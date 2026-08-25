# IceStream - Real-Time Lakehouse Observability

IceStream is a local-first, review-ready implementation of Axlero Solutions' **Project 2: Real-Time Lakehouse Observability**. It simulates checkout telemetry, evaluates governed quality rules, opens a circuit breaker when the rolling critical-error rate exceeds 2%, quarantines unsafe records, broadcasts pipeline state over WebSockets, and preserves queryable snapshots for time-travel demonstrations.

The default profile is intentionally easy to run in VS Code. It uses a Python stateful processor and SQLite-backed lakehouse adapter while preserving explicit boundaries for Kafka, Flink, and Apache Iceberg. The UI and core control behavior are implemented and tested; the heavyweight production services are an upgrade path, not falsely claimed as executed.

## What is implemented

- Live checkout event generation with deterministic fault injection
- Six governed quality assertions with critical/warning severity
- Rolling 2% circuit-breaker threshold and five-clean-batch recovery
- Main-table versus dead-letter-queue routing
- Live WebSocket control-plane updates
- React Flow lineage graph with healthy, watching, and blocked states
- Incident log with open/resolved lifecycle
- Immutable local snapshots and snapshot inspection
- Pause, resume, manual reset, and three controlled anomaly scenarios
- Persistent operator registration plus username, user ID, and password login with an HTTP-only session and explicit sign out
- Responsive dashboard, offline preview state, API validation, tests, and VS Code tasks

## Quick start in VS Code

Prerequisites: Python 3.11+, Node.js 22.13+, npm, and Visual Studio Code.

1. Open this `icestream-lakehouse-observability` folder in VS Code.
2. Open **Terminal > Run Task > IceStream: Setup** once.
3. Run **Terminal > Run Task > IceStream: Start all**.
4. Open [http://localhost:3000](http://localhost:3000). API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs).

### Local login

The setup task creates an ignored `.env` profile that seeds the first local account when the user database is empty. This workspace currently uses:

- Username: `axlero.operator`
- User ID: `AXL-IS-001`
- Password: `IceStream@2026`

Anyone without an account can choose **Create account** on the access screen. New accounts are stored in the local SQLite database with unique usernames and user IDs; passwords are stored as salted hashes. The optional **Save password** control delegates the password to the browser's password manager and remembers only the non-secret username/User ID preference in local storage. Open the operator menu in the top-right corner to review the signed-in identity or sign out.

The same setup works from PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
.\scripts\run.ps1
```

## Demonstration flow

1. Let the healthy stream create at least one 24-event snapshot.
2. Click **Null tax burst** or **Schema drift**.
3. Watch the quality score fall, the circuit open, the serving edge turn red, and records move to quarantine.
4. Open **Incidents** to explain the breached rule and lifecycle.
5. Allow five clean probe batches or use **Reset** to close the circuit.
6. Open **Snapshots**, inspect a snapshot, and explain how the immutable watermark supports time travel.

## Architecture

```text
Checkout generator
      |
      v
Stateful stream engine ---> Quality rules (DQ-001 ... DQ-006)
      |                              |
      | pass                         | breach > 2%
      v                              v
Serving table                  Circuit breaker ---> DLQ
      |                              |
      v                              v
Snapshots / time travel       Incident lifecycle
              \                 /
               WebSocket + REST
                      |
                      v
              React Flow dashboard
```

Detailed decisions and production mapping are in [docs/architecture.md](docs/architecture.md).

## API surface

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Service health |
| POST | `/api/auth/login` | Validate username, user ID, and password; create a local session |
| POST | `/api/auth/register` | Validate and persist a unique local operator account; create a session |
| GET | `/api/auth/me` | Return the signed-in operator |
| POST | `/api/auth/logout` | Revoke the active session and clear its cookie |
| GET | `/api/dashboard` | Current pipeline state and metrics |
| GET | `/api/rules` | Governed rule catalogue |
| GET | `/api/incidents` | Incident history |
| GET | `/api/snapshots` | Snapshot metadata |
| GET | `/api/time-travel/{id}` | Immutable snapshot contents |
| POST | `/api/simulation/start` | Resume stream generation |
| POST | `/api/simulation/stop` | Pause stream generation |
| POST | `/api/simulation/inject` | Queue a controlled anomaly burst |
| POST | `/api/circuit/reset` | Resolve and reset the breaker |
| WS | `/ws` | Live dashboard events |

## Testing

After setup:

```powershell
.\.venv\Scripts\python.exe -m pytest -q backend\tests
npm run typecheck
npm run lint
npm run build
```

The test suite validates rule behavior, invalid API input, circuit-breaker routing/recovery, and snapshot creation. See [docs/testing-report.md](docs/testing-report.md) for the latest verified results.

## Production mapping

| Local demo component | Production component | Status |
|---|---|---|
| Python generator | Kafka producers / checkout CDC | Local implementation complete; Kafka adapter planned |
| `StreamEngine` | Apache Flink stateful job | Behavior implemented locally; Flink deployment planned |
| SQLite `LakehouseStore` | Apache Iceberg catalog and tables | Contract implemented locally; Iceberg adapter planned |
| Python rules | Great Expectations / Flink assertions | Custom engine implemented and tested |
| FastAPI WebSocket | Event gateway / control API | Implemented |
| React Flow dashboard | Operations control plane | Implemented |

## Project structure

```text
app/                 React/Vinext dashboard
backend/app/         API, stream engine, rules, local lakehouse adapter
backend/tests/       Unit, state-machine, and API tests
docs/                Requirements, RTM, architecture, reviews, roadmap
presentation/        Verified 14-slide project review deck
scripts/             One-command setup and run scripts for Windows
.vscode/             Tasks and full-stack debug configuration
```

## Security and operating notes

- No production credentials or real customer data are included.
- The checked-in `.env.example` contains placeholders; the real local password remains in ignored `.env`.
- Dashboard APIs and WebSockets require an eight-hour, HTTP-only local session cookie.
- CORS is restricted to the two local UI origins.
- Fault kinds and counts are allow-listed and bounded.
- SQL writes are parameterized; snapshot IDs use typed route parameters.
- Local state lives in ignored SQLite files under `backend/data/`.
- Authentication, rate limiting, encrypted transport, Kafka ACLs, and object-store policies are required before a production deployment.

## Evidence and limitations

Implemented behavior is traceable in [docs/requirement-traceability.md](docs/requirement-traceability.md). The repository does **not** claim that Kafka, Flink, Iceberg, cloud object storage, load testing, deployment, or a 20-day GitHub history have been executed. Those items remain explicit roadmap work. This honesty is intentional and follows the supplied execution framework.

## Documentation index

- [Requirements catalogue](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Requirement traceability](docs/requirement-traceability.md)
- [Assumptions and decisions](docs/assumptions-and-decisions.md)
- [Four-week roadmap](docs/four-week-roadmap.md)
- [Risk register](docs/risk-register.md)
- [Testing report](docs/testing-report.md)
- [Security review](docs/security-review.md)
- [Code review](docs/code-review.md)
- [Daily progress](docs/daily-progress.md)
- [GitHub development summary](docs/github-development-summary.md)
- [Viva guide](docs/project-explanation.md)

## Source brief

Built from the Axlero Solutions Advanced Data Analytics Project 2 brief and the Project Execution Handbook V1.1 supplied for this task.
