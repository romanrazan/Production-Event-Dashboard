# AI usage

AI coding assistants were used for this assessment, as permitted by its AI stage. This file records what each tool did and how the
output was reviewed. A summary of the session records is in [docs/ai-conversation.md](docs/ai-conversation.md).

## Tools and sequence (2026-10-09)

| Stage | Tool | What it did |
|---|---|---|
| 1 | Candidate | Wrote the implementation brief `Production-Assessment-Codex-Instructions.md`, covering requirements, fallback assumptions and the reference architecture |
| 2 | **OpenAI Codex** (≈06:19–06:46 UTC) | Created the repository and workspace, the PostgreSQL schema migration, entities and the shared event engine (commit `8ba446d`). Wrote the REST endpoints, acknowledgement policy, state queries, MQTT service/worker and first tests (commit `3a8b853`). Set up the isolated PostgreSQL 18 cluster on port 55433. Drafted the Next.js dashboard (left **uncommitted**). Stopped with `usage_limit_exceeded` during a responsive-layout pass |
| 3 | **Claude Code** (Claude Opus 5.5) | Resumed from that state: audited every requirement against the code, fixed correctness issues, completed MQTT reliability, finished the dashboard, added tests and local broker tooling, ran all verification, and wrote the documentation (commits after `3a8b853`) |

## What Claude Code changed and why

The audit found these issues in the Codex output (17 integration tests passing did not cover them):

- **Transactions ran at SERIALIZABLE.** The snapshot was taken before the advisory-lock wait, so correctness relied on PostgreSQL's
  unique-violation → serialization-failure conversion plus 3 retries. Switched to READ COMMITTED behind the same sorted advisory locks, with
  a shared bounded retry (`database/transaction.ts`).
- **A `null` item in a batch caused HTTP 500 for the whole batch** (SQL NULL into `raw_payload NOT NULL`). Raw payloads are now serialized
  explicitly as JSON, and the same fix was applied to MQTT challenge bodies.
- **Valid quantities above 2^31 overflowed** the `integer` column. Added a migration that widens it to `bigint` with a safe-integer check.
- **ACK locks were taken in request order**, so `[A,B]` racing `[B,A]` could deadlock. They are now sorted up front.
- **Exceptions omitted VOIDs rejected during pending resolution.** **Pending VOIDs targeting a VOID never resolved.** Both are fixed and tested.
- **The acknowledgement policy wasn't the single seam for the SQL views.** Added the SQL twin in the same file.
- **Lenient timestamps** (`2026-02-30`, `24:00` were accepted by `Date.parse`). Added strict calendar validation.
- **MQTT:** a failed publish was neither stored nor retried, there was no `INTERNAL_ERROR` reply, and messages were handled concurrently. Added the durable
  publish ledger and flush, serialized handling, and a richer `/api/mqtt/status`.
- **Simulator** read `MQTT_BROKER_URL`, so it could publish fake challenges to the examiner broker. It now targets a local broker only. Added a local aedes broker
  script, because Docker and mosquitto were not installed.
- **Frontend:** a lint error (setState in an effect), a polling race where an old-filter response could overwrite new state, no state for a failed
  first load, no row details, and a non-fresh-clone-safe typecheck (`next-env.d.ts` imports generated `.next` types).
- **Tests added:** a real MQTT worker against a local broker (reconnect, resubscribe, republish, OFFLINE), edge cases, concurrency (competing VOIDs,
  COUNT/VOID races, opposite-order ACKs, concurrent MQTT deliveries), and restart durability. The total went from 26 to 57 tests.

## How AI output was reviewed

- Every source file was read before it was changed. Codex's correct work (schema, locking design, module layout, most of the dashboard) was kept.
- Each claimed behaviour was checked by running it: `npm run typecheck`, `lint`, `build`, `test` and `test:integration` against a real
  PostgreSQL `_test` database, and a scripted REST walkthrough against the running server. The suites were run repeatedly to check for flakiness.
- MQTT was exercised end-to-end through a local broker (simulator plus an independent replay check after a backend restart), and separately
  connected to the examiner broker, with a passive observer confirming HEARTBEAT on `fse-01/07/status`.
- The dashboard was inspected in a real browser at 1440 px and 375 px, including submission, bulk ACK, row details and the stale-snapshot state when the
  backend was stopped. Screenshots in `docs/screenshots/` are genuine captures.
- Known gaps are stated rather than hidden: no examiner challenge was received during verification, and Docker Compose was not executed.

## Responsibility

The candidate remains responsible for the submission. All assumptions are documented in TECHNICAL_EXPLANATION.md §1 and can be changed in their owning functions.
