# Assumptions and Decisions Register

| Date | Decision / assumption | Reason | Alternatives | Impacted requirements |
|---|---|---|---|---|
| 2026-08-24 | “Lake wala” means Project 2, IceStream. | The supplied analytics brief names Project 2 as Real-Time Lakehouse Observability. | MetricMind or SupplyPrescript | All |
| 2026-08-24 | The immediate deliverable must run locally in VS Code. | Explicit user request; no cloud credentials or container runtime were supplied. | Cloud-only or Docker-only demo | NFR-001, TECH-001..003 |
| 2026-08-24 | Implement domain behavior locally before heavyweight infrastructure. | Reliable review demo and honest validation are more valuable than unexecuted YAML. | Kafka/Flink/Iceberg-only implementation | FR-001..012, FR-013 |
| 2026-08-24 | SQLite is a local lakehouse adapter, not an Iceberg substitute. | It preserves routes/incidents/snapshots with zero external services. | DuckDB, PostgreSQL, MinIO/Iceberg | FR-007, FR-010 |
| 2026-08-24 | A critical failure opens the circuit; warnings affect audit evidence but do not trip it. | Prevents low-risk dimension issues from halting all serving writes. | Treat every violation as critical | FR-004..007 |
| 2026-08-24 | Open-circuit batches are inspected and quarantined as recovery probes. | Allows automated recovery evidence without writing to serving. | Require only manual reset | FR-006, FR-007, FR-009 |
| 2026-08-24 | Five consecutive clean batches recover the circuit. | Simple, explainable hysteresis for a one-month educational build. | Time-based cooldown or adaptive policy | FR-006, FR-009 |
| 2026-08-24 | Snapshots occur every 24 accepted events. | Creates quick, deterministic time-travel evidence during a short demo. | Scheduled snapshots or every batch | FR-010 |
| 2026-08-25 | Add persistent local operator accounts after the user requested registration and sign out. | SQLite keeps the VS Code demo self-contained while salted hashes avoid storing plaintext registered passwords. Production SSO and roles remain mandatory. | One seeded operator or external OAuth | FR-014, NFR-004 |
| 2026-08-24 | Official cycle dates and team roster remain unspecified. | Documents do not provide the selected Month 2 start date or team members. | Invent names/dates | EVAL-006 |

## Open items requiring owner confirmation

- Official Month 2 cycle start date and review appointments
- Team roster, lead, branch names, and Work Distribution Document owner
- Whether the final evaluation requires a live Kafka/Flink/Iceberg environment or accepts staged infrastructure evidence
- Target deployment environment and available cloud/object-storage credentials
