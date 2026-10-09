import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { ProductionSourceEntity } from "./entities/production-source.entity";

@Injectable()
export class ProductionSourcesRepository {
  async ensure(sourceId: string, manager: EntityManager): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(ProductionSourceEntity)
      .values({ sourceId, displayName: sourceId })
      .orIgnore()
      .execute();
  }
}
