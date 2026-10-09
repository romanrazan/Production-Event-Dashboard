import request from "supertest";
import { MqttService } from "../src/mqtt/mqtt.service";
import { closeIntegrationContext, countEvent, createIntegrationContext, IntegrationContext, resetDatabase } from "./integration-setup";

describe("MQTT challenge integration", () => {
  let context: IntegrationContext;
  let mqtt: MqttService;
  beforeAll(async () => { context = await createIntegrationContext(); mqtt = context.app.get(MqttService); });
  beforeEach(async () => resetDatabase(context.db));
  afterAll(async () => closeIntegrationContext(context));

  const challenge = (overrides: Record<string, unknown> = {}) => {
    const now = new Date();
    return {
      protocol_version: "1.0",
      candidate_id: "07",
      challenge_id: "CH-REPLAY",
      command: "PROCESS_EVENTS",
      sent_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 60_000).toISOString(),
      events: [countEvent("MQTT-COUNT")],
      ...overrides,
    };
  };

  test("identical delivery exactly replays stored response without new effects or attempts", async () => {
    const body = challenge();
    const first = await mqtt.handleMqttChallenge(body);
    expect(first.replayed).toBe(false);
    expect(first.response.status).toBe("COMPLETED");
    await request(context.app.getHttpServer()).post("/api/events").send(countEvent("LATER", "LINE-02", 9)).expect(200);
    const second = await mqtt.handleMqttChallenge(body);
    expect(second.replayed).toBe(true);
    expect(JSON.stringify(second.response)).toBe(JSON.stringify(first.response));
    expect(Number((await context.db.query("SELECT COUNT(*) AS count FROM submission_attempts WHERE challenge_id='CH-REPLAY'"))[0].count)).toBe(1);
    expect(Number((await context.db.query("SELECT COUNT(*) AS count FROM mqtt_challenges"))[0].count)).toBe(1);
  });

  test("same ID with changed body fails as CHALLENGE_CONFLICT and preserves history", async () => {
    const body = challenge();
    await mqtt.handleMqttChallenge(body);
    const conflict = await mqtt.handleMqttChallenge({ ...body, events: [countEvent("CHANGED")] });
    expect(conflict.response).toMatchObject({ status: "FAILED", error_code: "CHALLENGE_CONFLICT" });
    expect(Number((await context.db.query("SELECT COUNT(*) AS count FROM production_events"))[0].count)).toBe(1);
  });

  test("expired and candidate-mismatched unprocessed challenges fail durably", async () => {
    const expired = challenge({ challenge_id: "EXPIRED", expires_at: new Date(Date.now() - 1000).toISOString() });
    const mismatch = challenge({ challenge_id: "MISMATCH", candidate_id: "7" });
    expect((await mqtt.handleMqttChallenge(expired)).response).toMatchObject({ status: "FAILED", error_code: "CHALLENGE_EXPIRED" });
    expect((await mqtt.handleMqttChallenge(mismatch)).response).toMatchObject({ status: "FAILED", error_code: "CANDIDATE_MISMATCH" });
    expect(Number((await context.db.query("SELECT COUNT(*) AS count FROM mqtt_challenges WHERE status='FAILED'"))[0].count)).toBe(2);
  });

  test("invalid event item remains a COMPLETED challenge with an ordered REJECTED result", async () => {
    const handled = await mqtt.handleMqttChallenge(challenge({ challenge_id: "INVALID-ITEM", events: [42, countEvent("VALID")] }));
    expect(handled.response.status).toBe("COMPLETED");
    if (handled.response.status === "COMPLETED") {
      expect(handled.response.results.map((item) => item.status)).toEqual(["REJECTED", "ACCEPTED"]);
      expect(handled.response.state.net_total).toBe(5);
    }
  });

  test("change request: new responses carry seven state fields; an older stored response replays unchanged", async () => {
    const created = await mqtt.handleMqttChallenge(challenge({ challenge_id: "CH-SEVEN", events: [countEvent("S-1"), countEvent("S-BAD", "LINE-01", 501)] }));
    expect(created.response.status).toBe("COMPLETED");
    if (created.response.status === "COMPLETED") {
      expect(Object.keys(created.response.state)).toEqual(["net_total", "processed_events", "pending_ack", "unresolved", "duplicates", "conflicts", "rejected_submissions"]);
      expect(created.response.results.map((r) => r.status)).toEqual(["ACCEPTED", "REJECTED"]);
      expect(created.response.state).toMatchObject({ net_total: 5, rejected_submissions: 1 });
    }
    // Simulate a challenge persisted before the change request (six-field state) and confirm replay is byte-identical.
    const legacyBody = challenge({ challenge_id: "CH-LEGACY", events: [countEvent("L-1")] });
    const legacyResponse = JSON.stringify({ protocol_version: "1.0", candidate_id: "07", challenge_id: "CH-LEGACY", status: "COMPLETED",
      processed_at: "2026-10-09T10:00:00.000Z", results: [{ event_id: "L-1", status: "ACCEPTED", message: "COUNT processed" }],
      state: { net_total: 5, processed_events: 1, pending_ack: 1, unresolved: 0, duplicates: 0, conflicts: 0 } });
    const { createHash } = await import("node:crypto");
    const { canonicalJson } = await import("../src/production-events/domain/normalization");
    await context.db.query(
      "INSERT INTO mqtt_challenges (challenge_id, request_digest, request_payload, response_payload, status, processed_at, published_at) VALUES ($1,$2,$3::jsonb,$4,'COMPLETED',now(),now())",
      ["CH-LEGACY", createHash("sha256").update(canonicalJson(legacyBody)).digest("hex"), JSON.stringify(legacyBody), legacyResponse]);
    const replay = await mqtt.handleMqttChallenge(legacyBody);
    expect(replay.replayed).toBe(true);
    expect(JSON.stringify(replay.response)).toBe(legacyResponse);
  });
});
