import { EventResult, StateSummary } from "../../shared/contracts";

export const MQTT_ERROR_CODES = [
  "VALIDATION_ERROR", "CANDIDATE_MISMATCH", "UNSUPPORTED_PROTOCOL",
  "CHALLENGE_EXPIRED", "CHALLENGE_CONFLICT", "INTERNAL_ERROR",
] as const;
export type MqttErrorCode = (typeof MQTT_ERROR_CODES)[number];

export interface MqttChallenge {
  protocol_version: "1.0";
  candidate_id: string;
  challenge_id: string;
  command: "PROCESS_EVENTS";
  sent_at: string;
  expires_at: string;
  events: unknown[];
}

export interface MqttCompletedResponse {
  protocol_version: "1.0";
  candidate_id: string;
  challenge_id: string;
  status: "COMPLETED";
  processed_at: string;
  results: EventResult[];
  state: StateSummary;
}

export interface MqttFailedResponse {
  protocol_version: "1.0";
  candidate_id: string;
  challenge_id: string | null;
  status: "FAILED";
  processed_at: string;
  error_code: MqttErrorCode;
  message: string;
}

export type MqttResponse = MqttCompletedResponse | MqttFailedResponse;
