"""DeepSeek Config Agent and deterministic post-validation."""

from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import Any, Callable

from openai import OpenAI

from .catalog import (
    ROOT,
    gal_cell_index,
    jd_field_index,
    load_fixed_scenario,
    load_reference_catalog,
    load_template_backbone,
    lookup_gal_catalog,
    lookup_jd_catalog,
)
from .models import (
    AgentCandidate,
    AgentRunResult,
    CoverageResult,
    ExtractionResult,
    NarrativeDraft,
    NarrativeRunResult,
    ToolTrace,
    ValidationIssue,
)


NARRATIVE_SYSTEM_INSTRUCTION = """
You are TaskNarrativeAgent, the first call in a two-call UAV benchmark pipeline.

Input contains one fixed business scenario and a short, colloquial human task
request. Expand them into a detailed Chinese task narrative for human review.

Mandatory rules:
- This call writes business prose only. Do not classify GAL or A×L and do not
  extract or display JD identifiers.
- Do not mention A×L, GAL, jd-x.x, JSON, schema fields, prompts, or agent internals.
- Use the fixed scenario as context, but include only task modules requested or
  necessarily implied by the short human request. A scene's available module is
  not automatically part of this task.
- Preserve the user's requested behavior, continuity, anomaly response, output,
  external responsibilities, and completion intent.
- Separate SUT responsibility from external executor, external system, and human
  responsibility whenever the input provides such a boundary.
- Do not invent thresholds, numeric business rules, object taxonomies, workflow
  rules, simulator APIs, communication protocols, or safety decisions.
- Missing information is stated as TBD or as an open question.
- Write seven substantive paragraphs: context/objective; nominal behavior;
  observations and variables; responsibility boundary; anomaly/event behavior;
  outputs/external loop; completion and TBD.
- Return Chinese content except unavoidable technical names.
""".strip()


SYSTEM_INSTRUCTION = """
You are ConfigAuthoringAgent for a UAV benchmark.

Classify one human-reviewed, expanded task narrative inside one fixed business scenario into proposed GAL A×L
coverage, non-scored runtime dependencies, JD candidates with provenance,
responsibility boundaries, open questions, and a Chinese natural-language
Task Template.

The local Agent orchestrator has already loaded the fixed scenario and called
lookup_gal_catalog and lookup_jd_catalog. Their actual results are included
separately from the human task request.

Mandatory rules:
- Use only GAL cells and JD slot IDs in the provided tool results.
- Treat fixed_scenario as authoritative context and confirmed_task_narrative as
  the only source of requested SUT behavior and autonomy responsibility.
- The confirmed narrative does not contain A×L or JD identifiers. Infer A and L from
  behavioral verbs, continuity, anomaly response, human decision role, and
  requested outputs.
- A×L responsibility is cumulative. For L2/L3/L4 include every responsibility
  and required JD inherited from all lower levels, not only the target-level delta.
- Keep the business case identity fixed when comparing levels of the same A;
  vary responsibility, human role, anomaly handling, and evidence expectations.
- Apply the provided task_template_backbone as a completeness contract.
- Emit every JD slot required by the base backbone and each selected A×L
  required_jd_ids list.
- If a required slot has no exact task evidence, emit value=null,
  status=TBD, and evidence_quote=""; never omit the slot.
- Stage 0 must not preselect A×L. Do not copy the historical case coverage.
- Do not invent thresholds, numeric business rules, simulator APIs, or levels.
- Unsupported or missing information becomes TBD or an open question.
- Keep scored coverage separate from runtime dependencies and external actors.
- Do not credit an external executor action to the SUT.
- Coverage evidence_quote must be an exact substring of the human task unless status is TBD.
- A JD or runtime dependency copied from fixed_scenario uses provenance=scenario_fixed
  and an exact scenario substring; task-specific values use provenance=agent_extracted
  and exact human task evidence.
- Express selected responsibilities and non-responsibilities in plain business Chinese.
- Return Chinese content except fixed IDs and reason codes.
""".strip()


