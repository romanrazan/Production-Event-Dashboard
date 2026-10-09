# CSI Smart Tech FSE 01 — Assessment Requirements Audit

**Production Event Processing Dashboard + MQTT Device Integration**

এটি একটি **audit-only** রিপোর্ট। এই audit-এ application source, configuration, existing database data বা Git history কিছুই বদলানো হয়নি। কোনো commit, push বা form submission করা হয়নি। সব runtime যাচাই একটি আলাদা clone, আলাদা `_test` database এবং local MQTT broker-এ করা হয়েছে।

---

## ১. Verdict এবং সবচেয়ে জরুরি gap

### Verdict: **NOT READY**

কারণ: কয়েকটি mandatory requirement নিশ্চিতভাবে **NOT DONE**:

- GitHub-এ push করা হয়নি।
- REST API এবং MQTT success-এর screenshot নেই।

এর বাইরে কয়েকটি mandatory বিষয় বাইরের কারণে **NOT VERIFIED**:

- examiner-এর আসল challenge আসেনি।
- Candidate ID-র exact topic string নিশ্চিত হয়নি।
- spec-এর তিনটি contradiction-এর কোনো examiner clarification রেকর্ড নেই।
- Google Form জমা হয়নি।

### Mandatory atomic rows (142টি)

| Status | সংখ্যা |
|---|---|
| **DONE** | **121** |
| **PARTIALLY DONE** | **6** |
| **NOT DONE** | **3** |
| **NOT VERIFIED** | **12** |

Verified coverage = DONE / সব mandatory row = 121 / 142 = **85.2%**। এটি examiner score নয়।

### সবচেয়ে জরুরি (P0)

1. **CI-02: Candidate topic identifier নিশ্চিত নয়।** Code ধরে নিয়েছে `07`, তাই `fse-01/07/challenge`-এ subscribe করে। কিন্তু spec-এর উদাহরণ `CAND-017`। Examiner যদি `CAND-007`-এর মতো ID ব্যবহার করে, তাহলে worker কোনো challenge পাবে না। Audit-এ দেখা গেছে `"7"` এবং `"CAND-007"` দুটোই `CANDIDATE_MISMATCH` হয়।
2. **SB-03: GitHub repository নেই।** `git remote -v` খালি। Spec (p2 §3, p7 §11) GitHub-এ push চায়।
3. **MQ-23: আসল examiner challenge-এর evidence নেই।** একই session-এর আগে (07:14Z) real broker-এ connect, subscribe এবং HEARTBEAT দেখা গিয়েছিল। কিন্তু examiner-এর পাঠানো কোনো challenge বা response round trip দেখা যায়নি।
4. **SB-13: Google Form submission এবং deadline**-এর কোনো evidence নেই। এটি আপনার হাতে, audit তা জমা দেয়নি।

### গুরুত্বপূর্ণ P1

- **CF-C (VOID acknowledgement contradiction):** §9-এর frontend note বলে "Pending-এ শুধু COUNT"। কিন্তু UI-তে Pending-এ VOID দেখায়। Demo-তে examiner এটাই প্রথমে দেখবেন।
- **SB-10 / SB-11:** REST এবং MQTT screenshot নেই।
- **SB-07:** পূর্ণ AI conversation record নেই।
- **MQ-14:** `expires_at`-এর আগে publish করার কোনো guard নেই।
- **MQ-24:** commit-এর আগে PUBACK চলে যায়, এই crash window খোলা।

---

## ২. Scope এবং environment

| বিষয় | মান |
|---|---|
| Project directory | `D:\AIUB\Internship Task\production-event-dashboard` |
| Branch / HEAD | `main` / `a3ef307b5badbc28a099d9bd78cc52d4c4495562` |
| Uncommitted changes (audit শুরুতে, 08:01Z) | **নেই** (`git status --short` খালি)। Audited snapshot তাই HEAD `a3ef307`। Gitignored ফাইলের মধ্যে আছে `production-event-dashboard-submission.zip` এবং `backend/.env` |
| Audit চলাকালে বাইরের পরিবর্তন (audit করেনি) | `Production-Assessment-Codex-Instructions.md` **deleted** এবং untracked `Production-Assessment-Instructions.md` তৈরি হয়েছে। Content হুবহু এক (`diff` = identical), অর্থাৎ শুধু rename। Commit না করলে ZIP বা GitHub-এ পুরনো নাম থেকে যাবে, এবং `docs/ai-conversation.md`-এ পুরনো নামের উল্লেখ আছে |
| Audit-এর নতুন untracked ফাইল | `ASSESSMENT_REQUIREMENTS_AUDIT.md`, `ASSESSMENT_REQUIREMENTS_MATRIX.csv`, `audit-evidence/` |
| Audit timestamp | 2026-10-09T08:01Z – 08:20Z (UTC) |
| Runtime | Node v24.17.0, npm 11.13.0, Windows 11 Pro |
| Database | PostgreSQL 18.4, project-local cluster `127.0.0.1:55433`। Audit-এর জন্য নতুন DB: `production_events_audit_test` (integration tests) এবং `production_events_audit_e2e_test` (runtime)। Operational DB `production_events`-এ হাত দেওয়া হয়নি |
| Isolated snapshot | HEAD-এর `git clone` → scratchpad, তারপর `npm ci`। Lockfile মূলটির সঙ্গে byte-identical (`cmp`) |
| Audit ports | backend 4100, frontend 3101, local aedes broker 18883। Examiner broker-এ কোনো test message পাঠানো হয়নি |
| Specification | ৭ পৃষ্ঠার assessment (clipboard photos `codex-clipboard-*.png`, 2026-10-09 12:20–12:21)। সব পৃষ্ঠা পড়া গেছে। পৃষ্ঠা ৩-এর বাম উপরের কোণ সামান্য কাটা, তবে folder layout পড়া যায়। কোনো পৃষ্ঠা অনুপস্থিত নেই |
| Reference repo | `Factory-Traffic-Management-System` শুধু style reference হিসেবে ধরা হয়েছে। Workspace-এ আলাদা production-event project আছে, তাই traffic feature গণনা করা হয়নি |
| Examiner clarification | **কোনো রেকর্ড পাওয়া যায়নি।** `Production-Assessment-Codex-Instructions.md`-এর fallback-গুলো examiner-এর নিশ্চিতকরণ নয় |

### Row category

| Category | অর্থ |
|---|---|
| `MANDATORY` | assessment-এর বাধ্যতামূলক requirement (rubric-এর reliability অংশসহ) |
| `MANDATORY-HUMAN` | বাধ্যতামূলক, কিন্তু যাচাইয়ের জন্য মানুষের বা ঐতিহাসিক evidence দরকার |
| `OPTIONAL-BONUS` | Protocol Buffers bonus, mandatory গণনায় নেই |
| `CONVENTION` | আপনার নিজের coding convention |
| `RECOMMENDATION` | অতিরিক্ত engineering পরামর্শ |
| `CROSS-REFERENCE` | একই contradiction-এর দ্বিতীয় উল্লেখ, দুবার গণনা এড়াতে আলাদা |

---

## ৩. Status গণনা (সব row)

| Category | DONE | PARTIALLY DONE | NOT DONE | NOT VERIFIED |
|---|---|---|---|---|
| MANDATORY (137) | 121 | 6 | 3 | 7 |
| MANDATORY-HUMAN (5) | 0 | 0 | 0 | 5 |
| **Mandatory মোট (142)** | **121** | **6** | **3** | **12** |
| OPTIONAL-BONUS | 0 | 0 | 1 | 0 |
| CONVENTION | 3 | 0 | 0 | 0 |
| RECOMMENDATION | 0 | 1 | 0 | 0 |
| CROSS-REFERENCE | 0 | 0 | 0 | 1 |

---

## ৪. সম্পূর্ণ requirement matrix

পূর্ণ কলামসহ সংস্করণ `ASSESSMENT_REQUIREMENTS_MATRIX.csv`-এ। সেখানে Implementation Evidence, Reproduction/Command, Recommended Correction এবং Blocker/Ambiguity কলামও আছে।

Evidence-এর সংক্ষেপ:

| সংকেত | অর্থ | কোথায় |
|---|---|---|
| `H01`…`H23` | audit-only harness check | `audit-evidence/22_harness_phase1.log`, `24_harness_phase2.log` |
| IT | committed integration test | `audit-evidence/09_all_tests.txt` |
| UT | committed unit test | `audit-evidence/09_all_tests.txt` |
| probe | validation probe | `audit-evidence/26_validation_probes.log` |

