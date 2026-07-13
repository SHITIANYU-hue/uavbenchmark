"""Offline contract checks for the Config Agent.

Run with:
    PYTHONPATH=src .venv/bin/python tests/agent_contract_checks.py
"""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from uav_benchmark.agent.catalog import load_reference_catalog
from uav_benchmark.agent.models import AgentCandidate
from uav_benchmark.agent.service import (
    _extract_tool_trace,
    gemini_response_schema,
    validate_candidate,
)


TASK = (
    "无人机在城市道路执行巡检，系统持续识别车辆并维护跨帧身份。"
    "外部执行器负责固定航段推进和悬停。定位退化后，系统标记位姿不可信并上报异常。"
)


def candidate(evidence: str) -> AgentCandidate:
    return AgentCandidate.model_validate({
        "task_title": "城市道路车辆巡检",
        "scenario_summary": "连续车辆巡检与定位退化处置",
        "coverage_candidates": [{
            "cell": "A5×L2",
            "role": "primary",
            "responsibilities": ["持续识别车辆并维护跨帧身份"],
            "out_of_scope": [],
            "evidence_quote": evidence,
            "status": "proposed",
        }],
        "runtime_dependencies": [{
            "dependency_id": "external_executor",
            "provider": "executor",
            "responsibilities": ["固定航段推进和悬停"],
            "evidence_quote": "外部执行器负责固定航段推进和悬停",
            "scored": False,
            "status": "proposed",
        }],
        "jd_candidates": [
            {"slot_id": "jd-0.2", "name": "工作空间结构", "value": "城市道路", "status": "given", "evidence_quote": "城市道路"},
            {"slot_id": "jd-8.3", "name": "平台与执行包络", "value": None, "status": "TBD", "evidence_quote": ""},
            {"slot_id": "jd-7.1", "name": "航路拓扑", "value": "固定航段", "status": "given", "evidence_quote": "固定航段"},
            {"slot_id": "jd-0.3", "name": "扰动谱", "value": "定位退化", "status": "given", "evidence_quote": "定位退化"},
            {"slot_id": "jd-0.10", "name": "安全包络", "value": None, "status": "TBD", "evidence_quote": ""},
            {"slot_id": "jd-0.7", "name": "任务完成判据", "value": None, "status": "TBD", "evidence_quote": ""},
            {"slot_id": "jd-0.9", "name": "载荷集", "value": None, "status": "TBD", "evidence_quote": ""},
            {"slot_id": "jd-5.1", "name": "业务对象类别", "value": "车辆", "status": "given", "evidence_quote": "车辆"},
        ],
        "responsibility_boundaries": [{
            "actor": "SUT",
            "responsible_for": ["车辆身份维护"],
            "explicitly_not_responsible_for": ["固定航段推进"],
        }],
        "natural_language_template": (
            "在【jd-0.2 工作空间结构＝城市道路】中，具备【jd-8.3 平台与执行包络＝TBD】的无人机，沿【jd-7.1 航路拓扑＝固定航段】执行车辆巡检任务；平台类型、速度范围和起降限制等待业务方补充。\n\n"
            "无人机使用【jd-0.9 载荷集＝TBD】观察【jd-5.1 业务对象类别＝车辆】。载荷型号与观测质量条件尚未提供，因此不生成传感器参数，只要求输出能够追溯到本次任务原文的车辆结果。\n\n"
            "外部执行器负责固定航段推进和悬停，SUT不承担底层闭环执行。控制接口、执行频率和仿真器协议均未在原文中说明，继续保留为开放问题。\n\n"
            "A5×L2 负责持续识别车辆并维护跨帧身份；它不负责固定航段推进，也不把外部执行器完成的动作计入评分结果。评分责任和外部运行依赖必须分别记录。\n\n"
            "任务可能发生【jd-0.3 扰动谱＝定位退化】，但【jd-0.10 安全包络＝TBD】。系统只能执行原文授权的异常标记和上报，不能自行编造定位阈值、恢复规则或安全判据。\n\n"
            "异常发生后，系统记录定位不可信并上报；外部参与者的后续决定和通信字段没有明确证据，因此作为待确认接口，不评价自然语言协认能力。\n\n"
            "任务依据【jd-0.7 任务完成判据＝TBD】结束。正式确认前仍需补充完成条件、证据要求和缺失字段；本模板只表达候选边界，不代表业务阈值已经批准。"
        ),
        "open_questions": [],
        "warnings": [],
    })


