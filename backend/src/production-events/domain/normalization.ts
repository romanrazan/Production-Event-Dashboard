import { createHash } from "node:crypto";
import { NormalizedProductionEvent, ProductionEventType } from "./model";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
  return `{${entries.join(",")}}`;
}

export function eventFingerprint(event: NormalizedProductionEvent): string {
  return createHash("sha256").update(canonicalJson(event)).digest("hex");
}

/** Equivalent offsets (e.g. +06:00 vs Z) normalize to the same UTC instant. */
export function normalizeTimestamp(value: string): string {
  return new Date(value).toISOString();
}

/**
 * Builds the canonical semantic form used for duplicate/conflict comparison:
 * trimmed identifiers, omitted nullable fields become explicit null, UTC timestamp.
 * Unknown extra fields are deliberately excluded; the raw payload is stored separately.
 */
export function normalizeEvent(event: {
  source_id: string;
  event_id: string;
  type: ProductionEventType;
  quantity: number | null;
  target_event_id: string | null;
  event_time: string;
}): NormalizedProductionEvent {
  return {
    source_id: event.source_id.trim(),
    event_id: event.event_id.trim(),
    type: event.type,
    quantity: event.type === "COUNT" ? event.quantity : null,
    target_event_id: event.type === "VOID" && event.target_event_id !== null ? event.target_event_id.trim() : null,
    event_time: normalizeTimestamp(event.event_time),
  };
}
