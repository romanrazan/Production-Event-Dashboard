import { BadRequestException, Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ProductionEventsService } from "./production-events.service";

@ApiTags("Production events")
@Controller("events")
export class ProductionEventsController {
  constructor(private readonly events: ProductionEventsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Process one event or an ordered event array with per-item results" })
  @ApiBody({ schema: { oneOf: [{ type: "object" }, { type: "array", items: { type: "object" } }] } })
  @ApiResponse({ status: 200, description: "Envelope accepted; individual items may be rejected" })
  @ApiResponse({ status: 400, description: "Top-level JSON is not an object or array" })
  async ingest(@Body() body: unknown) {
    if (body === null || (typeof body !== "object")) {
      throw new BadRequestException("Request body must be an event object or event array");
    }
    const items = Array.isArray(body) ? body : [body];
    return { results: await this.events.processBatch(items, { transport: "REST" }) };
  }
}
