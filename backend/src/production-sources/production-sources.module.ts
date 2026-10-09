import { Module } from "@nestjs/common";
import { ProductionSourcesRepository } from "./production-sources.repository";
import { ProductionSourcesService } from "./production-sources.service";

@Module({
  providers: [ProductionSourcesRepository, ProductionSourcesService],
  exports: [ProductionSourcesService],
})
export class ProductionSourcesModule {}
