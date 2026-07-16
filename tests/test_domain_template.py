"""Tests for Domain Template → Task Template product path."""

from __future__ import annotations

import unittest
from pathlib import Path

from uav_benchmark.instance.domain_template import (
    build_domain_template,
    normalize_domain_template,
    slug_id,
)
from uav_benchmark.instance.generator import generate_instance, validate_instance

ROOT = Path(__file__).resolve().parents[1]


class SlugTests(unittest.TestCase):
    def test_chinese_title_becomes_ascii(self) -> None:
        self.assertEqual(slug_id("城市高楼峡谷违停巡检"), "tpl")
        self.assertEqual(slug_id("城市高楼峡谷违停巡检", fallback="domain_tpl"), "domain_tpl")
        self.assertTrue(slug_id("Case 1 违停", fallback="tpl").startswith("Case_1"))


class DomainTemplateTests(unittest.TestCase):
    def test_build_and_generate_valid_task_template(self) -> None:
        domain = build_domain_template(
            task_title="油田管廊缺陷巡检",
            scenario_summary="油气巡检",
            coverage=[{"cell": "A5xL2", "role": "primary", "responsibilities": ["检测"]}],
            runtime_dependencies=[{
                "dependency_id": "external_executor",
                "provider": "executor",
                "responsibilities": ["执行固定航段"],
                "scored": True,
                "status": "proposed",
            }],
            jd_edits=[
                {"slot_id": "jd-enum", "name": "天气", "binding_mode": "enum", "allowed_values": ["晴", "阴"]},
                {"slot_id": "jd-fixed", "name": "高度", "binding_mode": "fixed", "value": "80m"},
                {"slot_id": "jd-range", "name": "电量", "binding_mode": "range", "minimum": 20, "maximum": 100},
            ],
        )
        self.assertEqual(domain["template_id"], "domain_tpl")
        self.assertFalse(domain["runtime_dependencies"][0]["scored"])
        self.assertEqual(domain["interfaces"]["executor_responsibilities"], ["执行固定航段"])
        artifact = generate_instance(domain, 7)
        self.assertEqual(artifact["artifact_type"], "task_instance")
        self.assertTrue(artifact["instance_id"].startswith("domain_tpl-s7"))
        self.assertGreaterEqual(len(artifact["phase_schedule"]), 1)
        validate_instance(artifact, schema_path=ROOT / "schemas" / "task_instance.schema.json")
        values = {s["slot_id"]: s["value"] for s in artifact["slot_bindings"]}
        self.assertIn(values["jd-enum"], ["晴", "阴"])
        self.assertEqual(values["jd-fixed"], "80m")
        self.assertGreaterEqual(values["jd-range"], 20)
        self.assertLessEqual(values["jd-range"], 100)
        self.assertEqual(
            artifact["executor_profile"]["extensions"]["runtime_dependencies"],
            domain["runtime_dependencies"],
        )

    def test_normalize_empty_phases(self) -> None:
        raw = {
            "template_id": "中文标题",
            "jd_slots": [{"slot_id": "jd-1", "binding": {"mode": "fixed", "value": 1, "status": "verified"}}],
            "phases": [],
        }
        domain = normalize_domain_template(raw)
        self.assertEqual(domain["template_id"], "domain_tpl")
        self.assertEqual(domain["phases"][0]["phase_id"], "phase_default")
        artifact = generate_instance(domain, 0)
        validate_instance(artifact, schema_path=ROOT / "schemas" / "task_instance.schema.json")


if __name__ == "__main__":
    unittest.main()
