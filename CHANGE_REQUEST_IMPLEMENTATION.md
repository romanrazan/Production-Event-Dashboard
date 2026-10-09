# FSE-01 Change Request Implementation

This change request adds four requirements to the delivered project. Each was implemented as a minimal change to the existing code. Architecture, transactions, locking, and VOID/DUPLICATE/CONFLICT/PENDING_REFERENCE logic are unchanged.

## Files and functions modified

| File | Change |
|---|---|
| `backend/src/production-events/domain/validation.ts` | `validateEvent`: COUNT quantity must be an integer within `COUNT_QUANTITY_MIN`–`COUNT_QUANTITY_MAX` (1–500). Both constants are new. |
| `backend/src/shared/contracts.ts` | `StateSummary` gains `rejected_submissions`. MQTT responses use this type. |
| `backend/src/state/state.repository.ts` | `summary()` adds one sub-select counting `submission_attempts` with `classification='REJECTED'`, using the same `source_id` filter, in the same single-statement snapshot. |
| `backend/src/state/dtos/state-query.dto.ts`, `state.controller.ts` | New Swagger `StateSummaryDto` (7 fields) and an `@ApiOkResponse` annotation. |
| `frontend/src/types/production.ts`, `schemas/production.ts` | `rejected_submissions` added to the type and the Zod schema. |
| `frontend/src/features/production/dashboard.tsx` | Filter bar now has a visible **Production Source** label, an **Apply Filter** button and a **Clear Filter** button. |
| `frontend/src/features/production/summary-cards.tsx` | Seventh card, **Rejected Submissions**, with distinct danger styling. |
| `frontend/src/app/globals.css` | Seven-column grid (4 columns ≤1280 px, 2 on mobile with the rejected card full-width), danger card style and filter label. |
| `backend/test/*.ts` | Summary assertions updated to seven fields. The obsolete >2³¹ quantity test was replaced by a 1–500 boundary test. New tests below. |
| `API.md` | Quantity rule and seventh summary field. |

## Design notes

- **Validation.** It lives in the shared `validateEvent`, used by both REST and MQTT through `ProductionEventsService.processBatch`. Rejected items still get ordered `REJECTED` results and a persisted `submission_attempts` row. The rejection reason is either `COUNT quantity 501 is outside the allowed range 1-500` or `COUNT quantity must be an integer between 1 and 500`.
- **`rejected_submissions`.** It counts attempts, not distinct IDs. DUPLICATE, CONFLICT and PENDING_REFERENCE attempts are excluded, and the filter uses the attempted `source_id`. No new endpoint was added.
- **MQTT.** New challenge responses include all seven metrics through `StateService.getSummary`. Stored responses are replayed from their persisted serialized text, so historical six-field responses replay byte-identically.
- **Source filter.** It uses the existing `source_id` support and the `usePoll` hook. Polling keeps the active filter, and stale responses are cancelled by the per-run flag plus `AbortController`.

## Actual test results (2026-10-09)

| Check | Result |
|---|---|
| `npx jest --runInBand` (backend, DB `production_events_test`) | **60/60 passed**, 0 skipped |
| New test: 450 and 500 → ACCEPTED; 501, 0, −3, 2.5, "5", true → REJECTED; reason persisted; net_total 950; `rejected_submissions` 6 | PASS |
| New test: `rejected_submissions` counts attempts only (2 copies counted twice), excludes DUPLICATE/CONFLICT/PENDING_REFERENCE, filtered by source | PASS |
| New test: new MQTT response state has exactly 7 keys in order; a legacy six-field stored response replays byte-identically | PASS |
| New unit test: quantity boundaries | PASS |
| All previous COUNT/VOID/duplicate/conflict/ACK/MQTT/concurrency/restart tests | PASS |
| `npm run typecheck`, `npm run lint`, `npm run build` | exit 0 |
| Live REST on dev backend: 450 → ACCEPTED, 500 → ACCEPTED, 501 → REJECTED; PostgreSQL row `REJECTED, COUNT quantity 501 is outside the allowed range 1-500`; filtered summary `{950,2,2,0,0,0,1}` | PASS |
| Browser (http://localhost:3001): Apply Filter sends `view=summary`, `view=pending` and `view=exceptions` with `source_id`; polling repeats with the filter; cards show 950/2/2/0/0/0/1 with the seventh styled as danger; Clear Filter returns to all sources (975/12/2/1/2/1/3); 375 px mobile has no horizontal overflow | PASS |

## Remaining blockers

- No live examiner MQTT challenge has been received, so new seven-field responses were verified through the integration tests and the local challenge path, not against the examiner broker.
- Earlier audit items are unchanged by this request (for example examiner topic-ID confirmation and screenshots). See `ASSESSMENT_REQUIREMENTS_AUDIT.md`.
