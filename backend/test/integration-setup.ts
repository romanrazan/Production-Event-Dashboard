import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DataSource, DataSourceOptions } from "typeorm";
import { AppModule } from "../src/app.module";
import { dataSource } from "../src/database/data-source";
import { setup } from "../src/setup";

export interface IntegrationContext { app: INestApplication; db: DataSource }

export interface IntegrationOptions {
  /** When set, the lifecycle-managed MQTT worker connects to this (local) broker. */
  mqttBrokerUrl?: string;
  heartbeatMs?: number;
}

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:55433/production_events_test";
  // Safety guard: these suites TRUNCATE every table, so only a database explicitly named *_test is allowed.
  if (!new URL(url).pathname.endsWith("_test")) throw new Error("TEST_DATABASE_URL database name MUST end in _test; tests truncate all tables");
  return url;
}

export async function createIntegrationContext(options: IntegrationOptions = {}): Promise<IntegrationContext> {
  const url = testDatabaseUrl();
  process.env.MQTT_ENABLED = options.mqttBrokerUrl ? "true" : "false";
  if (options.mqttBrokerUrl) process.env.MQTT_BROKER_URL = options.mqttBrokerUrl;
  process.env.MQTT_HEARTBEAT_MS = String(options.heartbeatMs ?? 30_000);
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
  await app.listen(0, "127.0.0.1");
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

/** Spawns the local aedes broker script on a free port; resolves once it is listening. */
export async function startLocalBroker(port?: number): Promise<{ url: string; port: number; stop: () => Promise<void> }> {
  const { spawn } = await import("node:child_process");
  const net = await import("node:net");
  const path = await import("node:path");
  const chosen = port ?? await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const free = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(free));
    });
  });
  const child = spawn(process.execPath, [path.join(__dirname, "..", "scripts", "local-mqtt-broker.mjs"), String(chosen), "--quiet"], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local broker did not start")), 10_000);
    child.stdout.on("data", (chunk: Buffer) => { if (chunk.toString().includes("READY")) { clearTimeout(timer); resolve(); } });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Local broker exited with ${code}`)); });
  });
  return {
    url: `mqtt://127.0.0.1:${chosen}`,
    port: chosen,
    stop: () => new Promise<void>((resolve) => {
      if (child.exitCode !== null) { resolve(); return; }
      child.once("exit", () => resolve());
      child.kill();
    }),
  };
}

export async function waitFor<T>(probe: () => Promise<T | null | undefined | false> | T | null | undefined | false, timeoutMs = 10_000, label = "condition"): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value as T;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
