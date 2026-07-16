/* pipeline/js/scenarios.js */
function scenarioPromptText(scenarioId) {
  if (!scenarioId) return "";
  const found = ((state.scenarioRegistry && state.scenarioRegistry.scenarios) || [])
    .find(s => s.scenario_id === scenarioId);
  const task = scenarioExampleText(scenarioId).replace(/^例如：/, "").trim();
  if (!found) return task;
  const parts = [];
  if (found.title) parts.push("场景：" + String(found.title).trim());
  if (found.summary) parts.push(String(found.summary).trim());
  const boundaries = found.fixed_boundary || [];
  if (boundaries.length) {
    parts.push("业务边界：\n" + boundaries.map(item => "- " + String(item).trim()).join("\n"));
  }
  const modules = found.available_task_modules || [];
  if (modules.length) {
    parts.push("可选任务模块：\n" + modules.map(m => {
      const name = String((m && m.name) || "").trim();
      const req = String((m && m.requirement) || "").trim();
      return "- " + name + (req ? ("：" + req) : "");
    }).join("\n"));
  }
  if (task) parts.push("任务：" + task);
  return parts.join("\n\n");
}

function applyScenarioSelection(scenarioId, { fillExample } = {}) {
  state.selectedScenarioId = scenarioId || SCENARIO_NONE;
  if (!scenarioId) {
    state.fixedScenario = null;
  } else {
    const found = ((state.scenarioRegistry && state.scenarioRegistry.scenarios) || [])
      .find(s => s.scenario_id === scenarioId);
    state.fixedScenario = found || null;
  }
  if (fillExample && scenarioId) {
    state.taskPrompt = scenarioPromptText(scenarioId);
  }
}
