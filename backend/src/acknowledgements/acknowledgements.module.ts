import { Module } from "@nestjs/common";
import { ProductionEventsModule } from "../production-events/production-events.module";
import { AcknowledgementsController } from "./acknowledgements.controller";
import { AcknowledgementsRepository } from "./acknowledgements.repository";
import { AcknowledgementsService } from "./acknowledgements.service";

@Module({
  imports: [ProductionEventsModule],
  controllers: [AcknowledgementsController],
  providers: [AcknowledgementsRepository, AcknowledgementsService],
  exports: [AcknowledgementsService],
})
export class AcknowledgementsModule {}
