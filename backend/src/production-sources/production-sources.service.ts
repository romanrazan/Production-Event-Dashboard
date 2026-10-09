import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { ProductionSourcesRepository } from "./production-sources.repository";

@Injectable()
export class ProductionSourcesService {
  constructor(private readonly sources: ProductionSourcesRepository) {}
  ensure(sourceId: string, manager: EntityManager): Promise<void> {
    return this.sources.ensure(sourceId, manager);
  }
}
