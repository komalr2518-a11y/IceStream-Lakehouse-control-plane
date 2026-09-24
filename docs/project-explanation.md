# Project Explanation and Viva Guide

## 60-second explanation

IceStream is a real-time data-quality control plane for checkout analytics. Every event is validated against governed rules before it reaches the serving table. If the rolling critical-error rate exceeds 2%, a circuit breaker stops serving writes, moves incoming records to a dead-letter route, opens an incident, and updates the lineage dashboard over WebSockets. Clean probe batches recover automatically, and immutable snapshots let an operator inspect the table at an earlier watermark.

## Why this architecture?

The project must be advanced but also run reliably in VS Code. The domain logic is therefore independent of infrastructure. A local Python/SQLite profile proves the rules, state machine, incidents, and snapshots; Kafka, Flink, and Iceberg can replace the ingress/processor/storage adapters in a production profile without rewriting the UI or governance rules.

## Important viva questions

### What problem does IceStream solve?

It reduces the delay between bad data entering a real-time pipeline and an operator discovering it through a broken dashboard. It treats data quality as a serving gate, not a later report.

### Why not validate after writing to the lake?

Post-write checks allow contaminated data to become visible. IceStream validates first, routes critical failures to quarantine, and preserves the rejected payload and rule evidence.

### Why is the threshold “greater than 2%” instead of “at least 2%”?

That follows the project brief wording. The implementation uses `error_rate > 0.02`; equality does not trip the circuit.

### Why use a rolling window?

A rolling window reacts to recent degradation while allowing old healthy events to age out. A lifetime average could hide a sudden incident.

### What prevents circuit flapping?

The open circuit requires five consecutive clean probe batches before automatic recovery. Any critical probe resets that streak. Manual reset remains available to an operator.

### What is the difference between a DLQ and deleting bad data?

The DLQ preserves the original event and violations for investigation/replay. Deletion removes evidence and makes recovery harder.

### Is SQLite an Apache Iceberg implementation?

No. SQLite is the verified local adapter. It demonstrates routes, incidents, and immutable snapshot reads. A production Iceberg adapter still needs a catalog, object store, ACID/concurrency audit, and real snapshot IDs.

### How would this move to Flink?

Kafka events would feed a keyed Flink job. Quality results would update checkpointed rolling state. Passing rows go to the Iceberg serving sink; critical/open-circuit rows use a side output and DLQ sink. Breaker state and incident events go to the control API.

### How is time travel implemented locally and in production?

Locally, each commit boundary stores immutable snapshot metadata and the latest 24 accepted rows. In Iceberg, the UI would query real snapshot IDs or timestamps through the catalog/query engine.

### How was the project tested?

Pure rules have unit tests. The state-machine test proves good writes, breaker trip, DLQ counts, five-batch recovery, and resolved incidents. API tests prove health, rule count, invalid injection validation, and missing snapshot behavior. Typecheck, lint, and production build cover the UI package.

### What can break?

The largest risks are production-infrastructure resource limits, WebSocket disconnects, insufficient auth, dependency advisories, unbounded retention, and team GitHub compliance. They are documented with mitigations in the risk/security reports.

### What would change in production?

Add Kafka/Flink/Iceberg adapters, S3-compatible storage, checkpointing, SSO/RBAC, WSS/TLS, rate limiting, secrets management, retention/compaction, observability/SLOs, CI/CD, and a tested disaster-recovery plan.

## Five-minute presentation outline

1. Problem and risk: bad telemetry reaches analytics before batch checks catch it.
2. Solution: validate -> trip -> quarantine -> alert -> recover -> time travel.
3. Architecture: local verified profile versus production adapter profile.
4. Live demo: healthy stream, fault injection, incident, DLQ, recovery, snapshot.
5. Evidence: tests, RTM, security review, honest limitations and next step.

## Ten-minute demo script

1. Start both VS Code tasks and show API health.
2. Explain the five lineage nodes and four live metrics.
3. Open the Quality Rules tab and point to DQ-001/DQ-003.
4. Inject a null-tax burst.
5. Show the quality score, red blocked serving path, quarantine count, and open incident.
6. Explain that rejected rows are preserved, not deleted.
7. Watch automatic recovery or use manual reset.
8. Open Snapshots and inspect the immutable watermark/sample.
9. Show the automated test report and RTM.
10. Close by distinguishing verified local behavior from planned Kafka/Flink/Iceberg execution.

## Limitations and future scope

- No real Kafka, Flink, Iceberg, S3, or distributed checkpoint execution yet
- No production authentication, rate limiting, TLS, or multi-tenant authorization
- No controlled load benchmark or availability SLO
- Local snapshot retention and incident ownership are simplified
- Manual accessibility/device-matrix audit remains before final gate
