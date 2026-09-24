from app.rules import evaluate, has_critical


def valid_event() -> dict:
    return {
        "event_id": "EVT-001",
        "occurred_at": "2026-08-24T10:00:00+00:00",
        "subtotal": 100.0,
        "tax_amount": 18.0,
        "currency": "INR",
        "region": "APAC",
        "schema_version": "checkout.v1",
    }


def test_valid_checkout_event_passes_all_rules() -> None:
    assert evaluate(valid_event()) == []


def test_null_tax_is_rejected_by_presence_and_plausibility_rules() -> None:
    event = valid_event()
    event["tax_amount"] = None
    violations = evaluate(event)
    assert {item.rule_id for item in violations} == {"DQ-001", "DQ-002"}
    assert has_critical(violations)


def test_unapproved_schema_is_critical() -> None:
    event = valid_event()
    event["schema_version"] = "checkout.v2-unapproved"
    violations = evaluate(event)
    assert [item.rule_id for item in violations] == ["DQ-003"]


def test_unknown_currency_is_warning_only() -> None:
    event = valid_event()
    event["currency"] = "BTC"
    violations = evaluate(event)
    assert [item.rule_id for item in violations] == ["DQ-004"]
    assert not has_critical(violations)
