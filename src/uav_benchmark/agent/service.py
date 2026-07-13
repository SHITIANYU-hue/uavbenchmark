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
    load_reference_catalog,
    load_template_backbone,
    lookup_gal_catalog,
    lookup_jd_catalog,
)
from .models import AgentCandidate, AgentRunResult, ToolTrace, ValidationIssue


SYSTEM_INSTRUCTION = """
You are ConfigAuthoringAgent for a UAV benchmark.

Transform one user-provided business task description into proposed GAL A×L
coverage, non-scored runtime dependencies, JD candidates with provenance,
responsibility boundaries, open questions, and a Chinese natural-language
Task Template using 【jd-x.x 字段＝值】 annotations.

The local Agent orchestrator has already called lookup_gal_catalog and
lookup_jd_catalog. Their actual results are included with the user task.

Mandatory rules:
- Use only GAL cells and JD slot IDs in the provided tool results.
- Apply the provided task_template_backbone as a completeness contract.
- Emit every JD slot required by the base backbone and selected A×L rules.
- If a required slot has no exact task evidence, emit value=null,
  status=TBD, and evidence_quote=""; never omit the slot.
- Existing project case templates are not available as answer templates.
- Do not invent thresholds, numeric business rules, simulator APIs, or levels.
- Unsupported or missing information becomes TBD or an open question.
- Keep scored coverage separate from runtime dependencies and external actors.
- Do not credit an external executor action to the SUT.
- evidence_quote must be an exact substring of the user task unless status is TBD.
- The natural-language template is the primary human artifact.
- Write the natural-language template as the seven substantive paragraphs in
  task_template_backbone.paragraph_sequence, not as a one-sentence summary.
- Include every required JD as 【jd-x.x 字段名＝值】 or 【jd-x.x 字段名＝TBD】.
- Name every selected A×L and preserve its responsibility and non-responsibility.
- Return Chinese content except fixed IDs and reason codes.
""".strip()


class ConfigAgentError(RuntimeError):
    """A user-safe Config Agent failure."""


def gemini_response_schema() -> dict[str, Any]:
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

    return sanitize(AgentCandidate.model_json_schema())


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


def validate_candidate(candidate: AgentCandidate, task_description: str) -> list[ValidationIssue]:
    catalog = load_reference_catalog()
    backbone = load_template_backbone()
    allowed_cells = {item["cell"] for item in catalog["gal_cells"]}
    allowed_jd = {item["slot_id"] for item in catalog["jd_fields"]}
    issues: list[ValidationIssue] = []

    for index, item in enumerate(candidate.coverage_candidates):
        if item.cell not in allowed_cells:
            issues.append(ValidationIssue(
                code="UNKNOWN_GAL_CELL",
                message=f"{item.cell} is outside the reviewed demo catalog.",
                path=f"coverage_candidates[{index}].cell",
            ))
        if item.status != "TBD" and item.evidence_quote not in task_description:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="Coverage evidence is not an exact input substring.",
                path=f"coverage_candidates[{index}].evidence_quote",
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
        elif item.provenance not in {"human_added", "human_edited"} and item.status != "TBD" and item.evidence_quote not in task_description:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="JD evidence is not an exact input substring.",
                path=f"jd_candidates[{index}].evidence_quote",
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
        elif item.provenance not in {"human_added", "human_edited"} and item.status != "TBD" and item.evidence_quote not in task_description:
            issues.append(ValidationIssue(
                code="EVIDENCE_NOT_VERBATIM",
                message="Dependency evidence is not an exact input substring.",
                path=f"runtime_dependencies[{index}].evidence_quote",
            ))

    tagged_slots = set(re.findall(r"【(jd-[0-9a-z.]+)", candidate.natural_language_template))
    required_slots = set(backbone["base_slots"])
    for item in candidate.coverage_candidates:
        required_slots.update(backbone["coverage_slot_rules"].get(item.cell, []))
    emitted_slots = {item.slot_id for item in candidate.jd_candidates}
    for slot in sorted(required_slots - emitted_slots):
        issues.append(ValidationIssue(
            code="MISSING_REQUIRED_JD_SLOT",
            message=f"Required template-backbone slot {slot} was omitted; emit it as TBD when unknown.",
            path="jd_candidates",
        ))
    for slot in sorted(required_slots - tagged_slots):
        issues.append(ValidationIssue(
            code="MISSING_REQUIRED_JD_IN_TEMPLATE",
            message=f"Natural-language template omitted required annotation {slot}.",
            path="natural_language_template",
        ))
    for slot in sorted(tagged_slots - allowed_jd):
        issues.append(ValidationIssue(
            code="UNKNOWN_JD_IN_TEMPLATE",
            message=f"Natural-language template contains unsupported slot {slot}.",
            path="natural_language_template",
        ))
    if not tagged_slots:
        issues.append(ValidationIssue(
            code="MISSING_JD_ANNOTATION",
            message="Natural-language template contains no 【jd-x.x】 annotation.",
            path="natural_language_template",
        ))
    paragraphs = [item.strip() for item in re.split(r"\n\s*\n", candidate.natural_language_template) if item.strip()]
    if len(paragraphs) < len(backbone["paragraph_sequence"]):
        issues.append(ValidationIssue(
            code="INCOMPLETE_TEMPLATE_STRUCTURE",
            message="Natural-language template must follow the seven-paragraph DOCX backbone.",
            path="natural_language_template",
        ))
    for item in candidate.coverage_candidates:
        if item.cell not in candidate.natural_language_template:
            issues.append(ValidationIssue(
                code="MISSING_COVERAGE_IN_TEMPLATE",
                message=f"Natural-language template does not name selected coverage {item.cell}.",
                path="natural_language_template",
            ))
    return issues


