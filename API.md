# API reference

Base URL: `http://localhost:4000/api`. Swagger UI is at `http://localhost:4000/docs`. All bodies are JSON.
The three business endpoints (`POST /api/events`, `GET /api/state`, `POST /api/ack`) keep the exact paths from the assessment.

## Event contract

```json
{
  "source_id": "LINE-01",
  "event_id": "EV-101",
  "type": "COUNT",
  "quantity": 5,
  "target_event_id": null,
  "event_time": "2026-10-09T10:30:00Z"
}
```

| Field | Rule |
|---|---|
| `source_id` | non-empty string (trimmed), ≤120 chars |
| `event_id` | non-empty string (trimmed), ≤160 chars, **globally unique** across all sources |
| `type` | exactly `COUNT` or `VOID` (case-sensitive) |
| `quantity` | COUNT: a positive JS safe integer, so `"5"`, `1.5`, `true` and `0` are all rejected. VOID: `null` or omitted |
| `target_event_id` | COUNT: `null` or omitted. VOID: a non-empty string naming a COUNT, and not the VOID's own `event_id` |
| `event_time` | ISO 8601 date-time with an explicit zone (`Z` or `±hh:mm`). Calendar overflow (Feb 30, 24:00) is rejected. No freshness window |

Normalization for duplicate/conflict comparison: identifiers are trimmed, omitted nullable fields become `null`, and
`event_time` becomes a UTC instant, so `2026-10-09T16:30:00+06:00` equals `2026-10-09T10:30:00Z`. Unknown extra fields are ignored for
identity but kept in the stored raw payload. Server receipt time (`received_at`) is separate from `event_time`.

Business rules applied after validation:

- **VOID target rules:** a VOID whose target does not exist yet is stored as `PENDING_REFERENCE`. A VOID whose target is a VOID is `REJECTED` ("VOID target must be a COUNT"). A VOID from a different source than its target is `REJECTED`. A VOID of a COUNT that is already reversed is `REJECTED`.
- **Pending VOIDs:** when the target COUNT arrives, the first stored (lowest server-side id) same-source pending VOID wins and the other candidates are `REJECTED` with reasons. If the target arrives as a VOID, pending VOIDs that target it are `REJECTED`.

---

## POST /api/events

Body: one event object **or** an array of events. Items are processed in order inside one transaction.

**200** for any object or array envelope, including when some items are rejected:

```json
{
  "results": [
    { "event_id": "EV-101", "status": "ACCEPTED", "message": "COUNT processed" },
    { "event_id": null, "status": "REJECTED", "message": "Event must be a JSON object" },
    { "event_id": "EV-102", "status": "REJECTED", "message": "COUNT quantity must be a positive safe integer" }
  ]
}
```

- There is exactly one result per submitted item, in submission order. `event_id` is `null` when the item has no usable `event_id`.
- Item statuses: `ACCEPTED`, `DUPLICATE`, `CONFLICT`, `PENDING_REFERENCE`, `REJECTED`.
- `DUPLICATE` means the same `event_id` with identical normalized data. It has no effect on totals, and the attempt is still stored.
- `CONFLICT` means the same `event_id` with different normalized data, including reuse from another source. The original is preserved and the attempt is stored. An individual CONFLICT **never** produces HTTP 409.
- Every item attempt, whatever its status (primitives and `null` included), is stored in `submission_attempts`.
- **Empty array:** `[]` returns `200 {"results": []}` and stores nothing.

**400** for malformed JSON or a top-level envelope that is not an object or array (`null`, a string, a number, a boolean):

```json
{ "message": "Unexpected token ...", "error": "Bad Request", "statusCode": 400 }
```

Messages:

| Status | Message examples |
|---|---|
| ACCEPTED | `COUNT processed`, `VOID applied` |
| PENDING_REFERENCE | `Stored until the target COUNT arrives` |
| DUPLICATE | `Identical event already received; no effects repeated` |
| CONFLICT | `event_id already belongs to different normalized data` |
| REJECTED | validation reason, or `VOID target must be a COUNT`, `VOID source_id must match the target COUNT source_id`, `Target COUNT was already reversed by <id>` |

