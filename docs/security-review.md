# Security Review

## Scope

Review covers the local mock-data profile: FastAPI endpoints, WebSocket transport, SQLite adapter, frontend actions, configuration, and dependencies. It is not a production penetration test.

## Controls present

| Area | Control | Evidence |
|---|---|---|
| Data | Only generated checkout records; no production credentials or real PII | `StreamEngine.generate_event` |
| Authentication | Unique SQLite-backed accounts use per-user salts and scrypt password hashes; valid credentials create an eight-hour HTTP-only session; protected REST and WebSocket surfaces reject anonymous access | `auth.py`, `main.py`, API tests |
| Input validation | Pydantic model, allow-listed anomaly kinds, count range 1..100 | `main.py` and API tests |
| Injection | All SQL values are parameterized | `storage.py` |
| Browser boundary | CORS restricted to localhost/127.0.0.1 UI origin | `main.py` |
| Secrets | `.env*` ignored except documented example; no hard-coded secrets | `.gitignore`, `.env.example` |
| Error handling | Invalid values return typed 422/404 without stack traces | API tests |
| Destructive actions | No delete/truncate endpoint; reset resolves evidence | `main.py`, `storage.py` |

## Findings

| ID | Severity | Finding | Resolution / required action | Status |
|---|---:|---|---|---|
| SEC-001 | High in production | Local authentication supports multiple accounts but has no roles, SSO, password reset, or centralized revocation | Replace local accounts with SSO, roles, centralized revocation, and audited identity | Local authentication resolved; production authorization planned |
| SEC-002 | High in production | HTTP/WS are unencrypted locally | Terminate TLS at ingress and use WSS | Accepted for local demo only |
| SEC-003 | Medium | No API rate limiting | Add gateway/app rate limits and request IDs | Planned |
| SEC-004 | Medium | SQLite data has no encryption/retention policy | Use protected volumes and formal retention in production | Planned |
| SEC-005 | High (resolved) | Initial scaffold audit reported 13 advisories (12 high, 1 low) | Updated Next, React/RSC, Vinext, Vite, Cloudflare tooling, Wrangler, and worker types to compatible fixed releases; rebuilt and retested | Resolved; `npm audit` reports 0 vulnerabilities |
| SEC-006 | Low | WebSocket connections have no explicit maximum | Add authenticated connection quota in production | Planned |

## Production checklist

- Kafka TLS/SASL and least-privilege topic ACLs
- Flink service account, checkpoint encryption, and restricted job submission
- Iceberg catalog identity, object-store IAM, encryption, and table-level access policy
- Central secrets manager and rotation
- Immutable audit logs for injections, resets, and incident resolutions
- Dependency/SBOM scanning in CI
- Threat model, abuse cases, penetration test, recovery exercise

## Conclusion

The verified controls are appropriate for a local, mock-data educational demo. The local session prevents casual anonymous access but is not a production identity system. The service must not be exposed to an untrusted network until the production actions in SEC-001 through SEC-004 are addressed.

## Dependency evidence

The first audit correctly blocked a “clean” security conclusion. Compatible non-force upgrades reduced the count from 13 to 6 and then to **0 known npm audit vulnerabilities**. Backend dependencies are fully pinned in `requirements.txt`; a Python advisory scanner was not available in the supplied environment, so no claim is made beyond version pinning and functional tests.
