import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { EventResultStatus, SubmissionTransport } from "../shared/contracts";

export interface AttemptInput {
  eventId: string | null;
  sourceId: string | null;
  classification: EventResultStatus;
  error: string | null;
  rawPayload: unknown;
  normalizedPayload: Record<string, unknown> | null;
  transport: SubmissionTransport;
  challengeId: string | null;
}

@Injectable()
export class AuditRepository {
  /**
   * Raw payloads may be any JSON value, including null or a primitive batch item.
   * Serializing explicitly stores a JSON null literal instead of an SQL NULL, so even
   * `[null]` produces a durable REJECTED attempt rather than a constraint failure.
   */
  async create(input: AttemptInput, manager: EntityManager): Promise<string> {
    const rows = (await manager.query(
      `INSERT INTO submission_attempts
         (event_id, source_id, classification, error, raw_payload, normalized_payload, transport, challenge_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
       RETURNING id::text`,
      [
        input.eventId,
        input.sourceId,
        input.classification,
        input.error,
        JSON.stringify(input.rawPayload ?? null),
        input.normalizedPayload === null ? null : JSON.stringify(input.normalizedPayload),
        input.transport,
        input.challengeId,
      ],
    )) as Array<{ id: string }>;
    const id = rows[0]?.id;
    if (!id) throw new Error("Submission attempt insert returned no id");
    return id;
  }
}