COVERAGE_INSTRUCTION = """
You are the CoverageClassification sub-agent in a UAV benchmark pipeline.

Your ONLY job is to classify A×L coverage and responsibility boundaries from
one confirmed task narrative. A later sub-call will extract JD candidates; do
not emit any jd_candidates.

Input contains: fixed_scenario, confirmed_task_narrative, and the compact GAL
catalog (cell IDs, ability names, required JD IDs per cell, cumulative level
count).

Rules:
- Infer A and L from behavioral verbs, continuity, anomaly response, human
  decision role, and requested outputs in the confirmed narrative.
- A×L responsibility is cumulative. For L2/L3/L4 emit one responsibility per
  inherited level (the catalog tells you cumulative_level_count).
- coverage_candidates[].evidence_quote MUST be an exact substring of
  confirmed_task_narrative.
- Use only cell IDs from the provided GAL catalog.
- Separate SUT responsibility from external executor / external system / human
  responsibility using responsibility_boundaries.
- Express responsibilities in plain business Chinese.
- Return Chinese content except fixed IDs.
""".strip()


EXTRACTION_INSTRUCTION = """
You are the JDExtraction sub-agent in a UAV benchmark pipeline.

Your ONLY job is to extract JD candidates and runtime dependencies from one
confirmed task narrative, given the already-classified coverage. Do not emit
any coverage_candidates.

Input contains: fixed_scenario, confirmed_task_narrative, the selected
coverage_cells (with their required_jd_ids), and the compact JD catalog
(slot IDs and canonical names).

Rules:
- Emit every JD slot required by the selected coverage's required_jd_ids AND
  the base backbone slots ["jd-0.2", "jd-0.7"].
- NEVER omit a required slot. Always emit it.
- FILL IN VALUES AGGRESSIVELY using task context, scenario context, and UAV
  domain knowledge. Do not leave slots as TBD when a reasonable value can be
  inferred. Use these status levels:
    status="given"     — value is directly stated in the narrative (evidence_quote
                          MUST be an exact narrative substring)
    status="proposed"  — value is inferred from context/domain knowledge
                          (evidence_quote = closest relevant narrative text or "")
    status="TBD"       — truly cannot be inferred at all (value=null, evidence_quote="")
- Examples of proactive inference:
    jd-5.1 业务对象类目: highway → "车辆、道路设施、异常停车"
    jd-5.2 典型场景特征: highway → "高速车流、多车道、匝道、桥梁路段"
    jd-1.1 指称对象目录: infer from task objects mentioned in narrative
    jd-1.2 指称方式集: infer standard naming conventions for the scenario
    jd-2.1 任务参数表: extract any mentioned parameters (altitude, speed, range)
    jd-10.2 地面站拓扑: "标准单地面站、C2链路、差分定位" (standard UAV setup)
    jd-0.10 安全包络: infer minimum safety rules from scenario type
- Use canonical JD names exactly as given in the catalog.
- JD value from fixed_scenario: provenance="scenario_fixed". Inferred from
  task/domain: provenance="agent_extracted".
- runtime_dependencies must have scored=false.
- Do not invent specific numeric thresholds, but DO infer qualitative domains
  and categorical values (e.g., object types, scene characteristics, sensor modes).
- Express content in plain business Chinese except fixed IDs.
""".strip()


class ConfigAgentError(RuntimeError):
    """A user-safe Config Agent failure."""


def structured_output_schema(model: type[AgentCandidate] | type[NarrativeDraft] = AgentCandidate) -> dict[str, Any]:
    """Return a JSON Schema describing the expected structured response.

    Pydantic emits ``additionalProperties: false`` for ``extra='forbid'``.
    The schema is embedded in the system prompt so DeepSeek produces JSON
    that conforms to it. ``AgentCandidate.model_validate`` still rejects
    extra fields after the response returns.
    """

    def sanitize(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: sanitize(item)
                for key, item in value.items()
                if key != "additionalProperties"
            }
        if isinstance(value, list):
            return [sanitize(item) for item in value]
        return value

    return sanitize(model.model_json_schema())


def _schema_instruction(model_cls: type[AgentCandidate] | type[NarrativeDraft]) -> str:
    schema = structured_output_schema(model_cls)
    schema_text = json.dumps(schema, ensure_ascii=False, indent=2)
    return (
        "\n\nYou must respond with a single valid JSON object that strictly "
        "conforms to the following JSON Schema. Output ONLY the raw JSON "
        "object—no markdown fences, no commentary, no surrounding text:\n\n"
        + schema_text
    )


