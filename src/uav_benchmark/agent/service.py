"""Provider-neutral Config Agent and deterministic post-validation."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any, Callable

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
    FillTbdResult,
    JDCandidate,
    NarrativeDraft,
    NarrativeRunResult,
    ToolTrace,
    ValidationIssue,
)
from .providers import (
    ProviderError,
    StructuredResponse,
    create_provider,
    response_schema,
)


NARRATIVE_SYSTEM_INSTRUCTION = """
You are TaskNarrativeAgent, the first call in a two-call UAV benchmark pipeline.

Input contains one fixed business scenario, a short colloquial human task
request, and optional target_coverage (human-selected ability levels with
cumulative responsibilities). Expand them into a detailed Chinese task
narrative for human review.

Mandatory rules:
- This call writes business prose only. Do not classify GAL or A×L and do not
  extract or display JD identifiers.
- Do not mention A×L, GAL, jd-x.x, JSON, schema fields, prompts, or agent internals.
- If target_coverage is provided, treat it as the intended scored responsibility
  set. Shape nominal behavior, continuity, anomaly handling, human roles, and
  outputs so they match those cumulative responsibilities. Do not invent
  obligations for abilities that are absent from target_coverage.
- Use the fixed scenario as context, but include only task modules requested or
  necessarily implied by the short human request and target_coverage. A scene's
  available module is not automatically part of this task.
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
- Optional scenario context must not preselect A×L. Do not copy historical case coverage.
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

Input contains: fixed_scenario, confirmed_task_narrative, the compact GAL
catalog (cell IDs, ability names, required JD IDs per cell, cumulative level
count), and optional preferred_coverage (human-selected target cells).

Rules:
- If preferred_coverage is provided, emit exactly those cells as
  coverage_candidates (same cell IDs and levels). Do not add extra scored A×L
  cells unless the narrative clearly requires an anomaly/auxiliary cell; when
  adding, mark role="anomaly" or "auxiliary" and explain in source_note.
- If preferred_coverage is absent, infer A and L from behavioral verbs,
  continuity, anomaly response, human decision role, and requested outputs.
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


FILL_TBD_INSTRUCTION = """
You are the JDDomainFill sub-agent in a UAV benchmark pipeline.

Your job is to REPLACE previously TBD JD slots with concrete variable domains.
You receive the confirmed task narrative, optional scenario context, already
resolved JD domains (for consistency), and the TBD slots that still need domains.

For EACH TBD slot, choose binding_mode and fill the domain:
1. fixed  — set value to one Chinese phrase inferred from the narrative/scenario
2. enum   — set allowed_values (>=2) and optional default value
3. range  — set numeric minimum/maximum when the slot is continuous
4. TBD    — only if still impossible; then source_note MUST explain what is missing

Rules:
- Prefer fixed/enum/range over TBD. Infer qualitatively even when thresholds are unknown.
- Keep names and slot_id exactly as provided; do not invent new slot IDs.
- status="proposed" for inferred domains; evidence_quote from narrative when possible.
- provenance="agent_extracted" (or scenario_fixed when clearly from scenario).
- Return ONLY the slots that were TBD in the input (same slot_id set).
- Express values in Chinese except numeric ranges and fixed IDs.
""".strip()


