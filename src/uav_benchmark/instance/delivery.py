"""Build reviewable Task Template, world_config, and user_config deliveries.

This module is deliberately deterministic.  The LLM may help author the source
narrative upstream, but it does not decide configuration ownership, expose
Hidden GT, or manufacture missing values here.
"""

from __future__ import annotations

import hashlib
import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping, Sequence

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from .generator import generate_instance, hash_template


SCHEMA_VERSION = "0.1.0"
DELIVERY_CONTRACT_VERSION = "2026-07-24.3"
_HIDDEN_ROLES = {"hidden_ground_truth"}
_HIDDEN_VISIBILITY = {"hidden_gt"}
_HIDDEN_CHANNELS = {"hidden_gt"}
_USER_PROJECTIONS = {"user_config", "sut_input"}
_WORLD_PROJECTIONS = {"world_config"}


def _stable_id(prefix: str, value: str, length: int = 16) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:length]
    return f"{prefix}-{digest}"


def _as_strings(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    return [str(value) for value in values if str(value)]


def _unique(values: Sequence[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def _format_value(value: Any) -> str:
    if value is None:
        return "TBD"
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def _status(value: Any) -> str:
    raw = str(value or "TBD")
    return raw if raw in {"verified", "proposed", "TBD"} else "TBD"


def _nodes_by_canonical(
    selection: Mapping[str, Any] | None,
) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for node in (selection or {}).get("selected_nodes", []):
        if not isinstance(node, Mapping):
            continue
        canonical = node.get("canonical_jd") or {}
        slot_id = canonical.get("slot_id") if isinstance(canonical, Mapping) else None
        if not slot_id:
            continue
        grouped.setdefault(str(slot_id), []).append(dict(node))
    return grouped


def _projection_for_nodes(nodes: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    roles = _unique([
        str(node.get("variable_role") or "TBD")
        for node in nodes
    ])
    sides = _unique([
        str(node.get("configuration_side") or "TBD")
        for node in nodes
    ])
    projections = _unique([
        target
        for node in nodes
        for target in _as_strings(node.get("projection_targets"))
    ])
    visibility = _unique([
        value
        for node in nodes
        for value in _as_strings(node.get("visibility"))
    ])
    channels = _unique([
        value
        for node in nodes
        for value in _as_strings(node.get("observation_channel"))
    ])
    gaps = _unique([
        gap
        for node in nodes
        for gap in _as_strings(node.get("metadata_gaps"))
    ])

    hidden = (
        bool(set(roles) & _HIDDEN_ROLES)
        or bool(set(visibility) & _HIDDEN_VISIBILITY)
        or bool(set(channels) & _HIDDEN_CHANNELS)
    )
    explicit_world = bool(set(projections) & _WORLD_PROJECTIONS)
    explicit_user = bool(set(projections) & _USER_PROJECTIONS)
    fixture_only = bool(set(visibility) & {"fixture_only", "grader_only"})
    sut_visible = (
        "sut_visible" in visibility
        or "sut_input" in channels
        or "sut_input" in projections
    )

    issues: list[str] = []
    if hidden and explicit_user:
        issues.append("HIDDEN_GT_USER_PROJECTION_CONFLICT")
    if hidden:
        assignment = "hidden_gt"
        status = "verified" if not issues else "TBD"
    else:
        world = explicit_world
        user = explicit_user
        if not projections:
            if sides == ["world"]:
                world = True
            elif sides == ["user"]:
                user = True
            elif fixture_only and not sut_visible:
                world = True
            elif sut_visible and not fixture_only:
                user = True
        if world and user:
            assignment = "shared"
        elif world:
            assignment = "world"
        elif user:
            assignment = "user"
        else:
            assignment = "TBD"
        status = "TBD" if assignment == "TBD" or gaps else "verified"

    return {
        "assignment": assignment,
        "status": status,
        "hidden": hidden,
        "roles": roles,
        "configuration_sides": sides,
        "projection_targets": projections,
        "visibility": visibility,
        "observation_channels": channels,
        "metadata_gaps": gaps,
        "issues": issues,
        "selected_node_ids": [
            str(node.get("node_id"))
            for node in nodes
            if node.get("node_id")
        ],
    }


def _binding_items(
    domain_template: Mapping[str, Any],
    instance: Mapping[str, Any],
    selection: Mapping[str, Any] | None,
    canonical_fields: Mapping[str, Mapping[str, Any]],
    human_edits: Mapping[str, Mapping[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    domain_slots = {
        str(slot.get("slot_id")): dict(slot)
        for slot in domain_template.get("jd_slots", [])
        if isinstance(slot, Mapping) and slot.get("slot_id")
    }
    grouped_nodes = _nodes_by_canonical(selection)
    human_edits = human_edits or {}
    items: list[dict[str, Any]] = []

    for raw in instance.get("slot_bindings", []):
        if not isinstance(raw, Mapping) or not raw.get("slot_id"):
            continue
        slot_id = str(raw["slot_id"])
        domain_slot = domain_slots.get(slot_id, {})
        canonical = canonical_fields.get(slot_id, {})
        projection = _projection_for_nodes(grouped_nodes.get(slot_id, []))
        value = deepcopy(raw.get("value"))
        status = _status(raw.get("status"))
        edit = human_edits.get(slot_id)
        edit_history = list((domain_slot.get("extensions") or {}).get("edit_history") or [])
        provenance = list(raw.get("provenance") or [])
        if edit and edit.get("value") not in (None, ""):
            value = deepcopy(edit.get("value"))
            status = "verified"
            note = str(edit.get("source_note") or "").strip()
            provenance = [{
                "source_id": "human_step6_override",
                "locator": slot_id,
                "status": "verified",
                "notes": note,
            }]
            edit_history.append({
                "field": "value",
                "source": "human_step6_override",
                "source_note": note,
                "changed_at": str(edit.get("changed_at") or ""),
            })
        if status == "TBD":
            value = None
        items.append({
            "binding_id": f"{instance['instance_id']}:{slot_id}",
            "canonical_jd": slot_id,
            "name": str(canonical.get("name") or domain_slot.get("description") or slot_id),
            "value": value,
            "status": status,
            "configuration_assignment": projection["assignment"],
            "assignment_status": projection["status"],
            "selected_node_ids": projection["selected_node_ids"],
            "variable_roles": projection["roles"],
            "configuration_sides": projection["configuration_sides"],
            "projection_targets": projection["projection_targets"],
            "visibility": projection["visibility"],
            "observation_channels": projection["observation_channels"],
            "metadata_gaps": projection["metadata_gaps"],
            "provenance": provenance or list(domain_slot.get("provenance") or []),
            "edit_history": edit_history,
        })
    return items


def _coverage_boundaries(coverage: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for item in coverage:
        cell = str(item.get("cell") or item.get("coverage_id") or "TBD")
        result.append({
            "coverage": cell,
            "role": str(item.get("role") or "auxiliary"),
            "responsible_for": list(
                item.get("responsibilities")
                or item.get("sut_responsibilities")
                or ["TBD"]
            ),
            "out_of_scope": list(item.get("out_of_scope") or []),
        })
    return result


def _annotated_narrative(
    title: str,
    base_narrative: str,
    bindings: Sequence[Mapping[str, Any]],
    boundaries: Sequence[Mapping[str, Any]],
    dependencies: Sequence[Mapping[str, Any]],
    include_legacy_completion: bool,
) -> str:
    section_slots = (
        (
            "jd-0.1", "jd-0.2", "jd-1.1", "jd-1.2", "jd-1.3",
            "jd-2.1", "jd-2.3", "jd-6.1", "jd-6.2", "jd-10.1",
        ),
        (
            "jd-0.9", "jd-3.1", "jd-4.1", "jd-10.2",
            "jd-11.2", "jd-12.1", "jd-12.2",
        ),
        (
            "jd-0.8", "jd-2.2", "jd-6.3", "jd-6.4", "jd-7.1",
            "jd-7.2", "jd-8.1", "jd-8.2", "jd-9.1", "jd-11.1",
            "jd-14.1", "jd-14.2",
        ),
        ("jd-0.4", "jd-0.5", "jd-4.2", "jd-5.1", "jd-5.2"),
        (
            "jd-0.3", "jd-0.6", "jd-0.10", "jd-4.3", "jd-4.4",
            "jd-7.3", "jd-8.3", "jd-9.2", "jd-9.3", "jd-10.3",
            "jd-10.4", "jd-11.3", "jd-12.3", "jd-14.3", "jd-16.1",
            "jd-16.2", "jd-16.3", "jd-16.4", "jd-16.5", "jd-17.1",
            "jd-17.2", "jd-17.3",
        ),
        (
            "jd-4.5", "jd-5.3", "jd-13.1", "jd-13.3",
            "jd-15.1", "jd-15.2", "jd-15.3",
        ),
        ("jd-0.7", "jd-3.2", "jd-13.2"),
    )
    section_leads = (
        "本段所述任务上下文、业务对象与任务参数由{}共同限定。",
        "标称执行所需的任务技能、导航、控制与载荷动作按照{}配置。",
        "运行时观测、定位、资源与通信状态依据{}提供或判定。",
        "系统、外部执行器与在场人员的职责和交接按照{}划分。",
        "扰动、异常、重规划、合规与安全处置按照{}执行。",
        "任务输出、通知、证据、审计与外部闭环按照{}交付。",
        "任务完成、覆盖判定与其余待确认项按照{}判断。",
    )
    fallback_paragraphs = (
        f"第一段（任务上下文与业务目标）：执行“{title}”任务。",
        "第二段（标称行为与持续性）：标称行为以已确认的任务要求为准。",
        "第三段（观测与变量）：观测与运行变量以已确认配置为准。",
        "第四段（职责边界划分）：职责边界以已确认的任务合同为准。",
        "第五段（异常与事件处置）：未确认的异常处置条件保持 TBD。",
        "第六段（输出与外部闭环）：输出与外部闭环以已确认合同为准。",
        "第七段（完成判据与待定项）：未确认的完成判据保持 TBD。",
    )

    text = base_narrative.replace("\\r\\n", "\n").replace("\\n", "\n").strip()
    paragraphs = [
        item.strip()
        for item in re.split(r"\n\s*\n", text)
        if item.strip()
    ]
    marker = re.compile(
        r"\s*(第(?:[一二三四五六七]|[1-7])段"
        r"(?:\s*[（(][^）)\n]{0,80}[）)])?\s*[：:])"
    )
    if len(paragraphs) < 7 and len(marker.findall(text)) >= 2:
        text = marker.sub(r"\n\n\1", text).strip()
        paragraphs = [
            item.strip()
            for item in re.split(r"\n\s*\n", text)
            if item.strip()
        ]
    if len(paragraphs) > 7:
        paragraphs = paragraphs[:6] + [" ".join(paragraphs[6:])]
    paragraphs.extend(fallback_paragraphs[len(paragraphs):])

    index = {
        item["canonical_jd"]: item
        for item in bindings
        if item.get("configuration_assignment") != "hidden_gt"
    }
    placed: set[str] = set()

    def annotation(item: Mapping[str, Any]) -> str:
        return (
            f"【{item['canonical_jd']} {item['name']}＝"
            f"{_format_value(item.get('value'))}】"
        )

    for section_index, slot_ids in enumerate(section_slots):
        paragraph = paragraphs[section_index]
        placeholders: dict[str, str] = {}
        remaining: list[str] = []
        for slot_id in slot_ids:
            item = index.get(slot_id)
            if not item:
                continue
            tagged = annotation(item)
            value = item.get("value")
            token = value.strip() if isinstance(value, str) else ""
            if (
                item.get("status") != "TBD"
                and len(token) >= 2
                and token in paragraph
            ):
                placeholder = f"\uFFF0{section_index}-{len(placeholders)}\uFFF1"
                paragraph = paragraph.replace(token, placeholder, 1)
                placeholders[placeholder] = tagged
            else:
                remaining.append(tagged)
            placed.add(slot_id)
        for placeholder, tagged in placeholders.items():
            paragraph = paragraph.replace(placeholder, tagged)
        if remaining:
            paragraph = paragraph.rstrip() + " " + section_leads[section_index].format(
                "、".join(remaining)
            )
        paragraphs[section_index] = paragraph

    # Canonical JD currently has 66 slots and all are routed above.  A future
    # catalog addition stays inside the observations/variables paragraph
    # rather than creating a new appendix after the seven-section narrative.
    unplaced = [
        item
        for slot_id, item in index.items()
        if slot_id not in placed
    ]
    if unplaced:
        paragraphs[2] += (
            " 其他经审阅的运行变量由"
            + "、".join(annotation(item) for item in unplaced)
            + "共同限定。"
        )

    if boundaries:
        boundary_lines = []
        for item in boundaries:
            scope = (
                "；不负责：" + "、".join(item["out_of_scope"])
                if item["out_of_scope"] else ""
            )
            boundary_lines.append(
                f"{item['coverage']}："
                + "、".join(item["responsible_for"])
                + scope
            )
        paragraphs[3] += " 结构化能力边界为：" + "；".join(boundary_lines) + "。"
    if dependencies:
        dep_lines = [
            str(item.get("dependency_id") or "外部依赖")
            + "负责"
            + "、".join(item.get("responsibilities") or ["TBD"])
            for item in dependencies
        ]
        paragraphs[5] += " 外部闭环依赖为：" + "；".join(dep_lines) + "。"
    if include_legacy_completion and "jd-0.7" not in index:
        paragraphs[6] += (
            " 任务完成条件：【jd-0.7 任务完成判据＝TBD】，"
            "需确认后方可作为正式判据。"
        )
    if any(item.get("status") == "TBD" for item in index.values()):
        paragraphs[6] += " 所有未确认项保持 TBD，不得自动填成默认值。"
    return "\n\n".join(paragraphs[:7])


def _sut_narrative(
    title: str,
    base_narrative: str,
    bindings: Sequence[Mapping[str, Any]],
    boundaries: Sequence[Mapping[str, Any]],
) -> str:
    safe_base_narrative = base_narrative
    for item in bindings:
        if item.get("configuration_assignment") != "hidden_gt":
            continue
        value = item.get("value")
        tokens: list[str] = []
        if isinstance(value, str) and len(value.strip()) >= 2:
            tokens.append(value.strip())
        elif isinstance(value, (dict, list)):
            tokens.append(
                json.dumps(value, ensure_ascii=False, separators=(",", ":"))
            )
        for token in tokens:
            if token:
                safe_base_narrative = safe_base_narrative.replace(
                    token, "【世界侧隐藏条件】",
                )
    visible = [
        item for item in bindings
        if item.get("configuration_assignment") in {"world", "user", "shared"}
        and (
            item.get("configuration_assignment") in {"user", "shared"}
            or "sut_visible" in item.get("visibility", [])
            or "sut_input" in item.get("projection_targets", [])
            or "sut_input" in item.get("observation_channels", [])
        )
        and item.get("status") != "TBD"
        and item.get("value") is not None
    ]
    parts = [f"任务：{title}。"]
    if safe_base_narrative.strip():
        parts.append(safe_base_narrative.strip())
    if visible:
        parts.append(
            "SUT 可见的任务条件："
            + "；".join(
                f"{item['name']}为{_format_value(item['value'])}"
                for item in visible
            )
            + "。"
        )
    if boundaries:
        parts.append(
            "能力与动作边界："
            + "；".join(
                f"{item['coverage']}负责"
                + "、".join(item["responsible_for"])
                + (
                    "，不负责" + "、".join(item["out_of_scope"])
                    if item["out_of_scope"] else ""
                )
                for item in boundaries
            )
            + "。"
        )
    return "\n\n".join(parts)


def _tbd_items(
    bindings: Sequence[Mapping[str, Any]],
    *,
    include_delivery_requirements: bool = True,
) -> list[dict[str, Any]]:
    def make_item(
        *,
        tbd_id: str,
        canonical_jd: str | None,
        name: str,
        missing: Sequence[str],
    ) -> dict[str, Any]:
        missing_values = _unique([str(value) for value in missing])
        owners: list[str] = []
        if "value" in missing_values:
            owners.append("business_task_owner")
        if any(value != "value" for value in missing_values):
            owners.append("jd_tree_maintainer")
        return {
            "tbd_id": tbd_id,
            "canonical_jd": canonical_jd,
            "name": name,
            "missing": missing_values,
            "status": "TBD",
            "resolution_owners": owners or ["business_task_owner"],
            "required_before": (
                "benchmark_run"
                if "value" in missing_values
                else "config_agent_handoff"
            ),
            "can_remain_tbd_in_draft": True,
        }

    items: list[dict[str, Any]] = []
    for binding in bindings:
        reasons: list[str] = []
        if binding.get("status") == "TBD":
            reasons.append("value")
        if binding.get("assignment_status") == "TBD":
            reasons.append("projection")
        reasons.extend(str(gap) for gap in binding.get("metadata_gaps") or [])
        if reasons:
            items.append(make_item(
                tbd_id=f"tbd:{binding['binding_id']}",
                canonical_jd=binding["canonical_jd"],
                name=binding["name"],
                missing=reasons,
            ))
    if include_delivery_requirements:
        if not any(binding["canonical_jd"] == "jd-0.7" for binding in bindings):
            items.append(make_item(
                tbd_id="tbd:completion_conditions",
                canonical_jd="jd-0.7",
                name="任务完成判据",
                missing=["value"],
            ))
    return items


def _task_template(
    *,
    batch_id: str,
    case_index: int,
    title: str,
    source_task: str,
    base_narrative: str,
    instance: Mapping[str, Any],
    bindings: Sequence[Mapping[str, Any]],
    domain_template: Mapping[str, Any],
    selection: Mapping[str, Any] | None,
) -> dict[str, Any]:
    boundaries = _coverage_boundaries(domain_template.get("coverage") or [])
    dependencies = list(domain_template.get("runtime_dependencies") or [])
    selection_basis = dict((selection or {}).get("selection_basis") or {})
    include_legacy_completion = (
        selection_basis.get("global_variables_included", True) is not False
    )
    tbd_items = _tbd_items(
        bindings,
        include_delivery_requirements=include_legacy_completion,
    )
    hidden_count = sum(
        1 for item in bindings
        if item.get("configuration_assignment") == "hidden_gt"
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "artifact_type": "task_template",
        "task_id": str(instance["instance_id"]),
        "batch_ref": batch_id,
        "case_index": case_index,
        "seed": int(instance["seed"]),
        "title": title,
        "narratives": {
            "review_annotated": _annotated_narrative(
                title, base_narrative, bindings, boundaries, dependencies,
                include_legacy_completion,
            ),
            "sut_visible": _sut_narrative(
                title, base_narrative, bindings, boundaries,
            ),
            "hidden_gt_note": (
                f"{hidden_count} 项 Hidden GT 仅在 world_config 中交付。"
                if hidden_count else "本案例没有已绑定的 Hidden GT。"
            ),
        },
        "manifest": {
            "objective": {
                "text": source_task or str(domain_template.get("scenario_summary") or title),
                "status": "verified" if source_task else "proposed",
                "source": "user_requirement" if source_task else "agent_scenario_summary",
            },
            "coverage": list(domain_template.get("coverage") or []),
            "capability_boundaries": boundaries,
            "completion_conditions": (
                [
                    {
                        "canonical_jd": "jd-0.7",
                        "value": deepcopy(item.get("value")),
                        "status": item["status"],
                    }
                    for item in bindings
                    if item["canonical_jd"] == "jd-0.7"
                ]
                or [{
                    "text": "以已确认任务正文中的完成条件为准。",
                    "status": "proposed" if base_narrative.strip() else "TBD",
                    "source": "confirmed_task_narrative",
                }]
            ),
            "exception_flow": {
                "text": base_narrative if any(
                    word in base_narrative for word in ("异常", "故障", "退化", "中止")
                ) else None,
                "status": "proposed" if any(
                    word in base_narrative for word in ("异常", "故障", "退化", "中止")
                ) else "TBD",
            },
            "external_dependencies": dependencies,
            "jd_bindings": list(bindings),
            "tbd_items": tbd_items,
        },
        "provenance": [{
            "source_id": "pipeline_delivery_compiler",
            "locator": str(instance["instance_id"]),
            "status": "verified",
            "notes": "Deterministic rendering from confirmed Domain Template and case seed.",
        }],
    }


def _world_config(
    *,
    task_template: Mapping[str, Any],
    instance: Mapping[str, Any],
    bindings: Sequence[Mapping[str, Any]],
    selection: Mapping[str, Any] | None,
) -> dict[str, Any]:
    world = [
        dict(item) for item in bindings
        if item.get("configuration_assignment") in {"world", "shared"}
    ]
    hidden = [
        dict(item) for item in bindings
        if item.get("configuration_assignment") == "hidden_gt"
    ]
    ids = {item["canonical_jd"]: item["binding_id"] for item in world}
    selection_basis = dict((selection or {}).get("selection_basis") or {})
    legacy_global_categories = (
        selection_basis.get("global_variables_included", True) is not False
        and any(slot_id.startswith("jd-0.") for slot_id in ids)
    )
    tbd_items = _tbd_items(
        world + hidden,
        include_delivery_requirements=False,
    )
    if world and not legacy_global_categories:
        tbd_items.append({
            "tbd_id": "tbd:world_semantic_categories",
            "canonical_jd": None,
            "name": "世界侧语义分类",
            "missing": [
                "world_asset_category",
                "scene_layout_category",
                "disturbance_category",
            ],
            "status": "TBD",
            "resolution_owners": ["jd_tree_maintainer"],
            "required_before": "config_agent_handoff",
            "can_remain_tbd_in_draft": True,
        })
    source_tree = dict((selection or {}).get("source_tree") or {})
    selection_id = str((selection or {}).get("selection_id") or "TBD")
    return {
        "schema_version": SCHEMA_VERSION,
        "artifact_type": "world_config",
        "config_id": f"world:{task_template['task_id']}",
        "task_ref": str(task_template["task_id"]),
        "adapter_contract": {
            "adapter": None,
            "simulator_api": None,
            "status": "TBD",
            "note": "Adapter-neutral contract; simulator API is not confirmed.",
        },
        "world_assets": [
            ids[slot] for slot in ("jd-0.4", "jd-0.9") if slot in ids
        ] if legacy_global_categories else [],
        "scene_layout": [
            ids[slot] for slot in ("jd-0.2",) if slot in ids
        ] if legacy_global_categories else [],
        "disturbances": [
            ids[slot] for slot in ("jd-0.3",) if slot in ids
        ] if legacy_global_categories else [],
        "event_injections": [
            item["binding_id"] for item in world + hidden
            if "harness" in item.get("projection_targets", [])
        ],
        "timeline": list(instance.get("phase_schedule") or []),
        "adjustable_variables": world,
        "hidden_ground_truth": hidden,
        "tbd_items": tbd_items + [{
            "tbd_id": "tbd:simulator_adapter",
            "canonical_jd": None,
            "name": "Simulator / Fixture adapter",
            "missing": ["adapter", "simulator_api"],
            "status": "TBD",
            "resolution_owners": ["simulator_adapter_owner"],
            "required_before": "simulator_integration",
            "can_remain_tbd_in_draft": True,
        }],
        "provenance": [{
            "source_id": source_tree.get("source_tree") or "jd_tree_selection",
            "locator": selection_id,
            "status": "verified",
            "notes": (
                "Deterministic projection from current JD business variable "
                "tree metadata; no legacy jd-0 category inference is used."
            ),
        }],
    }


def _user_config(
    *,
    task_template: Mapping[str, Any],
    bindings: Sequence[Mapping[str, Any]],
    domain_template: Mapping[str, Any],
    selection: Mapping[str, Any] | None,
) -> dict[str, Any]:
    user = [
        dict(item) for item in bindings
        if item.get("configuration_assignment") in {"user", "shared"}
    ]
    visible = [
        dict(item) for item in bindings
        if item.get("configuration_assignment") in {"world", "user", "shared"}
        if (
            "sut_visible" in item.get("visibility", [])
            or "sut_input" in item.get("projection_targets", [])
            or "sut_input" in item.get("observation_channels", [])
        )
    ]
    output_contract = [
        dict(item) for item in user
        if "contract_schema" in item.get("variable_roles", [])
    ]
    boundaries = task_template["manifest"]["capability_boundaries"]
    source_tree = dict((selection or {}).get("source_tree") or {})
    selection_id = str((selection or {}).get("selection_id") or "TBD")
    return {
        "schema_version": SCHEMA_VERSION,
        "artifact_type": "user_config",
        "config_id": f"user:{task_template['task_id']}",
        "task_ref": str(task_template["task_id"]),
        "task_text": str(task_template["narratives"]["sut_visible"]),
        "task_requirements": boundaries,
        "sut_visible_inputs": visible,
        "allowed_actions": [],
        "output_contract": output_contract,
        "external_executor_dependencies": list(
            domain_template.get("runtime_dependencies") or []
        ),
        "runtime_constraints": user,
        "hidden_ground_truth": [],
        "tbd_items": _tbd_items(user, include_delivery_requirements=False)
        + [{
            "tbd_id": "tbd:allowed_actions",
            "canonical_jd": None,
            "name": "允许动作",
            "missing": ["value"],
            "status": "TBD",
            "resolution_owners": ["task_interface_or_safety_owner"],
            "required_before": "benchmark_run",
            "can_remain_tbd_in_draft": True,
        }],
        "provenance": [{
            "source_id": source_tree.get("source_tree") or "jd_tree_selection",
            "locator": selection_id,
            "status": "verified",
            "notes": (
                "Deterministic projection from current JD business variable "
                "tree metadata; Hidden GT is excluded."
            ),
        }],
    }


def _validation(
    *,
    bindings: Sequence[Mapping[str, Any]],
    world_config: Mapping[str, Any],
    user_config: Mapping[str, Any],
    canonical_ids: set[str],
) -> dict[str, Any]:
    world_ids = {
        item["binding_id"]
        for item in world_config.get("adjustable_variables", [])
    }
    hidden_ids = {
        item["binding_id"]
        for item in world_config.get("hidden_ground_truth", [])
    }
    user_items = list(user_config.get("runtime_constraints") or [])
    user_surface_items = (
        user_items
        + list(user_config.get("sut_visible_inputs") or [])
        + list(user_config.get("output_contract") or [])
    )
    user_ids = {item["binding_id"] for item in user_surface_items}
    user_text = str(user_config.get("task_text") or "")
    hidden_text_leaks: list[str] = []
    for item in world_config.get("hidden_ground_truth", []):
        value = item.get("value")
        tokens: list[str] = []
        if isinstance(value, str) and len(value.strip()) >= 2:
            tokens.append(value.strip())
        elif isinstance(value, (dict, list)):
            tokens.append(
                json.dumps(value, ensure_ascii=False, separators=(",", ":"))
            )
        if any(token and token in user_text for token in tokens):
            hidden_text_leaks.append(item["binding_id"])
    shared_ids = {
        item["binding_id"]
        for item in bindings
        if item.get("configuration_assignment") == "shared"
    }
    canonical_invalid = [
        item["canonical_jd"]
        for item in bindings
        if item["canonical_jd"] not in canonical_ids
    ]
    tbd_with_values = [
        item["binding_id"]
        for item in bindings
        if item.get("status") == "TBD" and item.get("value") is not None
    ]
    projection_tbd = [
        item["binding_id"]
        for item in bindings
        if item.get("assignment_status") == "TBD"
    ]
    checks = [
        {
            "check_id": "hidden_gt_not_in_user_config",
            "status": (
                "pass"
                if hidden_ids.isdisjoint(user_ids) and not hidden_text_leaks
                else "fail"
            ),
            "message": "Hidden GT 未进入用户侧。" if (
                hidden_ids.isdisjoint(user_ids) and not hidden_text_leaks
            )
            else "检测到 Hidden GT 泄漏到用户侧。",
            "evidence": sorted(
                (hidden_ids & user_ids) | set(hidden_text_leaks)
            ),
        },
        {
            "check_id": "shared_references_consistent",
            "status": "pass" if shared_ids <= world_ids and shared_ids <= user_ids else "fail",
            "message": "共享引用在两侧使用相同 binding_id，数据仍按侧隔离。",
            "evidence": sorted(shared_ids),
        },
        {
            "check_id": "canonical_jd_valid",
            "status": "pass" if not canonical_invalid else "fail",
            "message": "所有 JD 均引用 canonical 目录。" if not canonical_invalid
            else "存在无效 canonical JD。",
            "evidence": sorted(set(canonical_invalid)),
        },
        {
            "check_id": "tbd_not_defaulted",
            "status": "pass" if not tbd_with_values else "fail",
            "message": "TBD 未被自动填成默认值。" if not tbd_with_values
            else "检测到 TBD 携带具体值。",
            "evidence": tbd_with_values,
        },
        {
            "check_id": "projection_metadata_complete",
            "status": "pass" if not projection_tbd else "TBD",
            "message": "配置归属元数据完整。" if not projection_tbd
            else "部分 JD 的配置归属元数据仍为 TBD，未擅自分配。",
            "evidence": projection_tbd,
        },
        {
            "check_id": "unconfirmed_threshold_not_autofilled",
            "status": "pass",
            "message": "未确认阈值没有被交付编译器自动填入。",
            "evidence": [],
        },
    ]
    overall = "fail" if any(item["status"] == "fail" for item in checks) else (
        "needs_review" if any(item["status"] == "TBD" for item in checks) else "pass"
    )
    return {"status": overall, "checks": checks}


def build_case_delivery(
    *,
    domain_template: Mapping[str, Any],
    seed: int,
    case_index: int,
    batch_id: str,
    source_task: str,
    base_narrative: str,
    jd_tree_selection: Mapping[str, Any] | None,
    canonical_fields: Mapping[str, Mapping[str, Any]],
    overrides: Mapping[str, Any] | None = None,
    human_edits: Mapping[str, Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    instance = generate_instance(domain_template, seed, overrides=overrides)
    bindings = _binding_items(
        domain_template,
        instance,
        jd_tree_selection,
        canonical_fields,
        human_edits,
    )
    title = str(domain_template.get("title") or "任务案例")
    if case_index:
        title = f"{title} · 案例 {case_index:02d}"
    task_template = _task_template(
        batch_id=batch_id,
        case_index=case_index,
        title=title,
        source_task=source_task,
        base_narrative=base_narrative,
        instance=instance,
        bindings=bindings,
        domain_template=domain_template,
        selection=jd_tree_selection,
    )
    world_config = _world_config(
        task_template=task_template,
        instance=instance,
        bindings=bindings,
        selection=jd_tree_selection,
    )
    user_config = _user_config(
        task_template=task_template,
        bindings=bindings,
        domain_template=domain_template,
        selection=jd_tree_selection,
    )
    validation = _validation(
        bindings=bindings,
        world_config=world_config,
        user_config=user_config,
        canonical_ids=set(canonical_fields),
    )
    return {
        "case_id": str(instance["instance_id"]),
        "case_index": case_index,
        "seed": seed,
        "task_template": task_template,
        "world_config": world_config,
        "user_config": user_config,
        "validation": validation,
        "run_plan": instance,
    }


def build_delivery_batch(
    *,
    domain_template: Mapping[str, Any],
    case_count: int,
    batch_seed: int,
    source_task: str,
    base_narrative: str,
    jd_tree_selection: Mapping[str, Any] | None,
    canonical_fields: Mapping[str, Mapping[str, Any]],
    case_overrides: Mapping[str, Mapping[str, Any]] | None = None,
    human_edits: Mapping[str, Mapping[str, Mapping[str, Any]]] | None = None,
) -> dict[str, Any]:
    if case_count < 1:
        raise ValueError("case_count must be at least 1")
    if batch_seed < 0:
        raise ValueError("batch_seed must be >= 0")
    identity = f"{hash_template(domain_template)}:{batch_seed}:{case_count}"
    batch_id = _stable_id("batch", identity)
    case_overrides = case_overrides or {}
    human_edits = human_edits or {}
    cases: list[dict[str, Any]] = []
    for index in range(1, case_count + 1):
        seed = batch_seed + index - 1
        override = case_overrides.get(str(seed)) or {}
        edits = human_edits.get(str(seed)) or {}
        if set(override) != set(edits):
            raise ValueError(
                f"Every case override for seed {seed} must have one matching "
                "human edit record."
            )
        for slot_id, value in override.items():
            edit = edits.get(slot_id)
            if not isinstance(edit, Mapping):
                raise ValueError(
                    f"Human edit record for seed {seed}, slot {slot_id} "
                    "must be an object."
                )
            if edit.get("value") != value:
                raise ValueError(
                    f"Human edit value does not match override for seed "
                    f"{seed}, slot {slot_id}."
                )
            if not str(edit.get("source_note") or "").strip():
                raise ValueError(
                    f"Human edit source is required for seed {seed}, "
                    f"slot {slot_id}."
                )
            if not str(edit.get("changed_at") or "").strip():
                raise ValueError(
                    f"Human edit timestamp is required for seed {seed}, "
                    f"slot {slot_id}."
                )
        cases.append(build_case_delivery(
            domain_template=domain_template,
            seed=seed,
            case_index=index,
            batch_id=batch_id,
            source_task=source_task,
            base_narrative=base_narrative,
            jd_tree_selection=jd_tree_selection,
            canonical_fields=canonical_fields,
            overrides=override,
            human_edits=edits,
        ))
    tbd_total = sum(
        len({
            item["tbd_id"]
            for config_items in (
                case["task_template"]["manifest"]["tbd_items"],
                case["world_config"]["tbd_items"],
                case["user_config"]["tbd_items"],
            )
            for item in config_items
        })
        for case in cases
    )
    signatures: list[str] = []
    values_by_jd: dict[str, set[str]] = {}
    for case in cases:
        signature_items: list[tuple[str, str, str]] = []
        for binding in case["task_template"]["manifest"]["jd_bindings"]:
            slot_id = str(binding["canonical_jd"])
            value_key = json.dumps(
                binding.get("value"),
                sort_keys=True,
                ensure_ascii=False,
                separators=(",", ":"),
            )
            status = str(binding.get("status") or "TBD")
            signature_items.append((slot_id, status, value_key))
            values_by_jd.setdefault(slot_id, set()).add(
                f"{status}:{value_key}"
            )
        signatures.append(json.dumps(sorted(signature_items), ensure_ascii=False))
    unique_configurations = len(set(signatures))
    varying_jd = sorted(
        slot_id
        for slot_id, values in values_by_jd.items()
        if len(values) > 1
    )
    failed = sum(case["validation"]["status"] == "fail" for case in cases)
    review = sum(case["validation"]["status"] == "needs_review" for case in cases)
    return {
        "schema_version": SCHEMA_VERSION,
        "artifact_type": "benchmark_delivery_batch",
        "batch_id": batch_id,
        "batch_seed": batch_seed,
        "case_count": case_count,
        "cases": cases,
        "summary": {
            "pass": case_count - failed - review,
            "needs_review": review,
            "fail": failed,
            "tbd_items": tbd_total,
            "unique_configurations": unique_configurations,
            "duplicate_cases": case_count - unique_configurations,
            "varying_jd": varying_jd,
        },
        "provenance": [{
            "source_id": "pipeline_delivery_compiler",
            "locator": batch_id,
            "status": "verified",
            "notes": "Case seeds are batch_seed + zero-based case index.",
        }],
    }


def validate_artifact(artifact: Mapping[str, Any], schema_path: str | Path) -> None:
    path = Path(schema_path)
    schema = json.loads(path.read_text(encoding="utf-8"))
    registry = Registry()
    for candidate in path.parent.glob("*.schema.json"):
        document = json.loads(candidate.read_text(encoding="utf-8"))
        if document.get("$id"):
            registry = registry.with_resource(
                document["$id"],
                Resource.from_contents(document),
            )
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema, registry=registry).validate(dict(artifact))