def _create_client(api_key: str) -> Any:
    base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    return OpenAI(api_key=api_key, base_url=base_url, timeout=90.0, max_retries=0)


def _model_error(exc: Exception) -> ConfigAgentError:
    from openai import APIConnectionError, APIStatusError, AuthenticationError, RateLimitError

    message = str(exc)
    if isinstance(exc, AuthenticationError) or "401" in message or "403" in message:
        return ConfigAgentError("DeepSeek API Key 无效、无权限或对应模型不可用。")
    if isinstance(exc, RateLimitError) or "429" in message or "RESOURCE_EXHAUSTED" in message:
        return ConfigAgentError("DeepSeek 请求频率已达到当前额度（429）。请至少等待一分钟后再重试。")
    if isinstance(exc, APIConnectionError):
        return ConfigAgentError(f"无法连接 DeepSeek 服务：{message[:240]}")
    if "503" in message or "UNAVAILABLE" in message:
        return ConfigAgentError("DeepSeek 当前临时高负载（503）。本次输入与 Run ID 已保存，请稍后重试。")
    return ConfigAgentError(f"DeepSeek 调用失败：{message[:240]}")


def _usage_dict(response: Any) -> dict[str, int | float | str | None]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return {}
    result: dict[str, int | float | str | None] = {}
    for attr in ("prompt_tokens", "completion_tokens", "total_tokens"):
        val = getattr(usage, attr, None)
        if isinstance(val, (int, float)):
            result[attr] = val
    return result


def _normalize_narrative_linebreaks(value: str) -> str:
    """Convert model-emitted literal newline escapes into real paragraphs."""

    return value.replace("\\r\\n", "\n").replace("\\n", "\n")


def _strip_json_fences(text: str) -> str:
    """Remove markdown code fences (```json ... ```) and surrounding noise."""

    text = text.strip()
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


def _extract_json(raw_text: str) -> str:
    """Best-effort extraction of a JSON object from model output."""

    text = _strip_json_fences(raw_text)
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return text


def _save_debug_response(run_id: str, operation: str, raw_text: str, finish_reason: str | None) -> Path:
    output_dir = ROOT / ".agent_runs"
    output_dir.mkdir(exist_ok=True)
    debug_path = output_dir / f"{run_id}_raw_{operation}.txt"
    debug_path.write_text(
        f"run_id: {run_id}\n"
        f"operation: {operation}\n"
        f"finish_reason: {finish_reason}\n"
        f"content_length: {len(raw_text)}\n"
        f"---raw---\n"
        f"{raw_text}",
        encoding="utf-8",
    )
    return debug_path


def _parse_model_json(
    raw_text: str,
    model_cls: type,
    *,
    run_id: str,
    operation: str,
    finish_reason: str | None,
    emit: Callable[[str, dict[str, Any]], None] | None = None,
):
    """Parse a JSON response into *model_cls*, saving a debug dump on failure."""

    text = _extract_json(raw_text)
    try:
        return model_cls.model_validate_json(text)
    except Exception as exc:
        debug_path = _save_debug_response(run_id, operation, raw_text, finish_reason)
        snippet = raw_text[:300].replace("\n", "\\n")
        detail = str(exc)[:500]
        if finish_reason == "length":
            raise ConfigAgentError(
                f"DeepSeek 返回被截断（finish_reason=length），JSON 不完整。"
                f"原始响应已保存到 {debug_path.name}。"
            ) from exc
        raise ConfigAgentError(
            f"DeepSeek 返回的 JSON 无法解析为 {model_cls.__name__}。\n"
            f"错误：{detail}\n"
            f"原始响应已保存到 {debug_path.name}。\n"
            f"响应片段（前300字符）：{snippet}"
        ) from exc


