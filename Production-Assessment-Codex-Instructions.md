You are a senior full-stack engineer. Implement the entire CSI Smart Tech FSE 01 assessment: “Production Event Processing Dashboard + MQTT Device Integration.”

Use my Factory Traffic Management System as the architecture and coding-style reference:
https://github.com/romanrazan/Factory-Traffic-Management-System

Build runnable code, migrations, a connected frontend, meaningful automated tests, documentation and submission artifacts. Continue through implementation and verification; do not stop at a plan or provide pseudocode. Report genuine external blockers without inventing successful results.

1. WORKSPACE AND REFERENCE

Inspect the current workspace, AGENTS.md, package manifests and Git status first. Inspect the reference repository’s actual files before adapting its conventions.

Treat the reference repository as a style reference, not automatically as the destination for this project. Use a separate project root named production-event-dashboard unless I have already provided a dedicated assessment workspace. If working inside the existing traffic repository, isolate the assessment in a new subdirectory and preserve its application. Do not replace the traffic system’s files, business rules, database or Git history.

Match these verified conventions:
- Root npm workspaces: backend and frontend, one package-lock.json.
- Backend: TypeScript, NestJS, TypeORM, PostgreSQL, class-validator/class-transformer, Swagger, Jest and Supertest.
- Feature folders directly beneath backend/src, with <feature>.controller.ts, <feature>.service.ts, <feature>.module.ts, dtos/ and entities/.
- Add <feature>.repository.ts files to keep database operations separate from services.
- backend/src/database/data-source.ts, backend/migrations/, backend/test/, main.ts, setup.ts and app.module.ts.
- Frontend: TypeScript, Next.js App Router, React, Tailwind CSS, Axios, Zod and lucide-react. React Hook Form is available when useful.
- frontend/src/app, components, features, hooks, lib/api, schemas, services and types.
- Use the reference’s typed API-service and non-overlapping polling patterns.
- Reuse architectural patterns, not junctions, signals, vehicle priorities, sequence rules or traffic-specific timestamp windows.
- Inspect compatible package versions. Reuse a working lockfile where appropriate; do not blindly copy package versions that cannot be installed.

One backend application/deployment and one persistent PostgreSQL database are required. The MQTT worker must be a lifecycle-managed provider inside that backend, not a separately deployed microservice.

2. REQUIREMENT CONFLICTS AND ASSUMPTIONS

Record these contradictions in TECHNICAL_EXPLANATION.md:
A. Section 5.1 says event_id is globally unique. Section 7 suggests unique(source_id, event_id).
B. Sections 5.2 and 6.1 require valid batch items to succeed despite invalid items. Section 7 says roll back the entire batch on validation failure.
C. Sections 6.2–6.3 allow completed COUNT and VOID events to await and receive acknowledgement. Section 9 says completed VOID events are automatically acknowledged and only COUNT appears in Pending.

Use examiner clarification if supplied. Otherwise implement these explicit fallback assumptions:
- Global uniqueness of event_id across production sources.
- Ordered partial success for mixed batches; rejected items remain recorded.
- Manual acknowledgement for both completed COUNT and VOID, following the explicit REST/state contract. Pending includes both.
Explain that fallback C conflicts with section 9. Keep acknowledgement eligibility in one named policy/function so an examiner can change it to automatic VOID acknowledgement and COUNT-only pending without rewriting routes, MQTT or frontend business rules.

Candidate ID appears as 07 on the assessment. Default MQTT_CANDIDATE_ID to the string "07", preserving leading zeros, and allow the examiner’s exact assigned identifier through configuration. Do not use CAND-017 from the example as my real ID.

Do not pause repeatedly over these documented fallback assumptions. Missing Google Form details should not block local implementation. Follow the assessment’s permitted AI stage and record actual AI use honestly.

3. REQUIRED FOLDER STRUCTURE

Use this layout, adding small necessary files without moving features into a generic src/modules hierarchy:

