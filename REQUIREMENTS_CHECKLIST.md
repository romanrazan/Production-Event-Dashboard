# Requirements checklist

Each requirement from `Production-Assessment-Codex-Instructions.md` (§ = section of that brief) is traced to code and to evidence produced on
2026-10-09. Statuses: **COMPLETE**, **PARTIALLY COMPLETE**, **NOT IMPLEMENTED**, **INCORRECT**, **BLOCKED**.
"IT" means an integration test against real PostgreSQL (`backend/test/*.integration.spec.ts`). "UT" means a unit test (`backend/test/domain.spec.ts`).
"E2E" means the scripted run against the live backend described in AI_USAGE.md / DEMO.md.

**Totals (127 requirements): COMPLETE 121 · PARTIALLY COMPLETE 1 · NOT IMPLEMENTED 1 (optional bonus) · INCORRECT 0 · BLOCKED 4**

At the start of the Claude Code session the audit classified these as INCORRECT: the SERIALIZABLE snapshot-before-lock (B13), the `null` batch item → 500 (V10),
the quantity overflow (B17), the ACK lock order (R14) and lenient timestamps (V5). These as PARTIAL: resolution-time exceptions (R11), VOID-of-VOID pending (V8),
publish retry (M12), INTERNAL_ERROR (M4), the simulator safety (M19), and the frontend polling/lint/error-state items (F8–F10). These as NOT IMPLEMENTED: all
documentation (G3), worker/restart/concurrency tests (T5, T8, T9) and the ZIP (G5). All of these were fixed and are verified below.

