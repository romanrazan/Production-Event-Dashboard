import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { MqttChallengeEntity } from "./entities/mqtt-challenge.entity";

@Injectable()
export class MqttRepository {
  async lockChallenge(challengeId: string, manager: EntityManager): Promise<void> {
    await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mqtt-challenge:${challengeId}`]);
  }

  find(challengeId: string, manager: EntityManager) {
    return manager.getRepository(MqttChallengeEntity).findOneBy({ challengeId });
  }

  /** Explicit JSON serialization keeps a `null` or non-object challenge body storable as JSON. */
  async create(values: Omit<MqttChallengeEntity, "receivedAt" | "updatedAt">, manager: EntityManager): Promise<void> {
    await manager.query(
      `INSERT INTO mqtt_challenges
         (challenge_id, request_digest, request_payload, response_payload, status, processed_at,
          publish_attempted_at, published_at, publish_error)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)`,
      [
        values.challengeId,
        values.requestDigest,
        JSON.stringify(values.requestPayload ?? null),
        values.responsePayload,
        values.status,
        values.processedAt,
        values.publishAttemptedAt,
        values.publishedAt,
        values.publishError,
      ],
    );
  }

  async recordPublish(challengeId: string, at: Date, error: string | null, manager: EntityManager): Promise<void> {
    await manager.query(
      `UPDATE mqtt_challenges
         SET publish_attempted_at = $2,
             publish_error = $3,
             published_at = CASE WHEN $3::text IS NULL THEN COALESCE(published_at, $2) ELSE published_at END,
             updated_at = now()
       WHERE challenge_id = $1`,
      [challengeId, at, error],
    );
  }

  async unpublished(limit: number, manager: EntityManager): Promise<Array<{ storageId: string; payload: string }>> {
    const rows = (await manager.query(
      `SELECT challenge_id, response_payload FROM mqtt_challenges
        WHERE published_at IS NULL AND response_payload IS NOT NULL
        ORDER BY received_at ASC, challenge_id ASC
        LIMIT $1`,
      [limit],
    )) as Array<{ challenge_id: string; response_payload: string }>;
    return rows.map((row) => ({ storageId: row.challenge_id, payload: row.response_payload }));
  }

  async challengeCounts(manager: EntityManager): Promise<{ completed: number; failed: number; total: number; unpublished: number }> {
    const rows = await manager.query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE status='FAILED')::int AS failed,
      COUNT(*) FILTER (WHERE published_at IS NULL)::int AS unpublished FROM mqtt_challenges`) as Array<{ completed: number; failed: number; total: number; unpublished: number }>;
    return rows[0] ?? { completed: 0, failed: 0, total: 0, unpublished: 0 };
  }
}
