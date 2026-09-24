# Defect Log

| ID | Severity | Description | Root cause | Resolution | Validation | Status |
|---|---:|---|---|---|---|---|
| DEF-001 | Medium | Official site scaffold failed under the first package runner. | Windows sandbox could not resolve/write the default user cache. | Used the same pinned scaffold through the available npm runner with a workspace-local cache. | Project scaffold created and dependencies installed. | Resolved |
| DEF-002 | High | Generated dependency tree reported 13 audit findings. | Pinned scaffold included vulnerable direct/transitive packages. | Applied compatible explicit upgrades without `--force`; updated peer packages; reran tests/lint/typecheck/build. | Final `npm audit`: 0 vulnerabilities. | Resolved |
| DEF-003 | Medium | React Flow initially produced an invalid-hook error in the multi-environment Vite preview. | React could be resolved independently by the client/RSC optimizer. | Added Vite `resolve.dedupe` for `react` and `react-dom`. | Preview returned HTTP 200 with no repeated runtime error; production build passed. | Resolved |
| DEF-004 | Low | Initial client timestamp caused server/client locale hydration mismatch. | Dynamic locale time was computed during server and client initialization. | Use an empty deterministic initial timestamp and populate it after API/WebSocket data arrives. | Preview reloaded without hydration mismatch; build passed. | Resolved |

New issues must include affected requirement, reproduction, actual fix, and regression evidence. Do not use this log to hide incomplete infrastructure work; FR-013 remains a requirement status, not a defect.
