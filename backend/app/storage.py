from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LakehouseStore:
    """A small local adapter that preserves the table/DLQ/snapshot contract.

    SQLite is deliberately used for the zero-infrastructure demo profile. The
    production adapter boundary maps these operations to Kafka/Flink/Iceberg.
    """

    def __init__(self, path: str | Path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        self._initialize()

    def _initialize(self) -> None:
        with self._lock, self._connection:
            self._connection.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS events (
                    event_id TEXT PRIMARY KEY,
                    occurred_at TEXT NOT NULL,
                    route TEXT NOT NULL CHECK(route IN ('main','dlq')),
                    payload TEXT NOT NULL,
                    violations TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS incidents (
                    incident_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    opened_at TEXT NOT NULL,
                    resolved_at TEXT,
                    rule_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    status TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS snapshots (
                    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    event_count INTEGER NOT NULL,
                    watermark TEXT NOT NULL,
                    payload TEXT NOT NULL
                );
                """
            )

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    def record_event(self, event: dict[str, Any], route: str, violations: list[dict[str, str]]) -> None:
        with self._lock, self._connection:
            self._connection.execute(
                "INSERT OR IGNORE INTO events(event_id, occurred_at, route, payload, violations) VALUES(?,?,?,?,?)",
                (
                    event["event_id"],
                    event["occurred_at"],
                    route,
                    json.dumps(event, separators=(",", ":")),
                    json.dumps(violations, separators=(",", ":")),
                ),
            )

    def open_incident(self, rule_id: str, title: str, reason: str) -> int:
        with self._lock, self._connection:
            cursor = self._connection.execute(
                "INSERT INTO incidents(opened_at, rule_id, title, reason, severity, status) VALUES(?,?,?,?,?,?)",
                (utc_now(), rule_id, title, reason, "critical", "open"),
            )
            return int(cursor.lastrowid)

    def resolve_incident(self, incident_id: int) -> None:
        with self._lock, self._connection:
            self._connection.execute(
                "UPDATE incidents SET status='resolved', resolved_at=? WHERE incident_id=?",
                (utc_now(), incident_id),
            )

    def counts(self) -> dict[str, int]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT route, COUNT(*) AS total FROM events GROUP BY route"
            ).fetchall()
            counts = {"main": 0, "dlq": 0}
            counts.update({row["route"]: int(row["total"]) for row in rows})
            return counts

    def recent_incidents(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT * FROM incidents ORDER BY incident_id DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(row) for row in rows]

    def create_snapshot(self) -> dict[str, Any]:
        with self._lock, self._connection:
            rows = self._connection.execute(
                "SELECT payload FROM events WHERE route='main' ORDER BY rowid DESC LIMIT 24"
            ).fetchall()
            payload = [json.loads(row["payload"]) for row in reversed(rows)]
            counts = self.counts()
            created_at = utc_now()
            watermark = payload[-1]["occurred_at"] if payload else created_at
            cursor = self._connection.execute(
                "INSERT INTO snapshots(created_at, event_count, watermark, payload) VALUES(?,?,?,?)",
                (created_at, counts["main"], watermark, json.dumps(payload, separators=(",", ":"))),
            )
            return {
                "snapshot_id": int(cursor.lastrowid),
                "created_at": created_at,
                "event_count": counts["main"],
                "watermark": watermark,
            }

    def list_snapshots(self, limit: int = 12) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT snapshot_id, created_at, event_count, watermark FROM snapshots ORDER BY snapshot_id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(row) for row in rows]

    def snapshot(self, snapshot_id: int) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM snapshots WHERE snapshot_id=?", (snapshot_id,)
            ).fetchone()
            if row is None:
                return None
            result = dict(row)
            result["events"] = json.loads(result.pop("payload"))
            return result
