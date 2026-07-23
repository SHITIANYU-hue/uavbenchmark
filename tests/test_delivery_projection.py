"""Regression tests for Task Template + world/user delivery projection."""

from __future__ import annotations

from pathlib import Path
import json

import pytest

from uav_benchmark.agent.catalog import jd_field_index, load_jd_tree_selection
from uav_benchmark.instance.delivery import (
    build_delivery_batch,
    validate_artifact,
)


ROOT = Path(__file__).resolve().parents[1]


def _domain() -> dict:
    return {
        "template_id": "highway_delivery_demo",
        "template_version": "0.1.0",
        "title": "高速巡检",
        "scenario_summary": "沿指定高速路段持续识别和记录道路异常。",
        "natural_language_template": (
            "无人机沿指定高速路段持续识别和记录道路异常。"
            "发生定位退化时，应进入允许的保护状态并输出异常事件。"
        ),
        "coverage": [{
            "cell": "A6×L2",
            "role": "primary",
            "responsibilities": ["持续识别", "更新结果"],
            "out_of_scope": ["真实飞行控制"],
        }],
        "runtime_dependencies": [{
            "dependency_id": "external_executor",
            "provider": "executor",
            "responsibilities": ["执行固定巡检航段"],
            "scored": False,
            "status": "proposed",
        }],
        "jd_slots": [
            {
                "slot_id": "jd-0.2",
                "description": "工作空间结构",
                "binding": {
                    "mode": "fixed",
                    "value": "指定高速巡检路段",
                    "status": "verified",
                },
                "provenance": [{
                    "source_id": "user_requirement",
                    "locator": "task",
                    "status": "verified",
                    "notes": None,
                }],
            },
            {
                "slot_id": "jd-0.3",
                "description": "扰动谱",
                "binding": {
                    "mode": "enum",
                    "allowed_values": ["无扰动", "定位退化"],
                    "status": "proposed",
                },
                "provenance": [{
                    "source_id": "agent_extracted",
                    "locator": "task",
                    "status": "proposed",
                    "notes": None,
                }],
            },
            {
                "slot_id": "jd-0.7",
                "description": "任务完成判据",
                "binding": {"mode": "TBD", "status": "TBD"},
                "provenance": [{
                    "source_id": "agent_extracted",
                    "locator": "task",
                    "status": "TBD",
                    "notes": None,
                }],
            },
        ],
        "phases": [],
        "disturbances": [],
        "interfaces": {"executor_responsibilities": ["执行固定巡检航段"]},
        "provenance": [],
    }


def _selection() -> dict:
    return {
        "selected_nodes": [
            {
                "node_id": "PROPOSED-jd-0.2-demo",
                "canonical_jd": {"slot_id": "jd-0.2"},
                "variable_role": "configuration_input",
                "configuration_side": "world",
                "projection_targets": ["world_config"],
                "visibility": ["fixture_only"],
                "observation_channel": ["fixture"],
                "metadata_gaps": [],
            },
            {
                "node_id": "PROPOSED-jd-0.3-hidden-demo",
                "canonical_jd": {"slot_id": "jd-0.3"},
                "variable_role": "hidden_ground_truth",
                "configuration_side": "world",
                "projection_targets": ["world_config", "harness"],
                "visibility": ["fixture_only", "grader_only", "hidden_gt"],
                "observation_channel": ["fixture", "grader", "hidden_gt"],
                "metadata_gaps": [],
            },
            {
                "node_id": "PROPOSED-jd-0.7-shared-demo",
                "canonical_jd": {"slot_id": "jd-0.7"},
                "variable_role": "contract_schema",
                "configuration_side": "shared",
                "projection_targets": ["world_config", "user_config", "sut_input"],
                "visibility": ["sut_visible", "grader_visible"],
                "observation_channel": ["sut_input", "grader"],
                "metadata_gaps": [],
            },
        ]
    }