## §1 Workspace and reference

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| W1 | Separate project root `production-event-dashboard`; traffic system untouched | COMPLETE | repo root | — | Own git repo; `../factory-traffic-management` not modified |
| W2 | Root npm workspaces backend + frontend, one lockfile | COMPLETE | package.json, package-lock.json | — | Fresh clone `npm ci` exit 0 |
| W3 | Backend stack: NestJS, TypeORM, PostgreSQL, class-validator, Swagger, Jest, Supertest | COMPLETE | backend/package.json | — | build/test pass |
| W4 | Feature folders under backend/src with controller/service/module/repository, dtos/, entities/ | COMPLETE | backend/src/* | — | Tree in README §8 |
| W5 | data-source.ts, migrations/, test/, main.ts, setup.ts, app.module.ts | COMPLETE | backend/ | — | Present |
| W6 | Frontend: Next App Router, React, Tailwind, Axios, Zod, lucide-react; src/app, components, features, hooks, lib/api, schemas, services, types | COMPLETE | frontend/src | — | `npm run build` passes |
| W7 | Reference patterns: typed API services and non-overlapping polling | COMPLETE | services/production.ts, hooks/use-poll.ts | — | Polling schedules only after settle; verified in the browser |
| W8 | One backend deployment, one DB; MQTT worker is a lifecycle provider | COMPLETE | mqtt/mqtt-worker.service.ts | — | IT mqtt-worker (OnModuleInit/OnModuleDestroy) |

## §2 Conflicts and assumptions

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| A1 | Record contradictions A/B/C in TECHNICAL_EXPLANATION.md | COMPLETE | TECHNICAL_EXPLANATION.md §1 | — | Document |
| A2 | Global event_id uniqueness | COMPLETE | migration UNIQUE(event_id) | — | IT "changed payload and cross-source reuse conflict" |
| A3 | Ordered partial success for mixed batches | COMPLETE | production-events.service.ts | — | IT "mixed valid and invalid items…", E2E |
| A4 | Manual ACK for COUNT and VOID; Pending includes both; single named policy | COMPLETE | domain/acknowledgement-policy.ts | — | IT ack "repeated IDs… COUNT and completed VOID"; UT policy |
| A5 | Candidate ID string "07", configurable, leading zero kept | COMPLETE | mqtt.service.ts, .env.example | — | UT `"7"` → CANDIDATE_MISMATCH; IT client id `fse01-07-…` |

## §3–4 Structure and boundaries

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| S1 | Required folder layout (all listed files) | COMPLETE | see README §8 | — | All listed files exist |
| S2 | Exact paths POST /api/events, GET /api/state, POST /api/ack; plus /api/health, /api/mqtt/status | COMPLETE | controllers | — | IT and E2E |
| S3 | Controllers delegate; services own workflows; repositories own SQL | COMPLETE | all modules | — | Code review |
| S4 | Named functions validateEvent, normalizeEvent, processBatch, processEvent, processCount, processVoid, resolvePendingVoids, acknowledgeEvent(s), getSummary/Pending/Exceptions, validateChallenge, handleMqttChallenge | COMPLETE | domain/, services | — | grep |
| S5 | REST and MQTT share the same processing and state services | COMPLETE | mqtt.service.ts → ProductionEventsService.processBatch, StateService.getSummary | — | IT MQTT tests change the same totals |
| S6 | Repositories use the caller's EntityManager; no nested independent transaction in MQTT | COMPLETE | repositories, mqtt.service.ts | — | IT "concurrent identical MQTT deliveries" |
| S7 | Domain notifications emitted only after commit, "where useful" | PARTIALLY COMPLETE | shared/domain-events.ts | Names reserved; no subscriber needed yet. Post-commit side effect (MQTT publish) is implemented directly | Documented in TECHNICAL_EXPLANATION §9 |
| S8 | Explain future service extraction | COMPLETE | TECHNICAL_EXPLANATION §9 | — | Document |

## §5 Event input and validation

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| V1 | source_id, event_id non-empty strings | COMPLETE | domain/validation.ts | — | UT |
| V2 | type exactly COUNT/VOID | COMPLETE | validation.ts | — | UT (`"void"` rejected) |
| V3 | COUNT quantity positive safe integer; target null/omitted | COMPLETE | validation.ts | — | UT (`"5"`, 1.5, true, 0, -1, 2^53) |
| V4 | VOID quantity null/omitted; target non-empty string | COMPLETE | validation.ts | — | UT |
| V5 | event_time ISO 8601 with explicit timezone | COMPLETE | validation.ts `isZonedIsoTimestamp` | — | UT incl. Feb 30, 24:00, no zone |
| V6 | event_time separate from received_at; no freshness window | COMPLETE | entity, validation | — | Rows show both fields |
| V7 | No coercion of "5", booleans, decimals | COMPLETE | validation.ts | — | UT, E2E BAD item |
| V8 | Reject self-target, cross-source, VOID-of-VOID, second reversal with reasons | COMPLETE | validation.ts, service.voidRejection | — | UT self-target; IT cross-source, target-type, second reversal |
| V9 | Deterministic normalization (null≡omitted, equivalent offsets); raw payload kept | COMPLETE | normalization.ts | — | UT; E2E +06:00 resend → DUPLICATE |
| V10 | No global ValidationPipe rejection of mixed batches; primitives get ordered REJECTED + audit | COMPLETE | production-events.controller.ts, audit.repository.ts | — | IT "primitive and null batch items are audited" |

## §6 Business processing and persistence

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| B1 | COUNT increases net production exactly once | COMPLETE | processCount | — | IT COUNT +5; concurrent duplicate COUNT |
| B2 | VOID reverses one same-source COUNT once; quantity from target | COMPLETE | processVoid, summary SQL | — | IT, E2E |
| B3 | VOID before COUNT is PENDING_REFERENCE, no totals change | COMPLETE | processVoid | — | IT, E2E |
| B4 | Target COUNT arrival resolves pending VOIDs in the same transaction | COMPLETE | resolvePendingVoids | — | IT "VOID before COUNT resolves automatically" |
| B5 | First stored valid pending VOID wins (server order, tie-break); others REJECTED with reasons | COMPLETE | repository.pendingVoids ORDER BY id | — | IT "first stored valid pending VOID wins"; IT resolution-time exceptions |
| B6 | Duplicates never change totals | COMPLETE | processEvent | — | IT |
| B7 | Same ID + different data is CONFLICT; original preserved | COMPLETE | processEvent | — | IT |
| B8 | Store every item attempt (all statuses) | COMPLETE | audit module | — | IT attempt counts |
| B9 | Never delete history | COMPLETE | no DELETE paths | — | Code review |
| B10 | Rejected identity reservation rule; NOT_READY vs NOT_FOUND | COMPLETE | service, ack service | — | IT ack NOT_READY; E2E malformed → NOT_FOUND; IT rejected resend → DUPLICATE |
| B11 | Migrations with 4 tables, FKs, timestamptz, CHECKs, indexes; no FK forcing VOID target existence | COMPLETE | migrations/*.ts | — | `db:migrate` "No migrations are pending"; IT migrations recorded |
| B12 | Global uniqueness + at-most-one reversal enforced in PostgreSQL | COMPLETE | UNIQUE, partial unique indexes | — | IT competing concurrent VOIDs (1 of 10 accepted) |
| B13 | Serialize COUNT/VOID incl. absent targets; consistent lock order; explain throughput | COMPLETE | repository.lockLogicalIds, database/transaction.ts | — | IT 10 racing pairs; TECHNICAL_EXPLANATION §4 |
| B14 | Business rejections persisted, not exceptions; DB failures roll back; no swallowed errors in aborted transactions | COMPLETE | service, transaction.ts | — | Code review; retry only re-runs the whole transaction |
| B15 | Summary from durable rows with a consistent snapshot | COMPLETE | state.repository.ts (single statement) | — | IT |
| B16 | Data, ACKs and challenge responses survive restart | COMPLETE | PostgreSQL | — | IT "survive an application restart"; E2E restart with identical summaries |
| B17 | Quantities up to the safe integer limit storable | COMPLETE | migration 1791600000000 (bigint) | — | IT 3,000,000,000 |

## §7 REST contracts

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| R1 | POST /api/events accepts an object or an array; `{"results":[…]}` | COMPLETE | controller | — | IT |
| R2 | One ordered result per item; nullable event_id | COMPLETE | service | — | IT mixed batch |
| R3 | Status set ACCEPTED/DUPLICATE/CONFLICT/PENDING_REFERENCE/REJECTED | COMPLETE | shared/contracts.ts | — | IT |
| R4 | 200 for object/array envelopes even with rejections | COMPLETE | controller | — | IT |
| R5 | 400 for malformed JSON and null/string/number/boolean | COMPLETE | controller + body parser | — | IT (null, "bad", 42, true, `{bad json`) |
| R6 | Never 409 for an item CONFLICT | COMPLETE | controller | — | IT conflict returns 200 |
| R7 | Empty-array behaviour documented | COMPLETE | API.md | — | IT `[]` → `{results:[]}` |
| R8 | GET /api/state view validation; optional source_id | COMPLETE | state-query.dto.ts | — | IT invalid/missing view → 400 |
| R9 | Summary has exactly six fields with specified meanings | COMPLETE | state.repository.ts | — | IT `toEqual` on the full object |
| R10 | Pending = completed unacknowledged logical events | COMPLETE | state.repository.pending | — | IT, E2E |
| R11 | Exceptions = unresolved + rejected + conflicting, with reasons | COMPLETE | state.repository.exceptions | — | IT, E2E |
| R12 | Source filter: stored source vs attempted source; sourceless invalid only unfiltered | COMPLETE | state.repository | — | IT "source-filtered summaries…" |
| R13 | POST /api/ack ordered ACKED/ALREADY_ACKED/NOT_READY/NOT_FOUND; repeats processed in order | COMPLETE | acknowledgements.service.ts | — | IT, E2E |
| R14 | Concurrent and repeated ACK safe | COMPLETE | sorted locks + FOR UPDATE | — | IT concurrent ACK; IT opposite-order ACKs |
| R15 | ACK changes neither totals nor history and doesn't block a later VOID | COMPLETE | — | — | IT "acknowledgement changes neither totals nor a later valid VOID" |
| R16 | Response shapes consistent across Swagger, API.md, frontend schemas and tests | COMPLETE | dtos, API.md, schemas/production.ts | — | Zod parses live responses in the browser |

## §8 MQTT

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| M1 | mqtt client; broker/candidate/enabled config defaults | COMPLETE | mqtt-worker.service.ts, .env.example | — | /api/mqtt/status |
| M2 | MQTT 3.1.1, QoS 1, retain=false | COMPLETE | worker | — | Local broker log shows `qos 1, retain false` |
| M3 | Client ID `fse01-{id}-{suffix}`; own topics only | COMPLETE | worker | — | IT regex; examiner run `fse01-07-8debc8` |
| M4 | Full envelope validation with stable error codes | COMPLETE | challenge-validation.ts | — | UT all codes; IT expired/mismatch/protocol/non-JSON |
| M5 | COMPLETED response with ordered results + six-field state; invalid items REJECTED | COMPLETE | mqtt.service.ts | — | IT "invalid event item remains COMPLETED"; simulator |
| M6 | FAILED response with error_code + message | COMPLETE | mqtt.service.ts | — | IT, simulator |
| M7 | Persist challenge id, digest, status, exact response, timestamps | COMPLETE | mqtt_challenges | — | IT |
| M8 | Exact replay, no new effects or attempts | COMPLETE | handleInTransaction | — | IT replay; simulator byte-identical; post-restart replay with 14→14 attempts |
| M9 | Same ID + changed body → CHALLENGE_CONFLICT, history preserved | COMPLETE | mqtt.service.ts | — | IT, simulator |
| M10 | Concurrent duplicate deliveries protected (uniqueness + locking) | COMPLETE | lockChallenge + PK | — | IT 6 concurrent deliveries → processed once |
| M11 | Event effects and response persisted atomically | COMPLETE | single transaction | — | Design + IT |
| M12 | Publish only after commit; failure keeps a durable response for retry | COMPLETE | worker.onMessage, flushUnpublished, recordPublish | — | IT "stored but unpublished response is republished" |
| M13 | Receipt time not in identity/digest; candidate_id not event identity | COMPLETE | mqtt.service.ts | — | Code review |
| M14 | Replay-versus-expiry precedence documented and implemented | COMPLETE | API.md, mqtt.service.ts | — | IT restart test replays an expired handled challenge |
| M15 | ONLINE after subscribe, HEARTBEAT ≤30 s, OFFLINE as last will + shutdown | COMPLETE | worker | — | IT ONLINE/HEARTBEAT/OFFLINE; examiner broker HEARTBEAT observed |
| M16 | Bounded reconnect backoff and resubscription | COMPLETE | worker.onClose/onConnect | — | IT broker restart → reconnect_attempts > 0, new challenge answered |
| M17 | Clean shutdown of client and timers | COMPLETE | onModuleDestroy | — | IT OFFLINE on close; Jest exits cleanly |
| M18 | Track connectivity, last challenge/time, response status, counts, last error | COMPLETE | worker.getStatus, repository.challengeCounts | — | GET /api/mqtt/status |
| M19 | Local simulator for repeatable development | COMPLETE | simulator/local-mqtt-simulator.ts, scripts/local-mqtt-broker.mjs | — | `npm run mqtt:simulate` 4/4 PASS |
| M20 | Connection to the examiner broker 152.42.238.142:1883 | COMPLETE | — | — | 2026-10-09 07:14Z: connected + subscribed; HEARTBEAT seen by an independent observer on `fse-01/07/status` |
| M21 | Real examiner challenge → correlated response round trip | BLOCKED | — | Requires the examiner to send a challenge to `fse-01/07/challenge` while the backend runs | No challenge received during the observation window |

## §9 Frontend

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| F1 | Six summary cards from the API | COMPLETE | summary-cards.tsx | — | Browser: values equal the API summary |
| F2 | JSON editor (object/array), example buttons, ordered results | COMPLETE | event-form.tsx | — | Browser: "VOID before COUNT" → ordered results |
| F3 | Optional source filter | COMPLETE | dashboard.tsx | — | Browser |
| F4 | Pending/Exceptions switch with all columns and reasons; event details | COMPLETE | events-table.tsx | — | Browser: expanded conflict row details |
| F5 | Selection and bulk ACK of Pending | COMPLETE | events-table.tsx | — | Browser: 7 ACKED, totals unchanged |
| F6 | Refresh after submission and ACK | COMPLETE | onComplete/onRefresh | — | Browser |
| F7 | MQTT panel: connection, candidate, last challenge/time, response status, counts, last error | COMPLETE | mqtt-status-panel.tsx | — | Browser, screenshot |
| F8 | Loading, empty, validation, success and API-failure states | COMPLETE | dashboard, event-form, events-table | — | Browser; skeletons, empty queue, JSON error, error-state panel |
| F9 | Stale-data notice keeping the last snapshot | COMPLETE | dashboard.tsx | — | Browser with the backend stopped: "STALE SNAPSHOT" |
| F10 | Non-overlapping polling, stable callbacks, cancellation on unmount/filter change | COMPLETE | use-poll.ts | — | Per-run cancel flag + AbortController; network log shows aborted superseded requests |
| F11 | Laptop and mobile layouts | COMPLETE | globals.css | — | Browser 1440 px and 375 px, no horizontal overflow; screenshots |
| F12 | Prevent double submission; no invented values or silent zeros | COMPLETE | event-form.tsx ref guard; dashboard error state | — | Code + browser |

## §10 Configuration and local run

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| C1 | Backend port 4000, frontend 3001 | COMPLETE | main.ts, frontend/package.json | — | Running servers |
| C2 | backend/.env.example with all listed variables | COMPLETE | backend/.env.example | — | File |
| C3 | DATABASE_URL alternative with explicit precedence; no hidden password | COMPLETE | data-source.ts, README §3 | — | Code |
| C4 | synchronize=false; migration commands | COMPLETE | data-source.ts, scripts | — | `db:migrate` |
| C5 | frontend/.env.local.example | COMPLETE | frontend/.env.local.example | — | File |
| C6 | Docker Compose PostgreSQL with persistent volume and host port | BLOCKED | docker-compose.yml | File provided; cannot be executed because Docker isn't installed on this machine | Not executed |
| C7 | Existing-PostgreSQL and pgAdmin instructions | COMPLETE | README §2 | — | Document |
| C8 | Root scripts dev:backend, dev:frontend, build, lint, typecheck, test, test:integration, db:migrate, mqtt:simulate | COMPLETE | package.json | — | All run with exit 0 |
| C9 | Works from a fresh clone | COMPLETE | — | — | Fresh clone: npm ci, typecheck, lint, build, test all exit 0 |
| C10 | Health and Swagger endpoints | COMPLETE | app.controller.ts, setup.ts | — | IT health + /docs-json |

## §11 Tests and verification

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| T1 | Dedicated PostgreSQL test DB; refuse non-test DB for destructive resets | COMPLETE | test/integration-setup.ts | — | Guard on `_test` suffix |
| T2 | Minimum tests 1–5 (COUNT +5, duplicate, VOID-before-COUNT, double ACK, MQTT replay) | COMPLETE | events/ack/mqtt specs | — | 38/38 IT pass |
| T3 | Conflict + cross-source ID collision; mixed batch; invalid audit + 400 | COMPLETE | events, edge-cases specs | — | IT |
| T4 | Wrong-source/target-type VOID; competing pending winner | COMPLETE | reliability, edge-cases | — | IT |
| T5 | Concurrent duplicate COUNT, COUNT vs VOID, competing reversal, concurrent ACK | COMPLETE | reliability, edge-cases | — | IT |
| T6 | Source-filtered duplicate/conflict metrics | COMPLETE | edge-cases | — | IT |
| T7 | Expired/mismatched/conflicting challenge; invalid item COMPLETED | COMPLETE | mqtt spec | — | IT |
| T8 | Replay after state changes and after restart | COMPLETE | mqtt, edge-cases | — | IT |
| T9 | Migrations, durable restart, reconnect behaviour | COMPLETE | edge-cases, mqtt-worker | — | IT |
| T10 | Controllable clock and MQTT transport where needed; no in-memory DB fake | COMPLETE | ClockService, validateChallenge(now), local broker | — | UT injected clock; IT real broker |
| T11 | Run install, migrations, lint, typecheck, tests, builds | COMPLETE | — | — | See AI_USAGE / final report, all exit 0 |
| T12 | Inspect dashboard at laptop and mobile widths; genuine screenshots | COMPLETE | docs/screenshots | — | Headless Chrome captures |

## §12 Git, documentation, delivery

| ID | Requirement | Status | File(s) | Missing work | Verification evidence |
|---|---|---|---|---|---|
| G1 | ≥3 real progress commits | COMPLETE | git log | — | 8ba446d, 3a8b853 (Codex), 8f0dc12, 4ae4801, docs commit (Claude Code) |
| G2 | Push only to an authorized target | BLOCKED | — | No remote or authorized target repository configured; commits are local | `git remote -v` empty |
| G3 | README, TECHNICAL_EXPLANATION, AI_USAGE, docs/ai-conversation, API, DEMO, checklist | COMPLETE | *.md | — | Files |
| G4 | .gitignore excludes env, node_modules, builds, caches; examples tracked | COMPLETE | .gitignore | — | `git check-ignore` on .env files |
| G5 | Clean source ZIP without dependencies or secrets | COMPLETE | `production-event-dashboard-submission.zip` (repo root, gitignored) | — | Built with `git archive` from HEAD |
| G6 | Examiner demo script | COMPLETE | DEMO.md | — | Steps executed in E2E |
| G7 | Optional Protocol Buffers bonus | NOT IMPLEMENTED | — | Optional; JSON protocol only | — |
| G8 | Google Form submission | BLOCKED | — | Must be done by the candidate | — |
