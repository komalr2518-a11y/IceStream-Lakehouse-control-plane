# Architecture

## Decision summary

IceStream uses a hexagonal, local-first architecture. Domain behavior does not depend on Kafka, Flink, or Iceberg APIs, so the project can run on a student laptop while retaining explicit upgrade seams. This makes the demo reliable without misrepresenting local adapters as the production stack.

```mermaid
flowchart LR
    G[Checkout Generator] --> I[Ingress Adapter]
    I --> E[Stateful Stream Engine]
    E --> R[Quality Rules]
    R -->|pass| M[(Serving Table)]
    R -->|critical breach| C[Circuit Breaker]
    C --> D[(Dead Letter Queue)]
    M --> S[(Immutable Snapshots)]
    E --> H[Incident Lifecycle]
    E --> W[WebSocket + REST]
    W --> U[React Flow Control Plane]
```

## Local runtime

```mermaid
flowchart TB
    subgraph Browser
      UI[Vinext / React dashboard]
      RF[React Flow lineage]
    end
    subgraph Python_Service
      API[FastAPI]
      ENG[StreamEngine]
      DQ[Rule catalogue]
      HUB[ConnectionHub]
    end
    subgraph Local_Lakehouse_Adapter
      MAIN[(events: main)]
      DLQ[(events: dlq)]
      INC[(incidents)]
      SNAP[(snapshots)]
    end
    UI <--> API
    RF <--> HUB
    API --> ENG
    ENG --> DQ
    ENG --> MAIN
    ENG --> DLQ
    ENG --> INC
    ENG --> SNAP
```

## Component responsibilities

| Component | Responsibility | Reason for separation |
|---|---|---|
| `StreamEngine` | Generate/process batches, maintain rolling quality state, control breaker/recovery | Domain behavior is independently testable |
| Rule catalogue | Pure assertions and violations | Governance is versioned and explainable |
| `LakehouseStore` | Main/DLQ writes, incidents, immutable snapshot reads | Storage can be swapped without changing rules |
| FastAPI | Validated REST/WebSocket boundary | Keeps transport out of the domain layer |
| React dashboard | Operator controls, metrics, history, snapshot inspection | Presentation does not own business rules |
| React Flow canvas | Live topology and affected-path state | Makes lineage failures demonstrable |

## Circuit-breaker state model

```mermaid
stateDiagram-v2
    [*] --> Closed
    Closed --> Open: rolling critical error rate > 2%
    Open --> Open: bad probe batch / route to DLQ
    Open --> Recovering: clean probe batch
    Recovering --> Open: critical error found
    Recovering --> Closed: five clean batches
    Open --> Closed: manual operator reset
```

The breaker is evaluated after the batch is validated. Critical records never enter the serving route. When the circuit is open, incoming records are quarantined while clean probes accumulate. Recovery resolves, rather than deletes, the incident.

## Data model

| Table | Key fields | Purpose |
|---|---|---|
| `events` | `event_id`, `occurred_at`, `route`, `payload`, `violations` | Append-only main/DLQ evidence |
| `incidents` | `incident_id`, timestamps, rule, reason, status | Operational incident lifecycle |
| `snapshots` | `snapshot_id`, watermark, event count, payload | Immutable local time-travel evidence |

SQLite WAL mode provides a reliable local read/write demonstration. It is not presented as an Iceberg ACID audit.

## Production upgrade mapping

```mermaid
flowchart LR
    P[Checkout / CDC] --> K[Kafka topic]
    K --> F[Apache Flink job]
    F --> Q[Great Expectations-compatible rules]
    Q -->|pass| I[Apache Iceberg serving table]
    Q -->|breach| B[DLQ Iceberg table]
    I --> O[S3 / object storage]
    F --> A[Alert gateway]
    A --> UI[React control plane]
```

Adapters to add:

1. `KafkaIngress` implementing the event source contract.
2. A Flink job expressing the rolling window, side output/DLQ, and checkpointed breaker state.
3. `IcebergLakehouseStore` backed by a REST catalog and S3-compatible object storage.
4. Snapshot metadata calls using Iceberg snapshot IDs and time-travel SQL.

## Technology decisions

| Selection | Why selected | Alternatives considered | Limitation |
|---|---|---|---|
| FastAPI | Typed API, WebSockets, automatic reviewable schema | Flask, Node | Production auth/rate limits must be added |
| Custom Python engine | Makes circuit state and tests explicit | Flink-only development | Not distributed and not a Flink performance claim |
| SQLite local adapter | Zero-service startup and durable evidence | PostgreSQL, DuckDB | Not an Iceberg substitute |
| React/Vinext | Current typed component model and local Sites-compatible build | Retool, plain HTML | Requires Node 22.13+ |
| React Flow | Directly satisfies node-based lineage visualization | Custom SVG/canvas | Accessibility needs supplemental semantic context |

## Security boundaries

- The demo uses mock records only.
- API mutations are allow-listed and counts are bounded.
- CORS accepts only local dashboard origins.
- SQLite queries use parameters.
- Production requires identity, authorization, TLS, Kafka ACLs, secrets management, audit retention, and object-store IAM.

## Deployment view

The verified deliverable is local-only by user requirement. No hosted deployment is claimed. The frontend scaffold remains Cloudflare Worker-compatible, but the Python service requires a separate container/service in any future deployment.
