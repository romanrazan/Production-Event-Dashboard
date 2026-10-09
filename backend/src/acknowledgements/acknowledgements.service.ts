import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { isAcknowledgementEligible } from "../production-events/domain/acknowledgement-policy";
import { ClockService } from "../shared/clock.service";
import { AcknowledgementsRepository } from "./acknowledgements.repository";

export type AcknowledgementStatus = "ACKED" | "ALREADY_ACKED" | "NOT_READY" | "NOT_FOUND";
export interface AcknowledgementResult { event_id: string; status: AcknowledgementStatus; message: string }

@Injectable()
export class AcknowledgementsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly acknowledgements: AcknowledgementsRepository,
    private readonly clock: ClockService,
  ) {}

  acknowledgeEvents(eventIds: string[]): Promise<AcknowledgementResult[]> {
    return this.dataSource.transaction((manager) => this.acknowledgeInTransaction(eventIds, manager));
  }

  private async acknowledgeInTransaction(eventIds: string[], manager: EntityManager) {
    const results: AcknowledgementResult[] = [];
    for (const eventId of eventIds) results.push(await this.acknowledgeEvent(eventId, manager));
    return results;
  }

  async acknowledgeEvent(eventId: string, manager: EntityManager): Promise<AcknowledgementResult> {
    await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`production-event:${eventId}`]);
    const event = await this.acknowledgements.findForUpdate(eventId, manager);
    if (!event) return { event_id: eventId, status: "NOT_FOUND", message: "No logical event has this ID" };
    if (!isAcknowledgementEligible(event)) return { event_id: eventId, status: "NOT_READY", message: "Event is not successfully completed" };
    if (event.acknowledgedAt) return { event_id: eventId, status: "ALREADY_ACKED", message: "Event was acknowledged earlier" };
    event.acknowledgedAt = this.clock.now();
    await this.acknowledgements.save(event, manager);
    return { event_id: eventId, status: "ACKED", message: "Event acknowledged" };
  }
}
