import "reflect-metadata";
import "dotenv/config";
import { DataSource, DataSourceOptions } from "typeorm";
import { InitialProductionSchema1791511200000 } from "../../migrations/1791511200000-InitialProductionSchema";
import { WidenQuantityAndAuditIndexes1791600000000 } from "../../migrations/1791600000000-WidenQuantityAndAuditIndexes";
import { SubmissionAttemptEntity } from "../audit/entities/submission-attempt.entity";
import { ProductionEventEntity } from "../production-events/entities/production-event.entity";
import { ProductionSourceEntity } from "../production-sources/entities/production-source.entity";
import { MqttChallengeEntity } from "../mqtt/entities/mqtt-challenge.entity";

export function databaseOptions(): DataSourceOptions {
  const common = {
    type: "postgres" as const,
    entities: [ProductionSourceEntity, ProductionEventEntity, SubmissionAttemptEntity, MqttChallengeEntity],
    migrations: [InitialProductionSchema1791511200000, WidenQuantityAndAuditIndexes1791600000000],
    synchronize: false,
    logging: false,
  };
  if (process.env.DATABASE_URL) return { ...common, url: process.env.DATABASE_URL };
  return {
    ...common,
    host: process.env.DATABASE_HOST ?? "127.0.0.1",
    port: Number(process.env.DATABASE_PORT ?? 5432),
    username: process.env.DATABASE_USER ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "",
    database: process.env.DATABASE_NAME ?? "production_events",
  };
}

export const dataSource = new DataSource(databaseOptions());
