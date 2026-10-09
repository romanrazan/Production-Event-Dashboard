# Technical explanation

## 1. Requirement conflicts and chosen assumptions

No examiner clarification was supplied, so the fallback assumptions mandated by the implementation brief apply.

| # | Contradiction in the assessment | Implemented fallback | Where it lives |
|---|---|---|---|
| A | §5.1: `event_id` is globally unique. §7 suggests `unique(source_id, event_id)` | **Global uniqueness.** `uq_production_events_event_id UNIQUE (event_id)`. Reusing an ID from another source is a `CONFLICT` | migration 1791511200000 |
| B | §5.2/§6.1: valid batch items succeed despite invalid ones. §7: roll back the whole batch on validation failure | **Ordered partial success.** Invalid items get `REJECTED` results and durable attempt rows; valid items commit | `ProductionEventsService.processBatch` |
| C | §6.2–6.3: completed COUNT **and** VOID await manual acknowledgement. §9: completed VOID is auto-acknowledged and only COUNT is pending | **Manual acknowledgement for both**, following the explicit REST/state contract. Pending lists both | `domain/acknowledgement-policy.ts` |

Fallback C contradicts §9. To switch to the §9 behaviour, change `isAcknowledgementEligible` and its SQL twin
`acknowledgementEligibleSql` in that single file so they also require `type = 'COUNT'`, and stamp `acknowledged_at` when a VOID
completes. Routes, MQTT and the frontend read the policy indirectly and need no change.

Other documented decisions:

- **Candidate ID** defaults to the string `"07"`, which preserves the leading zero. It is configurable through `MQTT_CANDIDATE_ID`. `CAND-017` from the example is not used.
- **Rejected identities.** A structurally valid object that is rejected by a business rule (cross-source VOID, VOID of a VOID, second reversal, a pending VOID that lost) **reserves** its `event_id` as a `REJECTED` logical event. ACK on it returns `NOT_READY`, and re-sending the same payload is a `DUPLICATE`. A structurally invalid attempt does **not** create a logical event, so ACK returns `NOT_FOUND`. It exists only in `submission_attempts`.
- **"First stored" pending VOID** means the lowest server-assigned `production_events.id` (bigserial). Assignment is serialized by the advisory lock on the target ID, so it is deterministic. `event_time` is never used to pick a winner.
- **Empty array** `POST /api/events []` returns `200 {"results": []}`.

## 2. Entity model

```
production_sources (source_id PK, display_name, created_at)
        ▲ FK
production_events  (id bigserial PK, event_id UNIQUE, source_id FK, type CHECK, quantity bigint,
                    target_event_id (no FK: a VOID may precede its COUNT), event_time timestamptz,
                    received_at, status CHECK(ACCEPTED|PENDING_REFERENCE|REJECTED), reason,
                    normalized_payload jsonb, payload_fingerprint sha256, raw_payload jsonb,
                    reversed_by_event_id, completed_at, acknowledged_at, updated_at)
submission_attempts (id bigserial, event_id?, source_id?, classification CHECK, error, raw_payload jsonb,
                    normalized_payload jsonb?, transport REST|MQTT, challenge_id?, received_at)
mqtt_challenges    (challenge_id PK, request_digest sha256, request_payload jsonb, response_payload text (exact bytes),
                    status PROCESSING|COMPLETED|FAILED, received_at, processed_at,
                    publish_attempted_at, published_at, publish_error, updated_at)
```

Constraints that enforce invariants **in PostgreSQL**, not only in application code:

- `UNIQUE (event_id)`: one logical event per ID, globally.
- `ck_production_event_shape`: a COUNT has `quantity > 0` and no target. A VOID has no quantity and has a target.
- `ck_production_event_quantity_safe`: quantity ≤ 2^53−1 (the column is `bigint`, migration 1791600000000).
- `uq_successful_void_target`: a partial unique index on `target_event_id WHERE type='VOID' AND status='ACCEPTED'`, so **at most one successful reversal per COUNT**.
- `uq_production_events_reversed_by`: each VOID reverses at most one COUNT.
- `mqtt_challenges.challenge_id` PK: one stored response per challenge.
- `CHECK` constraints on all status, classification and transport columns. Timestamps are `timestamptz`.

History is never deleted. Corrections are new VOID rows, and status changes (`PENDING_REFERENCE → ACCEPTED/REJECTED`, acknowledgement) update
the logical row, while every received item is preserved verbatim in `submission_attempts`.

