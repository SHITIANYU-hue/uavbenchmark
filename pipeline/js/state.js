/* pipeline/js/state.js */
let state = null;
let pollTimer = null;

function initialState() {
  return {
    currentStage: 0, maxUnlocked: 0, completed: new Set(),
    serverStatus: "checking", healthInfo: null, catalogSummary: null,
    scenarioRegistry: null, selectedScenarioId: SCENARIO_NONE, fixedScenario: null,
    taskPrompt: "", llmProvider: "deepseek", modelTier: "flash",
    targetLevels: defaultTargetLevels(),
    coverageSeed: 0,
    narrativeStatus: "idle", narrativeRunId: null, narrativeDraft: "", narrativeOriginal: "", narrativeError: null,
    agentStatus: "idle", agentPhase: "idle", agentRunId: null, agentResult: null, agentError: null,
    coverageProgress: null,
    extractionStatus: "idle", extractionRunId: null, extractionError: null, extractionProgress: null,
    domainEdits: {},
    fillTbdLoading: false, fillTbdError: null, fillTbdNotice: null,
    instanceMode: "single", instanceSeed: 0, instanceBatchSeeds: "0-4",
    instanceRandomCount: 5, instanceRandomSeeds: [],
    instanceResult: null, instanceResults: null, instanceError: null, instanceLoading: false,
    saveNotice: null,
    contextCollapsed: false,
  };
}

function effectiveScenarioId() {
  return state.selectedScenarioId || SCENARIO_FALLBACK_ID;
}

function scenarioExampleText(scenarioId) {
  return SCENARIO_TASK_EXAMPLES[scenarioId || ""] || "例如：用几句话说明让无人机做什么、关注什么异常、希望得到什么结果。";
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return initialState();
    const s = Object.assign(initialState(), saved);
    s.completed = new Set(saved.completed || []);
    if (!s.targetLevels || !Object.keys(s.targetLevels).length) s.targetLevels = defaultTargetLevels();
    // 恢复后清掉「进行中」的瞬时标记，避免刷新后卡在 loading/disabled
    s.fillTbdLoading = false;
    s.instanceLoading = false;
    if (s.narrativeStatus === "running") s.narrativeStatus = s.narrativeDraft ? "done" : "idle";
    if (s.agentStatus === "running") s.agentStatus = s.agentResult ? "done" : "idle";
    if (s.agentPhase === "running") s.agentPhase = s.agentResult ? "done" : "idle";
    const hasJd = !!(s.agentResult && s.agentResult.candidate && (s.agentResult.candidate.jd_candidates || []).length);
    if (s.extractionStatus === "running") s.extractionStatus = hasJd ? "done" : "idle";
    s.extractionProgress = null;
    s.coverageProgress = null;
    // 已解锁的步数至少覆盖所有已完成的步骤，保证已保存的步骤都能跳转
    const comp = Array.from(s.completed);
    s.maxUnlocked = Math.max(s.maxUnlocked || 0, comp.length ? Math.max.apply(null, comp) : 0);
    return s;
  } catch { return initialState(); }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, state, {completed: Array.from(state.completed)})));
}

function migrateCompletedSteps(steps, stageSchema, hasAgent) {
  const arr = Array.from(steps || []);
  if (!arr.length) return new Set();
  // 旧 4 段：0选域 / 1扩充提取 / 2域模版 / 3特定模版 → 新 5 段插入 2b
  if ((stageSchema == null || stageSchema < 5) && Math.max(...arr) <= 3) {
    const migrated = arr.map(s => (s >= 1 ? s + 1 : s));
    if (hasAgent) {
      if (!migrated.includes(1)) migrated.push(1);
      if (!migrated.includes(2)) migrated.push(2);
    }
    return new Set(migrated);
  }
  return new Set(arr);
}

function furthestUnlocked() {
  const comp = Array.from(state.completed);
  return Math.max(state.maxUnlocked || 0, comp.length ? Math.max.apply(null, comp) : 0);
}

function stageReachable(i) { return i <= furthestUnlocked() || state.completed.has(i); }

function completeStage(i) { state.completed.add(i); state.maxUnlocked = Math.max(state.maxUnlocked, Math.min(i + 1, STAGES.length - 1)); state.currentStage = Math.min(i + 1, STAGES.length - 1); render(); }

function goToStage(i) { if (stageReachable(i)) { state.currentStage = i; render(); } }

function renderStageRail() {
  document.getElementById("stageRail").innerHTML = STAGES.map((s, i) => {
    const locked = !stageReachable(i);
    const cls = i === state.currentStage ? "current" : state.completed.has(i) ? "done" : locked ? "locked" : "";
    const tip = locked
      ? ("需先完成「" + STAGES[Math.max(0, i - 1)][1] + "」后解锁（进度会自动保存）")
      : ("进入 " + s[0] + " · " + s[1] + "（进度已自动保存，可随时跳转）");
    return '<button class="stage-node ' + cls + '" type="button" title="' + escapeHtml(tip) + '" onclick="goToStage(' + i + ')"'
      + (locked ? " disabled" : "") + "><span>" + s[0] + "</span><b>" + s[1] + "</b></button>";
  }).join("");
}

function setHeader(i, st) {
  document.getElementById("workspaceEyebrow").textContent = STAGES[i][0] + " · " + STAGES[i][2];
  document.getElementById("workspaceTitle").textContent = STAGES[i][1];
  document.getElementById("workspaceState").textContent = st || "";
}

state = loadState();
