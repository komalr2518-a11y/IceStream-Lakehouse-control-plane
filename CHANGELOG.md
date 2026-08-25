# Changelog

All notable changes to IceStream are documented here.

## 1.1.0-local - 2026-08-25

- Added username, user ID, and password authentication for the local profile.
- Added expiring HTTP-only sessions, protected REST/WebSocket access, current-user identity, and explicit sign out.
- Added a responsive login screen and operator account menu.
- Added ignored local credential generation during setup plus authentication tests and traceability.
- Added self-service registration with unique persistent SQLite accounts and salted scrypt password hashes.
- Replaced raw browser fetch failures with actionable backend restart guidance and a retry control.
- Added an optional browser-managed password save control without storing plaintext passwords in application storage.

## 1.0.0-local - 2026-08-24

- Added a deterministic checkout stream generator with six data-quality rules.
- Added rolling-threshold circuit breaking, dead-letter routing, incident history, and automatic/manual recovery.
- Added SQLite-backed events, snapshots, and time-travel inspection for the local adapter profile.
- Added FastAPI REST and WebSocket interfaces plus a responsive React/Vinext observability dashboard.
- Added VS Code setup, run, and debug tasks for Windows.
- Added backend tests, frontend type/lint/build gates, security review, traceability, roadmap, and review documentation.
- Added a verified 14-slide project-review deck and social-preview artwork.

## Known scope boundary

The verified release is the local adapter profile. Kafka, Flink, and Iceberg are documented production targets and are not represented as implemented.
