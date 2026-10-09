import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DataSource, DataSourceOptions } from "typeorm";
import { AppModule } from "../src/app.module";
import { dataSource } from "../src/database/data-source";
import { setup } from "../src/setup";

export interface IntegrationContext { app: INestApplication; db: DataSource }

export async function createIntegrationContext(): Promise<IntegrationContext> {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:55433/production_events_test";
  if (!new URL(url).pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL database name MUST end in _test; tests truncate all tables");
  process.env.MQTT_ENABLED = "false";
  process.env.MQTT_CANDIDATE_ID = "07";
  const db = new DataSource({ ...dataSource.options, type: "postgres", url } as DataSourceOptions);
  await db.initialize();
  await db.runMigrations();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DataSource)
    .useValue(db)
    .compile();
  const app = module.createNestApplication();
  setup(app);
  await app.init();
  return { app, db };
}

export async function resetDatabase(db: DataSource) {
  await db.query("TRUNCATE mqtt_challenges, submission_attempts, production_events, production_sources RESTART IDENTITY CASCADE");
}

export async function closeIntegrationContext(context: IntegrationContext) {
  await context.app.close();
  if (context.db.isInitialized) await context.db.destroy();
}

export const countEvent = (eventId = "EV-101", sourceId = "LINE-01", quantity = 5) => ({
  source_id: sourceId,
  event_id: eventId,
  type: "COUNT",
  quantity,
  target_event_id: null,
  event_time: "2026-10-09T10:30:00Z",
});

export const voidEvent = (eventId: string, targetEventId: string, sourceId = "LINE-01") => ({
  source_id: sourceId,
  event_id: eventId,
  type: "VOID",
  quantity: null,
  target_event_id: targetEventId,
  event_time: "2026-10-09T10:31:00Z",
});
