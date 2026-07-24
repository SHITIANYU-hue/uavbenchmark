"""Read-only tools exposed to the Config Agent."""

from __future__ import annotations

import hashlib
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Mapping


ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = ROOT / "knowledge" / "agent_reference_catalog.json"
TEMPLATE_BACKBONE_PATH = ROOT / "knowledge" / "task_template_backbone.json"
SCENARIO_REGISTRY_PATH = ROOT / "knowledge" / "business_scenario_registry.json"
JD_TREE_V2_PATH = ROOT / "knowledge" / "jd_variable_tree_version2.json"
JD_DICTIONARY_PATH = ROOT / "knowledge" / "jd_dictionary.json"


def _json_hash(payload: Mapping[str, Any]) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@lru_cache(maxsize=1)
def load_reference_catalog() -> dict[str, Any]:
    """Return the A×L catalog with the canonical 66-slot JD directory.

    The checked-in Agent catalog contains the current 17-A/68-cell definitions
    but its embedded ``jd_fields`` section is an inconsistent 78-row snapshot.
    ``jd_dictionary.json`` is the reviewed canonical 66-slot source.  Overlay it
    at read time so Agent extraction, tree tracing, delivery validation and UI
    counts all use one canonical set without rewriting the team-delivered tree.
    """

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    dictionary = json.loads(JD_DICTIONARY_PATH.read_text(encoding="utf-8"))
    fields = list(dictionary.get("variables") or [])
    counts = dict(catalog.get("counts") or {})
    dictionary_counts = dictionary.get("counts") or {}
    counts.update({
        "jd_fields": len(fields),
        "global_jd": int(dictionary_counts.get("global", 0)),
        "local_jd": int(dictionary_counts.get("local", 0)),
    })
    catalog["jd_fields"] = fields
    catalog["counts"] = counts
    return catalog


