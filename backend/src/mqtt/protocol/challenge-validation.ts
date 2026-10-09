import { isZonedIsoTimestamp } from "../../production-events/domain/validation";
import { MqttChallenge, MqttErrorCode } from "./mqtt-contracts";

export type ChallengeValidation =
  | { ok: true; value: MqttChallenge }
  | { ok: false; code: MqttErrorCode; message: string; challengeId: string | null };

/**
 * Validates the complete challenge envelope before any event is processed.
 * Individual event items are NOT validated here: invalid items become ordered REJECTED
 * results inside a COMPLETED challenge, exactly as for REST batches.
 */
export function validateChallenge(raw: unknown, candidateId: string, now: Date): ChallengeValidation {
  const challengeId = raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as Record<string, unknown>).challenge_id === "string"
    ? (raw as Record<string, unknown>).challenge_id as string : null;
  const fail = (code: MqttErrorCode, message: string): ChallengeValidation => ({ ok: false, code, message, challengeId });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("VALIDATION_ERROR", "Challenge must be a JSON object");
  const value = raw as Record<string, unknown>;
  if (value.protocol_version !== "1.0") return fail("UNSUPPORTED_PROTOCOL", "protocol_version must be 1.0");
  if (typeof value.candidate_id !== "string") return fail("VALIDATION_ERROR", "candidate_id must be a string");
  if (value.candidate_id !== candidateId) return fail("CANDIDATE_MISMATCH", "candidate_id does not match this worker");
  if (typeof value.challenge_id !== "string" || value.challenge_id.trim() === "") return fail("VALIDATION_ERROR", "challenge_id must be a non-empty string");
  if (value.challenge_id.length > 180) return fail("VALIDATION_ERROR", "challenge_id must be at most 180 characters");
  if (value.command !== "PROCESS_EVENTS") return fail("VALIDATION_ERROR", "command must be PROCESS_EVENTS");
  if (!isZonedIsoTimestamp(value.sent_at) || !isZonedIsoTimestamp(value.expires_at)) {
    return fail("VALIDATION_ERROR", "sent_at and expires_at must be ISO 8601 timestamps with explicit timezone");
  }
  if (!Array.isArray(value.events)) return fail("VALIDATION_ERROR", "events must be an array");
  if (Date.parse(value.expires_at) <= now.getTime()) return fail("CHALLENGE_EXPIRED", "Challenge expired before processing");
  return { ok: true, value: value as unknown as MqttChallenge };
}
