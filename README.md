# Production Event Processing Dashboard + MQTT Device Integration

CSI Smart Tech FSE 01 assessment. A factory supervisor submits or receives production events
(`COUNT` adds pieces, `VOID` reverses one earlier `COUNT`), reviews exceptions, and acknowledges completed
events. An MQTT worker inside the same backend answers examiner challenges using the **same** processing service.

- **Backend:** NestJS 11, TypeORM, PostgreSQL, class-validator, Swagger, Jest and Supertest, plus the `mqtt` client. Port **4000**.
- **Frontend:** Next.js 16 App Router, React 19, Tailwind CSS 4, Axios, Zod and lucide-react. Port **3001**.
- **One** backend deployment and **one** PostgreSQL database. The MQTT worker is a lifecycle-managed Nest provider, not a separate service.

Architecture follows the reference project [Factory-Traffic-Management-System](https://github.com/romanrazan/Factory-Traffic-Management-System):
root npm workspaces, feature folders directly under `backend/src` (`<feature>.controller|service|repository|module.ts`, `dtos/`, `entities/`),
and a typed frontend service layer with non-overlapping polling.

See also: [API.md](API.md), [DEMO.md](DEMO.md), [TECHNICAL_EXPLANATION.md](TECHNICAL_EXPLANATION.md),
[REQUIREMENTS_CHECKLIST.md](REQUIREMENTS_CHECKLIST.md), [AI_USAGE.md](AI_USAGE.md).

## 1. Prerequisites

- Node.js ≥ 22.13 (verified with Node 24.17 and npm 11.13)
- PostgreSQL 14+ (verified with PostgreSQL 18). Use any one of these setups:
  - **Docker Compose** (`docker compose up -d`): PostgreSQL 17 on host port 55433, with a persistent volume.
  - **Your existing local PostgreSQL** (for example on port 5432).
  - **A project-local cluster** (this is what was used for verification on Windows). See 2c.

## 2. Database setup

The app needs two databases: `production_events` (app) and `production_events_test` (integration tests only).
Integration tests **truncate every table** and refuse any `TEST_DATABASE_URL` whose database name does not end in `_test`.

### 2a. Docker Compose

```bash
docker compose up -d
```

Creates `production_events`, plus `production_events_test` via `scripts/init-test-db.sql`, on `127.0.0.1:55433`.
The password is `$POSTGRES_PASSWORD` (default `replace_me`). Put the same value in `backend/.env`.
*Docker was not available on the verification machine, so the Compose file is provided but was not executed.*

### 2b. Existing local PostgreSQL

```sql
CREATE DATABASE production_events;
CREATE DATABASE production_events_test;
```

Then set `DATABASE_HOST/PORT/USER/PASSWORD/NAME` and `TEST_DATABASE_URL` in `backend/.env` to your server's values.

### 2c. Project-local cluster (Windows example, PostgreSQL 18 binaries)

```bash
"C:/Program Files/PostgreSQL/18/bin/initdb.exe" -D .pgdata -U postgres -A trust
"C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe" -D .pgdata -o "-p 55433" -l .pgdata/server.log start
"C:/Program Files/PostgreSQL/18/bin/createdb.exe" -h 127.0.0.1 -p 55433 -U postgres production_events
"C:/Program Files/PostgreSQL/18/bin/createdb.exe" -h 127.0.0.1 -p 55433 -U postgres production_events_test
```

`.pgdata/` is gitignored. It uses trust auth on localhost only, so it suits development and never production.

### pgAdmin

Register a server with Host `127.0.0.1`, Port `55433` (or your own port), Maintenance DB `production_events`,
Username `postgres`, and your password (empty for the trust-auth local cluster). Tables: `production_sources`,
`production_events`, `submission_attempts`, `mqtt_challenges`, and TypeORM's `migrations`.

## 3. Configuration

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

| Variable | Default / example | Meaning |
|---|---|---|
| `NODE_ENV` | `development` | |
| `PORT` | `4000` | Backend HTTP port (binds 127.0.0.1) |
| `DATABASE_URL` | *(unset)* | **Takes precedence** over all `DATABASE_*` values when set |
| `DATABASE_HOST` / `DATABASE_PORT` | `127.0.0.1` / `55433` | |
| `DATABASE_USER` / `DATABASE_PASSWORD` | `postgres` / `replace_me` | No hidden fallback password in code |
| `DATABASE_NAME` | `production_events` | |
| `TEST_DATABASE_URL` | `postgresql://postgres:replace_me@127.0.0.1:55433/production_events_test` | Must end in `_test` |
| `CORS_ORIGIN` | `http://localhost:3001,http://127.0.0.1:3001` | Comma-separated |
| `MQTT_ENABLED` | `true` | `false` disables the worker |
| `MQTT_BROKER_URL` | `mqtt://152.42.238.142:1883` | Examiner broker |
| `MQTT_CANDIDATE_ID` | `07` | A string, so the leading zero is preserved |
| `MQTT_HEARTBEAT_MS` | `30000` | Clamped to 1000–30000 |
| `MQTT_SIMULATOR_BROKER_URL` | `mqtt://127.0.0.1:1883` | Used only by `npm run mqtt:simulate` |
| `NEXT_PUBLIC_API_URL` (frontend) | `http://localhost:4000/api` | |

TypeORM runs with `synchronize: false`. The schema comes only from migrations.

## 4. Install, migrate, run

```bash
npm install
npm run db:migrate
npm run dev:backend
npm run dev:frontend
```

- Dashboard: http://localhost:3001
- API: http://localhost:4000/api (health at `GET /api/health`)
- Swagger UI: http://localhost:4000/docs (JSON at `/docs-json`)

Production build:

```bash
npm run build
npm run start:backend
npm run start:frontend
```

Other root scripts: `typecheck`, `lint`, `test`, `test:integration`, `mqtt:broker`, `mqtt:simulate`.
Revert the last migration with `npm run migration:revert -w backend`, and list migrations with `npm run migration:show -w backend`.

## 5. Tests

```bash
npm test
npm run test:integration
```

- `npm test` runs pure domain unit tests (validation, normalization, policy, challenge validation).
- `npm run test:integration` runs Supertest and real PostgreSQL tests against `TEST_DATABASE_URL`. These include concurrency races, restart durability, MQTT replay, and a real MQTT worker running against a spawned local broker.

## 6. REST quick examples

```bash
curl -X POST http://localhost:4000/api/events -H "Content-Type: application/json" -d '{"source_id":"LINE-01","event_id":"EV-101","type":"COUNT","quantity":5,"target_event_id":null,"event_time":"2026-10-09T10:30:00Z"}'
curl "http://localhost:4000/api/state?view=summary&source_id=LINE-01"
curl -X POST http://localhost:4000/api/ack -H "Content-Type: application/json" -d '{"event_ids":["EV-101"]}'
```

Full contracts are in [API.md](API.md).

## 7. MQTT

| Item | Value |
|---|---|
| Broker | `MQTT_BROKER_URL` (default `mqtt://152.42.238.142:1883`), MQTT 3.1.1, QoS 1, `retain=false` |
| Client ID | `fse01-{candidate_id}-{6 hex chars}`, e.g. `fse01-07-8debc8` |
| Subscribe | `fse-01/07/challenge` |
| Publish response | `fse-01/07/response` |
| Publish status | `fse-01/07/status`: `ONLINE` after subscribing, `HEARTBEAT` every ≤30 s, `OFFLINE` on shutdown and as Last Will |

Flow: a challenge is received → the whole envelope is validated → events go through `ProductionEventsService.processBatch`
(the same code as REST) → results, the six-field state, and the exact serialized response are committed in **one** transaction
→ the response is published **after commit**. If a publish fails, the stored response is retried on reconnect and on each heartbeat.
An identical redelivery replays the stored response byte-for-byte. The same `challenge_id` with a different body returns `FAILED/CHALLENGE_CONFLICT`.
Worker state is available at `GET /api/mqtt/status` and in the dashboard's MQTT panel.

### Local simulation (no Docker or mosquitto needed)

Use three terminals:

```bash
npm run mqtt:broker
```

```bash
npm run dev:backend
```

```bash
npm run mqtt:simulate
```

1. `npm run mqtt:broker` starts a local aedes broker on 127.0.0.1:1883.
2. Start the backend with `MQTT_BROKER_URL=mqtt://127.0.0.1:1883` in `backend/.env`.
3. `npm run mqtt:simulate` sends four challenges: normal processing, exact replay, changed body (conflict), and expired.

The simulator reads only `MQTT_SIMULATOR_BROKER_URL` and refuses non-local brokers unless you pass `--allow-remote`,
so it cannot accidentally inject fake challenges into the examiner's broker.

## 8. Project layout

```
production-event-dashboard/
  package.json, package-lock.json, docker-compose.yml, scripts/init-test-db.sql
  backend/
    migrations/                       1791511200000-InitialProductionSchema.ts, 1791600000000-WidenQuantityAndAuditIndexes.ts
    scripts/local-mqtt-broker.mjs     local aedes broker (dev/test only)
    src/
      main.ts setup.ts app.module.ts app.controller.ts app.service.ts
      database/        data-source.ts, transaction.ts (READ COMMITTED + retry)
      shared/          clock.service.ts, contracts.ts, domain-events.ts, filters/safe-exception.filter.ts
      production-sources/  module, service, repository, entities/
      production-events/   controller, service, repository, module, dtos/, entities/,
                           domain/ (model, validation, normalization, acknowledgement-policy)
      acknowledgements/    controller, service, repository, module, dtos/
      state/               controller, service, repository, module, dtos/
      audit/               service, repository, module, entities/
      mqtt/                controller, service, worker, repository, module, dtos/, protocol/, entities/
      simulator/           local-mqtt-simulator.ts
    test/              domain.spec.ts + *.integration.spec.ts
  frontend/src/
    app/ components/ features/production/ hooks/ lib/api/ schemas/ services/ types/
  docs/  ai-conversation.md, screenshots/
```

## 9. Known limitations

- The examiner broker connection was verified on 2026-10-09: the worker connected, subscribed, and its HEARTBEAT was observed on the broker. No examiner challenge arrived during that window, so a real examiner challenge/response round trip is still unverified (see [REQUIREMENTS_CHECKLIST.md](REQUIREMENTS_CHECKLIST.md)).
- `docker-compose.yml` was not executed because Docker is not installed on the verification machine.
- `npm audit` reports 2 moderate advisories in production dependencies (`js-yaml` inside `@nestjs/swagger`; the only fix is a forced major change). The other advisories are in dev-only tooling.
- Advisory locks serialize work per logical event ID. That is ample for one factory, but it caps write throughput on very hot IDs (see TECHNICAL_EXPLANATION.md).
- No authentication. The API binds to 127.0.0.1 and CORS is restricted to the dashboard origin.
