import { eventFingerprint } from "../src/production-events/domain/normalization";
import { isAcknowledgementEligible } from "../src/production-events/domain/acknowledgement-policy";
import { validateEvent } from "../src/production-events/domain/validation";
import { validateChallenge } from "../src/mqtt/protocol/challenge-validation";

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

  test.each(["2026-02-30T10:00:00Z", "2026-10-09T24:00:00Z", "2026-13-01T00:00:00Z", "2026-10-09T10:00:00+15:00", "2026-10-09", 1791511200000])(
    "rejects impossible or zone-less event_time %p",
    (eventTime) => {
      expect(validateEvent({ ...count, event_time: eventTime })).toMatchObject({ ok: false });
    },
  );

  test("VOID rules: quantity must be null/omitted and target must be a non-empty string", () => {
    const base = { source_id: "LINE-01", event_id: "V-1", type: "VOID", event_time: "2026-10-09T10:30:00Z" };
    expect(validateEvent({ ...base, target_event_id: "C-1" })).toMatchObject({ ok: true, value: { quantity: null, target_event_id: "C-1" } });
    expect(validateEvent({ ...base, target_event_id: "C-1", quantity: 5 })).toMatchObject({ ok: false });
    expect(validateEvent({ ...base, target_event_id: "  " })).toMatchObject({ ok: false });
    expect(validateEvent({ ...base, type: "void", target_event_id: "C-1" })).toMatchObject({ ok: false });
    expect(validateEvent({ ...count, target_event_id: "C-1" })).toMatchObject({ ok: false, eventId: "EV-101", sourceId: "LINE-01" });
  });

  test("extra fields do not change the semantic fingerprint", () => {
    const plain = validateEvent(count);
    const extra = validateEvent({ ...count, operator: "A" });
    expect(plain.ok && extra.ok && eventFingerprint(plain.value) === eventFingerprint(extra.value)).toBe(true);
  });

  test("acknowledgement policy: only completed logical events are eligible", () => {
    expect(isAcknowledgementEligible({ status: "ACCEPTED", type: "COUNT" })).toBe(true);
    expect(isAcknowledgementEligible({ status: "ACCEPTED", type: "VOID" })).toBe(true);
    expect(isAcknowledgementEligible({ status: "PENDING_REFERENCE", type: "VOID" })).toBe(false);
    expect(isAcknowledgementEligible({ status: "REJECTED", type: "VOID" })).toBe(false);
  });

  test("challenge validation uses stable error codes with an injected clock", () => {
    const now = new Date("2026-10-09T10:00:00Z");
    const challenge = {
      protocol_version: "1.0", candidate_id: "07", challenge_id: "CH-1", command: "PROCESS_EVENTS",
      sent_at: "2026-10-09T09:59:00Z", expires_at: "2026-10-09T10:01:00Z", events: [],
    };
    expect(validateChallenge(challenge, "07", now)).toMatchObject({ ok: true });
    expect(validateChallenge({ ...challenge, candidate_id: "7" }, "07", now)).toMatchObject({ ok: false, code: "CANDIDATE_MISMATCH" });
    expect(validateChallenge({ ...challenge, candidate_id: 7 }, "07", now)).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(validateChallenge({ ...challenge, protocol_version: "1.1" }, "07", now)).toMatchObject({ ok: false, code: "UNSUPPORTED_PROTOCOL" });
    expect(validateChallenge({ ...challenge, command: "OTHER" }, "07", now)).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(validateChallenge({ ...challenge, events: {} }, "07", now)).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(validateChallenge(challenge, "07", new Date("2026-10-09T10:01:00Z"))).toMatchObject({ ok: false, code: "CHALLENGE_EXPIRED" });
  });

  test("change request: COUNT quantity boundaries 1..500", () => {
    for (const ok of [1, 450, 500]) expect(validateEvent({ ...count, quantity: ok })).toMatchObject({ ok: true, value: { quantity: ok } });
    for (const bad of [0, -1, 501, 1000, 2.5, "450", true, null]) expect(validateEvent({ ...count, quantity: bad })).toMatchObject({ ok: false });
    expect(validateEvent({ ...count, quantity: 501 })).toMatchObject({ reason: "COUNT quantity 501 is outside the allowed range 1-500" });
  });
});
