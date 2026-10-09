import { eventFingerprint } from "../src/production-events/domain/normalization";
import { validateEvent } from "../src/production-events/domain/validation";

describe("production event domain", () => {
  const count = {
    source_id: " LINE-01 ",
    event_id: " EV-101 ",
    type: "COUNT",
    quantity: 5,
    event_time: "2026-10-09T16:30:00+06:00",
  };

  test("normalizes identifiers, nullable fields and equivalent timestamp offsets", () => {
    const first = validateEvent(count);
    const second = validateEvent({ ...count, source_id: "LINE-01", event_id: "EV-101", target_event_id: null, event_time: "2026-10-09T10:30:00Z" });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value).toEqual(second.value);
      expect(eventFingerprint(first.value)).toBe(eventFingerprint(second.value));
    }
  });

  test.each(["5", 1.5, true, 0, -1, Number.MAX_SAFE_INTEGER + 1])("rejects invalid COUNT quantity %p", (quantity) => {
    expect(validateEvent({ ...count, quantity })).toMatchObject({ ok: false });
  });

  test("rejects timezone-free timestamps and self-target VOID", () => {
    expect(validateEvent({ ...count, event_time: "2026-10-09T10:30:00" })).toMatchObject({ ok: false });
    expect(validateEvent({ source_id: "LINE-01", event_id: "V-1", type: "VOID", target_event_id: "V-1", event_time: "2026-10-09T10:30:00Z" })).toMatchObject({ ok: false });
  });

  test("returns nullable identity for primitive input", () => {
    expect(validateEvent(42)).toEqual({ ok: false, eventId: null, sourceId: null, reason: "Event must be a JSON object" });
  });
});
