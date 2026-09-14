from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class Violation:
    rule_id: str
    field: str
    message: str
    severity: str = "critical"

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass(frozen=True)
class QualityRule:
    rule_id: str
    name: str
    field: str
    description: str
    severity: str
    predicate: Callable[[dict[str, Any]], bool]

    def public_dict(self) -> dict[str, str]:
        return {
            "id": self.rule_id,
            "name": self.name,
            "field": self.field,
            "description": self.description,
            "severity": self.severity,
        }


RULES = (
    QualityRule(
        "DQ-001",
        "Tax is present",
        "tax_amount",
        "Checkout events must contain a calculated tax amount.",
        "critical",
        lambda event: event.get("tax_amount") is not None,
    ),
    QualityRule(
        "DQ-002",
        "Tax is plausible",
        "tax_amount",
        "Tax must be non-negative and no more than 35% of subtotal.",
        "critical",
        lambda event: event.get("tax_amount") is not None
        and 0 <= float(event["tax_amount"]) <= float(event.get("subtotal", 0)) * 0.35,
    ),
    QualityRule(
        "DQ-003",
        "Schema is governed",
        "schema_version",
        "Only the approved checkout.v1 contract may enter the serving table.",
        "critical",
        lambda event: event.get("schema_version") == "checkout.v1",
    ),
    QualityRule(
        "DQ-004",
        "Currency is supported",
        "currency",
        "Currency must be one of the configured settlement currencies.",
        "warning",
        lambda event: event.get("currency") in {"USD", "EUR", "GBP", "INR"},
    ),
    QualityRule(
        "DQ-005",
        "Subtotal is bounded",
        "subtotal",
        "Subtotal must be positive and below the operational fraud ceiling.",
        "critical",
        lambda event: 0 < float(event.get("subtotal", 0)) <= 25_000,
    ),
    QualityRule(
        "DQ-006",
        "Region is known",
        "region",
        "Region must map to the governed sales hierarchy.",
        "warning",
        lambda event: event.get("region") in {"EU", "NA", "APAC"},
    ),
)


def evaluate(event: dict[str, Any]) -> list[Violation]:
    violations: list[Violation] = []
    for rule in RULES:
        try:
            passed = rule.predicate(event)
        except (TypeError, ValueError):
            passed = False
        if not passed:
            violations.append(
                Violation(
                    rule_id=rule.rule_id,
                    field=rule.field,
                    message=rule.description,
                    severity=rule.severity,
                )
            )
    return violations


def has_critical(violations: list[Violation]) -> bool:
    return any(item.severity == "critical" for item in violations)
