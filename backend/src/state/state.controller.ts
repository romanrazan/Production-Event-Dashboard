import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StateQueryDto } from "./dtos/state-query.dto";
import { StateService } from "./state.service";

@ApiTags("Production state")
@Controller("state")
export class StateController {
  constructor(private readonly state: StateService) {}

  @Get()
  @ApiOperation({ summary: "Read durable summary, pending acknowledgement, or exception state" })
  get(@Query() query: StateQueryDto) {
    if (query.view === "summary") return this.state.getSummary(query.source_id);
    if (query.view === "pending") return this.state.getPending(query.source_id);
    return this.state.getExceptions(query.source_id);
  }
}
