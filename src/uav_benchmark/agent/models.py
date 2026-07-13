"""Structured contracts for the Config Agent response."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


SupportedCell = Literal[
    "A5×L1", "A5×L2", "A6a×L3", "A6b×L2",
    "A7×L1", "A7×L2", "A8×L1", "A11×L4",
]
SupportedJD = Literal[
    "jd-0.2", "jd-0.3", "jd-0.5", "jd-0.7", "jd-0.9", "jd-0.10",
    "jd-5.1", "jd-6a.1", "jd-6a.3", "jd-6b.1", "jd-6b.2",
    "jd-7.1", "jd-7.2", "jd-8.1", "jd-8.2", "jd-8.3",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CoverageCandidate(StrictModel):
    cell: SupportedCell
    role: Literal["primary", "anomaly", "auxiliary"]
    responsibilities: list[str] = Field(min_length=1)
    out_of_scope: list[str] = Field(default_factory=list)
    evidence_quote: str
    status: Literal["proposed", "TBD"] = "proposed"


class RuntimeDependencyCandidate(StrictModel):
    dependency_id: str
    provider: Literal["external_system", "executor", "human_or_external_decision"]
    responsibilities: list[str] = Field(min_length=1)
    evidence_quote: str
    # Gemini Structured Outputs accepts a boolean schema here, but not a
    # boolean Literal/const. The deterministic validator enforces false.
    scored: bool = False
    status: Literal["proposed", "TBD"] = "proposed"
    provenance: Literal["agent_extracted", "human_added", "human_edited", "auto_fixed"] = "agent_extracted"
    source_note: str | None = None


class JDCandidate(StrictModel):
    slot_id: SupportedJD
    name: str
    value: str | None
    status: Literal["given", "proposed", "TBD"]
    evidence_quote: str
    provenance: Literal["agent_extracted", "human_added", "human_edited", "auto_fixed"] = "agent_extracted"
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


class AgentCandidate(StrictModel):
    task_title: str
    scenario_summary: str
    coverage_candidates: list[CoverageCandidate] = Field(min_length=1)
    runtime_dependencies: list[RuntimeDependencyCandidate] = Field(default_factory=list)
    jd_candidates: list[JDCandidate] = Field(default_factory=list)
    responsibility_boundaries: list[ResponsibilityBoundary] = Field(default_factory=list)
    natural_language_template: str = Field(min_length=400)
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
