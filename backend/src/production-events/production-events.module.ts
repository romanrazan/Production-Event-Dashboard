import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ProductionSourcesModule } from "../production-sources/production-sources.module";
import { ClockService } from "../shared/clock.service";
import { ProductionEventsRepository } from "./production-events.repository";
import { ProductionEventsService } from "./production-events.service";

@Module({
  imports: [AuditModule, ProductionSourcesModule],
  providers: [ProductionEventsRepository, ProductionEventsService, ClockService],
  exports: [ProductionEventsService, ProductionEventsRepository, ClockService],
})
export class ProductionEventsModule {}
