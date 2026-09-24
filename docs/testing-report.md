# Testing Report

## Test strategy

| Layer | Scope | Tool |
|---|---|---|
| Unit | Quality predicates, severity, malformed values | Pytest |
| State machine | Breaker trip, DLQ routing, recovery, snapshot boundary | Pytest + asyncio |
| API | Health, dashboard, rules, validation, missing snapshot | FastAPI TestClient |
| Frontend static quality | Type safety and lint rules | TypeScript, ESLint |
| Production packaging | Optimized UI build | Vinext/Vite build |
| Manual functional | Fault injection, live graph, incident/snapshot tabs | Browser review |

## Automated result log

Latest automated run: **2026-08-25**, after adding persistent local registration and retryable backend status.

- Pytest: **9 passed in 8.30s**
- TypeScript: **passed** (`tsc --noEmit`)
- ESLint: **passed**
- Vinext/Vite production build: **passed** (five build stages)
- Authentication integration: weak registration `422` -> account creation `201` -> duplicate `409` -> identity `200` -> logout/login `200` -> restart/login `200`
- Full-stack integration: null-tax injection opened the circuit, quarantined records, created an incident, then recovered and resolved after five clean probes

| Test ID | Requirement | Scenario | Expected | Status |
|---|---|---|---|---|
| T-001 | FR-004 | Valid checkout event | Zero violations | Passed |
| T-002 | FR-002/004 | Null tax | DQ-001 and DQ-002 critical violations | Passed |
| T-003 | FR-004 | Unknown currency | Warning only; breaker unaffected | Passed |
| T-004 | FR-006/007/009 | Bad burst over threshold | Circuit opens, eight bad records route to DLQ, incident opens | Passed |
| T-005 | FR-006/009 | Five clean probe batches | Circuit closes and incident resolves | Passed |
| T-006 | FR-010 | 24 accepted records | One immutable snapshot with 24 sample events | Passed |
| T-007 | NFR-002 | Invalid anomaly/count | HTTP 422 | Passed |
| T-008 | FR-010 | Unknown snapshot ID | HTTP 404 | Passed |
| T-009 | TECH-007 | TypeScript project | No type errors | Passed |
| T-010 | TECH-007 | ESLint project | No lint errors | Passed |
| T-011 | TECH-007 | Production UI build | Build exits successfully | Passed |
| T-012 | FR-005..009 | Live null-tax burst | Open -> quarantine -> incident -> automatic closed/resolved | Passed (integration) |
| T-013 | FR-014 | Anonymous dashboard request | HTTP 401 | Passed |
| T-014 | FR-014 | Correct username, ID, and password | Session cookie and operator identity | Passed |
| T-015 | FR-014 | Sign out | Session revoked; next dashboard request returns 401 | Passed |
| T-016 | FR-014/NFR-004 | Register, reject weak/duplicate identity, and restart | Salted account persists; duplicate username/user ID returns 409; restart login succeeds | Passed |

## Manual cases still required before final review

- Keyboard-only navigation through tabs, controls, table, and React Flow controls
- Screen-reader labels/status announcements
- 360px, 768px, 1280px, and 1440px layout checks
- WebSocket disconnect/reconnect while the stream runs
- Clean-machine execution via VS Code setup/start tasks
- Real Kafka/Flink/Iceberg ACID, concurrent read/write, checkpoint, and time-travel audit if FR-013 is required

## Performance

No load or latency benchmark has been run. The displayed local stream velocity is operational demo data, not a scalability claim.
