import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { acknowledgementEligibleSql } from "../production-events/domain/acknowledgement-policy";
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

const iso = (column: string) => `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

@Injectable()
export class StateRepository {
  /** One SQL statement = one snapshot, so the six values are mutually consistent. */
  async summary(sourceId: string | undefined, manager: EntityManager): Promise<StateSummary> {
    const rows = (await manager.query(
      `SELECT
        COALESCE((SELECT SUM(CASE WHEN e.type='COUNT' THEN e.quantity ELSE -target.quantity END)
          FROM production_events e LEFT JOIN production_events target ON target.event_id=e.target_event_id
          WHERE e.status='ACCEPTED' AND ($1::varchar IS NULL OR e.source_id=$1)), 0)::float8 AS net_total,
        (SELECT COUNT(*) FROM production_events e
          WHERE e.status='ACCEPTED' AND ($1::varchar IS NULL OR e.source_id=$1))::int AS processed_events,
        (SELECT COUNT(*) FROM production_events e
          WHERE ${acknowledgementEligibleSql("e")} AND e.acknowledged_at IS NULL
            AND ($1::varchar IS NULL OR e.source_id=$1))::int AS pending_ack,
        (SELECT COUNT(*) FROM production_events e
          WHERE e.status='PENDING_REFERENCE' AND ($1::varchar IS NULL OR e.source_id=$1))::int AS unresolved,
        (SELECT COUNT(*) FROM submission_attempts a
          WHERE a.classification='DUPLICATE' AND ($1::varchar IS NULL OR a.source_id=$1))::int AS duplicates,
        (SELECT COUNT(*) FROM submission_attempts a
          WHERE a.classification='CONFLICT' AND ($1::varchar IS NULL OR a.source_id=$1))::int AS conflicts`,
      [sourceId ?? null],
    )) as StateSummary[];
    const row = rows[0];
    if (!row) throw new Error("Summary query returned no row");
    return {
      net_total: Number(row.net_total),
      processed_events: row.processed_events,
      pending_ack: row.pending_ack,
      unresolved: row.unresolved,
      duplicates: row.duplicates,
      conflicts: row.conflicts,
    };
  }

  /** Completed, unacknowledged logical events under the acknowledgement policy. */
  async pending(sourceId: string | undefined, manager: EntityManager): Promise<StateRow[]> {
    return manager.query(
      `SELECT e.id::text AS id, e.event_id, e.source_id, e.type, e.quantity::float8 AS quantity, e.target_event_id,
          ${iso("e.event_time")} AS event_time, ${iso("e.received_at")} AS received_at, e.status, e.reason,
          ${iso("e.acknowledged_at")} AS acknowledged_at
       FROM production_events e
       WHERE ${acknowledgementEligibleSql("e")} AND e.acknowledged_at IS NULL
         AND ($1::varchar IS NULL OR e.source_id=$1)
       ORDER BY e.id ASC`,
      [sourceId ?? null],
    );
  }

  /**
   * Exceptions: unresolved VOID references, logical events rejected by business rules
   * (at submission or later during pending resolution), structurally invalid attempts
   * that never created a logical event, and conflicting attempts.
   */
  async exceptions(sourceId: string | undefined, manager: EntityManager): Promise<StateRow[]> {
    const rows = (await manager.query(
      `SELECT * FROM (
         SELECT ('event-' || e.id)::text AS id, e.event_id, e.source_id, e.type, e.quantity::float8 AS quantity,
            e.target_event_id, ${iso("e.event_time")} AS event_time, ${iso("e.received_at")} AS received_at,
            e.status, e.reason, e.received_at AS sort_at, e.id AS sort_id, 0 AS sort_kind
         FROM production_events e
         WHERE e.status IN ('PENDING_REFERENCE','REJECTED') AND ($1::varchar IS NULL OR e.source_id=$1)
         UNION ALL
         SELECT ('attempt-' || a.id)::text AS id, a.event_id, a.source_id,
            COALESCE(a.normalized_payload->>'type',
              CASE WHEN jsonb_typeof(a.raw_payload)='object' THEN a.raw_payload->>'type' END) AS type,
            CASE WHEN (a.normalized_payload->>'quantity') ~ '^[0-9]+$'
              THEN (a.normalized_payload->>'quantity')::float8 ELSE NULL END AS quantity,
            a.normalized_payload->>'target_event_id' AS target_event_id,
            a.normalized_payload->>'event_time' AS event_time,
            ${iso("a.received_at")} AS received_at, a.classification AS status, a.error AS reason,
            a.received_at AS sort_at, a.id AS sort_id, 1 AS sort_kind
         FROM submission_attempts a
         WHERE (a.classification = 'CONFLICT' OR (a.classification = 'REJECTED' AND a.normalized_payload IS NULL))
           AND ($1::varchar IS NULL OR a.source_id=$1)
       ) exceptions
       ORDER BY sort_at ASC, sort_kind ASC, sort_id ASC`,
      [sourceId ?? null],
    )) as Array<StateRow & { sort_at?: unknown; sort_id?: unknown; sort_kind?: unknown }>;
    return rows.map(({ sort_at: _at, sort_id: _id, sort_kind: _kind, ...row }) => row);
  }
}
