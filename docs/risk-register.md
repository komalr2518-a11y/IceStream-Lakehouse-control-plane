# Risk Register

| ID | Risk | Probability | Impact | Mitigation | Owner / trigger | Status |
|---|---|---:|---:|---|---|---|
| R-001 | Heavy Kafka/Flink/Iceberg stack fails on review laptop. | High | High | Keep verified local profile; rehearse Docker/remote profile separately. | Team lead before final review | Open |
| R-002 | Local adapter is mistaken for production Iceberg proof. | Medium | High | Label every mapping and limitation; require separate ACID audit evidence. | Presenter | Mitigated in docs |
| R-003 | 2% threshold flaps around a small window. | Medium | Medium | Use 100-event rolling window plus five-clean-batch hysteresis. | Backend owner | Mitigated |
| R-004 | WebSocket disconnect hides pipeline changes. | Medium | Medium | Reconnect automatically and poll dashboard every six seconds. | UI owner | Mitigated |
| R-005 | Unbounded fault injection consumes storage. | Low | Medium | Allow-list kinds; cap each request at 100 records. | API owner | Mitigated |
| R-006 | Mock records are presented as real performance evidence. | Medium | High | Report no throughput/scale claims without controlled measurement. | Reviewer/documentation owner | Mitigated |
| R-007 | Dependency vulnerabilities affect the scaffold. | Medium | High | Capture `npm audit`; avoid force upgrades; update pinned scaffold with compatibility testing. | Team lead | Under review |
| R-008 | Team misses handbook GitHub-day requirements. | Medium | High | Schedule genuine work daily; monitor distinct commit days; never backdate. | Team lead | Open |
| R-009 | An unresponsive teammate blocks delivery. | Medium | High | Follow 48-hour contact/escalation process and update work allocation. | Team lead | Open |
| R-010 | Snapshot payload grows without retention. | Medium | Medium | Demo stores only last 24 rows per snapshot; production needs retention policy. | Data owner | Partially mitigated |
| R-011 | Local CORS/API lacks production identity controls. | High in production | High | Add TLS, SSO/JWT, role-based actions, rate limits, and audit logs before deployment. | Security owner | Accepted for local demo only |
| R-012 | Responsive or assistive-tech defects are missed. | Medium | Medium | Run keyboard, screen-reader, and device matrix before final gate. | QA owner | Open |
