/* pipeline/js/main.js */
function render() { renderStageRail(); renderContext(); [renderStep1, renderStep2a, renderStep2b, renderStep3, renderStep4][state.currentStage](); persistState(); }

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
}
render(); init();