production-event-dashboard/
  package.json
  package-lock.json
  .gitignore
  docker-compose.yml
  README.md
  API.md
  DEMO.md
  TECHNICAL_EXPLANATION.md
  AI_USAGE.md
  REQUIREMENTS_CHECKLIST.md
  docs/
    ai-conversation.md
    screenshots/
  backend/
    package.json
    .env.example
    tsconfig.json
    tsconfig.build.json
    eslint.config.mjs
    jest.config.cjs
    migrations/
      <timestamp>-InitialProductionSchema.ts
    src/
      main.ts
      setup.ts
      app.module.ts
      app.controller.ts
      app.service.ts
      database/
        data-source.ts
      shared/
        clock.service.ts
        contracts.ts
        domain-events.ts
        filters/
          safe-exception.filter.ts
      production-sources/
        production-sources.module.ts
        production-sources.service.ts
        production-sources.repository.ts
        entities/
          production-source.entity.ts
      production-events/
        production-events.controller.ts
        production-events.service.ts
        production-events.repository.ts
        production-events.module.ts
        dtos/
          production-event.dto.ts
        domain/
          model.ts
          validation.ts
          normalization.ts
          acknowledgement-policy.ts
        entities/
          production-event.entity.ts
      acknowledgements/
        acknowledgements.controller.ts
        acknowledgements.service.ts
        acknowledgements.repository.ts
        acknowledgements.module.ts
        dtos/
          acknowledge-events.dto.ts
      state/
        state.controller.ts
        state.service.ts
        state.repository.ts
        state.module.ts
        dtos/
          state-query.dto.ts
      audit/
        audit.service.ts
        audit.repository.ts
        audit.module.ts
        entities/
          submission-attempt.entity.ts
      mqtt/
        mqtt.controller.ts
        mqtt.service.ts
        mqtt-worker.service.ts
        mqtt.repository.ts
        mqtt.module.ts
        dtos/
          mqtt-challenge.dto.ts
        protocol/
          mqtt-contracts.ts
          challenge-validation.ts
        entities/
          mqtt-challenge.entity.ts
      simulator/
        local-mqtt-simulator.ts
    test/
      events.integration.spec.ts
      acknowledgements.integration.spec.ts
      mqtt.integration.spec.ts
      reliability.integration.spec.ts
      domain.spec.ts
  frontend/
    package.json
    .env.local.example
    tsconfig.json
    postcss.config.mjs
    eslint.config.mjs
    src/
      app/
        layout.tsx
        page.tsx
        globals.css
      components/
        shell.tsx
        status-badge.tsx
      features/
        production/
          dashboard.tsx
          event-form.tsx
          summary-cards.tsx
          events-table.tsx
          mqtt-status-panel.tsx
      hooks/
        use-poll.ts
      lib/api/
        client.ts
      schemas/
        production.ts
      services/
        production.ts
      types/
        production.ts

The three mandated business endpoints must keep their exact paths. Additional GET /api/health and GET /api/mqtt/status are acceptable for operational visibility.

4. MODULE AND FUNCTION BOUNDARIES

Controllers handle transport and delegate. Services own business workflows. Repositories own SQL/TypeORM queries. Inject dependencies through NestJS modules; export only required services.

Provide small, explainable functions/methods:
validateEvent, normalizeEvent, processBatch, processEvent, processCount, processVoid, resolvePendingVoids, acknowledgeEvent, acknowledgeEvents, getSummary, getPending, getExceptions, validateChallenge and handleMqttChallenge.

REST and MQTT must call the SAME production-events processing service and state service. Frontend displays backend decisions; it must not calculate authoritative totals or resolve VOID events.

Repositories used in a transaction must use that transaction’s EntityManager. Avoid nested independent transactions when an outer MQTT transaction needs atomic processing and response persistence.

Use domain notifications/callbacks where useful, emitted only after successful commit. Explain a credible future extraction of events, queries and MQTT into services; do not introduce Kafka, RabbitMQ or Kubernetes for this assessment.

5. EVENT INPUT AND VALIDATION

Event contract:
{
  "source_id": "LINE-01",
  "event_id": "EV-101",
  "type": "COUNT",
  "quantity": 5,
  "target_event_id": null,
  "event_time": "2026-10-09T10:30:00Z"
}

Validate:
- source_id and event_id: non-empty strings.
- type: exactly COUNT or VOID.
- COUNT: quantity is a positive safe integer; target_event_id null or omitted.
- VOID: quantity null or omitted; target_event_id is a non-empty string identifying a COUNT.
- event_time: a valid ISO 8601 timestamp with explicit timezone.
- Keep event_time separate from received_at.
- Do not coerce "5", booleans or decimals into valid quantities.
- Reject self-target VOID, cross-source VOID, target VOID, and another VOID of an already reversed COUNT with clear reasons.
- Do not add traffic-specific freshness restrictions to event_time.

Normalize semantic fields deterministically: omitted nullable fields equal explicit null and equivalent timestamp offsets represent the same instant. Preserve raw payload separately. Use canonical normalized data for duplicate/conflict comparison.

