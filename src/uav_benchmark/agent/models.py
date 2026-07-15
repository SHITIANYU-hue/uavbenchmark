"""Structured contracts for the Config Agent response."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# IDs are validated against the versioned local knowledge catalog instead of
# being duplicated as Python Literal enums.  This keeps schema and catalog
# upgrades independent while retaining deterministic post-validation.
SupportedCell = str
SupportedJD = str


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CoverageCandidate(StrictModel):
    cell: SupportedCell
    role: Literal["primary", "anomaly", "auxiliary"]
    responsibilities: list[str] = Field(min_length=1)
    out_of_scope: list[str] = Field(default_factory=list)
    evidence_quote: str
    status: Literal["proposed", "TBD"] = "proposed"
    provenance: Literal["agent_inferred", "human_edited"] = "agent_inferred"
    source_note: str | None = None


class RuntimeDependencyCandidate(StrictModel):
    dependency_id: str
    provider: Literal["external_system", "executor", "human_or_external_decision"]
    responsibilities: list[str] = Field(min_length=1)
    evidence_quote: str
    # DeepSeek JSON mode accepts a boolean schema here. The deterministic
    # validator enforces false.
    scored: bool = False
    status: Literal["proposed", "TBD"] = "proposed"
    provenance: Literal["agent_extracted", "scenario_fixed", "human_added", "human_edited", "auto_fixed"] = "agent_extracted"
    source_note: str | None = None


class JDCandidate(StrictModel):
    slot_id: SupportedJD
    name: str
    value: str | None
    status: Literal["given", "proposed", "TBD"]
    evidence_quote: str
    provenance: Literal["agent_extracted", "scenario_fixed", "human_added", "human_edited", "auto_fixed"] = "agent_extracted"
    source_note: str | None = None


class ResponsibilityBoundary(StrictModel):
    actor: str
    responsible_for: list[str] = Field(min_length=1)
    explicitly_not_responsible_for: list[str] = Field(default_factory=list)


class OpenQuestion(StrictModel):
    question_id: str
    topic: str
    question: str
    blocking: bool = False


class NarrativeDraft(StrictModel):
    """First-call output: business prose only, without GAL/JD classification."""

    task_title: str
    expanded_narrative: str = Field(min_length=400)
    open_questions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class AgentCandidate(StrictModel):
    catalog_versions: dict[str, str] = Field(default_factory=dict)
    task_title: str
    scenario_summary: str
    coverage_candidates: list[CoverageCandidate] = Field(min_length=1)
    runtime_dependencies: list[RuntimeDependencyCandidate] = Field(default_factory=list)
    jd_candidates: list[JDCandidate] = Field(default_factory=list)
    responsibility_boundaries: list[ResponsibilityBoundary] = Field(default_factory=list)
    natural_language_template: str = Field(default="")
    open_questions: list[OpenQuestion] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class CoverageResult(StrictModel):
    """Sub-call 2a output: A×L coverage classification only."""

    task_title: str
    scenario_summary: str
    coverage_candidates: list[CoverageCandidate] = Field(min_length=1)
    responsibility_boundaries: list[ResponsibilityBoundary] = Field(default_factory=list)


class ExtractionResult(StrictModel):
    """Sub-call 2b output: JD and dependency extraction only."""

    jd_candidates: list[JDCandidate] = Field(default_factory=list)
    runtime_dependencies: list[RuntimeDependencyCandidate] = Field(default_factory=list)
    open_questions: list[OpenQuestion] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ValidationIssue(StrictModel):
    code: str
    message: str
    path: str | None = None


class ToolTrace(StrictModel):
    tool: str
    status: Literal["called", "completed"]


class AgentRunResult(StrictModel):
    run_id: str
    model: str
    candidate: AgentCandidate
    validation_status: Literal["pass", "needs_review"]
    validation_issues: list[ValidationIssue]
    tool_trace: list[ToolTrace]
    usage: dict[str, int | float | str | None] = Field(default_factory=dict)


class NarrativeRunResult(StrictModel):
    run_id: str
    model: str
    draft: NarrativeDraft
    validation_status: Literal["pass", "needs_review"]
    validation_issues: list[ValidationIssue]
    usage: dict[str, int | float | str | None] = Field(default_factory=dict)
