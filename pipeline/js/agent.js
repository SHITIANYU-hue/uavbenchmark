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

/** Update progress text in-place. Do NOT full-render — that recreates the stage
 *  rail and eats mid-click navigation while classification/extraction is running. */
function patchRunningProgressUi() {
  renderContext();
  const covEl = document.getElementById("coverageProgressCard");
  if (covEl && state.agentStatus === "running") {
    const cp = state.coverageProgress;
    const title = covEl.querySelector("b");
    const note = covEl.querySelector("p");
    if (title) {
      title.textContent = cp && cp.total > 1
        ? ("A×L 分类调用中…第 " + cp.chunk + "/" + cp.total + " 批")
        : "A×L 分类调用中...";
    }
    if (note) {
      note.textContent = cp && cp.total > 1
        ? "已选 A×L 分批分类，可看到进度并降低单次返回被截断的风险。"
        : "按目标 coverage 与文案确定计分 A×L 与责任边界。";
    }
  }
  const extEl = document.getElementById("extractionProgressCard");
  if (extEl && state.extractionStatus === "running") {
    const pr = state.extractionProgress;
    const title = extEl.querySelector("b");
    if (title) {
      title.textContent = pr && pr.total
        ? ("正在提取 JD 变量域…第 " + pr.chunk + "/" + pr.total + " 批")
        : "正在根据 A×L 提取 JD 变量域…";
    }
  }
  const ws = document.getElementById("workspaceState");
  if (ws) {
    if (state.currentStage === 1 && state.agentStatus === "running") ws.textContent = "分类中";
    if (state.currentStage === 2 && state.extractionStatus === "running") ws.textContent = "提取中";
  }
}

// Adopt a completed coverage result. Idempotent: safe whether the POST resolved
// normally or the result was recovered from the status poll after a lost connection.
function adoptCoverageResult(result) {
  if (!result || state.agentStatus === "done") return;
  stopAgentPoll();
  state.agentStatus = "done";
  state.agentPhase = "done";
  state.coverageProgress = null;
  state.agentError = null;
  state.agentResult = result;
  state.extractionStatus = "idle";
  state.extractionError = null;
  state.extractionProgress = null;
  state.maxUnlocked = Math.max(state.maxUnlocked, 2);
  render();
}

function adoptExtractionResult(result) {
  if (!result || state.extractionStatus === "done") return;
  stopAgentPoll();
  state.agentResult = result;
  state.extractionStatus = "done";
  state.extractionProgress = null;
  state.extractionError = null;
  state.maxUnlocked = Math.max(state.maxUnlocked, 2);
  render();
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
      // Finalize even if the POST connection was lost (reload / preview refresh).
      if (s.status === "completed" && s.result) { adoptCoverageResult(s.result); return; }
      patchRunningProgressUi();
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
      }
      // Finalize even if the POST connection was lost (reload / preview refresh).
      if (s.status === "completed" && s.result) { adoptExtractionResult(s.result); return; }
      patchRunningProgressUi();
    } catch (_) { /* ignore transient poll errors */ }
    if (state.extractionStatus === "running" && state.extractionRunId === runId) {
      pollTimer = setTimeout(tick, 700);
    }
  };
  pollTimer = setTimeout(tick, 350);
}

