export const EVENT_TYPES = ["COUNT", "VOID"] as const;
export type ProductionEventType = (typeof EVENT_TYPES)[number];

export type LogicalEventStatus = "ACCEPTED" | "PENDING_REFERENCE" | "REJECTED";

export interface NormalizedProductionEvent {
  [key: string]: unknown;
  source_id: string;
  event_id: string;
  type: ProductionEventType;
  quantity: number | null;
  target_event_id: string | null;
  event_time: string;
}

export interface ValidationSuccess {
  ok: true;
  value: NormalizedProductionEvent;
}

export interface ValidationFailure {
  ok: false;
  eventId: string | null;
  sourceId: string | null;
  reason: string;
}

export type EventValidation = ValidationSuccess | ValidationFailure;
