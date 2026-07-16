/* pipeline/js/agent.js */
async function runNarrative() {
  const cells = selectedCoverageCells();
  if (!cells.length) {
    state.narrativeError = "请先至少选择 1 个目标 A×L coverage，再运行文案扩充。";
    render();
    return;
  }
  state.narrativeStatus = "running"; state.narrativeError = null; state.narrativeRunId = uid("agent-"); render();
  try {
    const r = await fetch("/api/config-agent/expand", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        task_description: state.taskPrompt,
        scenario_id: effectiveScenarioId(),
        provider: state.llmProvider,
        model_tier: state.modelTier,
        run_id: state.narrativeRunId,
        target_coverage: cells,
      })});
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || d.error);
    state.narrativeStatus = "done"; state.narrativeDraft = d.result.draft.expanded_narrative; state.narrativeOriginal = state.narrativeDraft;
  } catch(e) { state.narrativeStatus = "idle"; state.narrativeError = String(e.message || e); }
  render();
}

function stopAgentPoll() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}

function startAgentPoll(runId) {
  stopAgentPoll();
  const tick = async () => {
    if (state.agentStatus !== "running" || state.agentRunId !== runId) return;
    try {
      const s = await (await fetch("/api/config-agent/status?run_id=" + encodeURIComponent(runId), {cache: "no-store"})).json();
      const det = s.details || {};
      const op = det.operation || "";
      const event = s.event || "";
      if (op === "coverage") {
        state.agentPhase = event === "model_response_received" ? "coverage_done" : "coverage";
        if (det.chunk_total) state.coverageProgress = { chunk: det.chunk, total: det.chunk_total };
      } else if (s.status === "completed") {
        state.agentPhase = "done";
      }
      if (state.currentStage === 1) render();
    } catch (_) { /* ignore transient poll errors */ }
    if (state.agentStatus === "running" && state.agentRunId === runId) {
      pollTimer = setTimeout(tick, 700);
    }
  };
  pollTimer = setTimeout(tick, 350);
}

function startExtractionPoll(runId) {
  stopAgentPoll();
  const tick = async () => {
    if (state.extractionStatus !== "running" || state.extractionRunId !== runId) return;
    try {
      const s = await (await fetch("/api/config-agent/status?run_id=" + encodeURIComponent(runId), {cache: "no-store"})).json();
      const det = s.details || {};
      if (det.operation === "extraction" && det.chunk_total) {
        state.extractionProgress = { chunk: det.chunk, total: det.chunk_total };
        if (state.currentStage === 2) render();
      }
    } catch (_) { /* ignore transient poll errors */ }
    if (state.extractionStatus === "running" && state.extractionRunId === runId) {
      pollTimer = setTimeout(tick, 700);
    }
  };
  pollTimer = setTimeout(tick, 350);
}

// STEP 2: A×L coverage classification only (no JD extraction here).
async function runCoverage() {
  state.agentStatus = "running";
  state.agentPhase = "coverage";
  state.agentError = null;
  state.coverageProgress = null;
  state.agentRunId = uid("agent-");
  render();
  startAgentPoll(state.agentRunId);
  try {
    const r = await fetch("/api/config-agent/classify", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        task_description: state.narrativeDraft,
        scenario_id: effectiveScenarioId(),
        provider: state.llmProvider,
        model_tier: state.modelTier,
        run_id: state.agentRunId,
        preferred_coverage: selectedCoverageCells(),
      })});
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || d.error);
    state.agentStatus = "done";
    state.agentPhase = "done";
    state.coverageProgress = null;
    state.agentResult = d.result;
    // Coverage changed → any earlier JD extraction is now stale.
    state.extractionStatus = "idle";
    state.extractionError = null;
    state.extractionProgress = null;
    state.maxUnlocked = Math.max(state.maxUnlocked, 2);
  } catch(e) {
    state.agentStatus = "idle";
    state.agentPhase = "idle";
    state.coverageProgress = null;
    state.agentError = String(e.message || e);
  }
  stopAgentPoll();
  render();
}

