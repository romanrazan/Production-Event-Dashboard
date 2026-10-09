import { ProductionEventEntity } from "../entities/production-event.entity";

/** Single policy seam for the assessment's COUNT/VOID acknowledgement contradiction. */
export function isAcknowledgementEligible(event: Pick<ProductionEventEntity, "status" | "type">): boolean {
  return event.status === "ACCEPTED" && (event.type === "COUNT" || event.type === "VOID");
}
