from __future__ import annotations

import asyncio
import random
import time
import uuid
from collections import Counter, deque
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from .rules import evaluate, has_critical
from .storage import LakehouseStore

Broadcast = Callable[[dict[str, Any]], Awaitable[None]]


class StreamEngine:
    threshold = 0.02
    recovery_batches = 5

    def __init__(self, store: LakehouseStore, broadcast: Broadcast, seed: int = 2026):
        self.store = store
        self.broadcast = broadcast
        self.random = random.Random(seed)
        self.running = True
        self.circuit_open = False
        self.current_incident: int | None = None
        self.healthy_streak = 0
        self.quality_window: deque[bool] = deque(maxlen=100)
        self.rule_failures: Counter[str] = Counter()
        self.events_seen = 0
        self.last_batch_size = 0
        self.last_batch_seconds = 1.0
        self.injection: deque[str] = deque()
        self._task: asyncio.Task[None] | None = None

    def generate_event(self, anomaly: str | None = None) -> dict[str, Any]:
        subtotal = round(self.random.uniform(18, 640), 2)
        event: dict[str, Any] = {
            "event_id": str(uuid.uuid4()),
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "customer_id": f"CUS-{self.random.randint(10000, 99999)}",
            "subtotal": subtotal,
            "tax_amount": round(subtotal * self.random.uniform(0.06, 0.2), 2),
            "currency": self.random.choice(["USD", "EUR", "GBP", "INR"]),
            "region": self.random.choice(["EU", "NA", "APAC"]),
            "device": self.random.choice(["web", "ios", "android"]),
            "schema_version": "checkout.v1",
        }
        if anomaly == "null_tax":
            event["tax_amount"] = None
        elif anomaly == "schema_drift":
            event["schema_version"] = "checkout.v2-unapproved"
            event["tax_details"] = {"source": "experimental"}
        elif anomaly == "amount_spike":
            event["subtotal"] = 50_000
        return event

    def queue_injection(self, kind: str, count: int = 8) -> None:
        if kind not in {"null_tax", "schema_drift", "amount_spike"}:
            raise ValueError("Unsupported anomaly type")
        self.injection.extend([kind] * count)

    async def process_batch(self, events: list[dict[str, Any]]) -> None:
        started = time.perf_counter()
        batch_has_error = False
        pending: list[tuple[dict[str, Any], list[dict[str, str]], bool]] = []

        for event in events:
            violations = evaluate(event)
            critical = has_critical(violations)
            batch_has_error = batch_has_error or critical
            self.quality_window.append(not critical)
            for violation in violations:
                self.rule_failures[violation.rule_id] += 1
            pending.append((event, [item.to_dict() for item in violations], critical))

        failures = sum(1 for passed in self.quality_window if not passed)
        error_rate = failures / max(1, len(self.quality_window))
        should_trip = error_rate > self.threshold
        just_tripped = should_trip and not self.circuit_open

        if just_tripped:
            self.circuit_open = True
            dominant = self.rule_failures.most_common(1)[0][0] if self.rule_failures else "DQ-UNKNOWN"
            self.current_incident = self.store.open_incident(
                dominant,
                "Quality threshold breached",
                f"Rolling error rate reached {error_rate:.1%}; serving writes were stopped.",
            )

        for event, violations, critical in pending:
            route = "dlq" if self.circuit_open or critical else "main"
            self.store.record_event(event, route, violations)
            self.events_seen += 1

        if self.circuit_open:
            self.healthy_streak = self.healthy_streak + 1 if not batch_has_error else 0
            if self.healthy_streak >= self.recovery_batches:
                await self.reset_circuit("Automatic recovery after five clean probe batches")

        counts = self.store.counts()
        latest = self.store.list_snapshots(1)
        last_snapshot_count = latest[0]["event_count"] if latest else 0
        if counts["main"] >= last_snapshot_count + 24:
            self.store.create_snapshot()

        self.last_batch_size = len(events)
        self.last_batch_seconds = max(time.perf_counter() - started, 0.001)
        await self.broadcast(await self.dashboard_payload(event="batch"))

    async def reset_circuit(self, reason: str = "Manual operator reset") -> None:
        if self.current_incident is not None:
            self.store.resolve_incident(self.current_incident)
        self.circuit_open = False
        self.current_incident = None
        self.healthy_streak = 0
        self.quality_window.clear()
        await self.broadcast(await self.dashboard_payload(event="recovered", note=reason))

    async def dashboard_payload(self, event: str = "state", note: str | None = None) -> dict[str, Any]:
        counts = self.store.counts()
        failed = sum(1 for passed in self.quality_window if not passed)
        total = len(self.quality_window)
        error_rate = failed / max(1, total)
        payload: dict[str, Any] = {
            "event": event,
            "running": self.running,
            "circuit": "open" if self.circuit_open else "closed",
            "pipeline_status": "quarantined" if self.circuit_open else ("streaming" if self.running else "paused"),
            "metrics": {
                "events_seen": self.events_seen,
                "accepted": counts["main"],
                "quarantined": counts["dlq"],
                "quality_score": round((1 - error_rate) * 100, 1),
                "error_rate": round(error_rate * 100, 2),
                "throughput": round(self.last_batch_size / 1.2, 1),
                "window_size": total,
            },
            "top_failures": [
                {"rule_id": rule_id, "count": count}
                for rule_id, count in self.rule_failures.most_common(4)
            ],
            "incidents": self.store.recent_incidents(8),
            "snapshots": self.store.list_snapshots(8),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if note:
            payload["note"] = note
        return payload

    async def _loop(self) -> None:
        while True:
            if self.running:
                batch = [
                    self.generate_event(self.injection.popleft() if self.injection else None)
                    for _ in range(8)
                ]
                await self.process_batch(batch)
            await asyncio.sleep(1.2)

    def start_task(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._loop())

    async def shutdown(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