def _batch(case_count: int = 10) -> dict:
    return build_delivery_batch(
        domain_template=_domain(),
        case_count=case_count,
        batch_seed=20260724,
        source_task="让无人机巡查指定高速路段并持续记录道路异常。",
        base_narrative=_domain()["natural_language_template"],
        jd_tree_selection=_selection(),
        canonical_fields=jd_field_index(),
    )


def test_batch_generates_ten_reviewable_case_packages() -> None:
    batch = _batch()

    assert batch["case_count"] == 10
    assert len(batch["cases"]) == 10
    assert batch["summary"]["tbd_items"] == 30
    assert [case["seed"] for case in batch["cases"]] == list(
        range(20260724, 20260734)
    )
    first = batch["cases"][0]
    assert "【jd-0.2 工作空间结构＝指定高速巡检路段】" in (
        first["task_template"]["narratives"]["review_annotated"]
    )
    assert first["task_template"]["narratives"]["sut_visible"]


def test_delivery_uses_the_canonical_66_slot_directory() -> None:
    canonical = jd_field_index()

    assert len(canonical) == 66
    assert "jd-4.5" in canonical
    assert "jd-16.5" in canonical
    assert "jd-15.4" not in canonical


def test_hidden_gt_is_world_only_and_user_config_stays_empty_of_it() -> None:
    first = _batch(1)["cases"][0]

    hidden = first["world_config"]["hidden_ground_truth"]
    assert {item["canonical_jd"] for item in hidden} == {"jd-0.3"}
    assert first["user_config"]["hidden_ground_truth"] == []
    user_ids = {
        item["binding_id"]
        for item in first["user_config"]["runtime_constraints"]
    }
    assert all(item["binding_id"] not in user_ids for item in hidden)
    check = next(
        item for item in first["validation"]["checks"]
        if item["check_id"] == "hidden_gt_not_in_user_config"
    )
    assert check["status"] == "pass"


def test_hidden_gt_value_is_redacted_from_sut_visible_text() -> None:
    domain = _domain()
    domain["jd_slots"][1]["binding"] = {
        "mode": "fixed",
        "value": "定位退化",
        "status": "proposed",
    }
    batch = build_delivery_batch(
        domain_template=domain,
        case_count=1,
        batch_seed=1,
        source_task="高速巡检",
        base_narrative="当定位退化发生时执行世界侧事件注入。",
        jd_tree_selection=_selection(),
        canonical_fields=jd_field_index(),
    )
    first = batch["cases"][0]

    assert "定位退化" not in first["user_config"]["task_text"]
    assert "【世界侧隐藏条件】" in first["user_config"]["task_text"]
    check = next(
        item for item in first["validation"]["checks"]
        if item["check_id"] == "hidden_gt_not_in_user_config"
    )
    assert check["status"] == "pass"


def test_tbd_value_remains_null_and_is_not_sampled() -> None:
    first = _batch(1)["cases"][0]
    completion = next(
        item for item in first["task_template"]["manifest"]["jd_bindings"]
        if item["canonical_jd"] == "jd-0.7"
    )

    assert completion["status"] == "TBD"
    assert completion["value"] is None
    check = next(
        item for item in first["validation"]["checks"]
        if item["check_id"] == "tbd_not_defaulted"
    )
    assert check["status"] == "pass"
    assert first["user_config"]["allowed_actions"] == []
    assert any(
        item["tbd_id"] == "tbd:allowed_actions"
        for item in first["user_config"]["tbd_items"]
    )
    completion_tbd = next(
        item for item in first["task_template"]["manifest"]["tbd_items"]
        if item["canonical_jd"] == "jd-0.7"
    )
    assert completion_tbd["resolution_owners"] == ["business_task_owner"]
    assert completion_tbd["required_before"] == "benchmark_run"
    assert completion_tbd["can_remain_tbd_in_draft"] is True
    allowed_actions_tbd = next(
        item for item in first["user_config"]["tbd_items"]
        if item["tbd_id"] == "tbd:allowed_actions"
    )
    assert allowed_actions_tbd["resolution_owners"] == [
        "task_interface_or_safety_owner"
    ]


