import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AcknowledgementsModule } from "./acknowledgements/acknowledgements.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { dataSource } from "./database/data-source";
import { MqttModule } from "./mqtt/mqtt.module";
import { ProductionEventsModule } from "./production-events/production-events.module";
import { StateModule } from "./state/state.module";

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSource.options),
    ProductionEventsModule,
    AcknowledgementsModule,
    StateModule,
    MqttModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
