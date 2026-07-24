/* One-click draft orchestration. Every checkpoint remains reviewable/editable. */

function setFactoryRunProgress(step, message) {
  state.factoryRunStep = step;
  state.factoryRunError = null;
  state.deliveryNotice = message || null;
  render();
}

async function runFactoryDraftToStep6() {
  if (state.factoryRunStatus === "running") return;
  const prompt = String(state.taskPrompt || "").trim();
  if (prompt.length < 10) {
    state.factoryRunError = "请先写至少 10 个字的任务描述。";
    render();
    return;
  }
  if (!providerReady()) {
    state.factoryRunError = "当前没有可用的模型 Provider / API Key。";
    render();
    return;
  }

  state.factoryRunStatus = "running";
  state.factoryRunError = null;
  state.factoryRunStep = "准备 A×L 草案";
  state.deliveryBatch = null;
  state.deliverySelectedCase = 0;
  state.deliveryOverrides = {};
  state.deliveryHumanEdits = {};
  state.deliveryStale = false;
  if (!selectedCoverageCells().length) {
    randomizeCoverage(state.coverageSeed || 0);
  }
  resetNarrativeForCoverage();
  state.completed.add(0);
  state.maxUnlocked = Math.max(state.maxUnlocked, 1);
  state.currentStage = 1;

  try {
    setFactoryRunProgress("STEP 2 / 6", "正在扩充任务文案…");
    if (!await runNarrative()) throw new Error(state.narrativeError || "文案扩充失败");

    setFactoryRunProgress("STEP 2 / 6", "正在确认 A×L 草案与责任边界…");
    if (!await runCoverage()) throw new Error(state.agentError || "A×L 分类失败");
    state.completed.add(1);
    state.maxUnlocked = Math.max(state.maxUnlocked, 2);
    state.currentStage = 2;

    setFactoryRunProgress("STEP 3 / 6", "正在按 L 累计规则加载能力变量…");
    if (!await loadJdV2Slice({preserveSelection: false})) {
      throw new Error(state.jdTreeError || "变量树加载失败");
    }
    const selection = await buildJdTreeSelectionArtifact();
    if (!selection) throw new Error(state.jdTreeError || "变量选择清单生成失败");
    if (!await runExtraction()) throw new Error(state.extractionError || "JD 域提取失败");
    state.completed.add(2);
    state.maxUnlocked = Math.max(state.maxUnlocked, 3);
    state.currentStage = 3;

    setFactoryRunProgress("STEP 4 / 6", "正在从已选变量加载可确认取值域…");
    await loadTreeDomains();
    state.completed.add(3);
    state.maxUnlocked = Math.max(state.maxUnlocked, 4);
    state.currentStage = 4;

    setFactoryRunProgress("STEP 5 / 6", "正在生成 Task Template 案例与两侧配置…");
    if (!await generateDeliveryBatch({
      notice: "一键草案已生成；请逐步复核，修改后可在 STEP 6 重新生成。",
    })) {
      throw new Error(state.deliveryError || "交付案例生成失败");
    }

    state.completed.add(4);
    state.maxUnlocked = 5;
    state.currentStage = 5;
    state.factoryRunStatus = "done";
    state.factoryRunStep = "STEP 6 / 6";
    state.deliveryNotice = "已一键生成到 STEP 6；所有中间步骤仍可进入检查和修改。";
  } catch (error) {
    state.factoryRunStatus = "error";
    state.factoryRunError = String(error && error.message ? error.message : error);
  }
  render();
}