@lru_cache(maxsize=1)
def load_template_backbone() -> dict[str, Any]:
    return json.loads(TEMPLATE_BACKBONE_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_scenario_registry() -> dict[str, Any]:
    """Return the versioned registry used for optional scenario examples."""

    return json.loads(SCENARIO_REGISTRY_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_jd_variable_tree_version2() -> dict[str, Any]:
    """Return the team-delivered JD Version2 tree without rewriting it."""

    tree = json.loads(JD_TREE_V2_PATH.read_text(encoding="utf-8"))
    nodes = tree.get("nodes")
    if not isinstance(nodes, list):
        raise ValueError("JD Version2 tree must contain a nodes array")
    node_ids = [node.get("node_id") for node in nodes if isinstance(node, dict)]
    if any(not isinstance(node_id, str) or not node_id for node_id in node_ids):
        raise ValueError("Every JD Version2 node must have a non-empty node_id")
    if len(node_ids) != len(nodes) or len(node_ids) != len(set(node_ids)):
        raise ValueError("JD Version2 node_id values must be unique")
    return tree


@lru_cache(maxsize=1)
def load_jd_dictionary() -> dict[str, Any]:
    """Return the legacy/canonical 66-slot trace dictionary."""

    return json.loads(JD_DICTIONARY_PATH.read_text(encoding="utf-8"))


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


def jd_tree_node_index(
    tree: Mapping[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """Index the current V2 tree by its native node IDs."""

    source = tree if tree is not None else load_jd_variable_tree_version2()
    return {
        node["node_id"]: dict(node)
        for node in source.get("nodes", [])
        if isinstance(node, dict) and node.get("node_id")
    }


def _node_path(
    node_id: str,
    index: Mapping[str, Mapping[str, Any]],
) -> list[str]:
    path: list[str] = []
    seen: set[str] = set()
    current: str | None = node_id
    while current:
        if current in seen:
            raise ValueError(f"JD Version2 parent cycle detected at {current}")
        seen.add(current)
        node = index.get(current)
        if node is None:
            raise ValueError(f"JD Version2 parent path references missing node {current}")
        path.append(current)
        parent = node.get("parent_id")
        current = str(parent) if parent else None
    path.reverse()
    return path


def _normalise_ids(values: Iterable[str] | None) -> set[str]:
    return {
        str(value).strip()
        for value in values or []
        if str(value).strip()
    }


def _domain_labels(raw_domain: Any) -> list[str]:
    if not isinstance(raw_domain, list):
        return []
    labels: list[str] = []
    for item in raw_domain:
        if isinstance(item, dict):
            label = item.get("label_zh")
            if label is None:
                label = item.get("value")
        else:
            label = item
        if label is None:
            continue
        text = str(label).strip()
        if text and text not in labels:
            labels.append(text)
    return labels


def _is_hidden_ground_truth(node: Mapping[str, Any]) -> bool:
    visibility = set(node.get("visibility") or [])
    channels = set(node.get("observation_channel") or [])
    return (
        node.get("variable_role") == "hidden_ground_truth"
        or "hidden_gt" in visibility
        or "hidden_gt" in channels
    )


def _tree_metadata(
    tree: Mapping[str, Any],
    *,
    source_hash: str | None = None,
) -> dict[str, Any]:
    return {
        "source_tree": JD_TREE_V2_PATH.name,
        "schema_version": tree.get("schema_version"),
        "catalog_version": tree.get("catalog_version"),
        "tree_sha256": source_hash or _json_hash(tree),
        "node_count": len(tree.get("nodes", [])),
    }


def lookup_jd_tree_metadata() -> dict[str, Any]:
    """Return immutable identity metadata for the current V2 source file."""

    return _tree_metadata(
        load_jd_variable_tree_version2(),
        source_hash=_file_hash(JD_TREE_V2_PATH),
    )


def build_jd_tree_domains(
    tree: Mapping[str, Any],
    selected_node_ids: Iterable[str] | None = None,
    *,
    source_hash: str | None = None,
) -> dict[str, Any]:
    """Build safe value-domain suggestions from native V2 variable nodes.

    ``selected_node_ids`` may contain a V2 group or leaf ID. A group selects
    its descendants by the explicit parent chain. Hidden-GT values are never
    returned as editable domain suggestions. This function does not infer a
    canonical-66 mapping from the shape of a V2 node ID.
    """

    index = jd_tree_node_index(tree)
    selected = _normalise_ids(selected_node_ids)
    missing = sorted(selected - set(index))
    if missing:
        raise KeyError(f"Unknown JD Version2 node IDs: {', '.join(missing)}")

    slots: dict[str, dict[str, Any]] = {}
    selected_variables = 0
    for raw_node in tree.get("nodes", []):
        if not isinstance(raw_node, dict) or raw_node.get("node_kind") != "variable":
            continue
        node_id = str(raw_node["node_id"])
        path = _node_path(node_id, index)
        if selected and not selected.intersection(path):
            continue
        if _is_hidden_ground_truth(raw_node):
            continue

        parent_id = raw_node.get("parent_id")
        if not parent_id or parent_id not in index:
            continue
        parent = index[parent_id]
        options = _domain_labels(raw_node.get("value_domain"))
        value_type = str(raw_node.get("value_type") or "TBD")
        node_record = {
            "node_id": node_id,
            "parent_id": parent_id,
            "node_path": path,
            "name": raw_node.get("name") or node_id,
            "value_type": value_type,
            "value_domain": raw_node.get("value_domain"),
            "options": options,
            "unit": raw_node.get("unit") or None,
            "variable_role": raw_node.get("variable_role") or "TBD",
            "configuration_side": raw_node.get("configuration_side") or "TBD",
            "projection_targets": raw_node.get("projection_targets") or [],
            "visibility": raw_node.get("visibility") or [],
            "observation_channel": raw_node.get("observation_channel") or [],
            "review_status": raw_node.get("review_status") or "TBD",
            "evidence_status": raw_node.get("evidence_status") or "TBD",
            "derivation_status": raw_node.get("derivation_status") or "TBD",
            "canonical_slot": raw_node.get("canonical_slot"),
            "canonical_jd_refs": raw_node.get("canonical_jd_refs") or [],
        }

        slot = slots.setdefault(str(parent_id), {
            "node_id": str(parent_id),
            "name": parent.get("name") or str(parent_id),
            "node_path": _node_path(str(parent_id), index),
            "value_type": value_type,
            "value_types": [],
            "options": [],
            "roles": [],
            "configuration_sides": [],
            "nodes": [],
        })
        if value_type not in slot["value_types"]:
            slot["value_types"].append(value_type)
        if len(slot["value_types"]) > 1:
            slot["value_type"] = "mixed"
        for option in options:
            if option not in slot["options"]:
                slot["options"].append(option)
        role = node_record["variable_role"]
        if role not in slot["roles"]:
            slot["roles"].append(role)
        side = node_record["configuration_side"]
        if side not in slot["configuration_sides"]:
            slot["configuration_sides"].append(side)
        slot["nodes"].append(node_record)
        selected_variables += 1

    return {
        **_tree_metadata(tree, source_hash=source_hash),
        "selected_node_ids": sorted(selected),
        "selected_variable_count": selected_variables,
        "slots": slots,
    }


def load_jd_tree_domains(
    selected_node_ids: Iterable[str] | None = None,
) -> dict[str, Any]:
    """Load domain suggestions from the current Version2 file."""

    return build_jd_tree_domains(
        load_jd_variable_tree_version2(),
        selected_node_ids,
        source_hash=_file_hash(JD_TREE_V2_PATH),
    )


def build_jd_tree_slice(
    tree: Mapping[str, Any],
    ability_ids: Iterable[str],
    *,
    include_global: bool = True,
    selected_node_ids: Iterable[str] | None = None,
    source_hash: str | None = None,
) -> dict[str, Any]:
    """Return a bounded V2 slice for confirmed abilities and optional nodes."""

    abilities = _normalise_ids(ability_ids)
    index = jd_tree_node_index(tree)
    valid_abilities = {
        node_id
        for node_id, node in index.items()
        if node.get("node_kind") == "capability_root"
    }
    invalid_abilities = sorted(abilities - valid_abilities)
    if not abilities or invalid_abilities:
        invalid = ", ".join(invalid_abilities) or "<empty>"
        raise KeyError(f"Unknown JD Version2 abilities: {invalid}")

    selected = _normalise_ids(selected_node_ids)
    missing = sorted(selected - set(index))
    if missing:
        raise KeyError(f"Unknown JD Version2 node IDs: {', '.join(missing)}")

    allowed_owners = set(abilities)
    if include_global:
        allowed_owners.add("MULTI")
    candidate_ids = {
        node_id
        for node_id, node in index.items()
        if node.get("owner_a") in allowed_owners
    }

    if selected:
        outside = sorted(selected - candidate_ids)
        if outside:
            raise ValueError(
                "Selected JD Version2 nodes fall outside requested abilities: "
                + ", ".join(outside)
            )
        included_ids: set[str] = set()
        for node_id in selected:
            included_ids.update(_node_path(node_id, index))
        included_ids &= candidate_ids
    else:
        included_ids = candidate_ids

    nodes: list[dict[str, Any]] = []
    for raw_node in tree.get("nodes", []):
        node_id = raw_node.get("node_id")
        if node_id not in included_ids:
            continue
        node = dict(raw_node)
        node["node_path"] = _node_path(str(node_id), index)
        nodes.append(node)

    return {
        **_tree_metadata(tree, source_hash=source_hash),
        "abilities": sorted(abilities, key=lambda value: int(value[1:])),
        "include_global": include_global,
        "selected_node_ids": sorted(selected),
        "selected_node_count": len(nodes),
        "nodes": nodes,
    }


def load_jd_tree_slice(
    ability_ids: Iterable[str],
    *,
    include_global: bool = True,
    selected_node_ids: Iterable[str] | None = None,
) -> dict[str, Any]:
    """Load a bounded slice from the current Version2 file."""

    return build_jd_tree_slice(
        load_jd_variable_tree_version2(),
        ability_ids,
        include_global=include_global,
        selected_node_ids=selected_node_ids,
        source_hash=_file_hash(JD_TREE_V2_PATH),
    )


def _canonical_anchor_for_node(
    node_id: str,
    index: Mapping[str, Mapping[str, Any]],
    canonical_ids: set[str],
) -> tuple[str | None, str]:
    """Resolve a V2 detail node to a compact canonical JD without upgrading it.

    Version2 contains both explicitly linked ``PROPOSED-*`` detail nodes and
    native fine-grained branches whose nearest canonical parent is encoded in
    the parent path.  The returned trace method makes that distinction
    auditable; the detail node itself is never labelled canonical.
    """

    node = index[node_id]
    explicit = node.get("canonical_slot")
    if explicit and str(explicit) in canonical_ids:
        return str(explicit), "explicit"
    for ancestor_id in reversed(_node_path(node_id, index)[:-1]):
        if ancestor_id in canonical_ids:
            return ancestor_id, "ancestor_path"
    return None, "unresolved"


def build_jd_tree_selection(
    tree: Mapping[str, Any],
    ability_ids: Iterable[str],
    selected_node_ids: Iterable[str],
    *,
    coverage_cells: Iterable[str] | None = None,
    include_global: bool = True,
    source_hash: str | None = None,
) -> dict[str, Any]:
    """Build the reviewable artifact that freezes one human V2 selection.

    Only real Version2 variable nodes may be selected.  Canonical traceability
    is recorded separately from the authority of each fine-grained node, and
    missing routing metadata stays visible as ``TBD`` instead of being inferred.
    """

    abilities = _normalise_ids(ability_ids)
    selected = _normalise_ids(selected_node_ids)
    if not selected:
        raise ValueError("At least one JD Version2 variable node must be selected")

    # Reuse the slice validator for ability ownership and node existence.
    build_jd_tree_slice(
        tree,
        abilities,
        include_global=include_global,
        selected_node_ids=selected,
        source_hash=source_hash,
    )
    index = jd_tree_node_index(tree)
    non_variables = sorted(
        node_id
        for node_id in selected
        if index[node_id].get("node_kind") != "variable"
    )
    if non_variables:
        raise ValueError(
            "JD tree selection accepts variable nodes only: "
            + ", ".join(non_variables)
        )

    coverage = sorted(_normalise_ids(coverage_cells))
    invalid_coverage = sorted(set(coverage) - set(gal_cell_index()))
    if invalid_coverage:
        raise ValueError(
            "Unknown canonical A×L coverage cells: "
            + ", ".join(invalid_coverage)
        )
    outside_coverage = sorted({
        match.group(1)
        for cell in coverage
        if (match := re.match(r"^(A\d+)×L[1-4]$", cell))
        and match.group(1) not in abilities
    })
    if outside_coverage:
        raise ValueError(
            "Coverage abilities fall outside the requested V2 slice: "
            + ", ".join(outside_coverage)
        )

    canonical_ids = set(jd_field_index())
    selected_nodes: list[dict[str, Any]] = []
    allowed_agent_slots: set[str] = set()
    unresolved_nodes: list[dict[str, Any]] = []
    metadata_fields = (
        "variable_role",
        "configuration_side",
        "projection_targets",
        "visibility",
        "observation_channel",
    )

    for raw_node in tree.get("nodes", []):
        node_id = raw_node.get("node_id")
        if node_id not in selected:
            continue
        canonical_slot, trace_method = _canonical_anchor_for_node(
            str(node_id), index, canonical_ids
        )
        if canonical_slot:
            allowed_agent_slots.add(canonical_slot)
        gaps = [
            field
            for field in metadata_fields
            if raw_node.get(field) in (None, "", [])
        ]
        record = {
            "node_id": str(node_id),
            "parent_id": raw_node.get("parent_id"),
            "node_path": _node_path(str(node_id), index),
            "owner_a": raw_node.get("owner_a"),
            "name": raw_node.get("name") or str(node_id),
            "authority_status": "proposed_v2_detail",
            "canonical_jd": {
                "slot_id": canonical_slot,
                "trace_method": trace_method,
                "status": "valid" if canonical_slot else "TBD",
            },
            "variable_role": raw_node.get("variable_role") or "TBD",
            "configuration_side": raw_node.get("configuration_side") or "TBD",
            "projection_targets": raw_node.get("projection_targets") or [],
            "visibility": raw_node.get("visibility") or [],
            "observation_channel": raw_node.get("observation_channel") or [],
            "value_contract": {
                "value_type": raw_node.get("value_type") or "TBD",
                "value_domain": raw_node.get("value_domain"),
                "unit": raw_node.get("unit") or None,
            },
            "review_status": raw_node.get("review_status") or "TBD",
            "evidence_status": raw_node.get("evidence_status") or "TBD",
            "metadata_gaps": gaps,
        }
        selected_nodes.append(record)
        if gaps or canonical_slot is None:
            unresolved_nodes.append({
                "node_id": str(node_id),
                "missing_fields": gaps + (
                    ["canonical_jd"] if canonical_slot is None else []
                ),
                "status": "TBD",
            })

    selection_basis = {
        "coverage_cells": coverage,
        "abilities": sorted(abilities, key=lambda value: int(value[1:])),
        "global_variables_included": include_global,
    }
    identity_payload = {
        "tree_sha256": source_hash or _json_hash(tree),
        "selection_basis": selection_basis,
        "selected_node_ids": sorted(selected),
    }
    return {
        "schema_version": "0.1.0",
        "artifact_type": "jd_tree_selection",
        "selection_id": "jdsel-" + _json_hash(identity_payload)[:16],
        "source_tree": _tree_metadata(tree, source_hash=source_hash),
        "selection_basis": selection_basis,
        "selected_nodes": selected_nodes,
        "allowed_agent_slot_ids": sorted(allowed_agent_slots),
        "unresolved_nodes": unresolved_nodes,
        "validation": {
            "selected_nodes_exist": True,
            "selected_nodes_are_variables": True,
            "canonical_references_valid": all(
                node["canonical_jd"]["status"] == "valid"
                for node in selected_nodes
            ),
            "tbd_metadata_preserved": True,
        },
    }


def load_jd_tree_selection(
    ability_ids: Iterable[str],
    selected_node_ids: Iterable[str],
    *,
    coverage_cells: Iterable[str] | None = None,
    include_global: bool = True,
) -> dict[str, Any]:
    """Build a selection from the immutable team-delivered Version2 file."""

    return build_jd_tree_selection(
        load_jd_variable_tree_version2(),
        ability_ids,
        selected_node_ids,
        coverage_cells=coverage_cells,
        include_global=include_global,
        source_hash=_file_hash(JD_TREE_V2_PATH),
    )
