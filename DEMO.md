# Examiner demo walkthrough

A repeatable walkthrough of about 10 minutes. It assumes PostgreSQL is up and migrated (`npm run db:migrate`).
Commands use `curl` from a bash shell. Every step can also be done in the dashboard at http://localhost:3001.

## 0. Who uses this

A production supervisor on the factory floor. Line devices (or operators) report `COUNT` events. Mistakes are corrected with `VOID`
events that reference the original COUNT. The supervisor watches net production, reviews completed events, and acknowledges them.
Exceptions (unresolved corrections, rejected or conflicting submissions) show why something did not count.

## 1. Start

Use three terminals:

```bash
npm run mqtt:broker
```

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

1. `npm run mqtt:broker` is only needed for the local MQTT demo in step 6. In that case set `MQTT_BROKER_URL=mqtt://127.0.0.1:1883`.
2. `npm run dev:backend` serves http://localhost:4000/docs (Swagger) and `/api/health`.
3. `npm run dev:frontend` serves http://localhost:3001.

Use a fresh source so the numbers start at zero:

```bash
export A=http://localhost:4000/api SRC=LINE-DEMO-$RANDOM
```

## 2. COUNT +5

```bash
curl -s -X POST $A/events -H 'Content-Type: application/json' -d "{\"source_id\":\"$SRC\",\"event_id\":\"$SRC-C1\",\"type\":\"COUNT\",\"quantity\":5,\"target_event_id\":null,\"event_time\":\"2026-10-09T10:30:00Z\"}"
curl -s "$A/state?view=summary&source_id=$SRC"
```

Expected: `ACCEPTED`, then `{"net_total":5,"processed_events":1,"pending_ack":1,"unresolved":0,"duplicates":0,"conflicts":0}`.

## 3. Duplicate without extra production

The resend below uses the same instant written as `+06:00` and omits `target_event_id`, so normalization makes it identical:

```bash
curl -s -X POST $A/events -H 'Content-Type: application/json' -d "{\"source_id\":\"$SRC\",\"event_id\":\"$SRC-C1\",\"type\":\"COUNT\",\"quantity\":5,\"event_time\":\"2026-10-09T16:30:00+06:00\"}"
curl -s "$A/state?view=summary&source_id=$SRC"
```

Expected: `DUPLICATE`, `net_total` still 5, `duplicates: 1`. If you change `quantity` to 6 you get `CONFLICT`, the original is kept, and `conflicts` goes up by 1.

## 4. VOID before its COUNT, then automatic resolution

```bash
curl -s -X POST $A/events -H 'Content-Type: application/json' -d "{\"source_id\":\"$SRC\",\"event_id\":\"$SRC-V1\",\"type\":\"VOID\",\"target_event_id\":\"$SRC-C2\",\"event_time\":\"2026-10-09T10:35:00Z\"}"
curl -s "$A/state?view=summary&source_id=$SRC"
curl -s "$A/state?view=exceptions&source_id=$SRC"
curl -s -X POST $A/events -H 'Content-Type: application/json' -d "[{\"source_id\":\"$SRC\",\"event_id\":\"$SRC-C2\",\"type\":\"COUNT\",\"quantity\":3,\"event_time\":\"2026-10-09T10:34:00Z\"},{\"source_id\":\"$SRC\",\"event_id\":\"$SRC-BAD\",\"type\":\"COUNT\",\"quantity\":\"5\",\"event_time\":\"2026-10-09T10:34:00Z\"}]"
curl -s "$A/state?view=summary&source_id=$SRC"
```

Expected:

1. The VOID is `PENDING_REFERENCE`, with `unresolved: 1`, and appears in Exceptions with "Target COUNT has not arrived".
2. The batch returns `ACCEPTED`, then `REJECTED` for the string quantity, in order, with partial success.
3. The final summary is `net_total: 5` (5 + 3 − 3), `processed_events: 3`, `unresolved: 0`, `pending_ack: 3`.

In the dashboard, the "VOID before COUNT" example button shows the same thing.

## 5. Acknowledge Pending rows

```bash
curl -s "$A/state?view=pending&source_id=$SRC"
curl -s -X POST $A/ack -H 'Content-Type: application/json' -d "{\"event_ids\":[\"$SRC-C1\",\"$SRC-C1\",\"$SRC-V1\",\"$SRC-C2\",\"$SRC-BAD\"]}"
curl -s "$A/state?view=summary&source_id=$SRC"
```

Expected: `ACKED`, `ALREADY_ACKED`, `ACKED`, `ACKED`, `NOT_FOUND` (the malformed item never created a logical event). After that, `pending_ack: 0` and
`net_total` stays 5, because acknowledgement never changes totals. In the dashboard, tick the rows (or "select all") and press **Acknowledge**.

## 6. MQTT challenge and response, plus an exception

**Local** (repeatable): with the broker and the backend from step 1 pointed at `mqtt://127.0.0.1:1883`:

```bash
npm run mqtt:simulate
```

It prints four correlated responses:

1. `COMPLETED` with ordered results (VOID-before-COUNT resolved inside the challenge, and an invalid item `REJECTED`) and the six-field state.
2. The identical redelivery, which replays byte-for-byte (`replay byte-identical to first response: true`) with no new effects.
3. The same `challenge_id` with a changed body, which returns `FAILED / CHALLENGE_CONFLICT`.
4. An expired challenge, which returns `FAILED / CHALLENGE_EXPIRED`.

The dashboard MQTT panel shows the last challenge ID and time, the response status, and the counters.

**Real examiner broker:** set `MQTT_BROKER_URL=mqtt://152.42.238.142:1883` and `MQTT_CANDIDATE_ID` to the assigned ID (default `07`),
restart the backend, and confirm the panel shows ONLINE with `fse-01/07/challenge`. Challenges sent by the examiner are processed and answered on
`fse-01/07/response`.

## 7. Restart and durable state

```bash
curl -s "$A/state?view=summary&source_id=$SRC"
```

Stop the backend (Ctrl+C, which publishes OFFLINE), then start it again:

```bash
npm run dev:backend
```

```bash
curl -s "$A/state?view=summary&source_id=$SRC"
```

The two summaries are identical. Re-running an already handled challenge (or redelivering it from the broker) replays the original stored response,
even after it has expired. ACK on the earlier IDs now returns `ALREADY_ACKED`.

## 8. Change one business rule in its owning function

Example: adopt §9 of the assessment, where VOIDs are auto-acknowledged and only COUNTs are pending.

Edit `backend/src/production-events/domain/acknowledgement-policy.ts`:

```ts
export function isAcknowledgementEligible(event) {
  return event.status === "ACCEPTED" && event.type === "COUNT";
}
export function acknowledgementEligibleSql(alias: string) {
  return `(${alias}.status = 'ACCEPTED' AND ${alias}.type = 'COUNT')`;
}
```

Restart. Now completed VOIDs no longer appear in Pending, `pending_ack` counts COUNTs only, and ACK on a VOID returns `NOT_READY`.
Routes, the MQTT worker and the dashboard did not change. (Update the two ACK tests that assert VOID acknowledgement.)

## Evidence captured during verification

- `docs/screenshots/dashboard-laptop.png` (1440 px) and `docs/screenshots/dashboard-mobile.png` (390 px): genuine headless-Chrome captures of the running app against the dev database.
