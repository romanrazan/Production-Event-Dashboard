import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { ProductionEventEntity } from "./entities/production-event.entity";

@Injectable()
export class ProductionEventsRepository {
  findByEventId(eventId: string, manager: EntityManager, lock = false) {
    const query = manager
      .getRepository(ProductionEventEntity)
      .createQueryBuilder("event")
      .where("event.event_id = :eventId", { eventId });
    if (lock) query.setLock("pessimistic_write");
    return query.getOne();
  }

  create(values: Partial<ProductionEventEntity>, manager: EntityManager) {
    return manager.save(ProductionEventEntity, manager.create(ProductionEventEntity, values));
  }

  save(event: ProductionEventEntity, manager: EntityManager) {
    return manager.save(ProductionEventEntity, event);
  }

  pendingVoids(targetEventId: string, manager: EntityManager) {
    return manager
      .getRepository(ProductionEventEntity)
      .createQueryBuilder("event")
      .where("event.type = 'VOID'")
      .andWhere("event.status = 'PENDING_REFERENCE'")
      .andWhere("event.target_event_id = :targetEventId", { targetEventId })
      .orderBy("event.id", "ASC")
      .setLock("pessimistic_write")
      .getMany();
  }

  async lockLogicalIds(ids: string[], manager: EntityManager): Promise<void> {
    for (const id of [...new Set(ids)].sort()) {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`production-event:${id}`]);
    }
  }
}
