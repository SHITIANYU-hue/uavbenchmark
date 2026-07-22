"""Human case intake -> Config Agent task template compiler."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping, Union

import yaml
from jsonschema import Draft202012Validator


ABILITY_TO_GROUP = {
    "A1": "G1", "A2": "G1", "A3": "G1", "A4": "G1", "A5": "G1",
    "A6": "G2", "A7": "G2", "A8": "G2", "A9": "G2",
    "A10": "G3", "A11": "G3",
    "A12": "G4", "A13": "G4",
    "A14": "G5", "A15": "G6",
    "A16": "G5", "A17": "G6",
}

EVIDENCE_STATUSES = {"verified", "proposed", "TBD"}
LEVELS = {"L1", "L2", "L3", "L4"}
ROLES = {"primary", "anomaly", "auxiliary", "non_scored"}


class IntakeError(ValueError):
    """Raised when the human-authored intake is incomplete or contradictory."""


def load_case_intake(path: Union[str, Path]) -> dict[str, Any]:
    """Load a YAML or JSON case intake file."""

    intake_path = Path(path)
    text = intake_path.read_text(encoding="utf-8")
    if intake_path.suffix.lower() == ".json":
        document = json.loads(text)
    else:
        document = yaml.safe_load(text)
    if not isinstance(document, dict):
        raise IntakeError("Case intake root must be an object/mapping.")
    return document


def _required(document: Mapping[str, Any], field: str) -> Any:
    value = document.get(field)
    if value is None or value == "" or value == []:
        raise IntakeError(f"Missing required intake field: {field}")
    return value


def _status(value: Any, field: str) -> str:
    status = str(value or "TBD")
    if status not in EVIDENCE_STATUSES:
        raise IntakeError(f"{field} must be verified, proposed, or TBD; got {status!r}")
    return status


def _provenance(intake: Mapping[str, Any]) -> dict[str, Any]:
    source = intake.get("source") or {}
    return {
        "source_id": str(source.get("source_id") or f"case_intake:{_required(intake, 'case_id')}"),
        "locator": source.get("locator"),
        "status": _status(source.get("status", intake.get("status", "TBD")), "source.status"),
        "notes": source.get("notes"),
    }


def _coverage(item: Mapping[str, Any], provenance: Mapping[str, Any]) -> dict[str, Any]:
    ability = str(_required(item, "ability"))
    if ability not in ABILITY_TO_GROUP:
        raise IntakeError(f"Unknown ability: {ability}")
    level = str(_required(item, "level"))
    if level not in LEVELS:
        raise IntakeError(
            f"Scored coverage level must be L1-L4; got {level!r}. "
            "External/L0 conditions belong in runtime_dependencies."
        )
    role = str(_required(item, "role"))
    if role not in ROLES:
        raise IntakeError(f"Unknown coverage role: {role}")
    coverage_id = str(item.get("coverage_id") or f"{ability.lower()}_{level.lower()}")
    return {
        "coverage_id": coverage_id,
        "group": ABILITY_TO_GROUP[ability],
        "ability": ability,
        "level": level,
        "role": role,
        "sut_responsibilities": list(_required(item, "responsibilities")),
        "out_of_scope": list(item.get("out_of_scope") or []),
        "provenance": [deepcopy(provenance)],
    }


def _runtime_dependency(item: Mapping[str, Any], provenance: Mapping[str, Any]) -> dict[str, Any]:
    ability = item.get("ability")
    result: dict[str, Any] = {
        "dependency_id": str(_required(item, "dependency_id")),
        "provider": str(_required(item, "provider")),
        "responsibilities": list(_required(item, "responsibilities")),
        "scored": False,
        "status": _status(item.get("status", "TBD"), "runtime_dependency.status"),
        "provenance": [deepcopy(provenance)],
    }
    if ability is not None:
        ability = str(ability)
        if ability not in ABILITY_TO_GROUP:
            raise IntakeError(f"Unknown runtime dependency ability: {ability}")
        result["ability"] = ability
        result["group"] = ABILITY_TO_GROUP[ability]
    return result


def _slot(item: Mapping[str, Any], provenance: Mapping[str, Any]) -> dict[str, Any]:
    binding_input = item.get("binding") or {}
    binding = {
        "mode": str(binding_input.get("mode") or "TBD"),
        "status": _status(binding_input.get("status", item.get("status", "TBD")), "variable.binding.status"),
    }
    for field in ("value", "allowed_values", "minimum", "maximum", "reference"):
        if field in binding_input:
            binding[field] = deepcopy(binding_input[field])
    return {
        "slot_id": str(_required(item, "slot_id")),
        "description": str(_required(item, "description")),
        "visibility": str(item.get("visibility") or "compiler_only"),
        "binding": binding,
        "provenance": [deepcopy(provenance)],
    }


def _phase(item: Mapping[str, Any]) -> dict[str, Any]:
    duration = item.get("minimum_duration") or {"value": None, "unit": "TBD", "status": "TBD"}
    return {
        "phase_id": str(_required(item, "phase_id")),
        "order": int(_required(item, "order")),
        "entry_conditions": list(item.get("entry_conditions") or []),
        "exit_conditions": list(item.get("exit_conditions") or []),
        "minimum_duration": {
            "value": duration.get("value"),
            "unit": str(duration.get("unit") or "TBD"),
            "status": _status(duration.get("status", "TBD"), "phase.minimum_duration.status"),
        },
    }


def _interfaces(intake: Mapping[str, Any]) -> dict[str, Any]:
    interfaces = intake.get("interfaces") or {}

    def contracts(field: str) -> list[dict[str, Any]]:
        values = interfaces.get(field) or []
        return [
            {
                "name": str(_required(item, "name")),
                "description": str(_required(item, "description")),
                "schema_ref": item.get("schema_ref"),
            }
            for item in values
        ]

    external = interfaces.get("external_decision_port") or {
        "description": "No external decision protocol declared; human confirmation required.",
        "status": "TBD",
        "protocol": None,
    }
    return {
        "sut_visible_inputs": contracts("sut_visible_inputs"),
        "sut_outputs": contracts("sut_outputs"),
        "hidden_ground_truth": contracts("hidden_ground_truth"),
        "executor_responsibilities": list(interfaces.get("executor_responsibilities") or []),
        "external_decision_port": {
            "description": str(_required(external, "description")),
            "status": _status(external.get("status", "TBD"), "external_decision_port.status"),
            "protocol": external.get("protocol"),
        },
    }


def _metric(item: Mapping[str, Any], provenance: Mapping[str, Any]) -> dict[str, Any]:
    threshold = item.get("threshold") or {}
    threshold_status = _status(threshold.get("status", "TBD"), "metric.threshold.status")
    threshold_value = threshold.get("value")
    if threshold_status == "TBD" and threshold_value is not None:
        raise IntakeError("A metric with threshold status TBD must have a null value.")
    return {
        "metric_id": str(_required(item, "metric_id")),
        "coverage_id": str(_required(item, "coverage_id")),
        "name": str(_required(item, "name")),
        "parameters": deepcopy(item.get("parameters") or {}),
        "direction": str(item.get("direction") or "TBD"),
        "threshold": {
            "value": threshold_value,
            "status": threshold_status,
            "rationale": threshold.get("rationale"),
        },
        "provenance": [deepcopy(provenance)],
    }


def build_task_template(intake: Mapping[str, Any]) -> dict[str, Any]:
    """Normalize a human case intake into task_template.schema.json shape."""

    provenance = _provenance(intake)
    template = {
        "schema_version": "0.2.0",
        "artifact_type": "task_template",
        "template_id": str(intake.get("template_id") or f"{_required(intake, 'case_id')}_template"),
        "template_version": str(intake.get("template_version") or "0.1.0"),
        "title": str(_required(intake, "title")),
        "scenario": {
            "summary": str(_required(intake, "summary")),
            "fixed_boundaries": list(_required(intake, "fixed_boundaries")),
            "out_of_scope": list(intake.get("out_of_scope") or []),
        },
        "coverage": [_coverage(item, provenance) for item in _required(intake, "coverage")],
        "runtime_dependencies": [
            _runtime_dependency(item, provenance) for item in intake.get("runtime_dependencies") or []
        ],
        "attribution_rules": [
            {
                "rule_id": str(_required(item, "rule_id")),
                "description": str(_required(item, "description")),
                "applies_to": list(_required(item, "applies_to")),
                "shared_outcome_handling": str(_required(item, "shared_outcome_handling")),
                "status": _status(item.get("status", "TBD"), "attribution_rule.status"),
            }
            for item in intake.get("attribution_rules") or []
        ],
        "task_level_gates": [
            {
                "gate_id": str(_required(item, "gate_id")),
                "description": str(_required(item, "description")),
                "evidence_required": list(item.get("evidence_required") or []),
                "status": _status(item.get("status", "TBD"), "task_level_gate.status"),
            }
            for item in intake.get("task_level_gates") or []
        ],
        "coverage_accounting_mode": str(intake.get("coverage_accounting_mode") or "explicit_only"),
        "jd_slots": [_slot(item, provenance) for item in intake.get("variables") or []],
        "phases": [_phase(item) for item in _required(intake, "phases")],
        "disturbances": [
            {
                "disturbance_id": str(_required(item, "disturbance_id")),
                "kind": str(_required(item, "kind")),
                "injection_phase": str(_required(item, "injection_phase")),
                "parameters": deepcopy(item.get("parameters") or {}),
                "status": _status(item.get("status", "TBD"), "disturbance.status"),
            }
            for item in intake.get("disturbances") or []
        ],
        "interfaces": _interfaces(intake),
        "metrics": [_metric(item, provenance) for item in intake.get("metrics") or []],
        "provenance": [provenance],
    }
    return template


def validate_task_template(template: Mapping[str, Any], schema_path: Union[str, Path]) -> None:
    """Validate a generated template against the project JSON Schema."""

    schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(dict(template))
