# Requirements Catalogue

## Project understanding

IceStream protects real-time e-commerce analytics from bad checkout telemetry. It detects nulls, schema drift, and implausible values before they contaminate a serving table. A circuit breaker isolates unsafe data, records the incident, and exposes live lineage and recovery evidence to an operator.

## Functional requirements

| ID | Requirement | Priority | Acceptance criteria | Status |
|---|---|---:|---|---|
| FR-001 | Generate continuous mock checkout transactions. | Must | The service emits unique, timestamped events while running. | Complete (local profile) |
| FR-002 | Deliberately inject nulls and schema changes. | Must | Operator can queue reproducible null-tax and schema-drift bursts. | Complete |
| FR-003 | Visualize Ingest -> Process -> Quality -> Serve/DLQ lineage. | Must | React Flow graph exposes nodes, edges, and live status. | Complete |
| FR-004 | Apply strict data-quality assertions. | Must | Six versioned rules evaluate every event with severity. | Complete |
| FR-005 | Detect a bad-data burst immediately. | Must | A processed batch updates rolling quality state and UI within one broadcast cycle. | Complete |
| FR-006 | Open the circuit when critical error rate exceeds 2%. | Must | Breaker state changes from closed to open when rolling critical failures are greater than 2%. | Complete |
| FR-007 | Quarantine unsafe data in a DLQ. | Must | Critical rows, and all rows while the circuit is open, are stored with `route=dlq`. | Complete (local profile) |
| FR-008 | Push live alerts to the UI. | Must | Backend sends current state over WebSocket and UI updates without reload. | Complete |
| FR-009 | Preserve incident history and recovery state. | Must | A breach opens an incident; recovery/reset resolves it without deleting evidence. | Complete |
| FR-010 | Support time-travel inspection. | Must | A 24-event commit boundary creates an immutable snapshot retrievable by ID. | Complete (local profile) |
| FR-011 | Pause, resume, and reset the pipeline. | Should | Controls call validated endpoints and update state. | Complete |
| FR-012 | Provide review transparency. | Should | REST documentation and visible rule IDs explain decisions. | Complete |
| FR-013 | Run Kafka -> Flink -> Iceberg end to end. | Must for production/final infrastructure audit | A real Kafka topic, Flink job, Iceberg catalog/table, ACID audit, and object-store evidence are demonstrated. | Planned; not claimed |
| FR-014 | Register, authenticate, and identify dashboard operators. | Must | A user can create a unique persistent local account; valid credentials create an expiring HTTP-only session; protected APIs reject anonymous access; sign out revokes the session. | Complete (local profile) |

## Non-functional requirements

| ID | Requirement | Priority | Acceptance criteria | Status |
|---|---|---:|---|---|
| NFR-001 | VS Code reproducibility | Must | Setup and full-stack launch are available as named VS Code tasks. | Complete |
| NFR-002 | Reliability | Must | Invalid injections fail safely; disconnects fall back to a non-destructive preview. | Complete |
| NFR-003 | Maintainability | Must | Generator, rules, state machine, storage, API, and UI are separate modules. | Complete |
| NFR-004 | Security | Must | Seed credentials remain in ignored `.env`; registered passwords use per-user salts and slow hashes; inputs are bounded; SQL is parameterized; CORS is restricted; protected routes require an HTTP-only session. | Complete for demo profile |
| NFR-005 | Accessibility | Should | Keyboard-focus styles, semantic tables, labelled graph, and reduced-motion support exist. | Complete |
| NFR-006 | Responsive usability | Should | Primary operations remain usable at desktop, tablet, and mobile widths. | Complete by CSS; manual device audit pending |
| NFR-007 | Performance evidence | Should | Measurements are reported only after a controlled test. | Not measured; no unsupported claim |

## Technical requirements

| ID | Requirement | Selected implementation | Status |
|---|---|---|---|
| TECH-001 | Streaming engine | Python state machine behind a Flink-compatible adapter boundary | Local complete; Flink planned |
| TECH-002 | Messaging | In-process deterministic batches behind a Kafka-compatible ingress boundary | Local complete; Kafka planned |
| TECH-003 | Open table/snapshots | SQLite adapter preserving main/DLQ/snapshot contracts | Local complete; Iceberg planned |
| TECH-004 | Quality rules | Custom Python rules engine | Complete |
| TECH-005 | Lineage UI | React 19 and `@xyflow/react` | Complete |
| TECH-006 | Live transport | FastAPI WebSocket and REST | Complete |
| TECH-007 | Automated validation | Pytest, TypeScript compiler, ESLint, production build | Configured; results in testing report |

## Evaluation requirements

| ID | Evaluation expectation | Evidence |
|---|---|---|
| EVAL-001 | Week 1 stream generation and lineage scaffold | `backend/app/engine.py`, `app/components/PipelineCanvas.tsx` |
| EVAL-002 | Week 2 lakehouse foundation and rules | `backend/app/storage.py`, `backend/app/rules.py` |
| EVAL-003 | Mid-review detection check | Fault injection -> breaker -> incident -> DLQ demo flow |
| EVAL-004 | Week 3 remediation and live alerts | Circuit state machine, WebSocket, live graph |
| EVAL-005 | Week 4 time travel and incident log | Snapshot API/UI and incident views |
| EVAL-006 | GitHub day requirements | Must be satisfied with genuine future work; not fabricated by this package |
| EVAL-007 | Work Distribution Document before Month 1 mid-review | Team/lead responsibility; template decision recorded, not invented |

## Definition of complete

A requirement is marked complete only when code, validation, documentation, and a repeatable demo exist. Infrastructure requirement FR-013 remains planned because no real Kafka/Flink/Iceberg environment was executed in this workspace.