class AgentContractChecks(unittest.TestCase):
    def test_transport_schema_removes_unsupported_additional_properties(self) -> None:
        schema_text = str(gemini_response_schema())
        self.assertNotIn("additionalProperties", schema_text)

    def test_reviewed_catalog_is_partial_and_contains_no_case_templates(self) -> None:
        catalog = load_reference_catalog()
        self.assertEqual(catalog["scope"], "partial_demo_catalog")
        serialized = str(catalog)
        self.assertNotIn("城市高楼峡谷违停车辆巡检", serialized)
        self.assertNotIn("油田管廊缺陷巡检", serialized)

    def test_exact_evidence_passes(self) -> None:
        self.assertEqual(validate_candidate(candidate("持续识别车辆并维护跨帧身份"), TASK), [])

    def test_paraphrased_evidence_is_rejected(self) -> None:
        issues = validate_candidate(candidate("持续识别并追踪所有车辆"), TASK)
        self.assertIn("EVIDENCE_NOT_VERBATIM", {issue.code for issue in issues})

    def test_missing_backbone_slot_is_rejected(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        value.jd_candidates = [item for item in value.jd_candidates if item.slot_id != "jd-0.9"]
        issues = validate_candidate(value, TASK)
        self.assertIn("MISSING_REQUIRED_JD_SLOT", {issue.code for issue in issues})

    def test_runtime_dependency_cannot_be_scored(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        value.runtime_dependencies[0].scored = True
        issues = validate_candidate(value, TASK)
        self.assertIn("RUNTIME_DEPENDENCY_MARKED_SCORED", {issue.code for issue in issues})

    def test_human_jd_value_requires_source_note(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        row = next(item for item in value.jd_candidates if item.slot_id == "jd-8.3")
        row.value = "多旋翼平台"
        row.status = "proposed"
        row.provenance = "human_edited"
        issues = validate_candidate(value, TASK)
        self.assertIn("HUMAN_VALUE_MISSING_SOURCE", {issue.code for issue in issues})

    def test_human_jd_value_with_source_note_is_accepted(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        row = next(item for item in value.jd_candidates if item.slot_id == "jd-8.3")
        row.value = "多旋翼平台"
        row.status = "proposed"
        row.provenance = "human_edited"
        row.source_note = "业务负责人在项目例会上确认"
        issues = validate_candidate(value, TASK)
        self.assertNotIn("HUMAN_VALUE_MISSING_SOURCE", {issue.code for issue in issues})

    def test_human_dependency_requires_source_note(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        value.runtime_dependencies.append(value.runtime_dependencies[0].model_copy(update={
            "dependency_id": "external_decision_port",
            "provider": "human_or_external_decision",
            "evidence_quote": "",
            "provenance": "human_added",
            "source_note": None,
        }))
        issues = validate_candidate(value, TASK)
        self.assertIn("HUMAN_VALUE_MISSING_SOURCE", {issue.code for issue in issues})

    def test_tool_trace_does_not_invent_missing_calls(self) -> None:
        history = [SimpleNamespace(parts=[SimpleNamespace(
            function_call=SimpleNamespace(name="lookup_gal_catalog"),
            function_response=None,
        )])]
        trace = _extract_tool_trace(history)
        self.assertEqual([item.tool for item in trace], ["lookup_gal_catalog"])
        self.assertNotIn("lookup_jd_catalog", [item.tool for item in trace])

    def test_orchestrator_uses_one_model_request_after_two_local_tools(self) -> None:
        from uav_benchmark.agent.service import GeminiConfigAgent

        calls: list[tuple[str, object]] = []

        class FakeModels:
            def generate_content(self, *, model: str, contents: str, config: object) -> object:
                calls.append((model, config))
                return SimpleNamespace(parsed=candidate("持续识别车辆并维护跨帧身份"), usage_metadata=None)

        agent = GeminiConfigAgent.__new__(GeminiConfigAgent)
        agent.model = "fake-gemini"
        agent.client = SimpleNamespace(models=FakeModels())
        events: list[str] = []
        result = agent.analyze(TASK + TASK, progress=lambda event, _details: events.append(event))

        self.assertEqual(len(calls), 1)
        self.assertEqual(
            [item.tool for item in result.tool_trace if item.status == "completed"],
            ["lookup_gal_catalog", "lookup_jd_catalog"],
        )
        self.assertIn("model_response_received", events)


if __name__ == "__main__":
    unittest.main()
