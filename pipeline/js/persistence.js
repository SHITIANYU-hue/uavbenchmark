/* pipeline/js/persistence.js */
function runtimeSnapshot() {
  return {
    serverStatus: state.serverStatus, healthInfo: state.healthInfo, catalogSummary: state.catalogSummary,
    scenarioRegistry: state.scenarioRegistry, llmProvider: state.llmProvider, modelTier: state.modelTier,
  };
}

async function savePipeline() {
  try {
    const r = await fetch("/api/pipeline/save", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        selectedScenarioId: state.selectedScenarioId, taskPrompt: state.taskPrompt,
        llmProvider: state.llmProvider, modelTier: state.modelTier,
        targetLevels: state.targetLevels, coverageSeed: state.coverageSeed,
        narrativeRunId: state.narrativeRunId, narrativeDraft: state.narrativeDraft,
        agentRunId: state.agentRunId, agentResult: state.agentResult,
        domainEdits: state.domainEdits, domainEditHistory: state.domainEditHistory,
        jdTreeSlice: state.jdTreeSlice, jdTreeSelectedNodeIds: state.jdTreeSelectedNodeIds,
        jdTreeSelection: state.jdTreeSelection,
        deliveryCaseCount: state.deliveryCaseCount, deliveryBatchSeed: state.deliveryBatchSeed,
        deliveryBatch: state.deliveryBatch, deliverySelectedCase: state.deliverySelectedCase,
        deliveryOverrides: state.deliveryOverrides, deliveryHumanEdits: state.deliveryHumanEdits,
        deliveryStale: state.deliveryStale,
        currentStage: state.currentStage, maxUnlocked: state.maxUnlocked,
        completedSteps: Array.from(state.completed), stageSchema: 6,
        abilityIdScheme: ABILITY_ID_SCHEME, savedAt: new Date().toISOString(),
      })});
    state.saveNotice = r.ok ? "已保存检查点 ✓" : "保存失败";
  } catch(e) { state.saveNotice = "保存失败: " + e; }
  render();
}

