import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AcknowledgementsService } from "./acknowledgements.service";
import { AcknowledgeEventsDto } from "./dtos/acknowledge-events.dto";

@ApiTags("Acknowledgements")
@Controller("ack")
export class AcknowledgementsController {
  constructor(private readonly acknowledgements: AcknowledgementsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Acknowledge completed events, preserving request order" })
  async acknowledge(@Body() dto: AcknowledgeEventsDto) {
    return { results: await this.acknowledgements.acknowledgeEvents(dto.event_ids) };
  }
}