```bash
curl -X POST http://localhost:4000/api/events -H "Content-Type: application/json" -d '[{"source_id":"LINE-02","event_id":"V-1","type":"VOID","target_event_id":"C-1","event_time":"2026-10-09T10:40:00Z"},{"source_id":"LINE-02","event_id":"C-1","type":"COUNT","quantity":12,"event_time":"2026-10-09T10:39:00Z"}]'
```

The response is `PENDING_REFERENCE` for `V-1`, then `ACCEPTED` for `C-1`. `V-1` is resolved inside the same transaction.

---

## GET /api/state

Query: `view` = `summary` | `pending` | `exceptions` (required). `source_id` is optional. Any other `view` value returns **400**.

### view=summary

All six values come from **one SQL statement**, so they form a consistent snapshot.

```json
{ "net_total": 5, "processed_events": 1, "pending_ack": 1, "unresolved": 0, "duplicates": 0, "conflicts": 0 }
```

| Field | Definition |
|---|---|
| `net_total` | Σ accepted COUNT quantity − Σ quantity of COUNTs reversed by accepted VOIDs |
| `processed_events` | distinct completed (`ACCEPTED`) COUNT + VOID logical events. A pending VOID counts once it resolves |
| `pending_ack` | completed logical events not yet acknowledged, under the acknowledgement policy |
| `unresolved` | VOIDs still `PENDING_REFERENCE` |
| `duplicates` | number of stored DUPLICATE **attempts** |
| `conflicts` | number of stored CONFLICT **attempts** |

Source filtering applies the event's stored `source_id` to logical events and the *attempted* `source_id` to duplicate and conflict attempts.

### view=pending

Completed, unacknowledged logical events, oldest first:

```json
[
  { "id": "4", "event_id": "EV-101", "source_id": "LINE-01", "type": "COUNT", "quantity": 5, "target_event_id": null,
    "event_time": "2026-10-09T10:30:00.000Z", "received_at": "2026-10-09T07:11:06.128Z",
    "status": "ACCEPTED", "reason": null, "acknowledged_at": null }
]
```

### view=exceptions

Same row shape, without `acknowledged_at`. Includes:

- unresolved VOID references (`PENDING_REFERENCE`, reason `Target COUNT has not arrived`)
- logical events rejected by business rules, either at submission or later during pending resolution (`REJECTED` + reason)
- structurally invalid attempts that never created a logical event (`REJECTED`, `id` = `attempt-…`)
- conflicting attempts (`CONFLICT`)

Invalid attempts without a usable `source_id` appear only in the unfiltered view.

---

## POST /api/ack

```json
{ "event_ids": ["EV-101", "EV-101", "V-1", "NOPE"] }
```

**200**, with one result per requested ID in request order:

```json
{ "results": [
  { "event_id": "EV-101", "status": "ACKED", "message": "Event acknowledged" },
  { "event_id": "EV-101", "status": "ALREADY_ACKED", "message": "Event was acknowledged earlier" },
  { "event_id": "V-1", "status": "ACKED", "message": "Event acknowledged" },
  { "event_id": "NOPE", "status": "NOT_FOUND", "message": "No logical event has this ID" }
] }
```

| Status | When |
|---|---|
| `ACKED` | completed (COUNT or VOID) and not acknowledged before |
| `ALREADY_ACKED` | acknowledged earlier, including earlier in the same request |
| `NOT_READY` | a logical event exists but is `PENDING_REFERENCE` or `REJECTED` |
| `NOT_FOUND` | no logical event has this ID (e.g. only a malformed attempt was ever received) |

