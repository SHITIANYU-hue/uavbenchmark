from __future__ import annotations

from uav_benchmark.agent.catalog import build_jd_tree_domains, load_jd_tree_domains


def test_version2_domain_projection_merges_and_filters_nodes() -> None:
    tree = {
        "nodes": [
            {
                "node_id": "jd-6.1.1",
                "node_kind": "variable",
                "variable_role": "configuration_input",
                "value_type": "enum",
                "value_domain": [{"label_zh": "车辆"}, {"label_zh": "行人"}],
                "configuration_side": "world",
            },
            {
                "node_id": "jd-6.1.2",
                "node_kind": "variable",
                "variable_role": "TBD",
                "value_type": "enum",
                "value_domain": [{"label_zh": "车辆"}, {"label_zh": "路障"}],
                "configuration_side": "shared",
            },
            {
                "node_id": "jd-6.1.3",
                "node_kind": "variable",
                "variable_role": "hidden_ground_truth",
                "value_type": "enum",
                "value_domain": [{"label_zh": "真实标签"}],
                "visibility": ["hidden_gt"],
            },
            {
                "node_id": "jd-7.2.1",
                "node_kind": "variable",
                "variable_role": "configuration_input",
                "value_type": "number_or_range",
                "value_domain": [],
            },
            {
                "node_id": "PROPOSED-jd-7.4.1",
                "node_kind": "variable",
                "variable_role": "configuration_input",
                "value_type": "enum",
                "value_domain": [{"label_zh": "非 canonical 值"}],
            },
        ]
    }

    result = build_jd_tree_domains(tree, {"jd-6.1", "jd-7.2"})

    assert result["jd-6.1"]["options"] == ["车辆", "行人", "路障"]
    assert "真实标签" not in result["jd-6.1"]["options"]
    assert result["jd-7.2"]["value_type"] == "number_or_range"
    assert result["jd-7.2"]["options"] == []
    assert "jd-7.4" not in result


def test_real_domain_endpoint_uses_version2_without_hidden_gt() -> None:
    result = load_jd_tree_domains()

    assert result["source_tree"] == "jd_variable_tree_version2.json"
    assert result["catalog_version"] == "2.4.0-audited-merge"
    # Version2 currently supplies directly loadable enum/numeric domains for
    # 52 canonical slots; the remaining canonical JDs stay on the Agent/TBD
    # path instead of receiving invented defaults.
    assert len(result["slots"]) == 52
    assert all(
        "hidden_ground_truth" not in slot["roles"]
        for slot in result["slots"].values()
    )