// STEP 3: JD variable-domain extraction, chunked server-side (retriable).
async function runExtraction() {
  const c = state.agentResult && state.agentResult.candidate;
  if (!c || !((c.coverage_candidates || []).length)) {
    state.extractionError = "缺少已确认的 A×L 覆盖，请先在 STEP 2 完成分类。";
    render();
    return;
  }
  state.extractionStatus = "running";
  state.extractionError = null;
  state.extractionProgress = null;
  state.extractionRunId = uid("agent-");
  render();
  startExtractionPoll(state.extractionRunId);
  try {
    const r = await fetch("/api/config-agent/extract", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        task_description: state.narrativeDraft,
        scenario_id: effectiveScenarioId(),
        provider: state.llmProvider,
        model_tier: state.modelTier,
        run_id: state.extractionRunId,
        source_task_description: state.taskPrompt,
        narrative_parent_run_id: state.narrativeRunId,
        coverage_candidates: c.coverage_candidates,
        task_title: c.task_title,
        scenario_summary: c.scenario_summary,
        responsibility_boundaries: c.responsibility_boundaries || [],
      })});
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || d.error);
    state.agentResult = d.result;
    state.extractionStatus = "done";
    state.extractionProgress = null;
    state.maxUnlocked = Math.max(state.maxUnlocked, 2);
  } catch(e) {
    state.extractionStatus = "idle";
    state.extractionError = String(e.message || e);
  }
  stopAgentPoll();
  render();
}

// STEP 2: confirm the expanded narrative, then run coverage classification.
function confirmNar() { state.narrativeStatus = "done"; runCoverage(); }

function resetNarrativeForCoverage() {
  state.narrativeStatus = "idle";
  state.narrativeDraft = "";
  state.narrativeOriginal = "";
  state.narrativeError = null;
  stopAgentPoll();
  state.agentStatus = "idle";
  state.agentPhase = "idle";
  state.coverageProgress = null;
  state.agentResult = null;
  state.agentError = null;
  state.extractionStatus = "idle";
  state.extractionError = null;
  state.extractionProgress = null;
  render();
}

async function fillTbdDomains() {
  const tbds = tbdEdits();
  if (!tbds.length) { state.fillTbdNotice = "没有 TBD 项需要填写"; render(); return; }
  const narrative = state.narrativeDraft || state.taskPrompt;
  if (!narrative || narrative.trim().length < 20) {
    state.fillTbdError = "缺少确认文案，无法智能填写";
    render();
    return;
  }
  state.fillTbdLoading = true; state.fillTbdError = null; state.fillTbdNotice = null; render();
  try {
    const resolved = getEdits().filter(e => e.binding_mode !== "TBD").map(e => ({
      slot_id: e.slot_id, name: e.name, binding_mode: e.binding_mode,
      value: e.value, allowed_values: e.allowed_values, minimum: e.minimum, maximum: e.maximum,
    }));
    const r = await fetch("/api/config-agent/fill-tbd", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        task_description: narrative,
        scenario_id: effectiveScenarioId(),
        provider: state.llmProvider,
        model_tier: state.modelTier,
        run_id: uid("agent-fill-"),
        tbd_slots: tbds.map(e => ({slot_id: e.slot_id, name: e.name, source_note: "TBD"})),
        resolved_slots: resolved,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || d.error || JSON.stringify(d));
    const filled = (d.filled && d.filled.jd_candidates) || [];
    let applied = 0;
    filled.forEach(j => {
      if (!j || !j.slot_id) return;
      if ((j.binding_mode || "TBD") === "TBD") {
        if (j.source_note) setEdit(j.slot_id, "binding_mode", "TBD");
        return;
      }
      setEdit(j.slot_id, "binding_mode", j.binding_mode);
      if (j.binding_mode === "fixed") setEdit(j.slot_id, "value", j.value || "");
      if (j.binding_mode === "enum") setEdit(j.slot_id, "allowed_values", (j.allowed_values || []).join(", "));
      if (j.binding_mode === "range") {
        setEdit(j.slot_id, "minimum", j.minimum);
        setEdit(j.slot_id, "maximum", j.maximum);
      }
      if (state.agentResult && state.agentResult.candidate && state.agentResult.candidate.jd_candidates) {
        const idx = state.agentResult.candidate.jd_candidates.findIndex(x => x.slot_id === j.slot_id);
        if (idx >= 0) state.agentResult.candidate.jd_candidates[idx] = Object.assign({}, state.agentResult.candidate.jd_candidates[idx], j);
      }
      applied += 1;
    });
    state.fillTbdNotice = "已智能填写 " + applied + " / " + tbds.length + " 个 TBD 域";
  } catch (e) {
    state.fillTbdError = String(e.message || e);
  }
  state.fillTbdLoading = false;
  render();
}
