import { EventValidation, NormalizedProductionEvent } from "./model";
import { normalizeTimestamp } from "./normalization";

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function usableString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
  if (event.type !== "COUNT" && event.type !== "VOID") return fail("type must be exactly COUNT or VOID");
  if (typeof event.event_time !== "string" || !ISO_WITH_ZONE.test(event.event_time) || Number.isNaN(Date.parse(event.event_time))) {
    return fail("event_time must be a valid ISO 8601 timestamp with an explicit timezone");
  }

  const normalized: NormalizedProductionEvent = {
    source_id: event.source_id.trim(),
    event_id: event.event_id.trim(),
    type: event.type,
    quantity: event.quantity === undefined ? null : (event.quantity as number | null),
    target_event_id: event.target_event_id === undefined ? null : (event.target_event_id as string | null),
    event_time: normalizeTimestamp(event.event_time),
  };

  if (normalized.type === "COUNT") {
    if (!Number.isSafeInteger(event.quantity) || (event.quantity as number) <= 0) {
      return fail("COUNT quantity must be a positive safe integer");
    }
    if (normalized.target_event_id !== null) return fail("COUNT target_event_id must be null or omitted");
    normalized.quantity = event.quantity as number;
  } else {
    if (normalized.quantity !== null) return fail("VOID quantity must be null or omitted");
    if (!usableString(event.target_event_id)) return fail("VOID target_event_id must be a non-empty string");
    normalized.target_event_id = event.target_event_id.trim();
    if (normalized.target_event_id === normalized.event_id) return fail("VOID cannot target itself");
  }
  return { ok: true, value: normalized };
}
