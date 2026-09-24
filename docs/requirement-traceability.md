# Requirement Traceability Matrix

| Requirement | Design decision | Implementation / files | Test / validation | Demo evidence | Status |
|---|---|---|---|---|---|
| FR-001 | Deterministic Python event source | `backend/app/engine.py` | `test_engine.py` processes generated batches | Events observed counter increases | Complete (local) |
| FR-002 | Allow-listed anomaly queue | `queue_injection`, `/api/simulation/inject`, fault controls | API invalid-kind/count tests; rule tests | Null, schema, and amount controls | Complete |
| FR-003 | Semantic lineage plus graph | `app/components/PipelineCanvas.tsx` | Typecheck/build; responsive review pending | Five-node React Flow graph | Complete |
| FR-004 | Pure versioned rule catalogue | `backend/app/rules.py` | `test_rules.py` | Quality Rules tab | Complete |
| FR-005 | Batch evaluation before writes | `StreamEngine.process_batch` | Breaker test | Score and state change within broadcast cycle | Complete |
| FR-006 | Rolling critical-error threshold | `quality_window`, `threshold=0.02` | Breaker trip/recovery test | Circuit card and blocked serving edge | Complete |
| FR-007 | Route contract in durable store | `LakehouseStore.record_event` | Main/DLQ count assertions | Quarantined metric | Complete (local) |
| FR-008 | Broadcast current state | `ConnectionHub`, `/ws`, reconnecting UI client | API/build plus live manual flow | UI updates without reload | Complete |
| FR-009 | Incident state never overwritten | `open_incident`, `resolve_incident` | Open/resolved assertions | Incident table | Complete |
| FR-010 | Immutable 24-record snapshots | `create_snapshot`, `snapshot` | Snapshot boundary test; missing ID test | Snapshots tab and JSON inspection | Complete (local) |
| FR-011 | Explicit operations endpoints | start/stop/reset routes and UI actions | API smoke test; manual flow | Header and breaker controls | Complete |
| FR-012 | Explainable control plane | Rule IDs, reasons, OpenAPI, docs | Documentation audit | API docs and rule cards | Complete |
| FR-013 | Kafka/Flink/Iceberg production execution | Adapter architecture documented | No environment evidence | Upgrade diagram only | Planned / not claimed |
| FR-014 | Persistent local operator accounts | SQLite-backed `AuthManager`, `/api/auth/*`, sign-in/register screen, account menu | Weak/duplicate registration, persistence, login/me/logout API tests | Create-account form, visible username/user ID, sign-out action | Complete (local) |
| NFR-001 | VS Code as first-class runner | `.vscode/`, `scripts/` | Setup/run verification pending on clean machine | Named tasks | Complete configuration |
| NFR-002 | Safe fallback and validation | Retryable backend status, typed API validation | Invalid API tests; frontend build gates | Explicit restart/retry guidance instead of raw fetch errors | Complete |
| NFR-003 | Separated modules | `engine.py`, `rules.py`, `storage.py`, UI components | Code review | Architecture document | Complete |
| NFR-004 | Demo-profile security | Salted password hashes, unique identity indexes, HTTP-only sessions, ignored seed secret, parameterized SQL, bounded inputs, restricted CORS | Auth/API tests and security review | Anonymous requests return 401; sign out revokes access | Complete for demo |
| NFR-005 | Accessible interactions | focus-visible, semantic tables, reduced motion | Manual screen-reader test pending | Keyboard navigation | Partially verified |
| NFR-006 | Responsive layout | breakpoint-specific CSS | Browser/device matrix pending | Desktop/tablet/mobile CSS | Implemented, manual QA pending |
| EVAL-001 | Week 1 evidence | generator and lineage source | Tests/build | Working overview | Ready |
| EVAL-002 | Week 2 evidence | storage and rules | Unit/API tests | Rules and snapshot evidence | Ready (local profile) |
| EVAL-003 | Mid-review detection | controlled injection | State-machine test | One-minute breaker demo | Ready |
| EVAL-004 | Week 3 remediation | DLQ, recovery, WebSocket | Recovery test | Live alert/path state | Ready (local profile) |
| EVAL-005 | Week 4 polish | incident/snapshot UX and documents | Final audit pending | Review flow | In progress |
| EVAL-006 | Genuine GitHub activity | Repository strategy only | Actual history must be inspected | No fabricated evidence | Pending future work |

## Status rule

`Complete` means implemented, tested or directly validated, documented, and demonstrable. Local-profile completion is explicitly distinct from the production Kafka/Flink/Iceberg requirement.