async function loadPipeline() {
  try {
    const r = await fetch("/api/pipeline/load", {cache: "no-store"});
    if (!r.ok) { state.saveNotice = "没有已保存的进度"; render(); return; }
    const d = await r.json();
    if (d.abilityIdScheme !== ABILITY_ID_SCHEME) {
      state.saveNotice = "该检查点使用旧能力编号，请重新运行本轮任务";
      render();
      return;
    }
    const runtime = runtimeSnapshot();
    state = Object.assign(initialState(), runtime);
    state.selectedScenarioId = d.selectedScenarioId || SCENARIO_NONE;
    applyScenarioSelection(state.selectedScenarioId);
    if (d.taskPrompt !== undefined) state.taskPrompt = d.taskPrompt;
    if (d.llmProvider) state.llmProvider = d.llmProvider;
    if (d.modelTier) state.modelTier = d.modelTier;
    if (d.targetLevels && typeof d.targetLevels === "object" && Object.keys(d.targetLevels).length) {
      state.targetLevels = d.targetLevels;
    } else if (!Object.keys(state.targetLevels || {}).length) {
      state.targetLevels = defaultTargetLevels();
    }
    if (d.coverageSeed !== undefined && d.coverageSeed !== null) state.coverageSeed = parseInt(d.coverageSeed, 10) || 0;
    if (d.narrativeDraft) {
      state.narrativeRunId = d.narrativeRunId || null;
      state.narrativeDraft = d.narrativeDraft; state.narrativeOriginal = d.narrativeDraft; state.narrativeStatus = "done";
    }
    if (d.agentResult) {
      state.agentRunId = d.agentRunId || null;
      state.agentResult = d.agentResult; state.agentStatus = "done"; state.agentPhase = "done";
      const jd = (d.agentResult.candidate && d.agentResult.candidate.jd_candidates) || [];
      if (jd.length) state.extractionStatus = "done";
    }
    if (d.domainEdits) state.domainEdits = d.domainEdits;
    if (Array.isArray(d.domainEditHistory)) state.domainEditHistory = d.domainEditHistory;
    if (d.jdTreeSlice) {
      state.jdTreeSlice = d.jdTreeSlice;
      state.jdTreeStatus = "ready";
    }
    if (Array.isArray(d.jdTreeSelectedNodeIds)) state.jdTreeSelectedNodeIds = d.jdTreeSelectedNodeIds;
    if (d.jdTreeSelection) state.jdTreeSelection = d.jdTreeSelection;
    if (d.deliveryCaseCount) state.deliveryCaseCount = d.deliveryCaseCount;
    if (d.deliveryBatchSeed !== undefined) state.deliveryBatchSeed = d.deliveryBatchSeed;
    if (d.deliveryBatch) state.deliveryBatch = d.deliveryBatch;
    if (d.deliverySelectedCase !== undefined) state.deliverySelectedCase = d.deliverySelectedCase;
    if (d.deliveryOverrides && typeof d.deliveryOverrides === "object") state.deliveryOverrides = d.deliveryOverrides;
    if (d.deliveryHumanEdits && typeof d.deliveryHumanEdits === "object") state.deliveryHumanEdits = d.deliveryHumanEdits;
    state.deliveryStale = !!d.deliveryStale;
    const loadedBasis = (state.jdTreeSelection && state.jdTreeSelection.selection_basis) || {};
    const discardedLegacyGlobalSelection = !!(
      state.jdTreeSelection
      && loadedBasis.global_variables_included !== false
      && (state.jdTreeSelection.selected_nodes || []).some(node => node.owner_a === "MULTI")
    );
    if (discardedLegacyGlobalSelection) {
      if (state.agentResult && state.agentResult.candidate) {
        state.agentResult.candidate.jd_candidates = [];
        state.agentResult.candidate.runtime_dependencies = [];
      }
      state.extractionStatus = "idle";
      state.jdTreeSlice = null;
      state.jdTreeSelectedNodeIds = [];
      state.jdTreeSelection = null;
      state.domainEdits = {};
      state.domainEditHistory = [];
      state.deliveryBatch = null;
      state.deliveryStale = false;
    }
    state.completed = migrateCompletedSteps(d.completedSteps || [], d.stageSchema, !!d.agentResult);
    const completedArr = Array.from(state.completed);
    const computedUnlocked = completedArr.length ? Math.min(Math.max.apply(null, completedArr) + 1, STAGES.length - 1) : 0;
    state.maxUnlocked = Number.isInteger(d.maxUnlocked) ? Math.min(Math.max(d.maxUnlocked, computedUnlocked), STAGES.length - 1) : computedUnlocked;
    if (state.agentStatus === "done") state.maxUnlocked = Math.max(state.maxUnlocked, 2);
    state.currentStage = Number.isInteger(d.currentStage) ? Math.min(Math.max(d.currentStage, 0), state.maxUnlocked) : state.maxUnlocked;
    if (discardedLegacyGlobalSelection) {
      state.completed = new Set(Array.from(state.completed).filter(step => step <= 1));
      state.maxUnlocked = Math.min(state.maxUnlocked, 2);
      state.currentStage = Math.min(state.currentStage, 2);
      state.saveNotice = "检查点的 STEP 1–2 已加载；旧全局变量结果未带入新流程";
    } else {
      state.saveNotice = "已加载检查点 ✓";
    }
  } catch(e) { state.saveNotice = "加载失败: " + e; }
  render();
}

function workflowActionBar(options) {
  const opts = options || {};
  const actions = opts.actions || "";
  const note = opts.note || state.saveNotice || "浏览器自动暂存；保存可建立手动检查点";
  return '<section class="workflow-action-bar" aria-label="本步操作">'
    + '<div class="workflow-action-copy"><b>本步操作</b><span>' + escapeHtml(note) + '</span></div>'
    + '<div class="workflow-action-buttons">' + actions
    + '<button class="btn" type="button" onclick="loadPipeline()">加载进度</button>'
    + '<button class="btn" type="button" onclick="savePipeline()">保存进度</button>'
    + '</div></section>';
}

function saveBar() {
  return workflowActionBar();
}
