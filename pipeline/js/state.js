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
    domainEdits: {}, domainEditHistory: [],
    fillTbdLoading: false, fillTbdError: null, fillTbdNotice: null,
    treeMetrics: {}, treeSlice: null,
    jdTreeStatus: "idle", jdTreeError: null, jdTreeNotice: null,
    jdTreeSlice: null, jdTreeSelectedNodeIds: [], jdTreeSelection: null,
    deliveryCaseCount: 10,
    deliveryBatchSeed: Math.floor(Date.now() % 1000000000),
    deliveryBatch: null,
    deliverySelectedCase: 0,
    deliveryOverrides: {},
    deliveryHumanEdits: {},
    deliveryLoading: false,
    deliveryError: null,
    deliveryNotice: null,
    deliveryStale: false,
    factoryRunStatus: "idle",
    factoryRunStep: "",
    factoryRunError: null,
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
    s.factoryRunStatus = "idle";
    s.factoryRunStep = "";
    if (s.jdTreeStatus === "loading" || s.jdTreeStatus === "building") s.jdTreeStatus = "idle";
    s.deliveryLoading = false;
    if (s.narrativeStatus === "running") s.narrativeStatus = s.narrativeDraft ? "done" : "idle";
    if (s.agentStatus === "running") s.agentStatus = s.agentResult ? "done" : "idle";
    if (s.agentPhase === "running") s.agentPhase = s.agentResult ? "done" : "idle";
    const hasJd = !!(s.agentResult && s.agentResult.candidate && (s.agentResult.candidate.jd_candidates || []).length);
    if (s.extractionStatus === "running") s.extractionStatus = hasJd ? "done" : "idle";
    s.extractionProgress = null;
    s.coverageProgress = null;
    const selectionBasis = (s.jdTreeSelection && s.jdTreeSelection.selection_basis) || {};
    const oldGlobalSelection = !!(
      s.jdTreeSelection
      && selectionBasis.global_variables_included !== false
      && (s.jdTreeSelection.selected_nodes || []).some(node => node.owner_a === "MULTI")
    );
    if (oldGlobalSelection) {
      if (s.agentResult && s.agentResult.candidate) {
        s.agentResult.candidate.jd_candidates = [];
        s.agentResult.candidate.runtime_dependencies = [];
      }
      s.extractionStatus = "idle";
      s.extractionRunId = null;
      s.jdTreeStatus = "idle";
      s.jdTreeSlice = null;
      s.jdTreeSelectedNodeIds = [];
      s.jdTreeSelection = null;
      s.domainEdits = {};
      s.domainEditHistory = [];
      s.deliveryBatch = null;
      s.deliveryStale = false;
      s.completed = new Set(Array.from(s.completed).filter(step => step <= 1));
      s.maxUnlocked = Math.min(s.maxUnlocked || 2, 2);
      s.currentStage = Math.min(Number(s.currentStage) || 0, 2);
      s.saveNotice = "已保留 STEP 1–2；旧全局变量结果需从 STEP 3 按新规则重新生成";
    }
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
  // Five-step checkpoints remain valid; STEP 6 is intentionally appended and
  // stays locked until the new delivery batch is generated.
  if (stageSchema === 5) return new Set(arr.filter(s => s >= 0 && s <= 4));
  return new Set(arr);
}

function furthestUnlocked() {
  const comp = Array.from(state.completed);
  return Math.max(state.maxUnlocked || 0, comp.length ? Math.max.apply(null, comp) : 0);
}

function stageReachable(i) { return i <= furthestUnlocked() || state.completed.has(i); }

function completeStage(i) { state.completed.add(i); state.maxUnlocked = Math.max(state.maxUnlocked, Math.min(i + 1, STAGES.length - 1)); state.currentStage = Math.min(i + 1, STAGES.length - 1); render(); }

function clearDeliveryArtifacts() {
  if (state.deliveryBatch) {
    state.deliveryStale = true;
    state.deliveryError = null;
    state.deliveryNotice = "上游内容已修改；当前交付物需要按复核结果重新生成。";
    state.completed.delete(4);
    state.completed.delete(5);
    state.maxUnlocked = Math.max(state.maxUnlocked, 5);
    return;
  }
  state.deliveryBatch = null;
  state.deliverySelectedCase = 0;
  state.deliveryOverrides = {};
  state.deliveryHumanEdits = {};
  state.deliveryError = null;
  state.deliveryNotice = null;
  state.deliveryStale = false;
  state.completed.delete(4);
  state.completed.delete(5);
  state.maxUnlocked = Math.min(state.maxUnlocked, 4);
}

function goToStage(i) {
  const idx = Number(i);
  if (!Number.isInteger(idx) || !stageReachable(idx)) return;
  if (state.currentStage === idx) return;
  state.currentStage = idx;
  render();
}

function renderStageRail() {
  document.getElementById("stageRail").innerHTML = STAGES.map((s, i) => {
    const locked = !stageReachable(i);
    const cls = i === state.currentStage ? "current" : state.completed.has(i) ? "done" : locked ? "locked" : "";
    const tip = locked
      ? ("需先完成「" + STAGES[Math.max(0, i - 1)][1] + "」后解锁（进度会自动保存）")
      : ("进入 " + s[0] + " · " + s[1] + "（进度已自动保存，可随时跳转）");
    // data-stage + delegated listener on #stageRail (see main.js). Avoid inline onclick so
    // progress polls that rewrite the rail cannot strand a half-clicked button.
    return '<button class="stage-node ' + cls + '" type="button" data-stage="' + i + '" title="' + escapeHtml(tip) + '"'
      + (locked ? " disabled" : "") + "><span>" + s[0] + "</span><b>" + s[1] + "</b></button>";
  }).join("");
}

function setHeader(i, st) {
  document.getElementById("workspaceEyebrow").textContent = STAGES[i][0] + " · " + STAGES[i][2];
  document.getElementById("workspaceTitle").textContent = STAGES[i][1];
  document.getElementById("workspaceState").textContent = st || "";
}

state = loadState();
