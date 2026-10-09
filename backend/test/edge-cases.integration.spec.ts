import request from "supertest";
import { MqttService } from "../src/mqtt/mqtt.service";
import {
  closeIntegrationContext, countEvent, createIntegrationContext, IntegrationContext, resetDatabase, voidEvent,
} from "./integration-setup";

jest.setTimeout(60_000);

describe("edge cases, concurrency and restart durability", () => {
  let context: IntegrationContext;
  const http = () => request(context.app.getHttpServer());
  const summary = async (sourceId?: string) =>
    (await http().get(`/api/state?view=summary${sourceId ? `&source_id=${sourceId}` : ""}`).expect(200)).body;

  beforeAll(async () => { context = await createIntegrationContext(); });
  beforeEach(async () => resetDatabase(context.db));
  afterAll(async () => closeIntegrationContext(context));

  test("primitive and null batch items are audited as REJECTED without failing the batch", async () => {
    const response = await http().post("/api/events").send([null, "text", true, [], countEvent()]).expect(200);
    expect(response.body.results.map((r: { status: string }) => r.status)).toEqual(["REJECTED", "REJECTED", "REJECTED", "REJECTED", "ACCEPTED"]);
    const rows = await context.db.query("SELECT raw_payload FROM submission_attempts WHERE classification='REJECTED' ORDER BY id");
    expect(rows.map((row: { raw_payload: unknown }) => row.raw_payload)).toEqual([null, "text", true, []]);
  });

  test("malformed JSON and primitive top-level envelopes return HTTP 400", async () => {
    await http().post("/api/events").set("Content-Type", "application/json").send("{bad json").expect(400);
    await http().post("/api/events").set("Content-Type", "application/json").send("42").expect(400);
    await http().post("/api/events").set("Content-Type", "application/json").send("true").expect(400);
    expect(Number((await context.db.query("SELECT COUNT(*) AS n FROM submission_attempts"))[0].n)).toBe(0);
  });

  test("invalid views and empty ACK lists are rejected by DTO validation", async () => {
    await http().get("/api/state?view=everything").expect(400);
    await http().get("/api/state").expect(400);
    await http().post("/api/ack").send({ event_ids: [] }).expect(400);
    await http().post("/api/ack").send({ event_ids: [5] }).expect(400);
  });

  test("quantities above PostgreSQL integer range are stored and summed exactly", async () => {
    await http().post("/api/events").send([countEvent("BIG-1", "LINE-01", 3_000_000_000), countEvent("BIG-2", "LINE-01", 4)]).expect(200);
    expect((await summary()).net_total).toBe(3_000_000_004);
    const pending = (await http().get("/api/state?view=pending").expect(200)).body;
    expect(pending[0].quantity).toBe(3_000_000_000);
  });

  test("cross-source VOID is rejected, reserves identity and is listed in exceptions", async () => {
    await http().post("/api/events").send(countEvent("TARGET", "LINE-01")).expect(200);
    const response = await http().post("/api/events").send(voidEvent("CROSS", "TARGET", "LINE-02")).expect(200);
    expect(response.body.results[0]).toMatchObject({ status: "REJECTED", message: "VOID source_id must match the target COUNT source_id" });
    expect((await summary()).net_total).toBe(5);
    const exceptions = (await http().get("/api/state?view=exceptions&source_id=LINE-02").expect(200)).body;
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]).toMatchObject({ event_id: "CROSS", status: "REJECTED" });
    // Resubmitting the same rejected logical event is a DUPLICATE of that rejected identity.
    expect((await http().post("/api/events").send(voidEvent("CROSS", "TARGET", "LINE-02")).expect(200)).body.results[0].status).toBe("DUPLICATE");
  });

  test("pending VOIDs rejected during resolution appear in exceptions with reasons", async () => {
    await http().post("/api/events").send([voidEvent("V-WIN", "T"), voidEvent("V-LOSE", "T"), voidEvent("V-OTHER", "T", "LINE-09")]).expect(200);
    expect((await summary()).unresolved).toBe(3);
    await http().post("/api/events").send(countEvent("T")).expect(200);
    expect(await summary()).toMatchObject({ net_total: 0, processed_events: 2, unresolved: 0 });
    const exceptions = (await http().get("/api/state?view=exceptions").expect(200)).body as Array<{ event_id: string; status: string; reason: string }>;
    expect(exceptions.map((row) => [row.event_id, row.status])).toEqual([["V-LOSE", "REJECTED"], ["V-OTHER", "REJECTED"]]);
    expect(exceptions[0]!.reason).toBe("Target COUNT was already reversed by V-WIN");
  });

  test("a pending VOID whose target arrives as a VOID is closed as REJECTED", async () => {
    await http().post("/api/events").send(voidEvent("V-OUTER", "V-INNER")).expect(200);
    await http().post("/api/events").send(countEvent("C-1")).expect(200);
    await http().post("/api/events").send(voidEvent("V-INNER", "C-1")).expect(200);
    const rows = await context.db.query("SELECT event_id, status, reason FROM production_events WHERE event_id='V-OUTER'");
    expect(rows[0]).toMatchObject({ status: "REJECTED", reason: "VOID target must be a COUNT" });
    expect(await summary()).toMatchObject({ net_total: 0, unresolved: 0 });
  });

  test("acknowledgement changes neither totals nor a later valid VOID", async () => {
    await http().post("/api/events").send(countEvent("ACKED-COUNT")).expect(200);
    await http().post("/api/ack").send({ event_ids: ["ACKED-COUNT"] }).expect(200);
    expect(await summary()).toMatchObject({ net_total: 5, processed_events: 1, pending_ack: 0 });
    expect((await http().post("/api/events").send(voidEvent("LATE-VOID", "ACKED-COUNT")).expect(200)).body.results[0].status).toBe("ACCEPTED");
    expect(await summary()).toMatchObject({ net_total: 0, processed_events: 2, pending_ack: 1 });
  });

  test("source-filtered summaries count duplicate/conflict attempts by attempted source", async () => {
    await http().post("/api/events").send([countEvent("A-1", "LINE-A", 4), countEvent("B-1", "LINE-B", 6)]).expect(200);
    await http().post("/api/events").send([countEvent("A-1", "LINE-A", 4), countEvent("A-1", "LINE-A", 4), countEvent("A-1", "LINE-B", 4)]).expect(200);
    await http().post("/api/events").send({ source_id: "LINE-A", event_id: "BAD-A", type: "COUNT", quantity: 0, event_time: "2026-10-09T10:30:00Z" }).expect(200);
    await http().post("/api/events").send([7]).expect(200);
    expect(await summary("LINE-A")).toEqual({ net_total: 4, processed_events: 1, pending_ack: 1, unresolved: 0, duplicates: 2, conflicts: 0 });
    expect(await summary("LINE-B")).toEqual({ net_total: 6, processed_events: 1, pending_ack: 1, unresolved: 0, duplicates: 0, conflicts: 1 });
    expect(await summary()).toEqual({ net_total: 10, processed_events: 2, pending_ack: 2, unresolved: 0, duplicates: 2, conflicts: 1 });
    const allExceptions = (await http().get("/api/state?view=exceptions").expect(200)).body;
    const lineA = (await http().get("/api/state?view=exceptions&source_id=LINE-A").expect(200)).body;
    expect(allExceptions).toHaveLength(3); // conflict, invalid LINE-A item, sourceless primitive
    expect(lineA.map((row: { event_id: string }) => row.event_id)).toEqual(["BAD-A"]);
  });

  test("competing concurrent VOIDs reverse one COUNT exactly once", async () => {
    await http().post("/api/events").send(countEvent("SHARED")).expect(200);
    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => http().post("/api/events").send(voidEvent(`COMPETE-${i}`, "SHARED"))));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    const statuses = responses.map((r) => r.body.results[0].status);
    expect(statuses.filter((s) => s === "ACCEPTED")).toHaveLength(1);
    expect(statuses.filter((s) => s === "REJECTED")).toHaveLength(9);
    expect(await summary()).toMatchObject({ net_total: 0, processed_events: 2 });
  });

  test("concurrent COUNT/VOID races with absent targets always converge", async () => {
    const pairs = Array.from({ length: 10 }, (_, i) => [
      http().post("/api/events").send(voidEvent(`RV-${i}`, `RC-${i}`)),
      http().post("/api/events").send(countEvent(`RC-${i}`)),
    ]).flat();
    const responses = await Promise.all(pairs);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(await summary()).toMatchObject({ net_total: 0, processed_events: 20, unresolved: 0 });
  });

  test("overlapping ACK requests in opposite orders do not deadlock", async () => {
    const ids = Array.from({ length: 6 }, (_, i) => `ACK-${i}`);
    await http().post("/api/events").send(ids.map((id) => countEvent(id))).expect(200);
    const reversed = [...ids].reverse();
    const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => http().post("/api/ack").send({ event_ids: i % 2 ? reversed : ids })));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    const acked = responses.flatMap((r) => r.body.results).filter((r: { status: string }) => r.status === "ACKED");
    expect(acked).toHaveLength(ids.length);
    expect((await summary()).pending_ack).toBe(0);
  });

  test("concurrent identical MQTT deliveries process once and return the same response", async () => {
    const mqtt = context.app.get(MqttService);
    const body = {
      protocol_version: "1.0", candidate_id: "07", challenge_id: "CONCURRENT-CH", command: "PROCESS_EVENTS",
      sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60_000).toISOString(), events: [countEvent("MQ-1")],
    };
    const handled = await Promise.all(Array.from({ length: 6 }, () => mqtt.handleMqttChallenge(body)));
    expect(handled.filter((h) => !h.replayed)).toHaveLength(1);
    expect(new Set(handled.map((h) => JSON.stringify(h.response))).size).toBe(1);
    expect((await summary()).net_total).toBe(5);
    expect(Number((await context.db.query("SELECT COUNT(*) AS n FROM submission_attempts"))[0].n)).toBe(1);
  });

  test("non-JSON MQTT payloads fail durably with VALIDATION_ERROR", async () => {
    const handled = await context.app.get(MqttService).handleMqttChallenge("not json at all");
    expect(handled.response).toMatchObject({ status: "FAILED", error_code: "VALIDATION_ERROR", challenge_id: null });
    expect(handled.storageId).toMatch(/^INVALID-/);
    const nullBody = await context.app.get(MqttService).handleMqttChallenge(null);
    expect(nullBody.response).toMatchObject({ status: "FAILED", error_code: "VALIDATION_ERROR" });
  });

  test("unsupported protocol versions fail with UNSUPPORTED_PROTOCOL", async () => {
    const handled = await context.app.get(MqttService).handleMqttChallenge({
      protocol_version: "2.0", candidate_id: "07", challenge_id: "PROTO", command: "PROCESS_EVENTS",
      sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60_000).toISOString(), events: [],
    });
    expect(handled.response).toMatchObject({ status: "FAILED", error_code: "UNSUPPORTED_PROTOCOL", challenge_id: "PROTO" });
  });

  test("both migrations are recorded", async () => {
    const rows = await context.db.query("SELECT name FROM migrations ORDER BY id");
    expect(rows.map((row: { name: string }) => row.name)).toEqual(["InitialProductionSchema1791511200000", "WidenQuantityAndAuditIndexes1791600000000"]);
  });

  test("data, acknowledgements and challenge history survive an application restart", async () => {
    const mqtt = context.app.get(MqttService);
    const body = {
      protocol_version: "1.0", candidate_id: "07", challenge_id: "RESTART-CH", command: "PROCESS_EVENTS",
      sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 2_000).toISOString(),
      events: [countEvent("R-1", "LINE-R", 8), voidEvent("R-V", "R-0", "LINE-R")],
    };
    const original = await mqtt.handleMqttChallenge(body);
    await http().post("/api/ack").send({ event_ids: ["R-1"] }).expect(200);
    const before = await summary();

    await closeIntegrationContext(context);
    await new Promise((resolve) => setTimeout(resolve, 2_100)); // the challenge is now expired
    context = await createIntegrationContext(); // fresh Nest app and fresh connection pool, same database

    expect(await summary()).toEqual(before);
    expect(before).toMatchObject({ net_total: 8, pending_ack: 0, unresolved: 1 });
    const replay = await context.app.get(MqttService).handleMqttChallenge(body);
    expect(replay.replayed).toBe(true); // replay takes precedence over expiry for an already handled challenge
    expect(JSON.stringify(replay.response)).toBe(JSON.stringify(original.response));
    expect((await http().post("/api/ack").send({ event_ids: ["R-1"] }).expect(200)).body.results[0].status).toBe("ALREADY_ACKED");
  });
});
