# Four-Week Execution Roadmap

The handbook cycle runs from the 8th to the 7th. Exact dates below must be filled from the official Month 2 allocation; they are deliberately not invented.

## Week 1 - Requirements, stream generation, and lineage

Objectives:

- Confirm IceStream scope, acceptance criteria, team roles, risks, and production target.
- Scaffold frontend/backend, create event contract, and build deterministic generator.
- Render Ingest -> Process -> Serve lineage and establish test/lint/build foundations.

Evidence:

- `requirements.md`, architecture v1, RTM v1, risk register
- Generated healthy telemetry and visible lineage
- Commit examples: `docs: define IceStream requirements`; `feat: add checkout stream generator`; `feat: scaffold lineage dashboard`

Quality gate: generator is reproducible, UI compiles, each requirement has an owner/test plan.

## Week 2 - Lakehouse foundation and data-quality rules

Objectives:

- Implement main/DLQ/snapshot storage contract.
- Add governed assertions for nulls, schema version, ranges, currency, and region.
- Connect dashboard metrics and snapshot metadata.
- If infrastructure is available, configure Kafka, Flink, Iceberg catalog/object storage, and first end-to-end append.

Evidence:

- Rule catalogue and unit tests
- Durable local main/DLQ writes and first snapshot
- Real Iceberg catalog/config only if actually executed
- Commit examples: `feat: add governed checkout quality rules`; `feat: persist serving and quarantine routes`; `test: cover rule edge cases`

Mid-review flow: show Week 1 + Week 2, inject bad data, explain expected production mapping, and state honestly which profile is running.

## Week 3 - Circuit breaker, live alerts, and integration

Objectives:

- Implement rolling 2% threshold, DLQ routing, incident lifecycle, and recovery hysteresis.
- Push state through WebSockets and update affected graph nodes/edges.
- Add API, negative, recovery, and regression tests.
- In the production profile, implement Flink side output/checkpoints and prove read/write isolation.

Evidence:

- Automated breaker and recovery tests
- Live incident and quarantined-count changes
- Security/code review and defect log
- Commit examples: `feat: add quality circuit breaker`; `feat: stream control-plane alerts`; `test: verify quarantine and recovery`

Quality gate: no critical record enters serving; disconnect/reconnect behavior is safe; incidents remain auditable.

## Week 4 - Time travel, final audit, and review readiness

Objectives:

- Complete snapshot inspection and, if available, real Iceberg snapshot/time-travel queries.
- Finish accessibility/responsive QA, dependency review, README, RTM, scorecard, deck, and viva guide.
- Audit actual Git history, branch contributions, review dates, and missing evidence.

Evidence:

- Time-travel demo and incident timeline
- Passed final test/build reports
- Presentation and 5-minute/10-minute demo scripts
- Commit examples: `feat: add snapshot time-travel explorer`; `docs: finalize evaluation evidence`; `fix: resolve final review findings`

Final quality gate: requirement-by-requirement audit distinguishes local completion from production infrastructure evidence.

## Genuine GitHub cadence

- Work and commit only on days when meaningful progress occurs.
- Team members commit to their own branches; solo workers may use `main` as allowed by the handbook.
- The lead checks distinct activity days before each review.
- Do not create empty, whitespace-only, backdated, or contribution-graph commits.
- If the project starts late, document the gap; do not alter history.
