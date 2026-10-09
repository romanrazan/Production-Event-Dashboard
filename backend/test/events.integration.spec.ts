import request from "supertest";
import { closeIntegrationContext, countEvent, createIntegrationContext, IntegrationContext, resetDatabase, voidEvent } from "./integration-setup";

describe("events and state integration", () => {
  let context: IntegrationContext;
  beforeAll(async () => { context = await createIntegrationContext(); });
  beforeEach(async () => resetDatabase(context.db));
  afterAll(async () => closeIntegrationContext(context));

  test("COUNT +5 updates the six-field durable summary", async () => {
    await request(context.app.getHttpServer()).post("/api/events").send(countEvent()).expect(200).expect({ results: [{ event_id: "EV-101", status: "ACCEPTED", message: "COUNT processed" }] });
    await request(context.app.getHttpServer()).get("/api/state?view=summary").expect(200).expect({ net_total: 5, processed_events: 1, pending_ack: 1, unresolved: 0, duplicates: 0, conflicts: 0, rejected_submissions: 0 });
  });

  test("identical resubmission is audited without double counting", async () => {
    const event = countEvent();
    await request(context.app.getHttpServer()).post("/api/events").send(event).expect(200);
    const duplicate = await request(context.app.getHttpServer()).post("/api/events").send(event).expect(200);
    expect(duplicate.body.results[0].status).toBe("DUPLICATE");
    const state = await request(context.app.getHttpServer()).get("/api/state?view=summary").expect(200);
    expect(state.body).toMatchObject({ net_total: 5, processed_events: 1, duplicates: 1 });
    expect(Number((await context.db.query("SELECT COUNT(*) AS count FROM submission_attempts"))[0].count)).toBe(2);
  });

  test("VOID before COUNT resolves automatically and both become completed", async () => {
    const pending = await request(context.app.getHttpServer()).post("/api/events").send(voidEvent("VOID-1", "COUNT-LATE")).expect(200);
    expect(pending.body.results[0].status).toBe("PENDING_REFERENCE");
    await request(context.app.getHttpServer()).post("/api/events").send(countEvent("COUNT-LATE")).expect(200);
    await request(context.app.getHttpServer()).get("/api/state?view=summary").expect(200).expect({ net_total: 0, processed_events: 2, pending_ack: 2, unresolved: 0, duplicates: 0, conflicts: 0, rejected_submissions: 0 });
  });

  test("mixed valid and invalid items preserve order and invalid audit evidence", async () => {
    const response = await request(context.app.getHttpServer()).post("/api/events").send([countEvent(), 42, { ...countEvent("BAD"), quantity: "5" }]).expect(200);
    expect(response.body.results.map((item: { status: string }) => item.status)).toEqual(["ACCEPTED", "REJECTED", "REJECTED"]);
    expect(response.body.results.map((item: { event_id: string | null }) => item.event_id)).toEqual(["EV-101", null, "BAD"]);
    expect(Number((await context.db.query("SELECT COUNT(*) AS count FROM submission_attempts WHERE classification='REJECTED'"))[0].count)).toBe(2);
    await request(context.app.getHttpServer()).post("/api/events").set("Content-Type", "application/json").send("null").expect(400);
    await request(context.app.getHttpServer()).post("/api/events").set("Content-Type", "application/json").send(JSON.stringify("bad")).expect(400);
  });

  test("changed payload and cross-source reuse conflict with the global event identity", async () => {
    await request(context.app.getHttpServer()).post("/api/events").send(countEvent()).expect(200);
    const changed = await request(context.app.getHttpServer()).post("/api/events").send(countEvent("EV-101", "LINE-01", 6)).expect(200);
    const crossSource = await request(context.app.getHttpServer()).post("/api/events").send(countEvent("EV-101", "LINE-02", 5)).expect(200);
    expect(changed.body.results[0].status).toBe("CONFLICT");
    expect(crossSource.body.results[0].status).toBe("CONFLICT");
    const filtered = await request(context.app.getHttpServer()).get("/api/state?view=summary&source_id=LINE-02").expect(200);
    expect(filtered.body).toMatchObject({ net_total: 0, conflicts: 1 });
  });
});