class GeminiConfigAgent:
    def __init__(self, api_key: str, model: str) -> None:
        self.model = model
        self.client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=90_000,
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )

    def analyze(
        self,
        task_description: str,
        *,
        run_id: str | None = None,
        progress: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> AgentRunResult:
        if len(task_description.strip()) < 80:
            raise ConfigAgentError("任务描述过短；请提供环境、任务、责任和异常/完成条件。")

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
            "task_description": task_description,
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
            message = str(exc)
            if "API_KEY" in message.upper() or "401" in message or "403" in message:
                raise ConfigAgentError("Gemini API Key 无效、无权限或对应模型不可用。") from exc
            if "503" in message or "UNAVAILABLE" in message or "HIGH DEMAND" in message.upper():
                raise ConfigAgentError(
                    "Gemini 当前临时高负载（503）。任务输入和 Run ID 已保存；请稍后重试，或手动切换 Gemini 3.1 Flash-Lite。"
                ) from exc
            if "429" in message or "RESOURCE_EXHAUSTED" in message:
                raise ConfigAgentError(
                    "Gemini 请求频率已达到当前额度（429）。请至少等待一分钟后再重试。"
                ) from exc
            raise ConfigAgentError(f"Gemini 调用失败：{message[:240]}") from exc
        emit("model_response_received", {"model": self.model})

        candidate = response.parsed
        if candidate is None:
            try:
                candidate = AgentCandidate.model_validate_json(response.text)
            except Exception as exc:
                raise ConfigAgentError("Gemini 未返回符合候选合同的结构化结果。") from exc
        elif not isinstance(candidate, AgentCandidate):
            candidate = AgentCandidate.model_validate(candidate)

        issues = validate_candidate(candidate, task_description)
        emit("candidate_validated", {"issue_count": len(issues)})
        usage_metadata = getattr(response, "usage_metadata", None)
        usage: dict[str, int | float | str | None] = {}
        if usage_metadata is not None:
            for key, value in usage_metadata.model_dump(exclude_none=True).items():
                if isinstance(value, (int, float, str)) or value is None:
                    usage[key] = value

        return AgentRunResult(
            run_id=run_id or f"agent-{uuid.uuid4().hex[:12]}",
            model=self.model,
            candidate=candidate,
            validation_status="needs_review" if issues else "pass",
            validation_issues=issues,
            tool_trace=trace,
            usage=usage,
        )


def save_agent_run(task_description: str, result: AgentRunResult) -> Path:
    output_dir = ROOT / ".agent_runs"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"{result.run_id}.json"
    output_path.write_text(
        json.dumps({
            "task_description": task_description,
            "result": result.model_dump(mode="json"),
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output_path