EXTRACTION_INSTRUCTION = """
You are the JDExtraction sub-agent in a UAV benchmark pipeline.

Your job is to define VARIABLE DOMAINS for each required JD slot — not to fill
in a single concrete value. One template will later be instantiated many times
with different seeds, and each seed picks a concrete value from the domain you
define here.

Input contains: fixed_scenario, confirmed_task_narrative, the selected
coverage_cells (with their required_jd_ids), and the compact JD catalog
(slot IDs and canonical names).

For EACH required JD slot, choose a binding_mode and define its domain:

1. binding_mode="fixed"   — the value is determined by the scenario or task
   and should NOT vary across instances. Use for fixed facts.
   Set value to the single confirmed value. Example:
   jd-0.2: binding_mode="fixed", value="高速公路巡检走廊"

2. binding_mode="enum"    — there is a closed set of meaningful options.
   Set allowed_values to the full list. Set value to the recommended default.
   Example:
   jd-5.1: binding_mode="enum", allowed_values=["车辆","行人","非机动车","道路设施"],
           value="车辆"

3. binding_mode="range"   — the variable is numeric and varies continuously.
   Set minimum and maximum. Set value to null.
   Example:
   jd-0.1: binding_mode="range", minimum=60, maximum=300, value=null

4. binding_mode="TBD"     — truly cannot determine the domain.
   Set value=null, allowed_values=[], minimum=null, maximum=null.

Rules:
- Emit every required JD slot (from coverage required_jd_ids AND base backbone
  ["jd-0.2", "jd-0.7"]). Never omit a slot.
- You MUST analyze the confirmed_task_narrative and propose a domain for each
  slot. Empty "—" / null domains are a failure mode, not the default.
- Especially for task-derived slots such as jd-0.7 (任务完成判据), jd-0.1
  (任务时长), object catalogs, and completion/safety criteria: infer a
  fixed value or enum/range from the narrative. Do not leave them TBD just
  because a numeric threshold is missing — propose the qualitative criterion
  or a closed option set instead.
- PREFER enum or range over fixed when the variable could legitimately vary
  across benchmark instances. The more variables have non-trivial domains,
  the more diverse later 特定任务模版 seeds can be.
- PREFER fixed or enum over TBD. Infer reasonable domains from task context,
  scenario, and UAV domain knowledge. Only use TBD when truly nothing can be
  inferred even qualitatively.
- If binding_mode="TBD", you MUST set source_note to a short Chinese reason
  (what is missing) and preferably add an open_question. Never emit TBD with
  an empty explanation.
- For scenario-fixed facts (workspace, object types from scenario): use
  provenance="scenario_fixed". For task-inferred domains: provenance="agent_extracted".
- Use canonical JD names exactly as given in the catalog.
- status: "given" if directly stated in narrative; "proposed" if inferred; "TBD" if unknown.
- evidence_quote: exact narrative substring for status="given"; closest text or "" for "proposed".
- runtime_dependencies must have scored=false.
- Express domains and values in Chinese except fixed IDs and numeric ranges.
""".strip()


class ConfigAgentError(RuntimeError):
    """A user-safe Config Agent failure."""


def structured_output_schema(model: type = AgentCandidate) -> dict[str, Any]:
    """Backward-compatible public helper for transport schema inspection."""

    return response_schema(model)


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


def _save_debug_response(run_id: str, operation: str, raw_text: str, finish_reason: str | None,
                         reasoning: str | None = None) -> Path:
    output_dir = ROOT / ".agent_runs"
    output_dir.mkdir(exist_ok=True)
    debug_path = output_dir / f"{run_id}_raw_{operation}.txt"
    lines = [
        f"run_id: {run_id}",
        f"operation: {operation}",
        f"finish_reason: {finish_reason}",
        f"content_length: {len(raw_text)}",
    ]
    if reasoning:
        lines.append(f"reasoning_length: {len(reasoning)}")
        lines.append(f"---reasoning---\n{reasoning[:2000]}")
    lines.append(f"---raw---\n{raw_text}")
    debug_path.write_text("\n".join(lines), encoding="utf-8")
    return debug_path


def _parse_model_json(
    raw_text: str,
    model_cls: type,
    *,
    run_id: str,
    operation: str,
    finish_reason: str | None,
    reasoning: str | None = None,
    provider_name: str = "model",
    emit: Callable[[str, dict[str, Any]], None] | None = None,
):
    """Parse a JSON response into *model_cls*, saving a debug dump on failure."""

    text = _extract_json(raw_text)
    try:
        return model_cls.model_validate_json(text)
    except Exception as exc:
        debug_path = _save_debug_response(run_id, operation, raw_text, finish_reason, reasoning)
        snippet = raw_text[:300].replace("\n", "\\n")
        detail = str(exc)[:500]
        label = "Gemini" if provider_name == "gemini" else "DeepSeek" if provider_name == "deepseek" else "模型"
        if finish_reason and "length" in str(finish_reason).lower():
            raise ConfigAgentError(
                f"{label} 返回被截断，JSON 不完整。"
                f"原始响应已保存到 {debug_path.name}。"
            ) from exc
        raise ConfigAgentError(
            f"{label} 返回的 JSON 无法解析为 {model_cls.__name__}。\n"
            f"错误：{detail}\n"
            f"原始响应已保存到 {debug_path.name}。\n"
            f"响应片段（前300字符）：{snippet}"
        ) from exc


