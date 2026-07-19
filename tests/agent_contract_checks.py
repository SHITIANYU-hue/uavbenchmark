"""Offline contract checks for the Config Agent.

Run with:
    PYTHONPATH=src .venv/bin/python tests/agent_contract_checks.py
"""

from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from uav_benchmark.agent.catalog import load_fixed_scenario, load_reference_catalog, load_scenario_registry
from uav_benchmark.agent.models import AgentCandidate, CoverageResult, ExtractionResult, NarrativeDraft
from uav_benchmark.agent.providers import StructuredResponse
from uav_benchmark.agent.service import (
    ConfigAgentError,
    ConfigAgent,
    NarrativeAgent,
    _chunk_coverage_for_extraction,
    _chunk_preferred_coverage,
    _extract_tool_trace,
    _parse_model_json,
    _prune_model_extras,
    structured_output_schema,
    validate_candidate,
    validate_narrative_draft,
)


TASK = (
    "无人机在高速公路执行巡检，系统持续识别车辆并维护跨帧身份。"
    "外部执行器负责固定航段推进和悬停。定位退化后，系统标记位姿不可信并上报异常。"
)


class FakeTransport:
    def __init__(self, payloads: list[object], calls: list[str] | None = None) -> None:
        self.payloads = list(payloads)
        self.calls = calls if calls is not None else []

    def generate(self, *, response_model: type, **_kwargs: object) -> StructuredResponse:
        self.calls.append(response_model.__name__)
        value = self.payloads.pop(0)
        raw_text = value.model_dump_json() if hasattr(value, "model_dump_json") else str(value)
        return StructuredResponse(raw_text=raw_text, parsed=value, finish_reason="stop", reasoning=None,
                                  usage={"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150})


def candidate(evidence: str) -> AgentCandidate:
    return AgentCandidate.model_validate({
        "task_title": "城市道路车辆巡检",
        "scenario_summary": "连续车辆巡检与定位退化处置",
        "coverage_candidates": [{
            "cell": "A6×L2",
            "role": "primary",
            "responsibilities": ["输出当前车辆识别结果", "持续识别车辆并维护跨帧身份"],
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
            {"slot_id": "jd-0.2", "name": "工作空间结构", "value": "高速公路、沿线路段和超长道路走廊；具体路段结构待确认", "status": "given", "evidence_quote": "高速公路、沿线路段和超长道路走廊；具体路段结构待确认", "provenance": "scenario_fixed"},
            {"slot_id": "jd-0.7", "name": "任务完成判据", "value": None, "status": "TBD", "evidence_quote": ""},
            {"slot_id": "jd-6.1", "name": "业务对象类目", "value": "车辆", "status": "given", "evidence_quote": "车辆"},
            {"slot_id": "jd-6.2", "name": "典型场景特征", "value": None, "status": "TBD", "evidence_quote": ""},
            {"slot_id": "jd-6.3", "name": "感知模态集", "value": None, "status": "TBD", "evidence_quote": ""},
        ],
        "responsibility_boundaries": [{
            "actor": "SUT",
            "responsible_for": ["车辆身份维护"],
            "explicitly_not_responsible_for": ["固定航段推进"],
        }],
        "natural_language_template": (
            "本任务在固定的高速公路巡检环境中进行。无人机使用场景已经提供的道路区域、车辆对象和基础观测条件，持续识别车辆并维护跨帧身份；没有明确的业务参数不得从一般知识自动补齐。\n\n"
            "正常巡检期间，系统处理连续观测，输出当前车辆结果并在执行片段内维护目标的可见、暂失和重新出现状态。对同一车辆的重复发现应合并，巡检结果应随任务推进持续更新。\n\n"
            "道路中车辆的具体数量、遮挡程度、观测质量和传感器参数尚未由人工任务给出，因此继续作为待确认信息。变量表记录这些缺口，正文不把未知内容改写成确定业务规则。\n\n"
            "外部执行器负责固定航段推进和悬停，系统不承担底层飞行闭环执行。评分责任与外部运行依赖分别记录，执行器已经完成的动作不能作为系统能力结果重复计算。\n\n"
            "定位退化发生后，系统只执行人工任务明确授权的异常标记和上报。定位可信阈值、恢复规则、安全判据和仿真接口没有来源时继续作为开放问题，不生成默认数值。\n\n"
            "任务输出包括车辆识别、跨帧身份维护和巡检记录。外部参与者的后续决定和通信字段没有明确证据时只记录为运行依赖，不评价自然语言协认或外部控制能力。\n\n"
            "任务在人工确认的完成条件满足时结束。当前具体观测时长、最低目标数量、证据要求和异常阶段终止条件仍待补充；本正文只表达可追溯的候选任务责任。"
        ),
        "open_questions": [],
        "warnings": [],
    })


class AgentContractChecks(unittest.TestCase):
    def test_client_construction_does_not_raise(self) -> None:
        agent = ConfigAgent(api_key="test-key", model="test-model", transport=FakeTransport([]))
        self.assertEqual(agent.model, "test-model")

    def test_transport_schema_removes_unsupported_additional_properties(self) -> None:
        schema_text = str(structured_output_schema())
        self.assertNotIn("additionalProperties", schema_text)
        narrative_schema_text = str(structured_output_schema(NarrativeDraft))
        self.assertNotIn("additionalProperties", narrative_schema_text)

    def test_first_call_narrative_rejects_internal_labels(self) -> None:
        prose = candidate("持续识别车辆并维护跨帧身份").natural_language_template
        draft = NarrativeDraft(
            task_title="高速公路车辆巡检",
            expanded_narrative=prose + "\n\n内部建议采用 A6×L2。",
        )
        issues = validate_narrative_draft(draft)
        self.assertIn("INTERNAL_LABEL_IN_NARRATIVE", {item.code for item in issues})

    def test_first_call_uses_one_model_request_and_returns_editable_prose(self) -> None:
        prose = candidate("持续识别车辆并维护跨帧身份").natural_language_template
        calls: list[str] = []

        draft_obj = NarrativeDraft(
            task_title="高速公路车辆巡检",
            expanded_narrative=prose.replace("\n", "\\n"),
            open_questions=["具体观察时长是多少？"],
        )
        transport = FakeTransport([draft_obj], calls)
        agent = NarrativeAgent(api_key="unused", model="fake-deepseek", provider="deepseek", transport=transport)
        result = agent.expand("巡查高速路，持续记录病害，遇到异常先通知调度。")

        self.assertEqual(calls, ["NarrativeDraft"])
        self.assertEqual(result.draft.expanded_narrative, prose)
        self.assertNotRegex(result.draft.expanded_narrative, r"A\d+[a-z]?×L[1-4]|jd-")

    def test_reviewed_catalog_is_full_and_contains_no_case_templates(self) -> None:
        catalog = load_reference_catalog()
        self.assertEqual(catalog["scope"], "full_17A_L1_L4_66JD_catalog")
        self.assertEqual(catalog["ability_id_scheme"], "ability-id-v2-2026-07-19")
        self.assertEqual(
            [item["a_id"] for item in catalog["abilities"]],
            [
                "A1", "A2", "A3", "A4", "A5",
                "A6", "A7a", "A7b", "A8",
                "A9", "A10",
                "A11a", "A11b",
                "A12", "A13",
                "A14", "A15",
            ],
        )
        self.assertEqual(catalog["counts"]["gal_cells"], 68)
        self.assertEqual(catalog["counts"]["jd_fields"], 66)
        self.assertEqual(len({item["cell"] for item in catalog["gal_cells"]}), 68)
        self.assertEqual(len({item["id"] for item in catalog["jd_fields"]}), 66)
        serialized = str(catalog)
        self.assertNotIn("城市高楼峡谷违停车辆巡检", serialized)
        self.assertNotIn("油田管廊缺陷巡检", serialized)

    def test_a_by_l_responsibility_is_cumulative(self) -> None:
        catalog = load_reference_catalog()
        cell = next(item for item in catalog["gal_cells"] if item["cell"] == "A6×L4")
        self.assertEqual(cell["cumulative_levels"], ["L1", "L2", "L3", "L4"])
        self.assertEqual(len(cell["cumulative_responsibilities"]), 4)
        self.assertTrue({"jd-6.1", "jd-6.2", "jd-6.3", "jd-6.4"}.issubset(cell["required_jd_ids"]))

    def test_same_city_case_can_switch_a6_level_without_changing_ability(self) -> None:
        """Level selection expands one A's duties instead of swapping case templates."""
        catalog = load_reference_catalog()
        a6_cells = {
            item["level"]: item
            for item in catalog["gal_cells"]
            if item["a_id"] == "A6"
        }
        self.assertEqual(set(a6_cells), {"L1", "L2", "L3", "L4"})

        expected_new_jd = {
            "L1": {"jd-6.1", "jd-6.3"},
            "L2": {"jd-6.2"},
            "L3": {"jd-0.2", "jd-0.3", "jd-0.5"},
            "L4": {"jd-6.4"},
        }
        previous_jd: set[str] = set()
        for index, level in enumerate(("L1", "L2", "L3", "L4"), start=1):
            cell = a6_cells[level]
            current_jd = set(cell["required_jd_ids"])
            self.assertEqual(cell["cell"], f"A6×{level}")
            self.assertEqual(len(cell["cumulative_responsibilities"]), index)
            self.assertTrue(previous_jd.issubset(current_jd))
            self.assertTrue(expected_new_jd[level].issubset(current_jd))
            previous_jd = current_jd

    def test_legacy_jd_8_control_semantics_migrate_to_jd_10(self) -> None:
        catalog = load_reference_catalog()
        names = {item["id"]: item["name"] for item in catalog["jd_fields"]}
        self.assertEqual(names["jd-10.1"], "控制质量先验")
        self.assertEqual(names["jd-10.2"], "控制工作机制")
        self.assertEqual(names["jd-10.3"], "控制处置策略适用集")

    def test_fixed_scenario_precedes_human_task_and_has_no_level(self) -> None:
        registry = load_scenario_registry()
        scenario = load_fixed_scenario()
        self.assertEqual(registry["default_scenario_id"], "highway_inspection")
        self.assertEqual(len(registry["scenarios"]), 5)
        self.assertEqual(scenario["scenario_id"], "highway_inspection")
        self.assertNotRegex(str(scenario["summary"]), r"A\d+[a-z]?×L[1-4]")
        binding_modes = {item["binding_mode"] for item in scenario["variable_bindings"]}
        self.assertTrue(binding_modes.issubset({"fixed_value", "fixed_domain", "task_derived"}))
        self.assertTrue({"fixed_domain", "task_derived"}.issubset(binding_modes))

    def test_each_registered_scenario_uses_canonical_jd_names(self) -> None:
        catalog_names = {item["id"]: item["name"] for item in load_reference_catalog()["jd_fields"]}
        registry = load_scenario_registry()
        self.assertEqual(
            {item["scenario_id"] for item in registry["scenarios"]},
            {"highway_inspection", "oil_gas_inspection", "bridge_inspection", "campus_inspection", "other_inspection"},
        )
        for scenario in registry["scenarios"]:
            for binding in scenario["variable_bindings"]:
                self.assertEqual(catalog_names[binding["slot_id"]], binding["name"])

    def test_exact_evidence_passes(self) -> None:
        self.assertEqual(validate_candidate(candidate("持续识别车辆并维护跨帧身份"), TASK), [])

    def test_paraphrased_evidence_is_rejected(self) -> None:
        issues = validate_candidate(candidate("持续识别并追踪所有车辆"), TASK)
        self.assertIn("EVIDENCE_NOT_VERBATIM", {issue.code for issue in issues})

    def test_internal_axl_label_is_rejected_from_business_narrative(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        value.natural_language_template += "\n\n内部候选为 A6×L2。"
        issues = validate_candidate(value, TASK)
        self.assertIn("INTERNAL_LABEL_IN_NARRATIVE", {issue.code for issue in issues})

    def test_human_level_edit_requires_source_note(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        value.coverage_candidates[0].cell = "A6×L3"
        value.coverage_candidates[0].provenance = "human_edited"
        issues = validate_candidate(value, TASK)
        self.assertIn("HUMAN_VALUE_MISSING_SOURCE", {issue.code for issue in issues})

    def test_missing_backbone_slot_is_rejected(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        value.jd_candidates = [item for item in value.jd_candidates if item.slot_id != "jd-6.3"]
        issues = validate_candidate(value, TASK)
        self.assertIn("MISSING_REQUIRED_JD_SLOT", {issue.code for issue in issues})

    def test_level_two_requires_two_cumulative_responsibility_entries(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        value.coverage_candidates[0].responsibilities = ["持续识别车辆并维护跨帧身份"]
        issues = validate_candidate(value, TASK)
        self.assertIn("INCOMPLETE_CUMULATIVE_RESPONSIBILITY", {issue.code for issue in issues})

    def test_runtime_dependency_cannot_be_scored(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        value.runtime_dependencies[0].scored = True
        issues = validate_candidate(value, TASK)
        self.assertIn("RUNTIME_DEPENDENCY_MARKED_SCORED", {issue.code for issue in issues})

    def test_human_jd_value_requires_source_note(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        row = next(item for item in value.jd_candidates if item.slot_id == "jd-6.2")
        row.value = "高密度动态目标"
        row.status = "proposed"
        row.provenance = "human_edited"
        issues = validate_candidate(value, TASK)
        self.assertIn("HUMAN_VALUE_MISSING_SOURCE", {issue.code for issue in issues})

    def test_human_jd_value_with_source_note_is_accepted(self) -> None:
        value = candidate("持续识别车辆并维护跨帧身份")
        row = next(item for item in value.jd_candidates if item.slot_id == "jd-6.2")
        row.value = "高密度动态目标"
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

    def test_orchestrator_uses_two_model_requests_after_two_local_tools(self) -> None:
        calls: list[str] = []
        cand = candidate("持续识别车辆并维护跨帧身份")
        coverage = CoverageResult(
            task_title=cand.task_title,
            scenario_summary=cand.scenario_summary,
            coverage_candidates=cand.coverage_candidates,
            responsibility_boundaries=cand.responsibility_boundaries,
        )
        extraction = ExtractionResult(
            jd_candidates=cand.jd_candidates,
            runtime_dependencies=cand.runtime_dependencies,
            open_questions=cand.open_questions,
            warnings=cand.warnings,
        )
        agent = ConfigAgent(
            api_key="unused",
            model="fake-deepseek",
            provider="deepseek",
            transport=FakeTransport([coverage, extraction], calls),
        )
        events: list[str] = []
        confirmed_narrative = cand.natural_language_template
        result = agent.analyze(confirmed_narrative, progress=lambda event, _details: events.append(event))

        self.assertEqual(calls, ["CoverageResult", "ExtractionResult"])
        self.assertEqual(
            [item.tool for item in result.tool_trace if item.status == "completed"],
            ["lookup_gal_catalog", "lookup_jd_catalog"],
        )
        self.assertIn("model_response_received", events)
        self.assertEqual(
            result.candidate.catalog_versions,
            load_reference_catalog()["source_versions"],
        )
        self.assertEqual(result.candidate.natural_language_template, confirmed_narrative)
        self.assertEqual(result.candidate.task_title, "城市道路车辆巡检")
        self.assertTrue(len(result.candidate.jd_candidates) > 0)

    def test_classify_coverage_uses_one_request_and_omits_jd(self) -> None:
        calls: list[str] = []
        cand = candidate("持续识别车辆并维护跨帧身份")
        coverage = CoverageResult(
            task_title=cand.task_title,
            scenario_summary=cand.scenario_summary,
            coverage_candidates=cand.coverage_candidates,
            responsibility_boundaries=cand.responsibility_boundaries,
        )
        agent = ConfigAgent(
            api_key="unused",
            model="fake-deepseek",
            provider="deepseek",
            transport=FakeTransport([coverage], calls),
        )
        result = agent.classify_coverage(cand.natural_language_template)
        self.assertEqual(calls, ["CoverageResult"])
        self.assertTrue(len(result.candidate.coverage_candidates) > 0)
        self.assertEqual(result.candidate.jd_candidates, [])
        # JD-missing issues must not surface before STEP 3 runs extraction.
        self.assertNotIn("MISSING_REQUIRED_JD_SLOT", {i.code for i in result.validation_issues})

    def test_extract_jd_runs_extraction_only_and_merges(self) -> None:
        calls: list[str] = []
        cand = candidate("持续识别车辆并维护跨帧身份")
        extraction = ExtractionResult(
            jd_candidates=cand.jd_candidates,
            runtime_dependencies=cand.runtime_dependencies,
            open_questions=cand.open_questions,
            warnings=cand.warnings,
        )
        agent = ConfigAgent(
            api_key="unused",
            model="fake-deepseek",
            provider="deepseek",
            transport=FakeTransport([extraction], calls),
        )
        result = agent.extract_jd(
            cand.natural_language_template,
            coverage_candidates=[c.model_dump() for c in cand.coverage_candidates],
            task_title=cand.task_title,
            scenario_summary=cand.scenario_summary,
            responsibility_boundaries=[b.model_dump() for b in cand.responsibility_boundaries],
        )
        self.assertEqual(calls, ["ExtractionResult"])
        self.assertTrue(len(result.candidate.jd_candidates) > 0)
        self.assertEqual(result.candidate.task_title, cand.task_title)
        self.assertEqual(
            [item.tool for item in result.tool_trace if item.status == "completed"],
            ["lookup_gal_catalog", "lookup_jd_catalog"],
        )

    def test_extract_jd_requires_coverage(self) -> None:
        agent = ConfigAgent(api_key="unused", model="fake", transport=FakeTransport([]))
        with self.assertRaises(ConfigAgentError):
            agent.extract_jd(
                candidate("持续识别车辆并维护跨帧身份").natural_language_template,
                coverage_candidates=[],
                task_title="t",
                scenario_summary="s",
            )

    def test_chunking_splits_large_coverage_but_keeps_single_cell_whole(self) -> None:
        summary = [
            {"cell": "A4×L2", "required_jd_ids": ["jd-4.1", "jd-4.2", "jd-4.3", "jd-4.4", "jd-4.5"]},
            {"cell": "A6×L2", "required_jd_ids": ["jd-6.1", "jd-6.2", "jd-6.3", "jd-6.4"]},
            {"cell": "A13×L2", "required_jd_ids": ["jd-13.1", "jd-13.2", "jd-13.3", "jd-13.4", "jd-13.5"]},
        ]
        chunks = _chunk_coverage_for_extraction(summary, ["jd-0.2", "jd-0.7"], max_slots_per_chunk=10)
        self.assertGreater(len(chunks), 1)
        # every cell appears exactly once across all chunks
        flat = [entry["cell"] for chunk in chunks for entry in chunk]
        self.assertEqual(sorted(flat), ["A13×L2", "A4×L2", "A6×L2"])

    def test_chunking_single_cell_is_one_chunk(self) -> None:
        summary = [{"cell": "A6×L2", "required_jd_ids": ["jd-6.1", "jd-6.2"]}]
        chunks = _chunk_coverage_for_extraction(summary, ["jd-0.2", "jd-0.7"])
        self.assertEqual(len(chunks), 1)

    def test_preferred_coverage_chunking_splits_and_preserves(self) -> None:
        pref = [
            {"cell": f"{ability}×L2"}
            for ability in ("A1", "A2", "A3", "A4", "A5", "A6", "A7a", "A7b")
        ]
        chunks = _chunk_preferred_coverage(pref, max_cells_per_chunk=6)
        self.assertEqual(len(chunks), 2)
        flat = [entry["cell"] for chunk in chunks for entry in chunk]
        self.assertEqual(len(flat), 8)

    def test_preferred_coverage_chunking_empty_is_single_inference_call(self) -> None:
        self.assertEqual(_chunk_preferred_coverage([]), [[]])

    def test_extraction_tolerates_hallucinated_extra_fields(self) -> None:
        # DeepSeek sometimes adds an extra per-slot "open_question" key.
        raw = json.dumps({
            "jd_candidates": [{
                "slot_id": "jd-0.2", "name": "工作空间结构", "value": "高速公路走廊",
                "binding_mode": "fixed", "status": "given", "evidence_quote": "高速公路走廊",
                "open_question": "平台参数表的具体内容是什么？",  # extra, must be dropped
            }],
            "runtime_dependencies": [],
            "open_questions": [],
            "warnings": [],
        }, ensure_ascii=False)
        parsed = _parse_model_json(
            raw, ExtractionResult, run_id="agent-test", operation="extraction", finish_reason="stop",
        )
        self.assertEqual(len(parsed.jd_candidates), 1)
        self.assertEqual(parsed.jd_candidates[0].slot_id, "jd-0.2")

    def test_prune_model_extras_keeps_only_known_keys(self) -> None:
        cleaned = _prune_model_extras(
            {"slot_id": "jd-0.2", "name": "n", "value": "v", "status": "given",
             "evidence_quote": "", "bogus": 1},
            ExtractionResult.model_fields["jd_candidates"].annotation,
        )
        self.assertNotIn("bogus", cleaned[0] if isinstance(cleaned, list) else cleaned)

    def test_classify_coverage_batches_large_selection(self) -> None:
        calls: list[str] = []
        cells1 = ["A1×L2", "A2×L2", "A3×L2", "A4×L2", "A6×L2", "A7a×L2"]
        cells2 = ["A9×L2", "A11a×L2"]

        def make(cells: list[str]) -> CoverageResult:
            return CoverageResult(
                task_title="城市道路车辆巡检",
                scenario_summary="连续车辆巡检与定位退化处置",
                coverage_candidates=[{
                    "cell": c, "role": "primary",
                    "responsibilities": ["r1", "r2"],
                    "evidence_quote": "", "status": "proposed",
                } for c in cells],
                responsibility_boundaries=[],
            )

        agent = ConfigAgent(
            api_key="unused", model="fake", provider="deepseek",
            transport=FakeTransport([make(cells1), make(cells2)], calls),
        )
        narrative = candidate("持续识别车辆并维护跨帧身份").natural_language_template
        result = agent.classify_coverage(narrative, preferred_coverage=cells1 + cells2)
        self.assertEqual(calls, ["CoverageResult", "CoverageResult"])
        got = {c.cell for c in result.candidate.coverage_candidates}
        self.assertEqual(got, set(cells1 + cells2))


if __name__ == "__main__":
    unittest.main()