// After a reload/preview refresh, a long run may have finished server-side while
// the page was gone. Recover the completed result from the status endpoint.
async function resumeInterruptedRuns() {
  async function fetchStatus(runId) {
    if (!runId) return null;
    try {
      const r = await fetch("/api/config-agent/status?run_id=" + encodeURIComponent(runId), {cache: "no-store"});
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { return null; }
  }
  const c = state.agentResult && state.agentResult.candidate;
  const hasCoverage = c && (c.coverage_candidates || []).length;
  const hasJd = c && (c.jd_candidates || []).length;
  if (hasCoverage && !hasJd && state.extractionStatus !== "done" && state.extractionRunId) {
    const s = await fetchStatus(state.extractionRunId);
    if (s && s.status === "completed" && s.result) { adoptExtractionResult(s.result); return; }
  }
  if (!hasCoverage && state.agentStatus !== "done" && state.agentRunId) {
    const s = await fetchStatus(state.agentRunId);
    if (s && s.status === "completed" && s.result) { adoptCoverageResult(s.result); }
  }
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
    // If the status poll already recovered a completed result (connection lost
    // after the server finished), keep the "done" state instead of clobbering it.
    if (state.agentStatus === "running") {
      state.agentStatus = "idle";
      state.agentPhase = "idle";
      state.coverageProgress = null;
      state.agentError = String(e.message || e);
    }
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
    // If the status poll already recovered a completed result (connection lost
    // after the server finished), keep the "done" state instead of clobbering it.
    if (state.extractionStatus === "running") {
      state.extractionStatus = "idle";
      state.extractionError = String(e.message || e);
    }
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

async function loadTreeDomains() {
  state.fillTbdLoading = true; state.fillTbdError = null; state.fillTbdNotice = null; render();
  try {
    const r = await fetch("/api/jd-tree/domains", {cache: "no-store"});
    if (!r.ok) throw new Error("变量树数据不可用");
    const d = await r.json();
    const treeSlots = d.slots || {};
    const edits = getEdits();
    let applied = 0, skipped = 0;
    edits.forEach(e => {
      const tree = treeSlots[e.slot_id];
      if (!tree) { skipped++; return; }
      if (tree.options && tree.options.length > 0) {
        setEdit(e.slot_id, "binding_mode", "enum");
        setEdit(e.slot_id, "allowed_values", tree.options.join(", "));
        if (!e.value && tree.options[0]) setEdit(e.slot_id, "value", tree.options[0]);
        applied++;
      } else if (tree.value_type && tree.value_type.includes("number")) {
        setEdit(e.slot_id, "binding_mode", "range");
        applied++;
      }
    });
    state.fillTbdNotice = "从变量树加载了 " + applied + " 个域" + (skipped ? "（" + skipped + " 个无树数据）" : "");
  } catch (e) {
    state.fillTbdError = String(e.message || e);
  }
  state.fillTbdLoading = false;
  render();
}

async function loadMetricsForStep3() {
  const c = state.agentResult && state.agentResult.candidate;
  const abilities = c && c.coverage_candidates ? [...new Set(c.coverage_candidates.map(x => x.cell.split("×")[0]))] : [];
  if (!abilities.length) { state.fillTbdError = "没有选中的能力"; render(); return; }
  state.fillTbdLoading = true; state.fillTbdError = null; state.fillTbdNotice = null; render();
  try {
    const all = {};
    for (const a of abilities) {
      const r = await fetch("/api/metric-set?ability=" + a, {cache: "no-store"});
      if (!r.ok) continue;
      const ms = await r.json();
      Object.assign(all, ms.values || {});
    }
    state.treeMetrics = all;
    const qCount = Object.keys(all).filter(k => k.includes(".3.")).length;
    const pCount = Object.keys(all).filter(k => k.includes(".4.")).length;
    state.fillTbdNotice = "加载了 " + qCount + " 个质量标准 (.3) + " + pCount + " 个兜底协议 (.4)";
  } catch(e) {
    state.fillTbdError = String(e.message || e);
  }
  state.fillTbdLoading = false;
  render();
}

async function generateFullTaskTemplate() {
  const c = state.agentResult && state.agentResult.candidate;
  const ability = c && c.coverage_candidates ? c.coverage_candidates[0].cell.split("×")[0] : "A11";
  const seed = state.instanceSeed || 0;
  state.instanceLoading = true; state.instanceError = null; render();
  try {
    const tpl = buildDomainTemplate();
    const body = { ability, seed, template: tpl, domain_values: {}, scoring: {SR: true, CR: true, SPL: true} };
    const r = await fetch("/api/task-template/generate", {
      method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || d.error);
    state.instanceResult = d.task;
    state.fillTbdNotice = "生成完整 Task Template："
      + Object.keys(d.task.scenario||{}).length + " 场景值 + "
      + Object.keys(d.task.quality||{}).length + " 质量标准 + "
      + Object.keys(d.task.protocols||{}).length + " 兜底协议";
  } catch(e) {
    state.instanceError = String(e.message || e);
  }
  state.instanceLoading = false;
  render();
}
