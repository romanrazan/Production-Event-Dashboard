import request from "supertest";
import { closeIntegrationContext, countEvent, createIntegrationContext, IntegrationContext, resetDatabase, voidEvent } from "./integration-setup";

describe("concurrency and business edge cases", () => {
  let context: IntegrationContext;
  beforeAll(async () => { context = await createIntegrationContext(); });
  beforeEach(async () => resetDatabase(context.db));
  afterAll(async () => closeIntegrationContext(context));

  test("concurrent duplicate COUNT is accepted once", async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => request(context.app.getHttpServer()).post("/api/events").send(countEvent("CONCURRENT"))));
    expect(responses.every((item) => item.status === 200)).toBe(true);
    const statuses = responses.map((item) => item.body.results[0].status);
    expect(statuses.filter((status) => status === "ACCEPTED")).toHaveLength(1);
    expect(statuses.filter((status) => status === "DUPLICATE")).toHaveLength(7);
    expect((await request(context.app.getHttpServer()).get("/api/state?view=summary")).body.net_total).toBe(5);
  });

  test("concurrent COUNT and VOID serialize even when the target row was initially absent", async () => {
    const [count, correction] = await Promise.all([
      request(context.app.getHttpServer()).post("/api/events").send(countEvent("RACE-TARGET")),
      request(context.app.getHttpServer()).post("/api/events").send(voidEvent("RACE-VOID", "RACE-TARGET")),
    ]);
    expect(count.status).toBe(200);
    expect(correction.status).toBe(200);
    expect((await request(context.app.getHttpServer()).get("/api/state?view=summary")).body).toMatchObject({ net_total: 0, processed_events: 2, unresolved: 0 });
  });

  test("first stored valid pending VOID wins; cross-source and later competitors are rejected", async () => {
    await request(context.app.getHttpServer()).post("/api/events").send([
      voidEvent("WRONG-SOURCE", "TARGET", "LINE-02"),
      voidEvent("WINNER", "TARGET"),
      voidEvent("LOSER", "TARGET"),
    ]).expect(200);
    await request(context.app.getHttpServer()).post("/api/events").send(countEvent("TARGET")).expect(200);
    const rows = await context.db.query("SELECT event_id, status, reason FROM production_events WHERE type='VOID' ORDER BY id");
    expect(rows.map((row: { event_id: string; status: string }) => [row.event_id, row.status])).toEqual([
      ["WRONG-SOURCE", "REJECTED"], ["WINNER", "ACCEPTED"], ["LOSER", "REJECTED"],
    ]);
    expect((await request(context.app.getHttpServer()).get("/api/state?view=summary")).body.net_total).toBe(0);
  });

  test("target-type and second reversal rules create durable business rejections", async () => {
    await request(context.app.getHttpServer()).post("/api/events").send([countEvent("TARGET"), voidEvent("VOID-1", "TARGET")]).expect(200);
    const targetVoid = await request(context.app.getHttpServer()).post("/api/events").send(voidEvent("VOID-OF-VOID", "VOID-1")).expect(200);
    const second = await request(context.app.getHttpServer()).post("/api/events").send(voidEvent("VOID-2", "TARGET")).expect(200);
    expect(targetVoid.body.results[0]).toMatchObject({ status: "REJECTED", message: "VOID target must be a COUNT" });
    expect(second.body.results[0].status).toBe("REJECTED");
  });

  test("concurrent acknowledgement has one winner", async () => {
    await request(context.app.getHttpServer()).post("/api/events").send(countEvent()).expect(200);
    const responses = await Promise.all([
      request(context.app.getHttpServer()).post("/api/ack").send({ event_ids: ["EV-101"] }),
      request(context.app.getHttpServer()).post("/api/ack").send({ event_ids: ["EV-101"] }),
    ]);
    expect(responses.map((item) => item.body.results[0].status).sort()).toEqual(["ACKED", "ALREADY_ACKED"]);
  });

  test("health, Swagger and empty array contract remain available", async () => {
    await request(context.app.getHttpServer()).get("/api/health").expect(200, { status: "ok", database: "connected" });
    await request(context.app.getHttpServer()).get("/docs-json").expect(200);
    await request(context.app.getHttpServer()).post("/api/events").send([]).expect(200, { results: [] });
  });
});
