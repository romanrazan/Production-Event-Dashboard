import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { ProductionEventEntity } from "../production-events/entities/production-event.entity";

@Injectable()
export class AcknowledgementsRepository {
  findForUpdate(eventId: string, manager: EntityManager) {
    return manager
      .getRepository(ProductionEventEntity)
      .createQueryBuilder("event")
      .where("event.event_id = :eventId", { eventId })
      .setLock("pessimistic_write")
      .getOne();
  }

  save(event: ProductionEventEntity, manager: EntityManager) {
    return manager.save(ProductionEventEntity, event);
  }
}
