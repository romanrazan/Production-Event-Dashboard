export const EVENT_STATUSES = [
  "ACCEPTED",
  "DUPLICATE",
  "CONFLICT",
  "PENDING_REFERENCE",
  "REJECTED",
] as const;

export type EventResultStatus = (typeof EVENT_STATUSES)[number];

export interface EventResult {
  event_id: string | null;
  status: EventResultStatus;
  message: string;
}

export interface StateSummary {
  net_total: number;
  processed_events: number;
  pending_ack: number;
  unresolved: number;
  duplicates: number;
  conflicts: number;
}

export type SubmissionTransport = "REST" | "MQTT";