IMPORTANT: Do not let a global Nest ValidationPipe reject a whole mixed event batch before AuditService sees it. Inspect the top-level envelope separately, then validate each item inside the shared ingestion service. Invalid array members, including primitives, must receive ordered REJECTED results and durable attempt records.

6. BUSINESS PROCESSING AND PERSISTENCE

- COUNT increases net production exactly once.
- VOID reverses one accepted COUNT from the same source exactly once; the reversed quantity comes from its target COUNT.
- VOID before COUNT is PENDING_REFERENCE and does not change totals.
- When the target COUNT arrives, resolve eligible pending VOID records within the same protected database workflow.
- First stored valid pending VOID wins; rejected or cross-source candidates cannot win.
- Use server-side stable storage order, with a tie-breaker, rather than event_time to decide "first stored."
- Mark later competing VOID records REJECTED with clear reasons.
- Duplicate processing never changes totals again.
- Same event_id plus different normalized data is CONFLICT; preserve the original logical event.
- Store every received item attempt, including accepted, pending, duplicate, conflict and rejected cases.
- Preserve original logical events and changes in processing status; never delete history to correct production.
- Explicitly document whether rejected logical IDs reserve identity. For this implementation, an object with usable event_id/source_id that passes structural validation may reserve its logical identity even when rejected by business rules. Malformed attempts need not create logical events. ACK NOT_READY and NOT_FOUND must follow this distinction.

Create PostgreSQL migrations with production_sources, production_events, submission_attempts and mqtt_challenges. Use foreign keys where valid, timestamptz, suitable CHECK constraints and indexes. Do not require a resolved target foreign key that prevents storing a VOID before its COUNT exists.

Enforce global logical event uniqueness and at-most-one successful reversal in PostgreSQL, not only application checks. Serialize competing COUNT/VOID decisions, including absent target rows; a row lock on an existing COUNT alone is insufficient for VOID-before-COUNT races. A short transaction-scoped PostgreSQL advisory lock is acceptable for this small version; explain its throughput tradeoff. Consistent locking order must avoid deadlocks.

Business rejections are persisted results, not exceptions that roll back other valid items. Genuine database failures roll back affected database work; do not label infrastructure failures as successfully persisted rejections. Avoid swallowing a PostgreSQL constraint error and continuing an aborted transaction without a savepoint/retry strategy.

Derive summary from durable accepted events and successful reversals, or a transactionally maintained projection. Use a consistent snapshot for the six summary values. Data, acknowledgements and challenge responses must survive application restart.

7. REST CONTRACTS

POST /api/events
- Accept one JSON event object or an array.
- Return {"results":[{"event_id":"EV-101","status":"ACCEPTED","message":"Event processed"}]}.
- Preserve item order and provide one result per submitted item, including malformed items using nullable event_id.
- Allowed statuses: ACCEPTED, DUPLICATE, CONFLICT, PENDING_REFERENCE, REJECTED.
- HTTP 200 for object/array envelopes, even when some items are rejected.
- HTTP 400 for malformed JSON or unusable top-level envelopes such as null, strings, numbers and booleans.
- Never return HTTP 409 for an individual CONFLICT inside a valid event submission envelope.
- Document empty-array behavior.

GET /api/state?source_id=LINE-01&view=summary
- source_id optional; validate view as summary, pending or exceptions.
- Summary has exactly: net_total, processed_events, pending_ack, unresolved, duplicates, conflicts.
- net_total: accepted COUNT quantity minus applied VOID quantity.
- processed_events: distinct completed COUNT and completed VOID; unresolved VOID enters this count after resolution.
- pending_ack: completed logical events without acknowledgement under the chosen policy.
- unresolved: pending valid VOID references.
- duplicates/conflicts: numbers of stored attempts, not distinct original events.
- Pending: completed, unacknowledged logical events.
- Exceptions: unresolved references, rejected submissions and conflicting attempts, with reasons.
- Source filter uses stored source for logical events and attempted source for duplicate/conflict attempts.
- Invalid attempts without a useful source_id appear only in unfiltered exceptions.

POST /api/ack
Input: {"event_ids":["EV-101","EV-102"]}
Return one ordered result per requested ID:
ACKED, ALREADY_ACKED, NOT_READY or NOT_FOUND.
- Repeated IDs in one request are processed in order.
- Concurrent/repeated acknowledgement is safe.
- Unresolved/rejected logical events are NOT_READY.
- An ID with no original logical event is NOT_FOUND.
- Both completed COUNT and completed VOID are acknowledgeable under the default assumption.
- Acknowledgement does not change totals, erase history or block a later valid VOID.

