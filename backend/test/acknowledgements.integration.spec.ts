import request from "supertest";
import { closeIntegrationContext, countEvent, createIntegrationContext, IntegrationContext, resetDatabase, voidEvent } from "./integration-setup";

describe("acknowledgement integration", () => {
  let context: IntegrationContext;
  beforeAll(async () => { context = await createIntegrationContext(); });
  beforeEach(async () => resetDatabase(context.db));
  afterAll(async () => closeIntegrationContext(context));

  test("repeated IDs and repeated requests are idempotent for COUNT and completed VOID", async () => {
    await request(context.app.getHttpServer()).post("/api/events").send([countEvent(), voidEvent("VOID-1", "EV-101")]).expect(200);
    const first = await request(context.app.getHttpServer()).post("/api/ack").send({ event_ids: ["EV-101", "EV-101", "VOID-1"] }).expect(200);
    expect(first.body.results.map((item: { status: string }) => item.status)).toEqual(["ACKED", "ALREADY_ACKED", "ACKED"]);
    const second = await request(context.app.getHttpServer()).post("/api/ack").send({ event_ids: ["EV-101", "VOID-1", "MISSING"] }).expect(200);
    expect(second.body.results.map((item: { status: string }) => item.status)).toEqual(["ALREADY_ACKED", "ALREADY_ACKED", "NOT_FOUND"]);
    expect((await request(context.app.getHttpServer()).get("/api/state?view=summary").expect(200)).body.pending_ack).toBe(0);
  });

  test("unresolved and business-rejected logical IDs are NOT_READY", async () => {
    await request(context.app.getHttpServer()).post("/api/events").send(voidEvent("PENDING", "NO-COUNT")).expect(200);
    await request(context.app.getHttpServer()).post("/api/events").send(countEvent("TARGET", "LINE-02")).expect(200);
    await request(context.app.getHttpServer()).post("/api/events").send(voidEvent("REJECTED", "TARGET", "LINE-01")).expect(200);
    const response = await request(context.app.getHttpServer()).post("/api/ack").send({ event_ids: ["PENDING", "REJECTED"] }).expect(200);
    expect(response.body.results.map((item: { status: string }) => item.status)).toEqual(["NOT_READY", "NOT_READY"]);
  });
});