| ID | Page/Section | Requirement | Cat | Status | Verification | Reference | Actual vs Expected | Missing | Priority |
|---|---|---|---|---|---|---|---|---|---|
| AR-01 | p1 §1 | Production supervisor: reliable totals, inspect exceptions, acknowledge reviewed events | MANDATORY | DONE | PASS | frontend/src/features/production/dashboard.tsx; events-table.tsx | UI values == API summary; ACK reflected | — | — |
| AR-02 | p1 §1 | Factory floor operator: submit a count or correction manually | MANDATORY | DONE | PASS | features/production/event-form.tsx | EV-301 ACCEPTED, EV-302/#3/EV-303 REJECTED with reasons | — | — |
| AR-03 | p1 §1 | Support team: device connection, last challenge, trace errors without losing history | MANDATORY | DONE | PASS | mqtt-status-panel.tsx; mqtt-worker.service.ts:getStatus | connected/subscribed shown; history never deleted (no DELETE paths) | — | — |
| AR-04 | p2 §4 | ONE backend application, ONE deployment, ONE PostgreSQL database; no separate microservices | MANDATORY | DONE | INSPECTION VERIFIED | backend/src/app.module.ts; mqtt/mqtt.module.ts | single process handled REST + MQTT (H01–H20) | — | — |
| AR-05 | p2-3 §4 | Modules own responsibilities: events, acknowledgement, state, MQTT, audit, shared | MANDATORY | DONE | INSPECTION VERIFIED | backend/src/* | matches suggested layout (Nest naming) | — | — |
| AR-06 | p2 §4 | Controllers/routes thin | MANDATORY | DONE | INSPECTION VERIFIED | production-events.controller.ts:16 ingest; acknowledgements.controller.ts; state.controller.ts | no business rules in controllers | — | — |
| AR-07 | p2 §4 | Business rules in services; database commands in repositories/data-access | MANDATORY | DONE | INSPECTION VERIFIED | production-events.service.ts; state.repository.ts; acknowledgements.repository.ts; mqtt.repository.ts; audit.repository.ts | consistent separation | — | — |
| AR-08 | p2 §4 | Small functions with clear inputs/outputs (validate_event, process_count, process_void, resolve_pending_voids, acknowledge_event, get_summary, handle_mqtt_challenge) | MANDATORY | DONE | INSPECTION VERIFIED | validation.ts:34; production-events.service.ts:29,71,94,119,164; acknowledgements.service.ts:21,35; state.service.ts:9-15; challenge-validation.ts:13; mqtt.service.ts:40 | all named functions exist and are exercised by tests | — | — |
| AR-09 | p2 §4, p5 §8, p6 §8.2(2) | REST and MQTT call the SAME event-processing function | MANDATORY | DONE | PASS | mqtt.service.ts:51-90; production-events.controller.ts:16 | 3 attempts + logical events created via MQTT path | — | — |
| AR-10 | p5 §8 | MQTT reads state through the same query functions as REST | MANDATORY | DONE | PASS | mqtt.service.ts:51-90; state.service.ts:9 | six-field state in response | — | — |
| AR-11 | p2 §4 | Internal notifications/callbacks (EVENT_ACCEPTED, VOID_RESOLVED, EVENT_ACKNOWLEDGED) where useful, only after successful DB work | MANDATORY | PARTIALLY DONE | INSPECTION VERIFIED | shared/domain-events.ts (constants only, unused) | constants defined but never emitted/subscribed | No notification/callback mechanism is emitted after commit | P2 |
| AR-12 | p2 §4, p7 §10 | Changing a rule in one function must not require editing routes/unrelated modules | MANDATORY | DONE | INSPECTION VERIFIED | production-events/domain/acknowledgement-policy.ts:12,17 | single owning file; routes/MQTT/frontend read the result only | Live change not executed in this audit (would modify source) | — |
| AR-13 | p2 §4 | Do not duplicate COUNT/VOID logic in routes, MQTT handlers, frontend | MANDATORY | DONE | INSPECTION VERIFIED | production-events.service.ts:94-192; frontend has no total computation | no duplication found | — | — |
| AR-14 | p2 §4, p7 §11 | Credible future microservice migration path explained | MANDATORY | DONE | INSPECTION VERIFIED | TECHNICAL_EXPLANATION.md | ingestion / query / device-gateway split described | — | — |
| AR-15 | p2 §3 | PostgreSQL is the persistent database (no SQLite/in-memory) | MANDATORY | DONE | PASS | backend/src/database/data-source.ts | real PostgreSQL 18.4 | — | — |
| CF-A | p3 §5.1 vs p5 §7 | Event identity: globally unique event_id (§5.1) vs composite unique (source_id, event_id) (§7) | MANDATORY | NOT VERIFIED | PASS (implemented policy works) | migrations/1791511200000-InitialProductionSchema.ts:31 | implemented policy consistent in DB, REST, MQTT, frontend, tests | No recorded examiner clarification | P1 |
| CF-B | p3 §5.2 + p4 §6.1 vs p5 §7 | Batch: valid items succeed despite invalid items vs roll back whole batch on validation failure | MANDATORY | NOT VERIFIED | PASS (implemented policy works) | production-events.service.ts:34 processBatchInTransaction | consistent across REST and MQTT (H14 REJECTED item inside COMPLETED) | No recorded examiner clarification | P1 |
| CF-C | p4 §6.2-6.3 vs p6 §9 note | VOID acknowledgement: completed COUNT and VOID manually acknowledged & in Pending vs VOID auto-acknowledged, Pending shows COUNT only | MANDATORY | NOT VERIFIED | PASS (implemented policy works) | acknowledgement-policy.ts:12,17; state.repository.ts:57 | implemented consistently in DB queries, REST, MQTT state, frontend, tests | No examiner clarification; §9 frontend note is explicitly contradicted by implemented UI (Pending shows VOID rows) | P1 |
| CI-01 | p1 header, p5 §8 | Candidate ID 07 configured with leading zero preserved; topics fse-01/07/* | MANDATORY | DONE | PASS | mqtt.service.ts (candidateId); mqtt-worker.service.ts:50-53; backend/.env.example | client_id fse01-07-d16fdf; topics fse-01/07/{challenge,response,status} | — | — |
| CI-02 | p5 §8 ('Assigned by examiner') | Exact examiner topic identifier confirmed (07 vs 7 vs CAND-007 style, cf. example CAND-017) | MANDATORY | NOT VERIFIED | NOT RUN | backend/.env (MQTT_CANDIDATE_ID) | If the examiner simulator uses e.g. 'CAND-007', the worker would never receive challenges on fse-01/07/challenge | Examiner confirmation of the exact identifier string | P0 |
| EV-01 | p3 §5.1 | source_id: required non-empty string | MANDATORY | DONE | PASS | validation.ts:34 | REJECTED 'source_id must be a non-empty string' | — | — |
| EV-02 | p3 §5.1 | event_id: required non-empty string | MANDATORY | DONE | PASS | validation.ts:34 | REJECTED 'event_id must be a non-empty string' | — | — |
| EV-03 | p3 §5.1 | type exactly COUNT or VOID | MANDATORY | DONE | PASS | validation.ts | 'count' REJECTED | — | — |
| EV-04 | p3 §5.1 | COUNT quantity positive integer | MANDATORY | DONE | PASS | validation.ts | all invalid forms REJECTED | — | — |
| EV-05 | p3 §5.1 | COUNT target_event_id null or omitted | MANDATORY | DONE | PASS | validation.ts | string → REJECTED, null → valid | — | — |
| EV-06 | p3 §5.1 | VOID target_event_id = ID of the COUNT being reversed (required) | MANDATORY | DONE | PASS | validation.ts; production-events.service.ts:186 voidRejection | REJECTED with reasons | — | — |
| EV-07 | p3 §5.1 | VOID quantity null or omitted | MANDATORY | DONE | PASS | validation.ts | 0 → REJECTED; omitted → valid | — | — |
| EV-08 | p3 §5.1 | event_time ISO 8601 with timezone | MANDATORY | DONE | PASS | validation.ts:11 isZonedIsoTimestamp | zone-less REJECTED; offsets accepted | — | — |
| EV-09 | p3 §5.1 | Event time kept separate from server receipt time | MANDATORY | DONE | PASS | production-event.entity.ts; state.repository.ts:57 | event_time 10:30Z vs received_at server time | — | — |
| EV-10 | p3 §5.2 'same normalized data' | Normalization rules documented (null≡omitted, equivalent offsets, trimming) | MANDATORY | PARTIALLY DONE | PASS (behaviour) / gaps | normalization.ts:28 normalizeEvent | Two choices are NOT documented: (1) sub-millisecond event_time digits are truncated (…00.1234Z vs …00.1239Z → DUPLICATE, H12); (2) POST /api/ack does not trim IDs (' X ' → NOT_FOUND while events trim, H12b) | Documentation (and possibly behaviour) for these two choices | P2 |
| BR-01 | p3 §5.2 | COUNT adds its quantity only once after successful processing | MANDATORY | DONE | PASS | production-events.service.ts:94 processCount | net 5 / 6 as expected | — | — |
| BR-02 | p3 §5.2 | VOID reverses one accepted COUNT; same source_id required | MANDATORY | DONE | PASS | production-events.service.ts:119 processVoid, :186 | cross-source REJECTED; same-source ACCEPTED, net restored | — | — |
| BR-03 | p3 §5.2 | One COUNT can be reversed only once | MANDATORY | DONE | PASS | migration :37-40 | exactly 1 accepted reversal | — | — |
| BR-04 | p3 §5.2 | VOID before COUNT stored as PENDING_REFERENCE | MANDATORY | DONE | PASS | processVoid | PENDING_REFERENCE, unresolved 1, net unchanged | — | — |
| BR-05 | p3 §5.2 | Resolve automatically when the matching COUNT arrives | MANDATORY | DONE | PASS | production-events.service.ts:164 | VOID → ACCEPTED, processed 3, net 5 (5+3−3) | — | — |
| BR-06 | p3 §5.2 | Several pending VOIDs: first stored valid VOID wins | MANDATORY | DONE | PASS | production-events.repository.ts:24 pendingVoids | WIN accepted, WRONG-source/LOSE rejected | — | — |
| BR-07 | p3 §5.2 | Reject the other pending VOIDs with clear reasons | MANDATORY | DONE | PASS | resolvePendingVoids | 'Target COUNT was already reversed by …', 'VOID source_id must match …' | — | — |
| BR-08 | p3 §5.2, p4 §6.1 | Process batch items in submitted order; preserve order in response | MANDATORY | DONE | PASS | processBatchInTransaction | 7 ordered results incl. null event_id for malformed | — | — |
| BR-09 | p3 §5.2, p4 §6.1 | Invalid item REJECTED and recorded; valid items in same batch still succeed | MANDATORY | DONE | PASS | production-events.service.ts:34; audit.repository.ts:23 | valid M1/M2 committed | — | — |
| BR-10 | p3 §5.2 table | Same event ID + same normalized data → DUPLICATE, never processed twice | MANDATORY | DONE | PASS | processEvent :71 | DUPLICATE, total unchanged, attempt stored | — | — |
| BR-11 | p3 §5.2 table | Same event ID + different data → CONFLICT, original preserved | MANDATORY | DONE | PASS | processEvent | CONFLICT; original quantity 5 kept | — | — |
| BR-12 | p3 §5.2 | Keep every rejected submission, duplicate attempt and conflict attempt in persistent storage | MANDATORY | DONE | PASS | audit.repository.ts:23 | attempt counts match item counts | — | — |
| BR-13 | p3 §5.2, p5 §7 | PostgreSQL constraints and transactions prevent double counting under repeated/concurrent requests | MANDATORY | DONE | PASS | production-events.repository.ts:36 lockLogicalIds; database/transaction.ts:18 | no double counting | — | — |
| RE-01 | p4 §6.1 | POST /api/events accepts one event object or a JSON array | MANDATORY | DONE | PASS | production-events.controller.ts:16 | both accepted | — | — |
| RE-02 | p4 §6.1 | One result per submitted item, original order, {results:[{event_id,status,message}]} | MANDATORY | DONE | PASS | processBatchInTransaction | shape and order correct | — | — |
| RE-03 | p4 §6.1 | Allowed statuses ACCEPTED, DUPLICATE, CONFLICT, PENDING_REFERENCE, REJECTED | MANDATORY | DONE | PASS | shared/contracts.ts | all five observed | — | — |
| RE-04 | p4 §6.1 | HTTP 200 when top-level JSON is an event or array even if items REJECTED | MANDATORY | DONE | PASS | controller | 200 | — | — |
| RE-05 | p4 §6.1 | HTTP 400 when the top-level request cannot be interpreted as event/array | MANDATORY | DONE | PASS | controller; setup.ts | all 400 | — | — |
| RE-06 | p4 §6.1 | Do not undo valid items because another item is invalid | MANDATORY | DONE | PASS | processBatchInTransaction | valid items persisted | — | — |
| RE-07 | p3 §5.2 (audit) + p4 §6.1 | Global validation does not bypass required audit persistence | MANDATORY | DONE | PASS | controller.ts:16; setup.ts:10 | every item audited | — | — |
| RE-08 | p4 §6.2 | GET /api/state: optional source_id; view ∈ summary\|pending\|exceptions | MANDATORY | DONE | PASS | state/dtos/state-query.dto.ts | validated | — | — |
| RE-09 | p4 §6.2 | summary returns exactly net_total, processed_events, pending_ack, unresolved, duplicates, conflicts | MANDATORY | DONE | PASS | state.repository.ts:25 | exact keys | — | — |
| RE-10 | p4 §6.2 | net_total = accepted COUNT − successfully applied VOID quantities | MANDATORY | DONE | PASS | state.repository.ts:25 | correct | — | — |
| RE-11 | p4 §6.2 | processed_events = distinct completed COUNT and VOID; unresolved VOID joins after resolution | MANDATORY | DONE | PASS | state.repository.ts | correct | — | — |
| RE-12 | p4 §6.2 | pending_ack = processed/resolved events not yet acknowledged | MANDATORY | DONE | PASS | acknowledgement-policy.ts:17 | consistent under documented policy | — | — |
| RE-13 | p4 §6.2 | unresolved = valid VOID events still waiting for target | MANDATORY | DONE | PASS | state.repository.ts | 1 → 0 | — | — |
| RE-14 | p4 §6.2 | duplicates/conflicts = number of stored attempts | MANDATORY | DONE | PASS | state.repository.ts | attempt-based | — | — |
| RE-15 | p4 §6.2 | pending view: successfully processed COUNT/VOID ready for ACK and not yet acknowledged | MANDATORY | DONE | PASS | state.repository.ts:57 | includes COUNT and VOID | — | — |
| RE-16 | p4 §6.2 | exceptions view: unresolved references, rejected submissions, conflict attempts, with reasons | MANDATORY | DONE | PASS | state.repository.ts:75 | reasons present | — | — |
| RE-17 | p4 §6.2 | source filter applies stored source to original logical events | MANDATORY | DONE | PASS | state.repository.ts | correct | — | — |
| RE-18 | p4 §6.2 | duplicate/conflict attempts filtered by source_id in the attempt | MANDATORY | DONE | PASS | state.repository.ts | B conflicts 1 | — | — |
| RE-19 | p4 §6.2 | invalid submissions without useful source_id only in unfiltered exceptions | MANDATORY | DONE | PASS | state.repository.ts | correct | — | — |
| RE-20 | p4 §6.3 | POST /api/ack {event_ids:[…]} → one result per requested ID, in order | MANDATORY | DONE | PASS | acknowledgements.service.ts:21 | ordered | — | — |
| RE-21 | p4 §6.3 | Statuses ACKED / ALREADY_ACKED / NOT_READY / NOT_FOUND with stated meanings | MANDATORY | DONE | PASS | acknowledgements.service.ts:35 | [ACKED, ALREADY_ACKED, ACKED, NOT_READY, NOT_FOUND, NOT_FOUND] | — | — |
| RE-22 | p4 §6.3 | Second copy of an ID in one request becomes ALREADY_ACKED | MANDATORY | DONE | PASS | acknowledgeInTransaction | second copy ALREADY_ACKED | — | — |
| RE-23 | p4 §6.3, p5 §7 | Repeated/concurrent acknowledgement is safe | MANDATORY | DONE | PASS | acknowledgements.service.ts:25 | safe | — | — |
| RE-24 | p4 §6.3 | Acknowledgement never deletes history | MANDATORY | DONE | PASS | acknowledgeEvent | history intact | — | — |
| RE-25 | p4 §6.3 | Acknowledgement does not prevent a later valid VOID | MANDATORY | DONE | PASS | voidRejection | VOID ACCEPTED on ACKed COUNT | — | — |
| RE-26 | p4 §6.3 | Both completed COUNT and completed VOID can be acknowledged through the API | MANDATORY | DONE | PASS | acknowledgement-policy.ts:12 | ACKED | — | — |
| DB-01 | p5 §7 | Store logical events, all submission attempts, original payload/normalized values, status, failure reason, event time, receipt time, acknowledgement info | MANDATORY | DONE | PASS | migrations/1791511200000-InitialProductionSchema.ts | all columns present and populated | — | — |
| DB-02 | p5 §7 | Store MQTT challenge responses (challenge_id, request digest/body, serialized result, timestamps, status) | MANDATORY | DONE | PASS | mqtt.repository.ts:16 | 5 challenges stored with response_payload and published_at | — | — |
| DB-03 | p5 §7 table | Suggested tables production_sources, production_events, submission_attempts, mqtt_challenges | MANDATORY | DONE | PASS | migrations | all four exist | — | — |
| DB-04 | p5 §7 | Integrity/uniqueness constraints exist in the database | MANDATORY | DONE | PASS | migrations | present in live audit DB | — | — |
| DB-05 | p5 §7 | Protect competing COUNT/VOID updates (incl. target row not yet existing) | MANDATORY | DONE | PASS | lockLogicalIds | converges, net 0 | — | — |
| DB-06 | p5 §7 | Protect competing reversals and acknowledgement state | MANDATORY | DONE | PASS | — | safe | — | — |
| DB-07 | p5 §7 | Rejections preserve diagnostic history | MANDATORY | DONE | PASS | — | reasons + raw payload kept | — | — |
| DB-08 | p5 §7 (appropriate transactions) | Database errors do not leave transactions silently aborted / mislabelled | MANDATORY | NOT VERIFIED | INSPECTION VERIFIED | database/transaction.ts:18; shared/filters/safe-exception.filter.ts:5 | no fault-injection run | Runtime fault-injection evidence | P2 |
| DB-09 | p5 §7 | Summary totals from durable evidence (not process memory) | MANDATORY | DONE | PASS | state.repository.ts:25 | durable | — | — |
| DB-10 | p5 §7, p7 §13 | Data survives server restart (state, acknowledgements) | MANDATORY | DONE | PASS | — | identical summaries; ALREADY_ACKED | — | — |
| DB-11 | p5 §7, p6 §8.2(4) | Duplicate handling and MQTT replay survive restart | MANDATORY | DONE | PASS | — | durable | — | — |
| DB-12 | p5 §7 | Migration/initialization command | MANDATORY | DONE | PASS | package.json; backend/package.json migration:run | exit 0 | — | — |
| DB-13 | p5 §7, p7 §11 | Usable .env.example without real secrets | MANDATORY | DONE | INSPECTION VERIFIED | backend/.env.example; frontend/.env.local.example | no real secrets | — | — |
| DB-14 | p5 §7 | Never expose SQL credentials, stack traces or internal secrets in API errors | MANDATORY | DONE | PASS (400 paths) / INSPECTION VERIFIED (500 path) | shared/filters/safe-exception.filter.ts:5 | no stack/credentials in 7 error bodies | 500 path not induced | — |
| MQ-01 | p5 §8 | Outbound MQTT client to examiner broker 152.42.238.142:1883 | MANDATORY | DONE | PASS (2026-10-09T07:14Z, earlier in this session; worker code unchanged since 8f0dc12) | mqtt-worker.service.ts:67 | connected & subscribed to real broker | Not re-run in this audit (no authorization to touch shared topics) | — |
| MQ-02 | p5 §8 | MQTT 3.1.1 or 5.0 | MANDATORY | DONE | PASS | mqtt-worker.service.ts:67 | 3.1.1 accepted | — | — |
| MQ-03 | p5 §8 | Subscribe fse-01/{id}/challenge; publish fse-01/{id}/response and /status; only own topics | MANDATORY | DONE | PASS | mqtt-worker.service.ts:51-53 | correct topics | — | — |
| MQ-04 | p5 §8 | Client ID fse01-{candidate_id}-{short_random_suffix} | MANDATORY | DONE | PASS | mqtt-worker.service.ts:50 | matches | — | — |
| MQ-05 | p5 §8 | QoS 1 and retain=false for challenge, response and status | MANDATORY | DONE | PASS | mqtt-worker.service.ts:74,90,180 | qos 1, retain false | — | — |
| MQ-06 | p6 §8.2(1) | Validate protocol_version, candidate_id, challenge_id, PROCESS_EVENTS, expiry, events collection | MANDATORY | DONE | PASS | challenge-validation.ts:13 | all checks enforced | — | — |
| MQ-07 | p6 §8.2(1) | Reject expired/mismatched challenges before processing events | MANDATORY | DONE | PASS | mqtt.service.ts:51 | FAILED, no effects | — | — |
| MQ-08 | p6 §8.2(2) | One shared event service and PostgreSQL model for MQTT and REST; candidate_id is envelope metadata only | MANDATORY | DONE | PASS | mqtt.service.ts; production-event.entity.ts | events keyed by event_id only | — | — |
| MQ-09 | p6 §8.2(3), §8.3 | COMPLETED response: matching challenge_id, ordered event results, current six-field state | MANDATORY | DONE | PASS | mqtt.service.ts:51 | correct | — | — |
| MQ-10 | p6 §8.2(3) | Invalid item may be REJECTED while challenge is COMPLETED | MANDATORY | DONE | PASS | — | COMPLETED | — | — |
| MQ-11 | p6 §8.2(4) | Persist each challenge_id and response | MANDATORY | DONE | PASS | mqtt.repository.ts:16 | persisted | — | — |
| MQ-12 | p6 §8.2(4) | Same ID + same body returns original response without processing again | MANDATORY | DONE | PASS | mqtt.service.ts:51 | byte-identical, 0 new attempts | — | — |
| MQ-13 | p6 §8.2(4) | Same ID + changed body → FAILED / CHALLENGE_CONFLICT | MANDATORY | DONE | PASS | mqtt.service.ts | FAILED/CHALLENGE_CONFLICT, no effects | — | — |
| MQ-14 | p6 §8.2(5) | Publish before expires_at | MANDATORY | PARTIALLY DONE | PASS (normal path, local) / FAIL-BY-INSPECTION (retry path) | mqtt-worker.service.ts:115 onMessage, :153 flushUnpublished | No expires_at check: flushUnpublished republishes stored COMPLETED responses even after expiry; slow processing is not bounded by expires_at | Expiry guard on publish/retry; real-broker latency evidence | P1 |
| MQ-15 | p6 §8.2(5) | Stable failure codes VALIDATION_ERROR, CANDIDATE_MISMATCH, UNSUPPORTED_PROTOCOL, CHALLENGE_EXPIRED, CHALLENGE_CONFLICT | MANDATORY | DONE | PASS | mqtt-contracts.ts | all five observed | — | — |
| MQ-16 | p6 §8.2(5) | INTERNAL_ERROR on infrastructure failure | MANDATORY | NOT VERIFIED | INSPECTION VERIFIED | mqtt.service.ts:98; mqtt-worker.service.ts:115 | not induced at runtime | Runtime evidence | P2 |
| MQ-17 | p6 §8.2(6) | Publish ONLINE after subscription | MANDATORY | DONE | PASS | mqtt-worker.service.ts:84-97 | ONLINE after SUBACK | — | — |
| MQ-18 | p6 §8.2(6) | HEARTBEAT at least every 30 seconds | MANDATORY | DONE | PASS | mqtt-worker.service.ts:192 | observed | — | — |
| MQ-19 | p6 §8.2(6) | OFFLINE as MQTT last will (and on clean shutdown) | MANDATORY | DONE | PASS | mqtt-worker.service.ts:74, :211 | both paths observed | Will payload 'at' is the connect time (stale timestamp) – cosmetic | P2 |
| MQ-20 | p6 §8.2(6) | Reconnect with backoff and resubscribe after disconnect | MANDATORY | DONE | PASS | mqtt-worker.service.ts:99 onClose | reconnect_attempts>0, new challenge answered | — | — |
| MQ-21 | p6 §8.2(6) | Clean up connections/timers on shutdown | MANDATORY | DONE | PASS | mqtt-worker.service.ts:211 | clean | — | — |
| MQ-22 | p6 §8.3 | Correct application response correlation (PUBACK alone insufficient) | MANDATORY | DONE | PASS | — | matching challenge_id + state | — | — |
| MQ-23 | p6 §8.2/§9.1(6), p7 §11 | Real examiner challenge received and correlated response published | MANDATORY | NOT VERIFIED | NOT RUN / BLOCKED | — | no examiner challenge observed | Evidence of one real challenge → response | P0 |
| MQ-24 | p5 §8 (Reliability rubric) | Crash windows: no event effects lost/duplicated between processing, response persistence and publication | MANDATORY | PARTIALLY DONE | PASS (post-commit window) / FAIL-BY-INSPECTION (pre-commit window) | mqtt.service.ts:40; mqtt-worker.service.ts:63-81; node_modules/mqtt/build/lib/handlers/publish.js (case 1) | mqtt.js sends PUBACK immediately after emitting 'message' (default handleMessage) and the worker uses clean:true → a crash after PUBACK but before commit loses the challenge (broker will not redeliver) | Defer PUBACK until commit / persistent session | P1 |
| MQ-25 | p5 §8 (local repeatability) | Local MQTT simulator | MANDATORY | DONE | PASS | backend/src/simulator/local-mqtt-simulator.ts; backend/scripts/local-mqtt-broker.mjs | works | — | — |
| FE-01 | p6 §9 | One responsive dashboard page connected to the real backend | MANDATORY | DONE | PASS | frontend/src/app/page.tsx; dashboard.tsx | values == API | — | — |
| FE-02 | p6 §9 | Input one JSON event or array, submission and result messages | MANDATORY | DONE | PASS | event-form.tsx | 4 ordered result rows with messages | — | — |
| FE-03 | p6 §9 | Six indicators | MANDATORY | DONE | PASS | summary-cards.tsx | 6 cards | — | — |
| FE-04 | p6 §9 | Pending/Exceptions table switch with useful fields, status, reason | MANDATORY | DONE | PASS | events-table.tsx | both tabs, reasons shown | — | — |
| FE-05 | p6 §9 | Select one or multiple pending events, submit ACK, refresh visible data | MANDATORY | DONE | PASS | events-table.tsx | ACK results shown, cards refreshed | — | — |
| FE-06 | p6 §9 | Show MQTT connectivity, candidate ID, last challenge ID/time, last response status, challenge counts, last error | MANDATORY | DONE | PASS | mqtt-status-panel.tsx | all fields rendered | — | — |
| FE-07 | p6 §9 | Loading, success, empty, invalid input and API failure states; real backend values only | MANDATORY | DONE | PASS | dashboard.tsx; event-form.tsx; use-poll.ts | all states observed | — | — |
| FE-08 | p6 §9 | Usable on typical laptop and narrow mobile viewport | MANDATORY | DONE | PASS | app/globals.css | no horizontal overflow | — | — |
| FE-09 | p6 §9 note | Factory workflow note: VOID auto-acknowledged; Pending shows COUNT only | CROSS-REFERENCE | NOT VERIFIED | PASS (implemented policy) | events-table.tsx; acknowledgement-policy.ts | contradicts §9 note | Examiner clarification | P1 |
| DM-01 | p6 §9.1(1-5) | Minimum examiner demo steps 1–5 executable (COUNT +5, duplicate, VOID-before-COUNT, ACK) | MANDATORY | DONE | PASS | DEMO.md | all steps reproduced | — | — |
| DM-02 | p6 §9.1(6) | Show a real MQTT challenge and correlated response on the dashboard; show an error/exception state | MANDATORY | PARTIALLY DONE | PASS (exception state, local challenge) / NOT RUN (real challenge) | mqtt-status-panel.tsx | Panel shows ID+status, not response content; no real challenge yet | Real challenge; optionally response detail on dashboard | P1 |
| TS-01 | p7 §10 | Automated test: COUNT and total | MANDATORY | DONE | PASS | backend/test/events.integration.spec.ts | PASSED | — | — |
| TS-02 | p7 §10 | Automated test: identical duplicate without double counting | MANDATORY | DONE | PASS | events.integration.spec.ts | PASSED | — | — |
| TS-03 | p7 §10 | Automated test: VOID-before-COUNT resolution | MANDATORY | DONE | PASS | events.integration.spec.ts | PASSED | — | — |
| TS-04 | p7 §10 | Automated test: repeated acknowledgement | MANDATORY | DONE | PASS | acknowledgements.integration.spec.ts | PASSED | — | — |
| TS-05 | p7 §10 | Automated test: repeated MQTT challenge without repeated event processing | MANDATORY | DONE | PASS | mqtt.integration.spec.ts | PASSED | — | — |
| TS-06 | p7 §10 (reliability credit) | Tests for conflicts, concurrent requests, mixed batches, restart recovery, reconnect | MANDATORY | DONE | PASS | backend/test/*.integration.spec.ts | all present and passing | — | — |
| SB-01 | p7 §11 | Runnable backend and frontend, migrations, three REST APIs, working MQTT worker | MANDATORY | DONE | PASS | — | fresh clone runs | — | — |
| SB-02 | p2 §3, p7 §11 | Git initialized with at least three genuine progress commits | MANDATORY | DONE | PASS | git log | 5 substantive commits; all authored within 55 min by AI tooling (disclosed in AI_USAGE.md) | — | — |
| SB-03 | p2 §3, p7 §11 | Push a runnable repository to GitHub | MANDATORY | NOT DONE | FAIL | git remote -v (empty) | no GitHub repository | Create GitHub repo and push | P0 |
| SB-04 | p7 §11 | README.md: exact setup, PostgreSQL initialization, run commands, tests, all REST request examples, MQTT topics and sample flow | MANDATORY | DONE | INSPECTION VERIFIED | README.md; API.md | all sections present; full REST examples in API.md (README links) | — | — |
| SB-05 | p7 §11 | TECHNICAL_EXPLANATION.md: entity model, module/function boundaries, transaction & duplicate strategy, pending VOID resolution, restart behaviour, future migration, assumptions | MANDATORY | DONE | INSPECTION VERIFIED | TECHNICAL_EXPLANATION.md | all topics covered | — | — |
| SB-06 | p2 §3, p7 §11 | AI_USAGE.md | MANDATORY | DONE | INSPECTION VERIFIED | AI_USAGE.md | Codex + Claude Code usage and review described | — | — |
| SB-07 | p2 §3, p7 §11 | Relevant/required AI conversation record | MANDATORY | PARTIALLY DONE | INSPECTION VERIFIED | docs/ai-conversation.md | Not a full conversation: Codex prompts/tool turns and the Claude Code transcripts (incl. this audit) are summarised, not included | Exported transcripts (redacted of paths/secrets) | P1 |
| SB-08 | p2 §3, p7 §11 | No .env secrets, passwords, build caches, node_modules, virtual envs in submission | MANDATORY | DONE | PASS | production-event-dashboard-submission.zip | clean | — | — |
| SB-09 | p7 §11 | Screenshot of the working dashboard | MANDATORY | DONE | INSPECTION VERIFIED | docs/screenshots/ | genuine captures | — | — |
| SB-10 | p7 §11 | Screenshot of REST API tests | MANDATORY | NOT DONE | FAIL | docs/screenshots/ | missing | REST API screenshot(s) | P1 |
| SB-11 | p7 §11 | Screenshot of a successful MQTT challenge | MANDATORY | NOT DONE | FAIL | docs/screenshots/ | missing | MQTT success screenshot | P1 |
| SB-12 | p7 §11 | Clean source ZIP without dependencies, caches or credentials | MANDATORY | DONE | PASS | production-event-dashboard-submission.zip (144 files) | clean; must be rebuilt after further changes | — | — |
| SB-13 | p2 §3, p7 §11 | Submit everything through the provided Google Form on time (open it first; follow delivery/deadline) | MANDATORY-HUMAN | NOT VERIFIED | NOT RUN | — | no form/deadline evidence supplied | Form submission + deadline evidence | P0 |
| SB-14 | p2 §3 | Unclear/inconsistent statements: raise question; if unanswered record assumption in TECHNICAL_EXPLANATION.md | MANDATORY | DONE | INSPECTION VERIFIED | TECHNICAL_EXPLANATION.md | assumptions recorded | Whether questions were raised is human evidence (HU-01) | — |
| HU-01 | p2 §3 | Read brief (10 min) and clarify with examiner (≤7 questions); no AI/search in first two stages | MANDATORY-HUMAN | NOT VERIFIED | NOT RUN | — | no record of questions/answers | Clarification notes | P1 |
| HU-02 | p1, p2 §3 | Work within 1 h 45 min stages | MANDATORY-HUMAN | NOT VERIFIED | NOT RUN | git log | start time unknown | Timing evidence | P2 |
| HU-03 | p2 §3, p7 §10 | Explain and change any AI-generated code; live walkthrough; change one rule and show others still work | MANDATORY-HUMAN | NOT VERIFIED | NOT RUN | DEMO.md §8 | cannot be proven from source | Rehearsed walkthrough | P1 |
| HU-04 | p1 §1, p7 §12 | Understanding of customer context, entities and correct assumptions | MANDATORY-HUMAN | NOT VERIFIED | INSPECTION VERIFIED (docs only) | README.md §0; DEMO.md §0 | documentation exists; understanding is assessed live | — | P1 |
| OP-01 | p7 §13 | Optional .proto contract + Protocol Buffers serialization (≤3 bonus marks) | OPTIONAL-BONUS | NOT DONE | NOT RUN | — | not implemented | entire bonus | P2 |
| CV-01 | user convention | NestJS feature folders with <feature>.controller/service/module/repository.ts, dtos/, entities/ | CONVENTION | DONE | INSPECTION VERIFIED | backend/src/* | matches (audit/production-sources have no controller – none needed) | — | — |
| CV-02 | user convention | Next.js app/components/features/hooks/lib/api/schemas/services/types; typed Axios services; Zod; non-overlapping polling | CONVENTION | DONE | INSPECTION VERIFIED | frontend/src/* | matches | — | — |
| CV-03 | user convention | Root npm workspaces, one lockfile, ports 4000/3001 | CONVENTION | DONE | PASS | package.json | matches | — | — |
| RC-01 | engineering recommendation | npm audit: 2 moderate advisories in production deps (js-yaml via @nestjs/swagger) | RECOMMENDATION | PARTIALLY DONE | INSPECTION VERIFIED | package-lock.json | 2 moderate | upgrade when non-breaking fix available | P2 |

---

## ৫. সম্পন্ন requirement (DONE, 121টি mandatory)

প্রতিটির evidence উপরের matrix-এ আছে। এখানে এলাকা অনুযায়ী সারাংশ।

### Architecture

- **কী আছে:** একটি NestJS backend, একটি deployment এবং একটি PostgreSQL। MQTT worker একটি Nest provider।
- **Layering:** controller পাতলা; business logic service-এ; SQL repository-তে।
- **Shared path:** REST এবং MQTT একই `ProductionEventsService.processBatch` এবং `StateService.getSummary` ব্যবহার করে (AR-04…AR-15, শুধু AR-11 বাদে)।
- **Runtime প্রমাণ:** H14-এ MQTT event একই `submission_attempts` এবং `production_events`-এ গেছে।

### Validation

- **EV-01…EV-09:** সব field rule runtime-এ যাচাই হয়েছে (probe + UT + H06)।
- **Coercion হয় না:** `"5"`, `1.5`, `true`, `0` → REJECTED।
- **Timestamp:** timezone ছাড়া → REJECTED। Equivalent offset একই instant হিসেবে ধরা হয় (H02-এ `+06:00` পাঠালে DUPLICATE)।

### Business rules (BR-01…BR-13)

| Check | কী দেখা গেছে | Evidence |
|---|---|---|
| COUNT +5 | net 5 | H01 |
| Duplicate | total অপরিবর্তিত, attempt সংরক্ষিত | H02 |
| Conflict | original row byte-identical থাকে | H03 |
| VOID-before-COUNT | PENDING, তারপর নিজে থেকে resolve; net 5+3−3=5 | H04 |
| Competing pending VOID | প্রথমটি জেতে, wrong-source এবং পরেরগুলো কারণসহ REJECTED | H05 |
| Mixed batch | ক্রম ঠিক থাকে, ৭টি item-এর ৭টিই audit হয় | H06 |
| ২০টি parallel duplicate | ১টি ACCEPTED | H08 |
| ১২টি competing VOID | ১টিই reversal | H08b |

### REST (RE-01…RE-26)

- **Status code:** 200 এবং 400-এর আচরণ ঠিক। ছয় ধরনের unusable envelope সব → 400 (H11)।
- **Summary:** ঠিক ছয়টি field, প্রতিটির অর্থ ঠিক।
- **Source filter:** spec যেভাবে বলে, সেভাবেই কাজ করে (H09)।
- **ACK:** চারটি status ক্রম মেনে আসে। Repeated এবং ১০টি concurrent ACK নিরাপদ। ACK-এর পরেও VOID কাজ করে (H07, H07b, H07c)।

### PostgreSQL

- **Schema:** চারটি table। Constraint-গুলো live DB-তে আছে (`10_db_constraints.log`)।
- **Migration:** খালি DB-তে `npm run db:migrate` সফল।
- **Restart-এর পরে:** summary হুবহু এক (H21), MQTT replay byte-identical এবং নতুন attempt শূন্য (H22), আগের ACK এখন `ALREADY_ACKED` এবং আবার পাঠালে DUPLICATE (H23)।

### MQTT (local broker-এ)

| বিষয় | কী দেখা গেছে | Evidence |
|---|---|---|
| Connection | client id `fse01-07-xxxxxx`, QoS 1, retain=false | H13, H20 |
| Response | COMPLETED; result ক্রমানুসারে; ছয়-field state | H14 |
| Replay | state বদলানোর পরেও replay byte-identical | H15 |
| Failure code | CHALLENGE_CONFLICT, EXPIRED, MISMATCH, UNSUPPORTED_PROTOCOL, VALIDATION_ERROR | H16–H18 |
| Status topic | ONLINE, HEARTBEAT; hard kill-এর পরে Last Will OFFLINE | `30_lwt_observer.log` |
| Reconnect | resubscribe হয়; graceful shutdown-এ OFFLINE | IT |

Real broker-এ connect, subscribe এবং HEARTBEAT এই session-এর আগে (07:14Z) দেখা গিয়েছিল (MQ-01)।

### Frontend (FE-01…FE-08)

Audit browser-এ যাচাই হয়েছে:

- **Submission:** mixed batch-এর ফলাফল ক্রম মেনে আসে।
- **Error state:** invalid JSON দিলে alert দেখায়।
- **ACK:** এক row acknowledge করার পরে card-এর সংখ্যা (27/18/13/0/24/2) API-র সঙ্গে মেলে।
- **Mobile:** 375 px-এ কোনো overflow নেই।
- **Backend বন্ধ থাকলে:** "STALE SNAPSHOT" দেখায়; প্রথম load-এ "API UNAVAILABLE" দেখায় এবং কোনো metric দেখায় না (মিথ্যা শূন্য নেই)।

### Tests এবং বাকি

- **Tests:** পাঁচটি বাধ্যতামূলক test এবং reliability-credit test সব আছে। মোট 57/57 pass, 0 skipped।
- **Docs:** README, TECHNICAL_EXPLANATION এবং AI_USAGE বিষয়বস্তুতে সম্পূর্ণ।
- **ZIP:** পরিষ্কার; file list HEAD tree-এর সমান, কোনো secret নেই।

---

## ৬. আংশিক সম্পন্ন (PARTIALLY DONE, 6টি)

| ID | যা সম্পন্ন | যা বাকি |
|---|---|---|
| AR-11 | `EVENT_ACCEPTED/VOID_RESOLVED/EVENT_ACKNOWLEDGED` নাম ঘোষিত; MQTT publish commit-এর পরে হয় | কোনো post-commit notification বা callback emit হয় না। Constant-গুলো অব্যবহৃত (`shared/domain-events.ts`) |
| EV-10 | Null ≡ omitted, offset normalization, ID trim; API.md-তে documented | দুটি **undocumented** সিদ্ধান্ত: (১) sub-millisecond `event_time` digit কেটে ফেলা হয়; `.1234Z` এবং `.1239Z` → DUPLICATE (H12)। (২) `POST /api/ack` ID trim করে না; `" X "` → NOT_FOUND (H12b) |
| MQ-14 | স্বাভাবিক পথে commit-এর পরপরই publish হয় (local-এ <1 s) | `expires_at` guard নেই। `flushUnpublished` মেয়াদ শেষ হওয়ার পরেও পুরনো response publish করতে পারে |
| MQ-24 | Event effects এবং response একই transaction-এ। Commit-এর পরের window republish দিয়ে ঢাকা | mqtt.js message emit করেই PUBACK পাঠায় (default `handleMessage`), আর worker `clean:true` ব্যবহার করে। ফলে PUBACK-এর পরে কিন্তু commit-এর আগে crash হলে broker challenge আর redeliver করবে না |
| DM-02 | Exception state এবং local challenge dashboard-এ দেখানো যায় | Real challenge নেই। Panel-এ শুধু ID, সময় আর status; correlated response-এর বিস্তারিত (results, state) দেখায় না |
| SB-07 | `docs/ai-conversation.md`-এ Codex progress message হুবহু এবং Claude Code step summary আছে | পূর্ণ conversation record নেই: prompt, Codex tool turn এবং Claude Code transcript (এই audit সহ) |

---

## ৭. অনুপস্থিত বা ভুল (NOT DONE, 3টি mandatory)

| ID | কী নেই |
|---|---|
| SB-03 | GitHub repository এবং push। `git remote -v` খালি |
| SB-10 | REST API test-এর screenshot (`docs/screenshots/`-এ শুধু dashboard-এর দুটি ছবি) |
| SB-11 | Successful MQTT challenge-এর screenshot |

Optional: **OP-01** Protocol Buffers bonus নেই। এতে mandatory completion কমে না।

Audit-এ কোনো row **INCORRECT** বা fundamentally ভুল পাওয়া যায়নি।

---

## ৮. Verification blocker (NOT VERIFIED, 12টি mandatory)

| ID | Source থেকে যা বোঝা যায় | কী করলে নিশ্চিত হবে |
|---|---|---|
| CF-A / CF-B / CF-C | Implemented policy কাজ করে (PASS) | Examiner clarification রেকর্ড করা (§৯ দেখুন) |
| CI-02 | `07` ধরে নেওয়া | Examiner বা Google Form থেকে exact string নিশ্চিত করে `/api/mqtt/status`-এ `topics.challenge` মেলানো |
| MQ-23 | Real broker-এ subscribe ঠিক ছিল | Examiner window-এ backend চালিয়ে একটি real challenge, `mqtt_challenges` row এবং panel screenshot সংগ্রহ |
| DB-08 | `runWithRetry` পুরো transaction rollback করে; ভেতরে কোনো catch নেই | Fault-injection integration test (constraint error → 500 এবং কোনো partial row নেই) |
| MQ-16 | Worker catch-এ INTERNAL_ERROR | `handleMqttChallenge` একবার throw করানো test |
| SB-13 | — | Google Form জমা দেওয়ার confirmation |
| HU-01…HU-04 | Docs আছে | মানুষের evidence: clarification note, সময়, live walkthrough |

---

## ৯. Contradiction এবং implemented assumption

তিনটির কোনোটিরই **examiner clarification রেকর্ড নেই**। তাই প্রতিটি **AMBIGUOUS SPECIFICATION**, এবং সংশ্লিষ্ট clause NOT VERIFIED। Implemented policy-গুলো নিজে কাজ করে কি না, তা আলাদাভাবে যাচাই করা হয়েছে। একই contradiction দুবার গণনা করা হয়নি; FE-09 শুধু CF-C-এর cross-reference।

### A. Event identity

- **Spec:** p3 §5.1 বলে `event_id` globally unique। p5 §7 বলে composite `(source_id, event_id)`।
- **Assumption:** global uniqueness (TECHNICAL_EXPLANATION §1-A)।
- **Implementation:** `UNIQUE(event_id)`। অন্য source থেকে একই ID এলে → CONFLICT।
- **Consistency:** DB, REST, MQTT, frontend এবং test সব একই নীতি মানে (IT, H09)।
- **ঝুঁকি:** examiner composite key চাইলে ভিন্ন line-এর একই ID CONFLICT হয়ে যাবে।

### B. Batch processing

- **Spec:** p3 §5.2 এবং p4 §6.1 বলে valid item টিকে থাকবে। p5 §7 বলে পুরো batch rollback।
- **Assumption:** ordered partial success।
- **Implementation:** invalid item REJECTED এবং audit হয়; valid item commit হয় (H06)। MQTT-ও একই: COMPLETED-এর ভেতরে REJECTED item (H14)।
- **ঝুঁকি:** কম। §6.1-এর "Do not undo valid items" বেশি নির্দিষ্ট।

### C. VOID acknowledgement

- **Spec:** p4 §6.2–6.3 বলে completed COUNT এবং VOID দুটোই Pending-এ যায় এবং ACK করা যায়। p6 §9-এর factory workflow note বলে VOID নিজে থেকে acknowledged হয়, Pending-এ শুধু COUNT।
- **Assumption:** দুটোই manual ACK।
- **Implementation:** policy seam আছে (`acknowledgement-policy.ts:12,17`)। Pending এবং `pending_ack`-এ VOID গোনা হয় (H10)। VOID ACKED হয় (H07)।
- **Consistency:** DB query, REST, MQTT state এবং frontend একই নীতি মানে।
- **ঝুঁকি: সর্বোচ্চ।** §9 note-টি frontend section-এ, examiner demo-তে এটাই দেখবেন।

### Candidate ID

- Handwritten `07` (p1) config-এ string হিসেবে আছে; leading zero টিকে থাকে (CI-01 DONE)।
- Examiner-এর exact topic string নিশ্চিত নয় (CI-02 NOT VERIFIED)।
- `CAND-017` শুধু উদাহরণ, ব্যবহার করা হয়নি।

---

## ১০. অগ্রাধিকার অনুযায়ী correction plan

এই audit-এ কোনো fix প্রয়োগ করা হয়নি।

### P0: critical / submission blocker

| ID | কোথায় | কী করবেন | কীভাবে যাচাই করবেন |
|---|---|---|---|
| CI-02 | `backend/.env` → `MQTT_CANDIDATE_ID` | Examiner বা Form থেকে exact ID string নিশ্চিত করে সেট করুন | `GET /api/mqtt/status`-এ `topics.challenge` = `fse-01/<ID>/challenge` |
| SB-03 | repository | GitHub repo তৈরি করে push করুন (নিচের command দেখুন) | GitHub-এ ≥3 commit এবং README render |
| MQ-23 | runtime | Examiner window-এ backend চালু রাখুন (`MQTT_BROKER_URL=mqtt://152.42.238.142:1883`) | `mqtt_challenges`-এ examiner challenge row; panel-এ `last_response_status=COMPLETED` |
| SB-13 | Google Form | সব কিছু শেষে নিজে জমা দিন | Confirmation রাখুন |

GitHub push-এর command (`<user>` আপনার GitHub username):

```bash
git remote add origin https://github.com/<user>/production-event-dashboard.git
```

```bash
git push -u origin main
```

### P1: অন্য mandatory gap

| ID | কোথায় (file / function) | কী করবেন | কীভাবে যাচাই করবেন |
|---|---|---|---|
| CF-C | `acknowledgement-policy.ts` (`isAcknowledgementEligible`, `acknowledgementEligibleSql`); `production-events.service.ts` (`processVoid`, `resolvePendingVoids`) | Examiner-কে জিজ্ঞেস করুন। §9 প্রযোজ্য হলে দুই function-এ `type='COUNT'` যোগ করুন এবং VOID ACCEPTED হলে `acknowledgedAt=now` দিন | Pending-এ VOID নেই; VOID ACK → `ALREADY_ACKED`; ACK test আপডেট করে `npm run test:integration` |
| CF-A / CF-B | `TECHNICAL_EXPLANATION.md` §1 | Examiner-এর উত্তর (বা "unanswered") লিখে রাখুন | Doc review |
| SB-10 | `docs/screenshots/rest-*.png` | Swagger বা curl দিয়ে তিনটি endpoint এবং test run-এর screenshot | ফাইল আছে |
| SB-11 | `docs/screenshots/mqtt-*.png` | Real challenge-এর পরে panel এবং stored response-এর screenshot (অন্তর্বর্তী হিসেবে local simulator, "local" লেবেলসহ) | ফাইল আছে |
| SB-07 | `docs/ai-conversation/` | Claude Code transcript (desktop app export) এবং redacted Codex rollout (user/assistant message) যোগ করে AI_USAGE.md থেকে link দিন | ফাইল আছে, কোনো secret নেই |
| MQ-14 | `mqtt-worker.service.ts` → `flushUnpublished`, `onMessage` | `expires_at < now` হলে publish বাদ দিন বা late হিসেবে log করুন | মেয়াদোত্তীর্ণ unpublished response-এর IT |
| MQ-24 | `mqtt-worker.service.ts` → `connect()` | `handleMessage` option দিয়ে commit শেষ হওয়ার পরে PUBACK; `clean:false` বিবেচনা করুন | Commit-এর আগে throw হলে redelivery হয়, এমন IT |
| DM-02 | `mqtt-worker.service.ts` → `getStatus`; `mqtt-status-panel.tsx` | Last response-এর সারাংশ (results count, `net_total`) দেখান | Browser |
| HU-01 / HU-03 / HU-04 | — | Clarification note রাখুন। একটি challenge-এর trace রিহার্সাল করুন: `onMessage → handleMqttChallenge → processBatch → persistNew → publish`। Policy-তে একটি rule বদলে test চালান | Live demo |

### P2: ঐচ্ছিক উন্নতি

| ID | কী করবেন |
|---|---|
| AR-11 | Post-commit notifier |
| EV-10 | Fractional-second নীতি এবং ACK trim document বা implement করুন |
| DB-08 | Fault-injection test |
| MQ-16 | INTERNAL_ERROR test |
| MQ-19 | Last Will payload-এর stale `at` timestamp (শুধু cosmetic) |
| RC-01 | `npm audit` |
| OP-01 | Protocol Buffers (সব mandatory শেষ হলে) |

---

## ১১. চালানো command এবং ফলাফল

Working directory, অন্যথা উল্লেখ না থাকলে: `<scratchpad>/audit/src` (HEAD `a3ef307`-এর clone)।

| # | Command | Dir | Exit | ফলাফল |
|---|---|---|---|---|
| 1 | `git clone` + `cmp package-lock.json` | scratchpad | 0 | Lockfile identical |
| 2 | `createdb production_events_audit_test`, `production_events_audit_e2e_test` | — | 0 | নতুন আলাদা DB |
| 3 | `npm ci` | src | 0 | `01_npm_ci.log` |
| 4 | `npm run db:migrate` | src | 0 | দুটি migration executed (খালি DB) |
| 5 | `npm run migration:show -w backend` | src | 0 | `[X] 1`, `[X] 2` |
| 6 | `npm run lint` | src | 0 | Clean |
| 7 | `npm run typecheck` | src | 0 | Clean (`next typegen` সহ) |
| 8 | `npm run build` | src | 0 | Backend `tsc` + `next build` |
| 9 | `npm test` | src | 0 | 19/19 |
| 10 | `npm run test:integration` | src | 0 | 38/38 |
| 11 | `npx jest --runInBand --json` | src/backend | 0 | 57 total, 57 passed, 0 skipped (`09_all_tests.txt`) |
| 12 | DB constraint dump (`psql`) | — | 0 | `10_db_constraints.log` |
| 13 | `node backend/dist/src/main.js` (:4100) + local broker (:18883) | src/backend | — | চালু |
| 14 | `node audit-harness.js phase1` | harness | 0 | 25 PASS, 1 auto-FAIL (H11)। H11 harness regex-এর false positive: JSON escape `\\` ধরেছিল। Body হাতে পরীক্ষা করে PASS |
| 15 | Backend stop → restart → `node audit-harness.js phase2` | harness | 0 | 3/3 PASS (H21–H23) |
| 16 | `next dev -p 3101` + browser (1440 px, 375 px; invalid JSON; mixed submit; ACK; backend down; reload) | src/frontend | — | সব state পর্যবেক্ষিত |
| 17 | Validation probes (compiled `validateEvent`) | src/backend | 0 | `26_validation_probes.log` |
| 18 | Last-Will: backend hard kill, observer `fse-01/07/status` (local) | — | — | Disconnect-এর পরে OFFLINE (`30_lwt_observer.log`) |
| 19 | ZIP check (`unzip -l`, diff vs `git archive HEAD`) | project | 0 | 144 ফাইল, secret বা cache নেই, HEAD-এর সমান |
| 20 | `git log --stat`, `git remote -v` | project | 0 | 6 commit, remote নেই |
| 21 | mqtt.js PUBACK flow inspection | — | — | `handlers/publish.js` case 1: emit, তারপর `handleMessage`, তারপর PUBACK |

যা চালানো হয়নি এবং কেন:

- **Examiner broker-এ message:** shared topic-এ test message পাঠানোর অনুমতি নেই।
- **Docker Compose:** Docker install করা নেই।
- **Google Form:** নিষিদ্ধ।

---

## ১২. Submission checklist

| আইটেম | অবস্থা |
|---|---|
| Runnable backend এবং frontend, migration, তিনটি REST API, MQTT worker | ✅ যাচাইকৃত |
| ≥5 automated test | ✅ (57) |
| GitHub repo এবং ≥3 meaningful commit | ❌ push হয়নি (local-এ 6টি commit) |
| README.md | ✅ |
| TECHNICAL_EXPLANATION.md | ✅ |
| AI_USAGE.md | ✅ |
| AI conversation record | ⚠️ আংশিক |
| `.env.example`-এ কোনো real secret নেই | ✅ |
| Dashboard screenshot | ✅ |
| REST screenshot | ❌ |
| MQTT success screenshot | ❌ |
| Clean source ZIP | ✅ (পরিবর্তনের পরে আবার তৈরি করতে হবে) |
| Examiner clarification রেকর্ড | ❓ নেই |
| Candidate topic ID নিশ্চিত | ❓ |
| Real MQTT challenge evidence | ❓ |
| Google Form জমা | ❓ (আপনি করবেন) |

---

## ১৩. Assessment rubric review

এটি কোনো authoritative score নয়। শুধু evidence এবং ঝুঁকিতে থাকা দিক দেখানো হয়েছে।

| Area | Marks | সমর্থনকারী evidence | Marks at risk (কারণ) |
|---|---|---|---|
| Understanding/clarification | 10 | Docs-এ customer context, entity এবং তিনটি assumption | **উচ্চ:** clarification রেকর্ড নেই (HU-01), CF-A/B/C unresolved। মূল্যায়ন হবে live |
| Backend/REST | 20 | RE-01…RE-26 সব DONE এবং runtime PASS | **কম:** শুধু CF-C-নির্ভর Pending semantics |
| PostgreSQL/business logic | 18 | BR, DB DONE; constraint live DB-তে; concurrency এবং restart PASS | **কম–মাঝারি:** CF-A (composite key বনাম global), DB-08 unverified |
| MQTT | 17 | Local-এ সব protocol behaviour PASS; real broker-এ connect এবং HEARTBEAT | **মাঝারি–উচ্চ:** real challenge নেই (MQ-23), topic ID unconfirmed (CI-02), expiry guard (MQ-14), pre-commit PUBACK (MQ-24) |
| Frontend | 12 | FE-01…FE-08 browser-এ PASS | **মাঝারি:** §9 VOID/Pending note (CF-C), DM-02 |
| Reliability | 10 | Concurrency, retry, pending resolution, restart, reconnect, LWT সব PASS | **কম–মাঝারি:** MQ-24 crash window, DB-08, MQ-16 |
| Automated tests | 5 | পাঁচটি বাধ্যতামূলক test এবং 52টি অতিরিক্ত, সব pass | **খুব কম** |
| Git/documentation | 4 | Commit, README, reproducible command | **উচ্চ:** GitHub push নেই, দুটি screenshot নেই, AI record আংশিক |
| Code ownership/architecture | 4 | Modular function, policy seam | **মাঝারি:** live walkthrough এবং rule change মানুষের evidence (HU-03) |

---

## Audit artifact

এগুলো untracked; commit করবেন কি না আপনার সিদ্ধান্ত।

- **Reports:** `ASSESSMENT_REQUIREMENTS_AUDIT.md`, `ASSESSMENT_REQUIREMENTS_MATRIX.csv` (UTF-8 with BOM, Excel-এ বাংলা দেখা যায়)।
- **Evidence:** `audit-evidence/` (log, Jest JSON, harness script; শুধু audit-এর জন্য, committed test হিসেবে গণ্য নয়)।
- **Database:** PostgreSQL cluster-এ রেখে দেওয়া audit DB `production_events_audit_test` এবং `production_events_audit_e2e_test`। দরকার না হলে মুছে ফেলুন:

```bash
"C:/Program Files/PostgreSQL/18/bin/dropdb.exe" -h 127.0.0.1 -p 55433 -U postgres production_events_audit_test
```

```bash
"C:/Program Files/PostgreSQL/18/bin/dropdb.exe" -h 127.0.0.1 -p 55433 -U postgres production_events_audit_e2e_test
```