def _validated_response(
    response: StructuredResponse,
    model_cls: type,
    *,
    run_id: str,
    operation: str,
    provider_name: str,
    emit: Callable[[str, dict[str, Any]], None] | None = None,
):
    if response.parsed is not None:
        try:
            if isinstance(response.parsed, model_cls):
                return response.parsed
            return model_cls.model_validate(response.parsed)
        except Exception:
            # Fall through to raw-text parsing so the debug artifact remains
            # consistent across providers.
            pass
    return _parse_model_json(
        response.raw_text,
        model_cls,
        run_id=run_id,
        operation=operation,
        finish_reason=response.finish_reason,
        reasoning=response.reasoning,
        provider_name=provider_name,
        emit=emit,
    )


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


def _resolve_target_coverage(cells: list[str] | None) -> list[dict[str, Any]]:
    """Validate human-selected A×L cells and attach cumulative responsibilities."""

    if not cells:
        return []
    index = gal_cell_index()
    resolved: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in cells:
        cell = str(raw or "").strip()
        if not cell or cell in seen:
            continue
        item = index.get(cell)
        if not item:
            raise ConfigAgentError(f"未知 coverage cell: {cell}")
        seen.add(cell)
        resolved.append({
            "cell": item["cell"],
            "a_id": item["a_id"],
            "level": item["level"],
            "ability": item["ability"],
            "level_label": item["level_label"],
            "cumulative_responsibilities": item.get("cumulative_responsibilities") or [],
            "required_jd_ids": item.get("required_jd_ids") or [],
        })
    return resolved


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
            message="候选结果使用的目录版本与当前审定字典不一致。",
            path="catalog_versions",
        ))

    coverage_ids = [item.cell for item in candidate.coverage_candidates]
    if len(coverage_ids) != len(set(coverage_ids)):
        issues.append(ValidationIssue(
            code="DUPLICATE_GAL_CELL",
            message="Coverage 中出现了重复的 A×L 单元。",
            path="coverage_candidates",
        ))

    for index, item in enumerate(candidate.coverage_candidates):
        if item.cell not in allowed_cells:
            issues.append(ValidationIssue(
                code="UNKNOWN_GAL_CELL",
                message=f"{item.cell} 不在当前审定目录中。",
                path=f"coverage_candidates[{index}].cell",
            ))
        elif len(item.responsibilities) < len(cells[item.cell]["cumulative_levels"]):
            issues.append(ValidationIssue(
                code="INCOMPLETE_CUMULATIVE_RESPONSIBILITY",
                message=f"{item.cell} 需为每个继承等级各写一条责任（累计覆盖）。",
                path=f"coverage_candidates[{index}].responsibilities",
            ))
        if item.status != "TBD" and item.evidence_quote not in task_description:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="A×L 证据摘录不是任务文案中的原文子串。",
                path=f"coverage_candidates[{index}].evidence_quote",
            ))
        if item.provenance == "human_edited" and not item.source_note:
            issues.append(ValidationIssue(
                code="HUMAN_VALUE_MISSING_SOURCE",
                message="人工修改的 A×L 等级需要填写来源说明。",
                path=f"coverage_candidates[{index}].source_note",
            ))

    for index, item in enumerate(candidate.jd_candidates):
        if item.slot_id not in allowed_jd:
            issues.append(ValidationIssue(
                code="UNKNOWN_JD_SLOT",
                message=f"{item.slot_id} 不在当前审定 JD 目录中。",
                path=f"jd_candidates[{index}].slot_id",
            ))
        if item.provenance in {"human_added", "human_edited"} and item.status != "TBD" and not item.source_note:
            issues.append(ValidationIssue(
                code="HUMAN_VALUE_MISSING_SOURCE",
                message="人工新增或修改的 JD 需要填写来源说明。",
                path=f"jd_candidates[{index}].source_note",
            ))
        elif item.provenance == "scenario_fixed" and item.status == "given" and item.evidence_quote not in scenario_evidence:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="场景固定 JD（status=given）的证据需是场景文本中的原文子串。",
                path=f"jd_candidates[{index}].evidence_quote",
            ))
        elif item.provenance == "agent_extracted" and item.status == "given" and item.evidence_quote not in task_description:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="JD 标为 given 时，证据需是任务文案原文；若为推断值请改用 proposed。",
                path=f"jd_candidates[{index}].evidence_quote",
            ))
        canonical = jd_fields.get(item.slot_id)
        if canonical and item.name != canonical["name"]:
            issues.append(ValidationIssue(
                code="JD_NAME_MISMATCH",
                message=f"{item.slot_id} 应使用规范名称「{canonical['name']}」。",
                path=f"jd_candidates[{index}].name",
            ))

    emitted_ids = [item.slot_id for item in candidate.jd_candidates]
    if len(emitted_ids) != len(set(emitted_ids)):
        issues.append(ValidationIssue(
            code="DUPLICATE_JD_SLOT",
            message="JD 候选中出现了重复的 slot ID。",
            path="jd_candidates",
        ))

    for index, item in enumerate(candidate.runtime_dependencies):
        if item.scored:
            issues.append(ValidationIssue(
                code="RUNTIME_DEPENDENCY_MARKED_SCORED",
                message="运行时依赖必须保持不计分（scored=false）。",
                path=f"runtime_dependencies[{index}].scored",
            ))
        if item.provenance in {"human_added", "human_edited"} and item.status != "TBD" and not item.source_note:
            issues.append(ValidationIssue(
                code="HUMAN_VALUE_MISSING_SOURCE",
                message="人工新增或修改的依赖需要填写来源说明。",
                path=f"runtime_dependencies[{index}].source_note",
            ))
        elif item.provenance == "scenario_fixed" and item.status != "TBD" and item.evidence_quote not in scenario_evidence:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="场景固定依赖的证据需是场景文本中的原文子串。",
                path=f"runtime_dependencies[{index}].evidence_quote",
            ))
        elif item.provenance == "agent_extracted" and item.status != "TBD" and item.evidence_quote not in task_description:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="依赖证据不是任务文案中的原文子串。",
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
            message=f"缺少必填 JD 槽位 {slot}；未知时应以 TBD 形式输出。",
            path="jd_candidates",
        ))
    if re.search(r"(?:A\d+[a-z]?\s*[×x]\s*L[1-4]|\bjd-[0-9a-z.]+\b|\bGAL\b)", candidate.natural_language_template, re.IGNORECASE):
        issues.append(ValidationIssue(
            code="INTERNAL_LABEL_IN_NARRATIVE",
            message="自然语言模版不得出现 A×L、GAL、JD 标识，这些应只留在结构化字段中。",
            path="natural_language_template",
        ))
    paragraphs = [item.strip() for item in re.split(r"\n\s*\n", candidate.natural_language_template) if item.strip()]
    if len(paragraphs) < len(backbone["paragraph_sequence"]):
        issues.append(ValidationIssue(
            code="INCOMPLETE_TEMPLATE_STRUCTURE",
            message="自然语言模版需遵循七段式骨干结构。",
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

    def __init__(self, api_key: str, model: str, *, provider: str = "deepseek", transport: Any | None = None) -> None:
        self.model = model
        self.provider = provider
        self.transport = transport or create_provider(provider, api_key=api_key, model=model)

    def expand(
        self,
        short_task_description: str,
        *,
        fixed_scenario: dict[str, Any] | None = None,
        target_coverage: list[str] | None = None,
        run_id: str | None = None,
        progress: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> NarrativeRunResult:
        if len(short_task_description.strip()) < 10:
            raise ConfigAgentError("任务描述过短；请用一到三句话说明希望无人机做什么。")

        fixed_scenario = fixed_scenario or load_fixed_scenario()
        resolved_coverage = _resolve_target_coverage(target_coverage)
        emit = progress or (lambda _event, _details: None)
        agent_input = json.dumps({
            "fixed_scenario": fixed_scenario,
            "short_human_task_request": short_task_description,
            "target_coverage": resolved_coverage,
            "coverage_note": (
                "Human-selected scored A×L targets. Match responsibilities in prose; "
                "do not print cell IDs. Unlisted abilities are out of scope."
                if resolved_coverage else
                "No human coverage target; expand only from the short request."
            ),
            "narrative_backbone": load_template_backbone()["paragraph_sequence"],
        }, ensure_ascii=False)

        system_content = NARRATIVE_SYSTEM_INSTRUCTION
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
            response = self.transport.generate(
                system_instruction=system_content,
                user_content=agent_input,
                response_model=NarrativeDraft,
                temperature=0.2,
                max_output_tokens=8192,
            )
        except ProviderError as exc:
            emit("model_request_failed", {"error": str(exc)[:500]})
            raise ConfigAgentError(str(exc)) from exc
        emit("model_response_received", {"provider": self.provider, "model": self.model, "operation": "narrative_expand"})

        draft = _validated_response(
            response,
            NarrativeDraft,
            run_id=run_id or "unknown",
            operation="narrative_expand",
            provider_name=self.provider,
            emit=emit,
        )

        draft = draft.model_copy(update={
            "expanded_narrative": _normalize_narrative_linebreaks(draft.expanded_narrative).strip(),
        })

        issues = validate_narrative_draft(draft)
        emit("narrative_validated", {"issue_count": len(issues)})
        return NarrativeRunResult(
            run_id=run_id or f"agent-draft-{uuid.uuid4().hex[:12]}",
            provider=self.provider,
            model=self.model,
            draft=draft,
            validation_status="needs_review" if issues else "pass",
            validation_issues=issues,
            usage=response.usage,
        )


class ConfigAgent:
    def __init__(self, api_key: str, model: str, *, provider: str = "deepseek", transport: Any | None = None) -> None:
        self.model = model
        self.provider = provider
        self.transport = transport or create_provider(provider, api_key=api_key, model=model)

    def analyze(
        self,
        task_description: str,
        *,
        fixed_scenario: dict[str, Any] | None = None,
        preferred_coverage: list[str] | None = None,
        run_id: str | None = None,
        progress: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> AgentRunResult:
        if len(task_description.strip()) < 300:
            raise ConfigAgentError("确认后的任务文案过短；请先完成第一次文案扩充，并在人工复核后再进行能力分类。")

        fixed_scenario = fixed_scenario or load_fixed_scenario()
        preferred = _resolve_target_coverage(preferred_coverage)
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
            "preferred_coverage": [
                {"cell": item["cell"], "a_id": item["a_id"], "level": item["level"], "ability": item["ability"]}
                for item in preferred
            ],
            "gal_catalog": gal_catalog,
        }, ensure_ascii=False)

        cov_sys = COVERAGE_INSTRUCTION
        cov_messages = [
            {"role": "system", "content": cov_sys},
            {"role": "user", "content": coverage_input},
        ]
        _save_raw_request(run_id or "unknown", "coverage", cov_messages)
        emit("model_request_started", {"model": self.model, "operation": "coverage", "timeout_seconds": 90})
        try:
            cov_response = self.transport.generate(
                system_instruction=cov_sys,
                user_content=coverage_input,
                response_model=CoverageResult,
                temperature=0.15,
                max_output_tokens=8192,
            )
        except ProviderError as exc:
            emit("model_request_failed", {"error": str(exc)[:500]})
            raise ConfigAgentError(str(exc)) from exc
        emit("model_response_received", {"provider": self.provider, "model": self.model, "operation": "coverage"})
        total_usage = _merge_usage(total_usage, cov_response.usage)

        coverage_result = _validated_response(
            cov_response,
            CoverageResult,
            run_id=run_id or "unknown",
            operation="coverage",
            provider_name=self.provider,
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

        ext_sys = EXTRACTION_INSTRUCTION
        ext_messages = [
            {"role": "system", "content": ext_sys},
            {"role": "user", "content": extraction_input},
        ]
        _save_raw_request(run_id or "unknown", "extraction", ext_messages)
        emit("model_request_started", {"model": self.model, "operation": "extraction", "timeout_seconds": 90})
        try:
            ext_response = self.transport.generate(
                system_instruction=ext_sys,
                user_content=extraction_input,
                response_model=ExtractionResult,
                temperature=0.15,
                max_output_tokens=8192,
            )
        except ProviderError as exc:
            emit("model_request_failed", {"error": str(exc)[:500]})
            raise ConfigAgentError(str(exc)) from exc
        emit("model_response_received", {"provider": self.provider, "model": self.model, "operation": "extraction"})
        total_usage = _merge_usage(total_usage, ext_response.usage)

        extraction_result = _validated_response(
            ext_response,
            ExtractionResult,
            run_id=run_id or "unknown",
            operation="extraction",
            provider_name=self.provider,
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
            provider=self.provider,
            model=self.model,
            candidate=candidate,
            validation_status="needs_review" if issues else "pass",
            validation_issues=issues,
            tool_trace=trace,
            usage=total_usage,
        )

    def fill_tbd_domains(
        self,
        task_description: str,
        *,
        tbd_slots: list[dict[str, Any]],
        resolved_slots: list[dict[str, Any]] | None = None,
        fixed_scenario: dict[str, Any] | None = None,
        run_id: str | None = None,
        progress: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> FillTbdResult:
        """Ask the model to propose domains for previously TBD JD slots only."""

        if not tbd_slots:
            return FillTbdResult(jd_candidates=[], warnings=["no_tbd_slots"])
        if len(task_description.strip()) < 20:
            raise ConfigAgentError("任务文案过短，无法智能填写 TBD 域。")

        fixed_scenario = fixed_scenario or load_fixed_scenario()
        emit = progress or (lambda _event, _details: None)
        payload = {
            "fixed_scenario": {
                "scenario_id": fixed_scenario.get("scenario_id"),
                "title": fixed_scenario.get("title"),
                "summary": fixed_scenario.get("summary"),
            },
            "confirmed_task_narrative": task_description,
            "resolved_jd_domains": resolved_slots or [],
            "tbd_slots": tbd_slots,
        }
        messages = [
            {"role": "system", "content": FILL_TBD_INSTRUCTION + _schema_instruction(FillTbdResult)},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ]
        rid = run_id or f"agent-fill-{uuid.uuid4().hex[:10]}"
        _save_raw_request(rid, "fill_tbd", messages)
        emit("model_request_started", {"model": self.model, "operation": "fill_tbd", "tbd_count": len(tbd_slots)})
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.2,
                max_tokens=4096,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            emit("model_request_failed", {"error": str(exc)[:500]})
            raise _model_error(exc) from exc
        emit("model_response_received", {"model": self.model, "operation": "fill_tbd"})
        raw = response.choices[0].message.content or ""
        finish = getattr(response.choices[0], "finish_reason", None) if response.choices else None
        reasoning = getattr(response.choices[0].message, "reasoning_content", None) or ""
        result = _parse_model_json(
            raw, FillTbdResult,
            run_id=rid,
            operation="fill_tbd",
            finish_reason=finish,
            reasoning=reasoning,
            emit=emit,
        )
        allowed = {str(item.get("slot_id")) for item in tbd_slots if item.get("slot_id")}
        filtered: list[JDCandidate] = [
            item for item in result.jd_candidates if item.slot_id in allowed
        ]
        return FillTbdResult(jd_candidates=filtered, warnings=result.warnings)


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