def _merge_usage(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
        val = extra.get(key)
        if isinstance(val, (int, float)):
            base[key] = base.get(key, 0) + val
    return base


def _lookup_required_jds(cell_id: str, gal_catalog: dict[str, Any]) -> list[str]:
    for c in gal_catalog.get("cells", []):
        if c.get("cell") == cell_id:
            return c.get("required_jd_ids", [])
    return []


def _condensed_gal_catalog() -> dict[str, Any]:
    """Compact GAL catalog: cell IDs, ability names, required JDs — no full responsibility text."""

    catalog = lookup_gal_catalog()
    return {
        "catalog_version": catalog["catalog_version"],
        "abilities": catalog["abilities"],
        "cells": [
            {
                "cell": c["cell"],
                "a_id": c["a_id"],
                "level": c["level"],
                "ability": c["ability"],
                "level_label": c["level_label"],
                "cumulative_level_count": len(c["cumulative_levels"]),
                "required_jd_ids": c["required_jd_ids"],
            }
            for c in catalog["gal_cells"]
        ],
    }


def _condensed_jd_catalog() -> dict[str, Any]:
    """Compact JD catalog: slot IDs and canonical names — no verbose descriptions."""

    catalog = lookup_jd_catalog()
    return {
        "jd_fields": [
            {"id": f["id"], "name": f["name"], "scope": f["scope"], "owner_a": f["owner_a"]}
            for f in catalog["jd_fields"]
        ],
    }


def _save_raw_request(run_id: str, operation: str, messages: list[dict[str, str]]) -> Path:
    output_dir = ROOT / ".agent_runs"
    output_dir.mkdir(exist_ok=True)
    path = output_dir / f"{run_id}_input_{operation}.txt"
    parts: list[str] = []
    for msg in messages:
        parts.append(f"=== {msg['role']} ({len(msg['content'])} chars) ===\n{msg['content']}")
    path.write_text(
        f"run_id: {run_id}\noperation: {operation}\n"
        f"total_messages: {len(messages)}\n"
        f"total_chars: {sum(len(m['content']) for m in messages)}\n\n"
        + "\n\n".join(parts),
        encoding="utf-8",
    )
    return path


def _extract_tool_trace(history: Any) -> list[ToolTrace]:
    trace: list[ToolTrace] = []
    for content in history or []:
        for part in getattr(content, "parts", None) or []:
            function_call = getattr(part, "function_call", None)
            if function_call and function_call.name:
                name = str(function_call.name)
                trace.append(ToolTrace(tool=name, status="called"))
            function_response = getattr(part, "function_response", None)
            if function_response and function_response.name:
                name = str(function_response.name)
                trace.append(ToolTrace(tool=name, status="completed"))
    return trace


def _scenario_evidence_text(fixed_scenario: dict[str, Any]) -> str:
    parts = [fixed_scenario.get("title", ""), fixed_scenario.get("summary", "")]
    parts.extend(fixed_scenario.get("fixed_boundary", []))
    for item in fixed_scenario.get("available_task_modules", []):
        parts.extend([item.get("name", ""), item.get("requirement", "")])
    for item in fixed_scenario.get("variable_bindings", []):
        parts.extend([item.get("name", ""), item.get("value_or_domain", "")])
    for item in fixed_scenario.get("runtime_dependencies", []):
        parts.extend([item.get("dependency_id", ""), item.get("responsibility", "")])
    return "\n".join(str(item) for item in parts if item)


def validate_candidate(
    candidate: AgentCandidate,
    task_description: str,
    fixed_scenario: dict[str, Any] | None = None,
) -> list[ValidationIssue]:
    fixed_scenario = fixed_scenario or load_fixed_scenario()
    scenario_evidence = _scenario_evidence_text(fixed_scenario)
    catalog = load_reference_catalog()
    backbone = load_template_backbone()
    cells = gal_cell_index()
    jd_fields = jd_field_index()
    allowed_cells = set(cells)
    allowed_jd = set(jd_fields)
    issues: list[ValidationIssue] = []

    if candidate.catalog_versions and candidate.catalog_versions != catalog["source_versions"]:
        issues.append(ValidationIssue(
            code="CATALOG_VERSION_MISMATCH",
            message="Candidate catalog versions do not match the active reviewed dictionaries.",
            path="catalog_versions",
        ))

    coverage_ids = [item.cell for item in candidate.coverage_candidates]
    if len(coverage_ids) != len(set(coverage_ids)):
        issues.append(ValidationIssue(
            code="DUPLICATE_GAL_CELL",
            message="Coverage candidates contain a duplicate A×L cell.",
            path="coverage_candidates",
        ))

    for index, item in enumerate(candidate.coverage_candidates):
        if item.cell not in allowed_cells:
            issues.append(ValidationIssue(
                code="UNKNOWN_GAL_CELL",
                message=f"{item.cell} is outside the reviewed demo catalog.",
                path=f"coverage_candidates[{index}].cell",
            ))
        elif len(item.responsibilities) < len(cells[item.cell]["cumulative_levels"]):
            issues.append(ValidationIssue(
                code="INCOMPLETE_CUMULATIVE_RESPONSIBILITY",
                message=f"{item.cell} must retain one explicit responsibility for each inherited level.",
                path=f"coverage_candidates[{index}].responsibilities",
            ))
        if item.status != "TBD" and item.evidence_quote not in task_description:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="Coverage evidence is not an exact input substring.",
                path=f"coverage_candidates[{index}].evidence_quote",
            ))
        if item.provenance == "human_edited" and not item.source_note:
            issues.append(ValidationIssue(
                code="HUMAN_VALUE_MISSING_SOURCE",
                message="Human-edited A×L levels require a source note.",
                path=f"coverage_candidates[{index}].source_note",
            ))

    for index, item in enumerate(candidate.jd_candidates):
        if item.slot_id not in allowed_jd:
            issues.append(ValidationIssue(
                code="UNKNOWN_JD_SLOT",
                message=f"{item.slot_id} is outside the reviewed demo catalog.",
                path=f"jd_candidates[{index}].slot_id",
            ))
        if item.provenance in {"human_added", "human_edited"} and item.status != "TBD" and not item.source_note:
            issues.append(ValidationIssue(
                code="HUMAN_VALUE_MISSING_SOURCE",
                message="Human-added or edited JD values require a source note.",
                path=f"jd_candidates[{index}].source_note",
            ))
        elif item.provenance == "scenario_fixed" and item.status == "given" and item.evidence_quote not in scenario_evidence:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="Scenario-fixed JD with status=given requires an exact fixed-scenario substring.",
                path=f"jd_candidates[{index}].evidence_quote",
            ))
        elif item.provenance == "agent_extracted" and item.status == "given" and item.evidence_quote not in task_description:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="JD with status=given requires an exact input substring; use status=proposed for inferred values.",
                path=f"jd_candidates[{index}].evidence_quote",
            ))
        canonical = jd_fields.get(item.slot_id)
        if canonical and item.name != canonical["name"]:
            issues.append(ValidationIssue(
                code="JD_NAME_MISMATCH",
                message=f"{item.slot_id} must use canonical name {canonical['name']}.",
                path=f"jd_candidates[{index}].name",
            ))

    emitted_ids = [item.slot_id for item in candidate.jd_candidates]
    if len(emitted_ids) != len(set(emitted_ids)):
        issues.append(ValidationIssue(
            code="DUPLICATE_JD_SLOT",
            message="JD candidates contain a duplicate slot ID.",
            path="jd_candidates",
        ))

    for index, item in enumerate(candidate.runtime_dependencies):
        if item.scored:
            issues.append(ValidationIssue(
                code="RUNTIME_DEPENDENCY_MARKED_SCORED",
                message="Runtime dependencies must remain unscored.",
                path=f"runtime_dependencies[{index}].scored",
            ))
        if item.provenance in {"human_added", "human_edited"} and item.status != "TBD" and not item.source_note:
            issues.append(ValidationIssue(
                code="HUMAN_VALUE_MISSING_SOURCE",
                message="Human-added or edited dependencies require a source note.",
                path=f"runtime_dependencies[{index}].source_note",
            ))
        elif item.provenance == "scenario_fixed" and item.status != "TBD" and item.evidence_quote not in scenario_evidence:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="Scenario-fixed dependency evidence is not an exact fixed-scenario substring.",
                path=f"runtime_dependencies[{index}].evidence_quote",
            ))
        elif item.provenance == "agent_extracted" and item.status != "TBD" and item.evidence_quote not in task_description:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="Dependency evidence is not an exact input substring.",
                path=f"runtime_dependencies[{index}].evidence_quote",
            ))

    required_slots = set(backbone["base_slots"])
    for item in candidate.coverage_candidates:
        if item.cell in cells:
            required_slots.update(cells[item.cell]["required_jd_ids"])
    emitted_slots = {item.slot_id for item in candidate.jd_candidates}
    for slot in sorted(required_slots - emitted_slots):
        issues.append(ValidationIssue(
            code="MISSING_REQUIRED_JD_SLOT",
            message=f"Required template-backbone slot {slot} was omitted; emit it as TBD when unknown.",
            path="jd_candidates",
        ))
    if re.search(r"(?:A\d+[a-z]?\s*[×x]\s*L[1-4]|\bjd-[0-9a-z.]+\b|\bGAL\b)", candidate.natural_language_template, re.IGNORECASE):
        issues.append(ValidationIssue(
            code="INTERNAL_LABEL_IN_NARRATIVE",
            message="Natural-language template must keep A×L, GAL, and JD identifiers in structured review data only.",
            path="natural_language_template",
        ))
    paragraphs = [item.strip() for item in re.split(r"\n\s*\n", candidate.natural_language_template) if item.strip()]
    if len(paragraphs) < len(backbone["paragraph_sequence"]):
        issues.append(ValidationIssue(
            code="INCOMPLETE_TEMPLATE_STRUCTURE",
            message="Natural-language template must follow the seven-paragraph DOCX backbone.",
            path="natural_language_template",
        ))
    return issues


