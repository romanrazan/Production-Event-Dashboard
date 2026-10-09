import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { StateSummary } from "../shared/contracts";

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

@Injectable()
export class StateRepository {
  async summary(sourceId: string | undefined, manager: EntityManager): Promise<StateSummary> {
    const params = sourceId ? [sourceId] : [];
    const eventFilter = sourceId ? "AND e.source_id = $1" : "";
    const attemptFilter = sourceId ? "AND a.source_id = $1" : "";
    const rows = await manager.query(
      `SELECT
        COALESCE((SELECT SUM(CASE WHEN e.type='COUNT' THEN e.quantity ELSE -target.quantity END)::int
          FROM production_events e LEFT JOIN production_events target ON target.event_id=e.target_event_id
          WHERE e.status='ACCEPTED' ${eventFilter}), 0)::int AS net_total,
        (SELECT COUNT(*)::int FROM production_events e WHERE e.status='ACCEPTED' ${eventFilter}) AS processed_events,
        (SELECT COUNT(*)::int FROM production_events e WHERE e.status='ACCEPTED' AND e.acknowledged_at IS NULL ${eventFilter}) AS pending_ack,
        (SELECT COUNT(*)::int FROM production_events e WHERE e.status='PENDING_REFERENCE' ${eventFilter}) AS unresolved,
        (SELECT COUNT(*)::int FROM submission_attempts a WHERE a.classification='DUPLICATE' ${attemptFilter}) AS duplicates,
        (SELECT COUNT(*)::int FROM submission_attempts a WHERE a.classification='CONFLICT' ${attemptFilter}) AS conflicts`,
      params,
    ) as StateSummary[];
    return rows[0] ?? { net_total: 0, processed_events: 0, pending_ack: 0, unresolved: 0, duplicates: 0, conflicts: 0 };
  }

  async pending(sourceId: string | undefined, manager: EntityManager): Promise<StateRow[]> {
    return manager.query(
      `SELECT id::text, event_id, source_id, type, quantity, target_event_id,
        event_time::text, received_at::text, status, reason, acknowledged_at::text
       FROM production_events
       WHERE status='ACCEPTED' AND acknowledged_at IS NULL
         AND ($1::varchar IS NULL OR source_id=$1)
       ORDER BY id ASC`,
      [sourceId ?? null],
    );
  }

  async exceptions(sourceId: string | undefined, manager: EntityManager): Promise<StateRow[]> {
    return manager.query(
      `SELECT ('event-' || e.id)::text AS id, e.event_id, e.source_id, e.type, e.quantity,
          e.target_event_id, e.event_time::text, e.received_at::text, e.status, e.reason
       FROM production_events e
       WHERE e.status='PENDING_REFERENCE' AND ($1::varchar IS NULL OR e.source_id=$1)
       UNION ALL
       SELECT ('attempt-' || a.id)::text AS id, a.event_id, a.source_id,
          a.normalized_payload->>'type' AS type,
          CASE WHEN (a.normalized_payload->>'quantity') ~ '^[0-9]+$' THEN (a.normalized_payload->>'quantity')::int ELSE NULL END AS quantity,
          a.normalized_payload->>'target_event_id' AS target_event_id,
          a.normalized_payload->>'event_time' AS event_time,
          a.received_at::text, a.classification AS status, a.error AS reason
       FROM submission_attempts a
       WHERE a.classification IN ('REJECTED','CONFLICT')
         AND ($1::varchar IS NULL OR a.source_id=$1)
       ORDER BY received_at ASC, id ASC`,
      [sourceId ?? null],
    );
  }
}
