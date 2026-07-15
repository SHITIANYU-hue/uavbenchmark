"""Read-only tools exposed to the Config Agent."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = ROOT / "knowledge" / "agent_reference_catalog.json"
TEMPLATE_BACKBONE_PATH = ROOT / "knowledge" / "task_template_backbone.json"
SCENARIO_REGISTRY_PATH = ROOT / "knowledge" / "business_scenario_registry.json"


@lru_cache(maxsize=1)
def load_reference_catalog() -> dict[str, Any]:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_template_backbone() -> dict[str, Any]:
    return json.loads(TEMPLATE_BACKBONE_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_scenario_registry() -> dict[str, Any]:
    """Return the versioned registry used by Stage 0."""

    return json.loads(SCENARIO_REGISTRY_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=None)
def load_fixed_scenario(scenario_id: str | None = None) -> dict[str, Any]:
    """Return one selected business scenario supplied before task input."""

    registry = load_scenario_registry()
    selected_id = scenario_id or registry["default_scenario_id"]
    for scenario in registry["scenarios"]:
        if scenario["scenario_id"] == selected_id:
            return scenario
    raise KeyError(f"Unknown business scenario: {selected_id}")


def lookup_gal_catalog() -> dict[str, Any]:
    """Return the reviewed 17-A, L1-L4 responsibility catalog."""

    catalog = load_reference_catalog()
    return {
        "catalog_version": catalog["catalog_version"],
        "scope": catalog["scope"],
        "source_versions": catalog["source_versions"],
        "counts": catalog["counts"],
        "warning": catalog["warning"],
        "level_policy": catalog["level_policy"],
        "same_case_leveling_rule": catalog["same_case_leveling_rule"],
        "abilities": catalog["abilities"],
        "gal_cells": catalog["gal_cells"],
        "global_rules": catalog["global_rules"],
    }


def lookup_jd_catalog() -> dict[str, Any]:
    """Return the reviewed 66-slot JD dictionary."""

    catalog = load_reference_catalog()
    return {
        "catalog_version": catalog["catalog_version"],
        "scope": catalog["scope"],
        "source_versions": catalog["source_versions"],
        "counts": catalog["counts"],
        "warning": catalog["warning"],
        "jd_fields": catalog["jd_fields"],
        "global_rules": catalog["global_rules"],
    }


def gal_cell_index() -> dict[str, dict[str, Any]]:
    """Index reviewed A×L cells by stable cell ID."""

    return {item["cell"]: item for item in load_reference_catalog()["gal_cells"]}


def jd_field_index() -> dict[str, dict[str, Any]]:
    """Index reviewed JD fields by stable slot ID."""

    return {item["id"]: item for item in load_reference_catalog()["jd_fields"]}
