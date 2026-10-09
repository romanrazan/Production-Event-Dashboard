import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { StateQueryDto, StateSummaryDto } from "./dtos/state-query.dto";
import { StateService } from "./state.service";

@ApiTags("Production state")
@Controller("state")
export class StateController {
  constructor(private readonly state: StateService) {}

  @Get()
  @ApiOperation({ summary: "Read durable summary, pending acknowledgement, or exception state" })
  @ApiOkResponse({ description: "view=summary returns StateSummaryDto; pending/exceptions return event rows", type: StateSummaryDto })
  get(@Query() query: StateQueryDto) {
    if (query.view === "summary") return this.state.getSummary(query.source_id);
    if (query.view === "pending") return this.state.getPending(query.source_id);
    return this.state.getExceptions(query.source_id);
  }
}
