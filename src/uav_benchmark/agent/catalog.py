"""Read-only tools exposed to the Config Agent."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = ROOT / "knowledge" / "agent_reference_catalog.json"
TEMPLATE_BACKBONE_PATH = ROOT / "knowledge" / "task_template_backbone.json"
SCENARIO_REGISTRY_PATH = ROOT / "knowledge" / "business_scenario_registry.json"
JD_TREE_PATH = ROOT / "knowledge" / "jd_variable_tree_version2.json"

_DOMAIN_EXCLUDED_ROLES = {
    "derived_metric",
    "example_profile",
    "hidden_ground_truth",
    "runtime_observation",
    "structural_group",
}
_NUMERIC_VALUE_TYPES = {"number", "number_or_range", "integer", "integer_or_range"}


@lru_cache(maxsize=1)
def load_reference_catalog() -> dict[str, Any]:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_template_backbone() -> dict[str, Any]:
    return json.loads(TEMPLATE_BACKBONE_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_scenario_registry() -> dict[str, Any]:
    """Return the versioned registry used for optional scenario examples."""

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
        "ability_id_scheme": catalog["ability_id_scheme"],
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
        "ability_id_scheme": catalog["ability_id_scheme"],
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


def _canonical_slot_for_tree_node(
    node: dict[str, Any], valid_slot_ids: set[str]
) -> str | None:
    """Resolve one fine-grained Version2 node to its primary canonical JD slot."""

    explicit = node.get("canonical_slot")
    if explicit in valid_slot_ids:
        return explicit

    # Version2 local leaf IDs inherit their primary canonical slot from the
    # first two numeric segments (for example jd-11.2.2.1 -> jd-11.2).
    match = re.search(r"jd-(\d+)\.(\d+)", str(node.get("node_id") or ""))
    if match:
        inferred = f"jd-{match.group(1)}.{match.group(2)}"
        if inferred in valid_slot_ids:
            return inferred

    # A unique reference is a safe fallback for migrated nodes whose ID does
    # not encode the canonical slot. Multiple references are relationships,
    # not permission to copy one domain into several unrelated JD slots.
    references = [
        item
        for item in (node.get("canonical_jd_refs") or [])
        if item in valid_slot_ids
    ]
    return references[0] if len(references) == 1 else None


def build_jd_tree_domains(
    tree: dict[str, Any], valid_slot_ids: set[str]
) -> dict[str, dict[str, Any]]:
    """Project the Version2 fine-grained tree onto the existing 66-slot API."""

    buckets: dict[str, dict[str, Any]] = {}
    for node in tree.get("nodes", []):
        if node.get("node_kind") != "variable":
            continue
        role = node.get("variable_role") or "TBD"
        visibility = set(node.get("visibility") or [])
        if role in _DOMAIN_EXCLUDED_ROLES or "hidden_gt" in visibility:
            continue

        slot = _canonical_slot_for_tree_node(node, valid_slot_ids)
        if not slot:
            continue

        value_type = str(node.get("value_type") or "")
        labels: list[str] = []
        raw_domain = node.get("value_domain") or []
        if isinstance(raw_domain, list):
            for item in raw_domain:
                if isinstance(item, dict):
                    label = item.get("label_zh") or item.get("value") or ""
                elif item is not None:
                    label = str(item)
                else:
                    label = ""
                label = str(label).strip()
                if label and label not in labels:
                    labels.append(label)

        if not labels and value_type not in _NUMERIC_VALUE_TYPES:
            continue

        bucket = buckets.setdefault(
            slot,
            {
                "options": [],
                "value_types": [],
                "node_ids": [],
                "roles": [],
                "configuration_sides": [],
            },
        )
        for label in labels:
            if label not in bucket["options"]:
                bucket["options"].append(label)
        for key, value in (
            ("value_types", value_type),
            ("node_ids", node.get("node_id")),
            ("roles", role),
            ("configuration_sides", node.get("configuration_side")),
        ):
            if value and value not in bucket[key]:
                bucket[key].append(value)

    domains: dict[str, dict[str, Any]] = {}
    for slot in sorted(buckets):
        bucket = buckets[slot]
        value_types = bucket.pop("value_types")
        domains[slot] = {
            "value_type": value_types[0] if len(value_types) == 1 else "mixed",
            **bucket,
        }
    return domains


def load_jd_tree_domains() -> dict[str, Any]:
    """Load Version2 and expose a backward-compatible 66-slot domain view."""

    tree = json.loads(JD_TREE_PATH.read_text(encoding="utf-8"))
    domains = build_jd_tree_domains(tree, set(jd_field_index()))
    return {
        "source_tree": JD_TREE_PATH.name,
        "catalog_version": tree.get("catalog_version"),
        "slots": domains,
    }
