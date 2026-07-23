/* pipeline/js/main.js */
function render() { renderStageRail(); renderContext(); [renderStep1, renderStep2a, renderStep2b, renderStep3, renderStep4, renderStep5][state.currentStage](); persistState(); }

// Stable delegation on #stageRail: rail innerHTML is rewritten on render, but the
// nav element itself is not. pointerdown fires before click and survives better
// if a late render races the gesture.
document.getElementById("stageRail").addEventListener("pointerdown", (e) => {
  const btn = e.target && e.target.closest ? e.target.closest("button.stage-node[data-stage]") : null;
  if (!btn || btn.disabled) return;
  e.preventDefault();
  goToStage(btn.getAttribute("data-stage"));
});

document.getElementById("resetButton").addEventListener("click", () => {
  if (!window.confirm("开始一个新任务？当前页面进度会清空，但手动保存的检查点仍可通过「加载」恢复。")) return;
  if (pollTimer) clearTimeout(pollTimer);
  const runtime = runtimeSnapshot();
  localStorage.removeItem(STORAGE_KEY);
  state = Object.assign(initialState(), runtime);
  applyScenarioSelection(SCENARIO_NONE);
  state.saveNotice = "已开始新任务；手动检查点仍可加载";
  render();
});
document.getElementById("contextToggle").addEventListener("click", () => {
  state.contextCollapsed = !state.contextCollapsed;
  render();
});
document.getElementById("openJdTreeLink").addEventListener("click", (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  persistState();
  try {
    sessionStorage.setItem("uav_pipeline_jd_tree_return", JSON.stringify({
      stage: state.currentStage,
      scrollY: window.scrollY,
    }));
  } catch (_) { /* navigation still works when session storage is unavailable */ }
});

function restoreJdTreeReturnPosition() {
  let raw = null;
  try { raw = sessionStorage.getItem("uav_pipeline_jd_tree_return"); } catch (_) { return; }
  if (!raw) return;
  try { sessionStorage.removeItem("uav_pipeline_jd_tree_return"); } catch (_) { /* no-op */ }
  try {
    const saved = JSON.parse(raw);
    const stage = Number(saved.stage);
    if (Number.isInteger(stage) && stageReachable(stage) && stage !== state.currentStage) {
      state.currentStage = stage;
      render();
    }
    const scrollY = Number(saved.scrollY);
    requestAnimationFrame(() => window.scrollTo(0, Number.isFinite(scrollY) ? scrollY : 0));
  } catch (_) { /* invalid return state: keep the normal Pipeline position */ }
}

async function init() {
  try {
    const h = await (await fetch("/api/health", {cache:"no-store"})).json();
    state.healthInfo = h;
    state.serverStatus = h.agent_ready ? "ready" : "missing_api_key";
    if (!h.providers || !h.providers[state.llmProvider] || (!h.providers[state.llmProvider].ready && h.default_provider)) {
      state.llmProvider = h.default_provider || "deepseek";
    }
    state.catalogSummary = await (await fetch("/api/catalog", {cache:"no-store"})).json();
    const reg = await (await fetch("/api/scenarios", {cache:"no-store"})).json(); state.scenarioRegistry = reg;
    applyScenarioSelection(state.selectedScenarioId || SCENARIO_NONE);
    // 手动检查点仅通过「加载」恢复；浏览器草稿已由 loadState() 接管
    // 若上次运行因刷新/断连中断但服务端已跑完，尝试恢复结果
    await resumeInterruptedRuns();
  } catch(e) { state.serverStatus = "offline"; }
  render();
  restoreJdTreeReturnPosition();
}
render(); init();