## 3. Module boundaries

Controllers handle transport and validation of the envelope. Services own workflows. Repositories own SQL and TypeORM and always take the
caller's `EntityManager`, so they run inside the caller's transaction.

| Module | Responsibility |
|---|---|
| `production-events` | `validateEvent` / `normalizeEvent` (domain), `processBatch`, `processEvent`, `processCount`, `processVoid`, `resolvePendingVoids` |
| `audit` | `AuditService.record`, one row per received item |
| `production-sources` | upserts the source row |
| `state` | `getSummary`, `getPending`, `getExceptions`, using one-statement snapshots |
| `acknowledgements` | `acknowledgeEvents` → `acknowledgeEvent` under the policy |
| `mqtt` | `validateChallenge`, `handleMqttChallenge` (atomic process + persist), and `MqttWorkerService` (connection lifecycle) |

**REST and MQTT call the same `ProductionEventsService.processBatch` and `StateService.getSummary`.** The MQTT path passes its
transaction's `EntityManager`, so processing, attempts and the stored response share one transaction with no nested independent transaction.
The frontend only displays backend decisions. It never computes totals or resolves VOIDs.

Why the global `ValidationPipe` does not reject mixed batches: `POST /api/events` takes `@Body() body: unknown`. The controller checks only the
top-level envelope (object or array, otherwise 400), and every item is validated inside the service, where it receives an ordered result
and an audit row. DTO validation is used where the whole request is one unit (`/api/ack`, the `/api/state` query).

## 4. Transactions, locking and concurrency

Each REST batch, ACK request and MQTT challenge runs in **one READ COMMITTED transaction** (`database/transaction.ts`):

1. **Advisory locks first.** `pg_advisory_xact_lock(hashtext('production-event:<id>'))` is taken for every `event_id` and every
   `target_event_id` in the batch, **de-duplicated and sorted**, before any read. A VOID locks its target's ID even when no
   target row exists yet, so a COUNT and a VOID racing for the same ID are serialized. A row lock alone could not cover the
   VOID-before-COUNT race, because there is no row to lock. ACK takes the same locks, also sorted, so overlapping ACK and event batches
   acquire locks in a single global order and cannot deadlock. MQTT first takes `mqtt-challenge:<id>` (a separate namespace that no
   other path takes after event locks), then the event locks.
2. **Read after the lock.** Under READ COMMITTED, each statement sees rows committed by the previous lock holder.
   (Codex's first version used SERIALIZABLE, where the snapshot is taken at the first statement, i.e. *before* the lock wait. It then depended on
   PostgreSQL converting unique violations into serialization failures and on retries. This was replaced.)
3. **Constraints are the final guard.** If a race were ever missed, the unique indexes reject it, the whole transaction rolls back, and
   `runWithRetry` retries `40001`, `40P01` and `23505` (bounded to 5 attempts with jitter). Errors are never swallowed inside an aborted transaction.
4. **Business rejections are data, not exceptions.** They are written as rows, so one bad item never rolls back the valid items.
   Genuine database failures roll back the whole unit and surface as HTTP 500 (or MQTT `INTERNAL_ERROR`). They are never reported as persisted rejections.

**Throughput tradeoff.** Advisory locks serialize per logical ID, and a batch holds its locks until commit. That is simple and obviously
correct for a single factory's event rates, but a very large batch touching hot IDs blocks other writers to those IDs for its duration,
and `hashtext` collisions occasionally serialize unrelated IDs. At higher scale the options are smaller transactions per item (with
savepoints), partitioning locks by source, or a single-writer queue per source.

Verified by integration tests: 8 concurrent identical COUNTs (1 ACCEPTED, 7 DUPLICATE), 10 concurrent competing VOIDs on one COUNT
(exactly 1 ACCEPTED), 10 COUNT/VOID pairs racing with absent targets (always converge to net 0), 8 overlapping ACK requests in opposite
orders (no deadlock, each ID ACKED once), and 6 concurrent identical MQTT deliveries (processed once, identical responses).

## 5. Normalization, duplicates and conflicts