- Repeated and concurrent requests are safe. IDs are locked in sorted order, so overlapping requests in opposite orders cannot deadlock.
- Acknowledgement changes neither totals nor history, and does not block a later valid VOID.
- **400** if `event_ids` is missing, empty, contains non-strings, or has more than 1000 entries.

---

## Operational endpoints

### GET /api/health

Returns `200 {"status":"ok","database":"connected"}`. If the database is unreachable it returns **500**.

### GET /api/mqtt/status

```json
{
  "enabled": true, "connected": true, "subscribed": true,
  "broker_url": "mqtt://152.42.238.142:1883", "candidate_id": "07", "client_id": "fse01-07-8debc8",
  "topics": { "challenge": "fse-01/07/challenge", "response": "fse-01/07/response", "status": "fse-01/07/status" },
  "last_connected_at": "2026-10-09T07:14:28.576Z", "last_heartbeat_at": "2026-10-09T07:14:58.683Z", "reconnect_attempts": 0,
  "last_challenge_id": null, "last_challenge_at": null, "last_response_status": null, "last_error": null,
  "challenge_counts": { "total": 2, "completed": 1, "failed": 1, "unpublished": 0 }
}
```

`challenge_counts` come from PostgreSQL. The other fields are the live in-process worker state.

---

## MQTT protocol

Challenge, received on `fse-01/{candidate_id}/challenge`:

```json
{
  "protocol_version": "1.0", "candidate_id": "07", "challenge_id": "CH-001", "command": "PROCESS_EVENTS",
  "sent_at": "2026-10-09T10:30:00Z", "expires_at": "2026-10-09T10:31:00Z",
  "events": [ { "source_id": "LINE-01", "event_id": "EV-201", "type": "COUNT", "quantity": 5, "event_time": "2026-10-09T10:30:00Z" } ]
}
```

Completed response, published on `fse-01/{candidate_id}/response` (QoS 1, retain=false):

```json
{
  "protocol_version": "1.0", "candidate_id": "07", "challenge_id": "CH-001", "status": "COMPLETED",
  "processed_at": "2026-10-09T10:30:00.412Z",
  "results": [ { "event_id": "EV-201", "status": "ACCEPTED", "message": "COUNT processed" } ],
  "state": { "net_total": 5, "processed_events": 1, "pending_ack": 1, "unresolved": 0, "duplicates": 0, "conflicts": 0 }
}
```

Invalid event *items* become ordered `REJECTED` results, and the challenge is still `COMPLETED`.

Failed response:

```json
{ "protocol_version": "1.0", "candidate_id": "07", "challenge_id": "CH-001", "status": "FAILED",
  "processed_at": "2026-10-09T10:30:00.100Z", "error_code": "CHALLENGE_EXPIRED", "message": "Challenge expired before processing" }
```

| error_code | Cause | Persisted? |
|---|---|---|
| `VALIDATION_ERROR` | non-JSON or non-object body, missing or invalid `challenge_id`, `command`, timestamps, or `events` not an array | yes |
| `UNSUPPORTED_PROTOCOL` | `protocol_version` ≠ `"1.0"` | yes |
| `CANDIDATE_MISMATCH` | `candidate_id` ≠ configured ID (string comparison, so `"7"` ≠ `"07"`) | yes |
| `CHALLENGE_EXPIRED` | `expires_at` ≤ server time for a challenge **not handled before** | yes |
| `CHALLENGE_CONFLICT` | known `challenge_id` arriving with a different body | no (the original is preserved) |
| `INTERNAL_ERROR` | infrastructure failure; nothing committed, so a redelivery can succeed | no |

Replay vs. expiry precedence: an identical, already handled challenge replays its stored response (original `processed_at` and
original `state` snapshot) even after it has expired, without new effects or new submission attempts. Only an expired challenge
that was **never** handled fails with `CHALLENGE_EXPIRED`.

Status messages on `fse-01/{candidate_id}/status`:
`{"status":"ONLINE|HEARTBEAT|OFFLINE","candidate_id":"07","client_id":"fse01-07-…","at":"…"}`.
