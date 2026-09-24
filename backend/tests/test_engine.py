import pytest

from app.engine import StreamEngine
from app.storage import LakehouseStore


@pytest.mark.asyncio
async def test_circuit_breaker_quarantines_bad_data_and_recovers(tmp_path) -> None:
    messages: list[dict] = []

    async def capture(payload: dict) -> None:
        messages.append(payload)

    store = LakehouseStore(tmp_path / "engine.db")
    engine = StreamEngine(store, capture)

    good_batch = [engine.generate_event() for _ in range(8)]
    await engine.process_batch(good_batch)
    assert store.counts() == {"main": 8, "dlq": 0}
    assert engine.circuit_open is False

    bad_batch = [engine.generate_event("null_tax") for _ in range(8)]
    await engine.process_batch(bad_batch)
    assert engine.circuit_open is True
    assert store.counts() == {"main": 8, "dlq": 8}
    assert store.recent_incidents(1)[0]["status"] == "open"

    for _ in range(engine.recovery_batches):
        await engine.process_batch([engine.generate_event() for _ in range(8)])

    assert engine.circuit_open is False
    assert store.recent_incidents(1)[0]["status"] == "resolved"
    assert any(message["event"] == "recovered" for message in messages)
    store.close()


@pytest.mark.asyncio
async def test_snapshot_is_created_after_accepted_commit_boundary(tmp_path) -> None:
    async def ignore(_: dict) -> None:
        return None

    store = LakehouseStore(tmp_path / "snapshots.db")
    engine = StreamEngine(store, ignore)
    for _ in range(3):
        await engine.process_batch([engine.generate_event() for _ in range(8)])

    snapshots = store.list_snapshots()
    assert len(snapshots) == 1
    assert snapshots[0]["event_count"] == 24
    assert len(store.snapshot(snapshots[0]["snapshot_id"])["events"]) == 24
    store.close()
