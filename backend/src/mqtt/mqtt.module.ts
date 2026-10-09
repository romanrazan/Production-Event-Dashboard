import { Module } from "@nestjs/common";
import { ProductionEventsModule } from "../production-events/production-events.module";
import { StateModule } from "../state/state.module";
import { MqttController } from "./mqtt.controller";
import { MqttRepository } from "./mqtt.repository";
import { MqttService } from "./mqtt.service";
import { MqttWorkerService } from "./mqtt-worker.service";

@Module({
  imports: [ProductionEventsModule, StateModule],
  controllers: [MqttController],
  providers: [MqttRepository, MqttService, MqttWorkerService],
  exports: [MqttService],
})
export class MqttModule {}