def validate_narrative_draft(draft: NarrativeDraft) -> list[ValidationIssue]:
    """Validate the first-call artifact without attempting A×L/JD classification."""

    issues: list[ValidationIssue] = []
    narrative = draft.expanded_narrative
    complete_output = "\n".join([draft.task_title, narrative, *draft.open_questions, *draft.warnings])
    if re.search(r"(?:A\d+[a-z]?\s*[×x]\s*L[1-4]|\bjd-[0-9a-z.]+\b|\bGAL\b)", complete_output, re.IGNORECASE):
        issues.append(ValidationIssue(
            code="INTERNAL_LABEL_IN_NARRATIVE",
            message="第一次调用生成的任务文案不得包含 A×L、GAL 或 JD 标识。",
            path="expanded_narrative",
        ))
    paragraphs = [item.strip() for item in re.split(r"\n\s*\n", narrative) if item.strip()]
    required_count = len(load_template_backbone()["paragraph_sequence"])
    if len(paragraphs) < required_count:
        issues.append(ValidationIssue(
            code="INCOMPLETE_TEMPLATE_STRUCTURE",
            message=f"扩充文案至少应包含 {required_count} 个实质段落。",
            path="expanded_narrative",
        ))
    return issues


class NarrativeAgent:
    """Call 1: turn a short human request into editable business prose."""

    def __init__(self, api_key: str, model: str) -> None:
        self.model = model
        self.client = _create_client(api_key)

    def expand(
        self,
        short_task_description: str,
        *,
        fixed_scenario: dict[str, Any] | None = None,
        run_id: str | None = None,
        progress: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> NarrativeRunResult:
        if len(short_task_description.strip()) < 10:
            raise ConfigAgentError("任务描述过短；请用一到三句话说明希望无人机做什么。")

        fixed_scenario = fixed_scenario or load_fixed_scenario()
        emit = progress or (lambda _event, _details: None)
        agent_input = json.dumps({
            "fixed_scenario": fixed_scenario,
            "short_human_task_request": short_task_description,
            "narrative_backbone": load_template_backbone()["paragraph_sequence"],
        }, ensure_ascii=False)

        system_content = NARRATIVE_SYSTEM_INSTRUCTION + _schema_instruction(NarrativeDraft)
        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": agent_input},
        ]
        _save_raw_request(run_id or "unknown", "narrative_expand", messages)
        emit("model_request_started", {
            "model": self.model,
            "operation": "narrative_expand",
            "timeout_seconds": 90,
            "input_chars": len(system_content) + len(agent_input),
        })
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.2,
                max_tokens=8192,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            emit("model_request_failed", {"error": str(exc)[:500]})
            raise _model_error(exc) from exc
        emit("model_response_received", {"model": self.model, "operation": "narrative_expand"})

        raw_text = response.choices[0].message.content or ""
        finish_reason = getattr(response.choices[0], "finish_reason", None) if response.choices else None
        draft = _parse_model_json(
            raw_text, NarrativeDraft,
            run_id=run_id or "unknown",
            operation="narrative_expand",
            finish_reason=finish_reason,
            emit=emit,
        )

        draft = draft.model_copy(update={
            "expanded_narrative": _normalize_narrative_linebreaks(draft.expanded_narrative).strip(),
        })

        issues = validate_narrative_draft(draft)
        emit("narrative_validated", {"issue_count": len(issues)})
        return NarrativeRunResult(
            run_id=run_id or f"agent-draft-{uuid.uuid4().hex[:12]}",
            model=self.model,
            draft=draft,
            validation_status="needs_review" if issues else "pass",
            validation_issues=issues,
            usage=_usage_dict(response),
        )


