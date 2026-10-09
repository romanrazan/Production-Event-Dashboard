import { MqttChallenge, MqttErrorCode } from "./mqtt-contracts";

export type ChallengeValidation =
  | { ok: true; value: MqttChallenge }
  | { ok: false; code: MqttErrorCode; message: string; challengeId: string | null };

const zonedDate = (value: unknown) => typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));

export function validateChallenge(raw: unknown, candidateId: string, now: Date): ChallengeValidation {
  const challengeId = raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as any).challenge_id === "string"
    ? (raw as any).challenge_id as string : null;
  const fail = (code: MqttErrorCode, message: string): ChallengeValidation => ({ ok: false, code, message, challengeId });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("VALIDATION_ERROR", "Challenge must be a JSON object");
  const value = raw as Record<string, unknown>;
  if (value.protocol_version !== "1.0") return fail("UNSUPPORTED_PROTOCOL", "protocol_version must be 1.0");
  if (value.candidate_id !== candidateId) return fail("CANDIDATE_MISMATCH", "candidate_id does not match this worker");
  if (typeof value.challenge_id !== "string" || value.challenge_id.trim() === "") return fail("VALIDATION_ERROR", "challenge_id must be a non-empty string");
  if (value.command !== "PROCESS_EVENTS") return fail("VALIDATION_ERROR", "command must be PROCESS_EVENTS");
  if (!zonedDate(value.sent_at) || !zonedDate(value.expires_at)) return fail("VALIDATION_ERROR", "sent_at and expires_at must be zoned ISO timestamps");
  if (!Array.isArray(value.events)) return fail("VALIDATION_ERROR", "events must be an array");
  if (new Date(value.expires_at as string).getTime() <= now.getTime()) return fail("CHALLENGE_EXPIRED", "Challenge expired before processing");
  return { ok: true, value: value as unknown as MqttChallenge };
}