`normalizeEvent` produces `{source_id, event_id, type, quantity, target_event_id, event_time}` with trimmed IDs, explicit nulls and a UTC
ISO timestamp. `canonicalJson` (keys sorted by code point) is hashed with SHA-256 into `payload_fingerprint`. When an existing `event_id`
arrives, an equal fingerprint is a `DUPLICATE` and any difference is a `CONFLICT`. Both are stored as attempts, and neither touches the original row
or the totals. Values are never coerced: quantity must pass `Number.isSafeInteger` and be > 0, so `"5"`, `1.5`, `true` and `0`
are rejected. (JSON `5.0` parses to the number 5 and is therefore accepted as 5.)

## 6. Pending resolution

A VOID whose target does not exist is stored as `PENDING_REFERENCE` and has no effect on totals. When a COUNT is inserted, `resolvePendingVoids`
(in the same transaction, under the same lock) loads pending VOIDs for that ID ordered by `id`:

- different source → `REJECTED`, reason "VOID source_id must match the target COUNT source_id"
- the first same-source candidate → `ACCEPTED`, `completed_at` set, `count.reversed_by_event_id` set
- later candidates → `REJECTED`, reason "Target COUNT was already reversed by <winner>"

If the awaited ID arrives as a VOID instead, pending VOIDs targeting it are rejected ("VOID target must be a COUNT"), so they cannot stay
unresolved forever. Resolution-time rejections appear in the Exceptions view with their reasons.

## 7. Summary derivation

The summary is derived directly from durable rows (no separate projection to drift) in one statement:
`net_total = Σ COUNT.quantity (ACCEPTED) − Σ target.quantity for ACCEPTED VOIDs`. The VOID's reversed quantity always comes from its
target COUNT. `duplicates` and `conflicts` count attempts. Results are cast to float8, which is exact up to 2^53.

## 8. MQTT reliability, restart and replay

- **Atomicity.** Event effects, their `submission_attempts` (tagged `transport='MQTT'`, `challenge_id`), the six-field state snapshot and the
  exact serialized response are committed in one transaction. A crash before commit leaves nothing, so a redelivery processes normally. A crash after
  commit leaves a stored response, so a redelivery replays it. Effects are never applied twice.
- **Digest.** SHA-256 of the canonical JSON body. Receipt time is not part of it, and `candidate_id` is transport metadata, not event identity.
- **Publish after commit.** The worker publishes only after `handleMqttChallenge` resolves. Successful publishes set `published_at`. Failures
  set `publish_error`, and `flushUnpublished` retries stored responses on (re)connect and on every heartbeat.
- **Duplicate deliveries.** The challenge advisory lock plus the primary key mean concurrent identical deliveries process once, and the others replay.
- **Ordering.** The worker handles messages strictly one at a time, in delivery order.
- **Connection lifecycle.** The worker uses clean sessions with QoS 1. ONLINE is sent after the SUBACK, HEARTBEAT every `min(MQTT_HEARTBEAT_MS, 30s)`, and OFFLINE as both
  the Last Will and a graceful message on shutdown. Reconnect backoff runs 1 s → 30 s (capped) and resubscribes on every connect. `onModuleDestroy`
  drains the queue, clears timers and ends the client.
- **Restart.** All state lives in PostgreSQL. A test closes the Nest app and pool, waits until a handled challenge has expired, boots a fresh app,
  and verifies identical summaries, a byte-identical replay, and `ALREADY_ACKED` on prior acknowledgements.

## 9. Future service extraction

The boundaries already match a credible split without introducing Kafka, RabbitMQ or Kubernetes now:

1. **Ingestion service** (`production-events` + `audit` + `production-sources`), which owns writes and the locking strategy.
2. **Query service** (`state`), which can move to a read replica or a transactionally maintained projection table.
3. **Device gateway** (`mqtt`), which would call the ingestion service over an idempotent API keyed by `challenge_id`, keeping the stored-response table.

`shared/domain-events.ts` reserves event names for post-commit notifications should those services need to subscribe.

## 10. Testing strategy

- **Unit tests** (`domain.spec.ts`, 19 tests): validation, normalization, fingerprinting, the policy, and challenge validation with an injected clock.
- **Integration tests** (6 suites, 38 tests): Supertest against a real PostgreSQL `_test` database (with a guard that refuses other names), covering
  REST contracts, the edge cases above, concurrency, restart durability, and a real MQTT worker against a spawned local aedes broker
  (ONLINE, HEARTBEAT, correlation, replay, broker restart with reconnect and resubscribe, durable republish, OFFLINE on shutdown).
  PostgreSQL behaviour is never replaced by in-memory fakes.