class ConfigAgent:
    def __init__(self, api_key: str, model: str) -> None:
        self.model = model
        self.client = _create_client(api_key)

    def analyze(
        self,
        task_description: str,
        *,
        fixed_scenario: dict[str, Any] | None = None,
        run_id: str | None = None,
        progress: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> AgentRunResult:
        if len(task_description.strip()) < 300:
            raise ConfigAgentError("确认后的任务文案过短；请先完成第一次文案扩充，并在人工复核后再进行能力分类。")

        fixed_scenario = fixed_scenario or load_fixed_scenario()
        emit = progress or (lambda _event, _details: None)
        trace: list[ToolTrace] = []
        total_usage: dict[str, int | float | str | None] = {}

        # --- Local tool calls (deterministic, no model) ------------------- #
        emit("tool_called", {"tool": "lookup_gal_catalog"})
        trace.append(ToolTrace(tool="lookup_gal_catalog", status="called"))
        gal_catalog = _condensed_gal_catalog()
        trace.append(ToolTrace(tool="lookup_gal_catalog", status="completed"))
        emit("tool_completed", {"tool": "lookup_gal_catalog"})

        emit("tool_called", {"tool": "lookup_jd_catalog"})
        trace.append(ToolTrace(tool="lookup_jd_catalog", status="called"))
        jd_catalog = _condensed_jd_catalog()
        trace.append(ToolTrace(tool="lookup_jd_catalog", status="completed"))
        emit("tool_completed", {"tool": "lookup_jd_catalog"})

        # --- Sub-call 2a: coverage classification ------------------------- #
        coverage_input = json.dumps({
            "fixed_scenario": fixed_scenario,
            "confirmed_task_narrative": task_description,
            "gal_catalog": gal_catalog,
        }, ensure_ascii=False)

        cov_sys = COVERAGE_INSTRUCTION + _schema_instruction(CoverageResult)
        cov_messages = [
            {"role": "system", "content": cov_sys},
            {"role": "user", "content": coverage_input},
        ]
        _save_raw_request(run_id or "unknown", "coverage", cov_messages)
        emit("model_request_started", {"model": self.model, "operation": "coverage", "timeout_seconds": 90})
        try:
            cov_response = self.client.chat.completions.create(
                model=self.model,
                messages=cov_messages,
                temperature=0.15,
                max_tokens=4096,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            emit("model_request_failed", {"error": str(exc)[:500]})
            raise _model_error(exc) from exc
        emit("model_response_received", {"model": self.model, "operation": "coverage"})
        total_usage = _merge_usage(total_usage, _usage_dict(cov_response))

        cov_raw = cov_response.choices[0].message.content or ""
        cov_finish = getattr(cov_response.choices[0], "finish_reason", None) if cov_response.choices else None
        coverage_result = _parse_model_json(
            cov_raw, CoverageResult,
            run_id=run_id or "unknown",
            operation="coverage",
            finish_reason=cov_finish,
            emit=emit,
        )

        # --- Sub-call 2b: JD / dependency extraction ---------------------- #
        coverage_summary = [
            {"cell": c.cell, "required_jd_ids": _lookup_required_jds(c.cell, gal_catalog)}
            for c in coverage_result.coverage_candidates
        ]
        extraction_input = json.dumps({
            "fixed_scenario": fixed_scenario,
            "confirmed_task_narrative": task_description,
            "coverage_cells": coverage_summary,
            "base_backbone_slots": load_template_backbone().get("base_slots", ["jd-0.2", "jd-0.7"]),
            "jd_catalog": jd_catalog,
        }, ensure_ascii=False)

        ext_sys = EXTRACTION_INSTRUCTION + _schema_instruction(ExtractionResult)
        ext_messages = [
            {"role": "system", "content": ext_sys},
            {"role": "user", "content": extraction_input},
        ]
        _save_raw_request(run_id or "unknown", "extraction", ext_messages)
        emit("model_request_started", {"model": self.model, "operation": "extraction", "timeout_seconds": 90})
        try:
            ext_response = self.client.chat.completions.create(
                model=self.model,
                messages=ext_messages,
                temperature=0.15,
                max_tokens=4096,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            emit("model_request_failed", {"error": str(exc)[:500]})
            raise _model_error(exc) from exc
        emit("model_response_received", {"model": self.model, "operation": "extraction"})
        total_usage = _merge_usage(total_usage, _usage_dict(ext_response))

        ext_raw = ext_response.choices[0].message.content or ""
        ext_finish = getattr(ext_response.choices[0], "finish_reason", None) if ext_response.choices else None
        extraction_result = _parse_model_json(
            ext_raw, ExtractionResult,
            run_id=run_id or "unknown",
            operation="extraction",
            finish_reason=ext_finish,
            emit=emit,
        )

        # --- Merge sub-results into AgentCandidate ------------------------ #
        candidate = AgentCandidate(
            catalog_versions=load_reference_catalog()["source_versions"].copy(),
            task_title=coverage_result.task_title,
            scenario_summary=coverage_result.scenario_summary,
            coverage_candidates=coverage_result.coverage_candidates,
            responsibility_boundaries=coverage_result.responsibility_boundaries,
            jd_candidates=extraction_result.jd_candidates,
            runtime_dependencies=extraction_result.runtime_dependencies,
            open_questions=extraction_result.open_questions,
            warnings=extraction_result.warnings,
            natural_language_template=task_description,
        )

        issues = validate_candidate(candidate, task_description, fixed_scenario)
        emit("candidate_validated", {"issue_count": len(issues)})
        return AgentRunResult(
            run_id=run_id or f"agent-{uuid.uuid4().hex[:12]}",
            model=self.model,
            candidate=candidate,
            validation_status="needs_review" if issues else "pass",
            validation_issues=issues,
            tool_trace=trace,
            usage=total_usage,
        )


def save_narrative_run(
    short_task_description: str,
    result: NarrativeRunResult,
    fixed_scenario: dict[str, Any] | None = None,
) -> Path:
    fixed_scenario = fixed_scenario or load_fixed_scenario()
    output_dir = ROOT / ".agent_runs"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"{result.run_id}.json"
    output_path.write_text(
        json.dumps({
            "artifact_type": "narrative_expansion_run",
            "fixed_scenario": {
                "scenario_id": fixed_scenario["scenario_id"],
                "scenario_version": fixed_scenario["scenario_version"],
            },
            "short_task_description": short_task_description,
            "result": result.model_dump(mode="json"),
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output_path


def save_agent_run(
    task_description: str,
    result: AgentRunResult,
    fixed_scenario: dict[str, Any] | None = None,
    *,
    source_task_description: str | None = None,
    narrative_parent_run_id: str | None = None,
) -> Path:
    fixed_scenario = fixed_scenario or load_fixed_scenario()
    output_dir = ROOT / ".agent_runs"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"{result.run_id}.json"
    output_path.write_text(
        json.dumps({
            "artifact_type": "classification_and_extraction_run",
            "fixed_scenario": {
                "scenario_id": fixed_scenario["scenario_id"],
                "scenario_version": fixed_scenario["scenario_version"],
            },
            "source_task_description": source_task_description,
            "confirmed_task_narrative": task_description,
            "narrative_parent_run_id": narrative_parent_run_id,
            "result": result.model_dump(mode="json"),
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output_path
