from __future__ import annotations

import pytest

from uav_benchmark.agent.catalog import (
    build_jd_tree_domains,
    build_jd_tree_selection,
    build_jd_tree_slice,
    load_jd_tree_domains,
    load_jd_tree_selection,
    load_jd_tree_slice,
)


def _sample_tree() -> dict:
    return {
        "schema_version": "2.3",
        "catalog_version": "test-v2",
        "nodes": [
            {
                "node_id": "A6",
                "parent_id": None,
                "owner_a": "A6",
                "name": "环境感知",
                "node_kind": "capability_root",
            },
            {
                "node_id": "jd-6.1",
                "parent_id": "A6",
                "owner_a": "A6",
                "name": "本体目录",
                "node_kind": "group",
            },
            {
                "node_id": "jd-6.1.1",
                "parent_id": "jd-6.1",
                "owner_a": "A6",
                "name": "目标类型集",
                "node_kind": "variable",
                "variable_role": "configuration_input",
                "value_type": "enum",
                "value_domain": [{"label_zh": "车辆"}, {"label_zh": "行人"}],
                "configuration_side": "world",
            },
            {
                "node_id": "jd-6.1.2",
                "parent_id": "jd-6.1",
                "owner_a": "A6",
                "name": "场景特征",
                "node_kind": "variable",
                "value_type": "enum",
                "value_domain": [{"label_zh": "车辆"}, {"label_zh": "路障"}],
                "configuration_side": "shared",
            },
            {
                "node_id": "jd-6.1.3",
                "parent_id": "jd-6.1",
                "owner_a": "A6",
                "name": "真实标签",
                "node_kind": "variable",
                "variable_role": "hidden_ground_truth",
                "value_type": "enum",
                "value_domain": [{"label_zh": "真实标签"}],
                "visibility": ["hidden_gt"],
            },
            {
                "node_id": "PROPOSED-jd-tree-global",
                "parent_id": None,
                "owner_a": "MULTI",
                "name": "共享业务变量",
                "node_kind": "global_root",
            },
            {
                "node_id": "jd-0.2",
                "parent_id": "PROPOSED-jd-tree-global",
                "owner_a": "MULTI",
                "name": "工作空间结构",
                "node_kind": "group",
            },
        ],
    }


def test_version2_domain_projection_uses_parent_paths_and_filters_hidden_gt() -> None:
    result = build_jd_tree_domains(_sample_tree(), {"jd-6.1"})

    slot = result["slots"]["jd-6.1"]
    assert slot["options"] == ["车辆", "行人", "路障"]
    assert [node["node_id"] for node in slot["nodes"]] == [
        "jd-6.1.1",
        "jd-6.1.2",
    ]
    assert slot["nodes"][0]["node_path"] == ["A6", "jd-6.1", "jd-6.1.1"]
    assert "真实标签" not in slot["options"]
    assert result["selected_node_ids"] == ["jd-6.1"]


def test_version2_slice_is_bounded_and_can_include_selected_ancestors() -> None:
    tree = _sample_tree()

    ability_only = build_jd_tree_slice(tree, {"A6"}, include_global=False)
    assert {node["owner_a"] for node in ability_only["nodes"]} == {"A6"}
    assert ability_only["selected_node_count"] == 5

    selected = build_jd_tree_slice(
        tree,
        {"A6"},
        include_global=False,
        selected_node_ids={"jd-6.1.1"},
    )
    assert [node["node_id"] for node in selected["nodes"]] == [
        "A6",
        "jd-6.1",
        "jd-6.1.1",
    ]


def test_version2_slice_rejects_nodes_outside_requested_ability() -> None:
    with pytest.raises(ValueError, match="outside requested abilities"):
        build_jd_tree_slice(
            _sample_tree(),
            {"A6"},
            include_global=False,
            selected_node_ids={"jd-0.2"},
        )


def test_real_domain_loader_uses_team_delivered_version2() -> None:
    result = load_jd_tree_domains()

    assert result["source_tree"] == "jd_variable_tree_version2.json"
    assert result["schema_version"] == "2.3"
    assert result["catalog_version"] == "2.4.0-merged"
    assert result["node_count"] == 444
    assert len(result["tree_sha256"]) == 64
    assert "jd-6.1" in result["slots"]
    assert any(
        node["node_id"] == "jd-6.1.1"
        for node in result["slots"]["jd-6.1"]["nodes"]
    )
    assert all(
        "hidden_ground_truth" not in slot["roles"]
        for slot in result["slots"].values()
    )


def test_real_domain_loader_can_filter_without_changing_source_identity() -> None:
    full = load_jd_tree_domains()
    selected = load_jd_tree_domains({"jd-6.1"})

    assert selected["tree_sha256"] == full["tree_sha256"]
    assert selected["selected_node_ids"] == ["jd-6.1"]
    assert set(selected["slots"]) == {"jd-6.1"}


def test_real_a6_slice_preserves_native_v2_identity() -> None:
    result = load_jd_tree_slice({"A6"}, include_global=False)

    assert result["schema_version"] == "2.3"
    assert result["catalog_version"] == "2.4.0-merged"
    assert result["selected_node_count"] == 17
    assert {node["owner_a"] for node in result["nodes"]} == {"A6"}
    leaf = next(node for node in result["nodes"] if node["node_id"] == "jd-6.2.1")
    assert leaf["name"] == "感知模态集"
    assert leaf["node_path"] == ["A6", "jd-6.2", "jd-6.2.1"]


def test_v2_selection_keeps_detail_authority_and_canonical_trace_separate() -> None:
    result = build_jd_tree_selection(
        _sample_tree(),
        {"A6"},
        {"jd-6.1.1"},
        coverage_cells={"A6×L2"},
    )

    node = result["selected_nodes"][0]
    assert node["authority_status"] == "proposed_v2_detail"
    assert node["canonical_jd"] == {
        "slot_id": "jd-6.1",
        "trace_method": "ancestor_path",
        "status": "valid",
    }
    assert result["allowed_agent_slot_ids"] == ["jd-6.1"]
    assert node["metadata_gaps"] == [
        "projection_targets",
        "visibility",
        "observation_channel",
    ]
    assert result["validation"]["tbd_metadata_preserved"] is True


def test_v2_selection_rejects_group_nodes() -> None:
    with pytest.raises(ValueError, match="variable nodes only"):
        build_jd_tree_selection(
            _sample_tree(),
            {"A6"},
            {"jd-6.1"},
            coverage_cells={"A6×L2"},
        )


def test_real_selection_can_exclude_global_variables_without_deleting_source() -> None:
    result = load_jd_tree_selection(
        {"A6"},
        {"jd-6.1.1"},
        coverage_cells={"A6×L2"},
        include_global=False,
    )

    assert result["selection_basis"]["global_variables_included"] is False
    assert {node["owner_a"] for node in result["selected_nodes"]} == {"A6"}

    with pytest.raises(ValueError, match="outside requested abilities"):
        load_jd_tree_selection(
            {"A6"},
            {"PROPOSED-jd-0.1.1"},
            coverage_cells={"A6×L2"},
            include_global=False,
        )
