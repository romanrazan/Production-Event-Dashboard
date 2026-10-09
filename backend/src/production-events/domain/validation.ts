import { EventValidation } from "./model";
import { normalizeEvent } from "./normalization";

const ISO_WITH_ZONE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

function usableString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Strict ISO 8601 date-time with explicit zone; rejects calendar overflow such as Feb 30 or 24:00. */
export function isZonedIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_WITH_ZONE.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return false;
  if (match[8] && (Number(match[9]) > 14 || Number(match[10]) > 59)) return false;
  return !Number.isNaN(Date.parse(value));
}

function identityOf(raw: unknown): { eventId: string | null; sourceId: string | null } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { eventId: null, sourceId: null };
  }
  const record = raw as Record<string, unknown>;
  return {
    eventId: usableString(record.event_id) ? record.event_id.trim() : null,
    sourceId: usableString(record.source_id) ? record.source_id.trim() : null,
  };
}

export function validateEvent(raw: unknown): EventValidation {
  const identity = identityOf(raw);
  const fail = (reason: string): EventValidation => ({ ok: false, ...identity, reason });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("Event must be a JSON object");
  const event = raw as Record<string, unknown>;
  if (!usableString(event.source_id)) return fail("source_id must be a non-empty string");
  if (!usableString(event.event_id)) return fail("event_id must be a non-empty string");
  if (event.source_id.trim().length > 120) return fail("source_id must be at most 120 characters");
  if (event.event_id.trim().length > 160) return fail("event_id must be at most 160 characters");
  if (event.type !== "COUNT" && event.type !== "VOID") return fail("type must be exactly COUNT or VOID");
  if (!isZonedIsoTimestamp(event.event_time)) {
    return fail("event_time must be a valid ISO 8601 timestamp with an explicit timezone");
  }

  if (event.type === "COUNT") {
    if (!Number.isSafeInteger(event.quantity) || (event.quantity as number) <= 0) {
      return fail("COUNT quantity must be a positive safe integer");
    }
    if (event.target_event_id !== undefined && event.target_event_id !== null) {
      return fail("COUNT target_event_id must be null or omitted");
    }
  } else {
    if (event.quantity !== undefined && event.quantity !== null) return fail("VOID quantity must be null or omitted");
    if (!usableString(event.target_event_id)) return fail("VOID target_event_id must be a non-empty string");
    if (event.target_event_id.trim().length > 160) return fail("target_event_id must be at most 160 characters");
    if (event.target_event_id.trim() === event.event_id.trim()) return fail("VOID cannot target itself");
  }

  return {
    ok: true,
    value: normalizeEvent({
      source_id: event.source_id,
      event_id: event.event_id,
      type: event.type,
      quantity: event.type === "COUNT" ? (event.quantity as number) : null,
      target_event_id: event.type === "VOID" ? (event.target_event_id as string) : null,
      event_time: event.event_time,
    }),
  };
}
