export interface StateSummary {
  net_total: number;
  processed_events: number;
  pending_ack: number;
  unresolved: number;
  duplicates: number;
  conflicts: number;
  rejected_submissions: number;
}

export type EventResultStatus = "ACCEPTED" | "DUPLICATE" | "CONFLICT" | "PENDING_REFERENCE" | "REJECTED";
export interface EventResult { event_id: string | null; status: EventResultStatus; message: string }
export interface EventResponse { results: EventResult[] }

export interface StateRow {
  id: string;
  event_id: string | null;
  source_id: string | null;
  type: string | null;
  quantity: number | null;
  target_event_id: string | null;
  event_time: string | null;
  received_at: string;
  status: string;
  reason: string | null;
  acknowledged_at?: string | null;
}

export interface AcknowledgementResult { event_id: string; status: "ACKED" | "ALREADY_ACKED" | "NOT_READY" | "NOT_FOUND"; message: string }
export interface AcknowledgementResponse { results: AcknowledgementResult[] }

export interface MqttStatus {
  enabled: boolean;
  connected: boolean;
  subscribed: boolean;
  broker_url: string;
  candidate_id: string;
  client_id: string | null;
  topics: { challenge: string; response: string; status: string };
  last_connected_at: string | null;
  last_heartbeat_at: string | null;
  reconnect_attempts: number;
  last_challenge_id: string | null;
  last_challenge_at: string | null;
  last_response_status: string | null;
  last_error: string | null;
  challenge_counts: { completed: number; failed: number; total: number; unpublished: number };
}

export interface DashboardSnapshot {
  summary: StateSummary;
  pending: StateRow[];
  exceptions: StateRow[];
  mqtt: MqttStatus;
  /** Source filter this snapshot was loaded for ("" = all sources). */
  sourceId: string;
}