Document response shapes consistently in backend Swagger, API.md, frontend schemas and tests.

8. MQTT WORKER AND CHALLENGE PROTOCOL

Add the mqtt Node client library. Configure:
MQTT_BROKER_URL=mqtt://152.42.238.142:1883
MQTT_CANDIDATE_ID=07
MQTT_ENABLED=true

Use MQTT 3.1.1 or 5.0, QoS 1 and retain=false.
Client ID: fse01-{candidate_id}-{short_random_suffix}
Subscribe: fse-01/{candidate_id}/challenge
Publish responses: fse-01/{candidate_id}/response
Publish status: fse-01/{candidate_id}/status
Only use this candidate’s own topics.

Challenge fields:
protocol_version "1.0", candidate_id, challenge_id, command "PROCESS_EVENTS", sent_at, expires_at and events array.

Validate the complete envelope before processing. Use stable error codes:
VALIDATION_ERROR, CANDIDATE_MISMATCH, UNSUPPORTED_PROTOCOL,
CHALLENGE_EXPIRED, CHALLENGE_CONFLICT and INTERNAL_ERROR.

A successful application response includes:
protocol_version, candidate_id, challenge_id, status "COMPLETED",
processed_at, ordered results and the current six-field state.
A challenge-level failure includes status "FAILED", error_code and message.
Invalid event items may be REJECTED while the challenge remains COMPLETED.

Persist challenge ID, canonical body/digest, status, exact serialized response and timestamps.
- Same ID/same body: replay the original stored response, including its original state and processed_at, without reprocessing events or adding fresh event submission attempts.
- Same ID/changed body: FAILED/CHALLENGE_CONFLICT; preserve original history.
- Protect concurrent duplicate deliveries using database uniqueness and locking.
- Persist event effects and the original challenge response atomically, so a crash cannot cause reprocessing after an event commit but before challenge-result storage.
- Publish only after successful commit.
- Publishing failure must retain the durable response for a safe retry.
- Do not wrap MQTT receipt time into event identity or compare it as part of the challenge-body digest.
- MQTT candidate_id is transport metadata, not part of production event identity.
- Document replay-versus-expiry precedence. An already completed identical challenge can replay its original result without new effects; an expired unprocessed challenge must fail.

Publish ONLINE after subscription, HEARTBEAT at least every 30 seconds and OFFLINE as a last will where supported. Implement bounded reconnect backoff and resubscription. Clean up clients and timers on shutdown. Track connectivity, last challenge/time, response status, counts and safe last error; persist durable challenge history.

Provide a local simulator for repeatable development. Distinguish local integration evidence from successful communication with the examiner’s real broker. If network access is blocked, complete local tests and state exactly which real-broker check remains.

9. FRONTEND

Create a usable responsive factory dashboard connected to actual API data:
- Six summary cards.
- JSON editor accepting a single event or an array, example-fill buttons and ordered submission results.
- Optional source filter.
- Pending/Exceptions table switch with event ID, source, type, quantity/target, event/receipt time, status and reason.
- Selection and bulk acknowledgement for eligible Pending rows.
- Refresh after submission and acknowledgement.
- MQTT panel with connection, candidate ID, last challenge ID/time, response status, challenge counts and last error.
- Loading, empty, validation, success and API-failure states.
- Stale-data notice if preserving the last successful snapshot after a failed poll.
- Non-overlapping polling, stable callbacks and cancellation on unmount/filter changes.
- Laptop and mobile layouts.

Keep API functions in services/production.ts, Axios/error handling in lib/api/client.ts, Zod contracts in schemas/production.ts and shared types in types/production.ts. Prevent accidental double submission. Do not show invented dashboard values or silently convert failures into zero totals.

10. CONFIGURATION AND LOCAL RUN

Backend port 4000; frontend port 3001, matching my reference project.

Provide backend/.env.example with:
NODE_ENV, PORT, DATABASE_HOST, DATABASE_PORT, DATABASE_USER,
DATABASE_PASSWORD, DATABASE_NAME, TEST_DATABASE_URL, CORS_ORIGIN,
MQTT_ENABLED, MQTT_BROKER_URL, MQTT_CANDIDATE_ID and MQTT_HEARTBEAT_MS.

