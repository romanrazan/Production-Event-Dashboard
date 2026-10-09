import mqtt, { MqttClient } from "mqtt";
import request from "supertest";
import { MqttService } from "../src/mqtt/mqtt.service";
import { MqttWorkerService } from "../src/mqtt/mqtt-worker.service";
import {
  closeIntegrationContext, countEvent, createIntegrationContext, IntegrationContext, resetDatabase, startLocalBroker, waitFor,
} from "./integration-setup";

jest.setTimeout(60_000);

/**
 * Runs the real lifecycle-managed worker against a local aedes broker process.
 * This is LOCAL evidence only; it does not prove connectivity to the examiner broker.
 */
describe("MQTT worker against a local broker", () => {
  let broker: Awaited<ReturnType<typeof startLocalBroker>>;
  let context: IntegrationContext;
  let observer: MqttClient;
  const messages: Array<{ topic: string; body: Record<string, unknown> }> = [];

  const connectObserver = (url: string) => new Promise<MqttClient>((resolve, reject) => {
    const client = mqtt.connect(url, { clientId: `observer-${Date.now()}`, protocolVersion: 4, reconnectPeriod: 500 });
    client.on("message", (topic, payload) => messages.push({ topic, body: JSON.parse(payload.toString("utf8")) }));
    client.once("connect", () => client.subscribe(["fse-01/07/response", "fse-01/07/status"], { qos: 1 }, (error) => error ? reject(error) : resolve(client)));
  });

  const challenge = (id: string, events: unknown[]) => ({
    protocol_version: "1.0", candidate_id: "07", challenge_id: id, command: "PROCESS_EVENTS",
    sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60_000).toISOString(), events,
  });

  const responseFor = (id: string, nth = 1) => waitFor(() => {
    const found = messages.filter((m) => m.topic === "fse-01/07/response" && m.body.challenge_id === id);
    return found.length >= nth ? found[nth - 1]!.body : null;
  }, 15_000, `response ${id} #${nth}`);

  const status = async () => (await request(context.app.getHttpServer()).get("/api/mqtt/status").expect(200)).body;

  beforeAll(async () => {
    broker = await startLocalBroker();
    observer = await connectObserver(broker.url);
    context = await createIntegrationContext({ mqttBrokerUrl: broker.url, heartbeatMs: 1000 });
    await resetDatabase(context.db);
    await waitFor(async () => (await status()).subscribed, 10_000, "worker subscription");
  });

  afterAll(async () => {
    if (context) await closeIntegrationContext(context).catch(() => undefined);
    observer?.end(true);
    await broker?.stop();
  });

  test("publishes ONLINE, HEARTBEAT and a correlated QoS 1 response; replays exactly", async () => {
    await waitFor(() => messages.some((m) => m.topic === "fse-01/07/status" && m.body.status === "ONLINE"), 5000, "ONLINE");
    await waitFor(() => messages.some((m) => m.topic === "fse-01/07/status" && m.body.status === "HEARTBEAT"), 5000, "HEARTBEAT");

    const body = challenge("WORKER-1", [countEvent("W-1"), 42]);
    observer.publish("fse-01/07/challenge", JSON.stringify(body), { qos: 1 });
    const first = await responseFor("WORKER-1");
    expect(first).toMatchObject({ status: "COMPLETED", candidate_id: "07", state: { net_total: 5 } });
    expect((first.results as Array<{ status: string }>).map((r) => r.status)).toEqual(["ACCEPTED", "REJECTED"]);

    observer.publish("fse-01/07/challenge", JSON.stringify(body), { qos: 1 });
    const replay = await responseFor("WORKER-1", 2);
    expect(JSON.stringify(replay)).toBe(JSON.stringify(first));

    const current = await status();
    expect(current).toMatchObject({ enabled: true, connected: true, candidate_id: "07", last_challenge_id: "WORKER-1", last_response_status: "COMPLETED" });
    expect(current.client_id).toMatch(/^fse01-07-[0-9a-f]{6}$/);
    const published = await context.db.query("SELECT COUNT(*)::int AS n FROM mqtt_challenges WHERE published_at IS NOT NULL");
    expect(published[0].n).toBe(1);
  });

  test("reconnects with backoff and resubscribes after the broker restarts", async () => {
    await broker.stop();
    await waitFor(async () => !(await status()).connected, 10_000, "disconnect");
    broker = await startLocalBroker(broker.port);
    await waitFor(async () => (await status()).subscribed, 20_000, "resubscription");
    expect((await status()).reconnect_attempts).toBeGreaterThan(0);

    await waitFor(() => observer.connected, 10_000, "observer reconnect");
    await new Promise<void>((resolve, reject) => observer.subscribe(["fse-01/07/response", "fse-01/07/status"], { qos: 1 }, (e) => e ? reject(e) : resolve()));
    observer.publish("fse-01/07/challenge", JSON.stringify(challenge("WORKER-2", [countEvent("W-2", "LINE-01", 2)])), { qos: 1 });
    expect(await responseFor("WORKER-2")).toMatchObject({ status: "COMPLETED", state: { net_total: 7 } });
  });

  test("a stored but unpublished response is republished from durable storage", async () => {
    const service = context.app.get(MqttService);
    // Simulates "committed, then publish failed": the response exists only in PostgreSQL.
    const handled = await service.handleMqttChallenge(challenge("WORKER-UNPUBLISHED", [countEvent("W-3", "LINE-01", 1)]));
    await service.recordPublish(handled.storageId, "simulated broker failure");
    const before = await context.db.query("SELECT published_at, publish_error FROM mqtt_challenges WHERE challenge_id='WORKER-UNPUBLISHED'");
    expect(before[0]).toMatchObject({ published_at: null, publish_error: "simulated broker failure" });

    await context.app.get(MqttWorkerService).flushUnpublished();
    const republished = await responseFor("WORKER-UNPUBLISHED");
    expect(JSON.stringify(republished)).toBe(JSON.stringify(handled.response));
    const after = await context.db.query("SELECT published_at FROM mqtt_challenges WHERE challenge_id='WORKER-UNPUBLISHED'");
    expect(after[0].published_at).not.toBeNull();
  });

  test("clean shutdown publishes OFFLINE and closes the client", async () => {
    const closing = context;
    context = undefined as unknown as IntegrationContext;
    await closeIntegrationContext(closing);
    await waitFor(() => messages.some((m) => m.topic === "fse-01/07/status" && m.body.status === "OFFLINE"), 5000, "OFFLINE");
  });
});
