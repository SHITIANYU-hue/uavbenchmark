"""Gemini Config Agent and deterministic post-validation."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any, Callable

from google import genai
from google.genai import types

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
- The natural-language template has already been generated and reviewed before
  this call. Copy confirmed_task_narrative exactly into natural_language_template;
  do not rewrite, summarize, expand, or polish it.
- Keep A×L and JD identifiers in the structured fields only. The natural-language
  template must not contain A×L labels, GAL labels, jd-x.x identifiers, or schema names.
- Express selected responsibilities and non-responsibilities in plain business Chinese.
- Return Chinese content except fixed IDs and reason codes.
""".strip()


class ConfigAgentError(RuntimeError):
    """A user-safe Config Agent failure."""


def gemini_response_schema(model: type[AgentCandidate] | type[NarrativeDraft] = AgentCandidate) -> dict[str, Any]:
    """Return an API-compatible schema while keeping local models strict.

    Pydantic emits ``additionalProperties: false`` for ``extra='forbid'``.
    The Gemini response_schema endpoint currently rejects the SDK-serialized
    ``additional_properties`` field, so it is removed only from the transport
    schema. ``AgentCandidate.model_validate`` still rejects extra fields after
    the response returns.
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


def _create_client(api_key: str) -> Any:
    try:
        return genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=90_000,
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )
    except ImportError as exc:
        if "socksio" in str(exc).lower():
            raise ConfigAgentError(
                "检测到 SOCKS 代理，但本地环境缺少 socksio。请重新安装 Agent 依赖："
                ".venv/bin/python -m pip install -e '.[agent,test]'"
            ) from exc
        raise


def _model_error(exc: Exception) -> ConfigAgentError:
    message = str(exc)
    if "API_KEY" in message.upper() or "401" in message or "403" in message:
        return ConfigAgentError("Gemini API Key 无效、无权限或对应模型不可用。")
    if "503" in message or "UNAVAILABLE" in message or "HIGH DEMAND" in message.upper():
        return ConfigAgentError("Gemini 当前临时高负载（503）。本次输入与 Run ID 已保存，请稍后重试。")
    if "429" in message or "RESOURCE_EXHAUSTED" in message:
        return ConfigAgentError("Gemini 请求频率已达到当前额度（429）。请至少等待一分钟后再重试。")
    return ConfigAgentError(f"Gemini 调用失败：{message[:240]}")


def _usage_dict(response: Any) -> dict[str, int | float | str | None]:
    usage_metadata = getattr(response, "usage_metadata", None)
    usage: dict[str, int | float | str | None] = {}
    if usage_metadata is not None:
        for key, value in usage_metadata.model_dump(exclude_none=True).items():
            if isinstance(value, (int, float, str)) or value is None:
                usage[key] = value
    return usage


def _normalize_narrative_linebreaks(value: str) -> str:
    """Convert model-emitted literal newline escapes into real paragraphs."""

    return value.replace("\\r\\n", "\n").replace("\\n", "\n")


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
        elif item.provenance == "scenario_fixed" and item.status != "TBD" and item.evidence_quote not in scenario_evidence:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="Scenario-fixed JD evidence is not an exact fixed-scenario substring.",
                path=f"jd_candidates[{index}].evidence_quote",
            ))
        elif item.provenance == "agent_extracted" and item.status != "TBD" and item.evidence_quote not in task_description:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="JD evidence is not an exact input substring.",
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


class GeminiNarrativeAgent:
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

        emit("model_request_started", {"model": self.model, "operation": "narrative_expand", "timeout_seconds": 90})
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=agent_input,
                config=types.GenerateContentConfig(
                    system_instruction=NARRATIVE_SYSTEM_INSTRUCTION,
                    temperature=0.2,
                    response_mime_type="application/json",
                    response_schema=gemini_response_schema(NarrativeDraft),
                ),
            )
        except Exception as exc:
            emit("model_request_failed", {"error": str(exc)[:500]})
            raise _model_error(exc) from exc
        emit("model_response_received", {"model": self.model, "operation": "narrative_expand"})

        draft = response.parsed
        if draft is None:
            try:
                draft = NarrativeDraft.model_validate_json(response.text)
            except Exception as exc:
                raise ConfigAgentError("Gemini 未返回符合任务文案合同的结构化结果。") from exc
        elif not isinstance(draft, NarrativeDraft):
            draft = NarrativeDraft.model_validate(draft)

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


class GeminiConfigAgent:
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
        emit("tool_called", {"tool": "lookup_gal_catalog"})
        trace.append(ToolTrace(tool="lookup_gal_catalog", status="called"))
        gal_catalog = lookup_gal_catalog()
        trace.append(ToolTrace(tool="lookup_gal_catalog", status="completed"))
        emit("tool_completed", {"tool": "lookup_gal_catalog"})

        emit("tool_called", {"tool": "lookup_jd_catalog"})
        trace.append(ToolTrace(tool="lookup_jd_catalog", status="called"))
        jd_catalog = lookup_jd_catalog()
        trace.append(ToolTrace(tool="lookup_jd_catalog", status="completed"))
        emit("tool_completed", {"tool": "lookup_jd_catalog"})

        agent_input = json.dumps({
            "fixed_scenario": fixed_scenario,
            "confirmed_task_narrative": task_description,
            "task_template_backbone": load_template_backbone(),
            "tool_results": {
                "lookup_gal_catalog": gal_catalog,
                "lookup_jd_catalog": jd_catalog,
            },
        }, ensure_ascii=False)

        emit("model_request_started", {"model": self.model, "timeout_seconds": 90})
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=agent_input,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.15,
                    response_mime_type="application/json",
                    response_schema=gemini_response_schema(),
                ),
            )
        except Exception as exc:
            emit("model_request_failed", {"error": str(exc)[:500]})
            raise _model_error(exc) from exc
        emit("model_response_received", {"model": self.model})

        candidate = response.parsed
        if candidate is None:
            try:
                candidate = AgentCandidate.model_validate_json(response.text)
            except Exception as exc:
                raise ConfigAgentError("Gemini 未返回符合候选合同的结构化结果。") from exc
        elif not isinstance(candidate, AgentCandidate):
            candidate = AgentCandidate.model_validate(candidate)

        # Catalog provenance and the reviewed prose are deterministic local
        # metadata. Call 2 may classify the prose but may never rewrite it.
        candidate = candidate.model_copy(update={
            "catalog_versions": load_reference_catalog()["source_versions"].copy(),
            "natural_language_template": task_description,
        })

        issues = validate_candidate(candidate, task_description, fixed_scenario)
        emit("candidate_validated", {"issue_count": len(issues)})
        return AgentRunResult(
            run_id=run_id or f"agent-{uuid.uuid4().hex[:12]}",
            model=self.model,
            candidate=candidate,
            validation_status="needs_review" if issues else "pass",
            validation_issues=issues,
            tool_trace=trace,
            usage=_usage_dict(response),
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
