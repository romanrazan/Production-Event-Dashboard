import { createHash } from "node:crypto";
import { NormalizedProductionEvent } from "./model";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
  return `{${entries.join(",")}}`;
}

export function eventFingerprint(event: NormalizedProductionEvent): string {
  return createHash("sha256").update(canonicalJson(event)).digest("hex");
}

export function normalizeTimestamp(value: string): string {
  return new Date(value).toISOString();
}