def test_human_tbd_override_requires_explicit_source_in_artifact() -> None:
    batch = build_delivery_batch(
        domain_template=_domain(),
        case_count=1,
        batch_seed=7,
        source_task="高速巡检",
        base_narrative=_domain()["natural_language_template"],
        jd_tree_selection=_selection(),
        canonical_fields=jd_field_index(),
        case_overrides={"7": {"jd-0.7": "已完成人工确认的完成条件"}},
        human_edits={
            "7": {
                "jd-0.7": {
                    "value": "已完成人工确认的完成条件",
                    "source_note": "会议确认记录",
                    "changed_at": "2026-07-24T00:00:00Z",
                }
            }
        },
    )
    completion = next(
        item for item in batch["cases"][0]["task_template"]["manifest"]["jd_bindings"]
        if item["canonical_jd"] == "jd-0.7"
    )

    assert completion["status"] == "verified"
    assert completion["provenance"][0]["source_id"] == "human_step6_override"
    assert completion["provenance"][0]["notes"] == "会议确认记录"
    assert completion["edit_history"][-1]["source"] == "human_step6_override"
    assert completion["edit_history"][-1]["changed_at"] == "2026-07-24T00:00:00Z"


def test_delivery_rejects_override_without_human_source_record() -> None:
    with pytest.raises(ValueError, match="matching human edit record"):
        build_delivery_batch(
            domain_template=_domain(),
            case_count=1,
            batch_seed=7,
            source_task="高速巡检",
            base_narrative=_domain()["natural_language_template"],
            jd_tree_selection=_selection(),
            canonical_fields=jd_field_index(),
            case_overrides={"7": {"jd-0.7": "人工完成条件"}},
        )


def test_all_delivery_artifacts_match_schemas() -> None:
    batch = _batch(2)
    for case in batch["cases"]:
        validate_artifact(
            case["task_template"],
            ROOT / "schemas" / "task_template_output.schema.json",
        )
        validate_artifact(
            case["world_config"],
            ROOT / "schemas" / "world_config.schema.json",
        )
        validate_artifact(
            case["user_config"],
            ROOT / "schemas" / "user_config.schema.json",
        )
    validate_artifact(batch, ROOT / "schemas" / "delivery_batch.schema.json")


def test_highway_demo_fixture_uses_real_tree_and_generates_delivery() -> None:
    fixture = json.loads(
        (
            ROOT / "examples" / "delivery"
            / "highway_inspection_demo_input.json"
        ).read_text(encoding="utf-8")
    )
    request = fixture["selection_request"]
    selection = load_jd_tree_selection(
        request["abilities"],
        request["selected_node_ids"],
        coverage_cells=request["coverage_cells"],
    )
    batch = build_delivery_batch(
        domain_template=fixture["domain_template"],
        case_count=fixture["case_count"],
        batch_seed=fixture["batch_seed"],
        source_task=fixture["source_task"],
        base_narrative=fixture["base_narrative"],
        jd_tree_selection=selection,
        canonical_fields=jd_field_index(),
    )

    assert len(batch["cases"]) == 10
    first = batch["cases"][0]
    assert first["world_config"]["hidden_ground_truth"]
    assert first["user_config"]["hidden_ground_truth"] == []
    assert any(
        item["canonical_jd"] == "jd-0.2"
        for item in first["user_config"]["sut_visible_inputs"]
    )
    assert {
        item["binding_id"]
        for item in first["world_config"]["hidden_ground_truth"]
    } <= set(first["world_config"]["event_injections"])
    assert "违法停车车辆" in first["task_template"]["narratives"]["review_annotated"]
    assert any(
        item["canonical_jd"] == "jd-0.7"
        for item in first["task_template"]["manifest"]["tbd_items"]
    )
    validate_artifact(batch, ROOT / "schemas" / "delivery_batch.schema.json")
