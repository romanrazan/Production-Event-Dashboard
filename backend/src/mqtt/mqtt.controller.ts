import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { MqttWorkerService } from "./mqtt-worker.service";

@ApiTags("MQTT")
@Controller("mqtt")
export class MqttController {
  constructor(private readonly worker: MqttWorkerService) {}
  @Get("status")
  @ApiOperation({ summary: "Read live worker state plus durable challenge counts" })
  status() { return this.worker.getStatus(); }
}
