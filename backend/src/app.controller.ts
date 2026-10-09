import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AppService } from "./app.service";

@ApiTags("Operations")
@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}
  @Get("health") health() { return this.app.health(); }
}
