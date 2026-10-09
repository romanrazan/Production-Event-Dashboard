import { ProductionEventEntity } from "../entities/production-event.entity";

/**
 * Single policy seam for the assessment's COUNT/VOID acknowledgement contradiction
 * (sections 6.2-6.3 vs section 9). Default fallback: every completed logical event,
 * COUNT or VOID, needs a manual acknowledgement and appears in Pending.
 *
 * To switch to "VOID is auto-acknowledged; only COUNT is pending", make both
 * definitions below also require type COUNT (and set acknowledged_at when a VOID
 * completes). Routes, MQTT and the frontend need no change.
 */
export function isAcknowledgementEligible(event: Pick<ProductionEventEntity, "status" | "type">): boolean {
  return event.status === "ACCEPTED" && (event.type === "COUNT" || event.type === "VOID");
}

/** SQL twin of isAcknowledgementEligible, used by the Pending view and the pending_ack metric. */
export function acknowledgementEligibleSql(alias: string): string {
  return `(${alias}.status = 'ACCEPTED' AND ${alias}.type IN ('COUNT','VOID'))`;
}