Allow DATABASE_URL as a documented alternative with explicit precedence. Use placeholder credentials, no hidden hardcoded fallback password. Keep synchronize=false and provide migration commands.

Frontend/.env.local.example:
NEXT_PUBLIC_API_URL=http://localhost:4000/api

Provide Docker Compose for PostgreSQL with a persistent volume and documented host port. Also explain using existing local PostgreSQL and connecting the same database through pgAdmin. Supply consistent database names, migration steps and commands.

Root scripts should include:
dev:backend, dev:frontend, build, lint, typecheck, test,
test:integration, db:migrate and mqtt:simulate.
Run examples must work from a fresh clone. Include health and Swagger endpoints.

11. AUTOMATED TESTS AND VERIFICATION

Use Jest/Supertest with a dedicated PostgreSQL test database. Fail safely if a destructive test reset targets a database not explicitly marked as test-only. Use a controllable clock and MQTT transport where needed; do not replace PostgreSQL reliability verification with an in-memory fake.

At minimum test:
1. COUNT +5 -> net_total 5, processed_events 1, pending_ack 1.
2. Identical resubmission -> DUPLICATE, net_total unchanged, attempt stored.
3. VOID before COUNT -> pending; COUNT arrival resolves it; net_total 0 and two completed events.
4. ACK twice, including duplicate IDs in one request.
5. Same MQTT challenge twice -> exact replay, no repeated event effects or extra event attempts.

Also verify:
- Conflicting payload and global ID collision across sources.
- Mixed valid/invalid batch and result order.
- Invalid event audit persistence and top-level HTTP 400 behavior.
- Wrong-source/target-type VOID and competing pending VOID winner.
- Concurrent duplicate COUNT, COUNT-versus-VOID and competing reversal.
- Concurrent ACK.
- Source-filtered duplicate/conflict metrics.
- Expired/mismatched/conflicting challenge and invalid-item COMPLETED response.
- Challenge replay after subsequent state changes and application restart.
- Migration execution, durable state after restart and reconnect behavior.

Run dependency installation, migrations, lint, typechecking, tests and production builds. Fix failures and rerun relevant checks. Inspect the working dashboard at laptop and mobile widths. Capture genuine screenshots where execution tools permit; otherwise record the missing evidence without fabricating it.

12. GIT, DOCUMENTATION AND DELIVERY

Make at least three real progress commits as work is completed:
1. PostgreSQL schema and shared event processing.
2. REST, acknowledgement and MQTT integration.
3. Dashboard, automated tests and documentation.

Show exact git add/commit/push commands with correct relative paths and the actual branch. Only push if I have supplied/authorized a target repository and credentials are available. The reference URL alone is not authorization to publish this different assessment into my existing traffic repository. Never force-push, rewrite history or include unrelated modifications.

README.md: fresh setup, PostgreSQL/pgAdmin, migrations, dev/production commands, tests, environment variables, REST examples and MQTT flow.
TECHNICAL_EXPLANATION.md: entity model, boundaries, transaction/locking strategy, normalization, duplicates/conflicts, pending resolution, acknowledgement policy, restart/replay behavior, future service extraction and assumptions.
AI_USAGE.md: actual assistance and how generated code was reviewed.
docs/ai-conversation.md: actual available conversation record; do not fabricate an unavailable transcript.
API.md and DEMO.md: endpoint examples and a repeatable examiner walkthrough.
REQUIREMENTS_CHECKLIST.md: each requirement with implementation file and verification evidence.

Ignore real .env files, .env.local, node_modules, build output, coverage, caches and private credentials; track .env.example and .env.local.example. Create a clean source ZIP including source, lockfile, migrations, tests, docs and genuine screenshots, excluding dependencies and secrets.

Examiner demo:
- Explain who uses the dashboard.
- Submit COUNT +5.
- Resubmit it and show duplicate evidence without extra production.
- Submit VOID before target COUNT and demonstrate automatic resolution.
- Acknowledge Pending rows and show the updated state.
- Show a real correlated MQTT challenge/response and an exception.
- Restart the backend and show durable state.
- Explain and change one business rule in its owning function.

Optional Protocol Buffers bonus is only after mandatory behavior works, preserves JSON compatibility and is genuinely verified.

Finish with the project tree, actual run commands, checks and outcomes, assumption list, commits, submission ZIP path and any external blockers. Do not claim “fully complete,” real MQTT success, submitted Google Form or passed tests unless verified.

