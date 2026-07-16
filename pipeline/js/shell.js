/* pipeline/js/shell.js */
function llmPhasePill(status) {
  if (status === "running") return pill("running", "proposed");
  if (status === "done") return pill("done", "given");
  if (status === "error") return pill("error", "risk");
  return pill(status || "idle", "tbd");
}

function providerHealthMap() {
  const hi = state.healthInfo || {};
  if (hi.providers && typeof hi.providers === "object") return hi.providers;
  // 兼容旧版 /api/health（无 providers 字段）：用 agent_ready 推断 DeepSeek
  if (hi.agent_ready) {
    return {
      deepseek: {
        label: "DeepSeek",
        ready: true,
        models: {
          flash: hi.flash_model || "deepseek-chat",
          lite: hi.lite_model || "deepseek-chat",
          pro: hi.pro_model || "deepseek-chat",
        },
      },
      gemini: { label: "Gemini", ready: false, models: {} },
    };
  }
  return {};
}

function providerOptions() {
  const providers = providerHealthMap();
  return ["deepseek", "gemini"].map(id => ({
    id: id,
    label: (providers[id] && providers[id].label) || (id === "gemini" ? "Gemini" : "DeepSeek"),
    ready: !!(providers[id] && providers[id].ready),
  }));
}

function selectedProviderInfo() {
  const providers = providerHealthMap();
  return providers[state.llmProvider || "deepseek"] || null;
}

function providerReady() {
  const info = selectedProviderInfo();
  return state.serverStatus === "ready" && !!(info && info.ready);
}

function connectionMeta() {
  if (state.serverStatus === "checking" || !state.healthInfo) {
    return { label: "checking", cls: "proposed", detail: "正在检查连接…" };
  }
  const info = selectedProviderInfo();
  if (info && info.ready) return { label: "connected", cls: "given", detail: info.label + " API Key 已就绪" };
  if (state.serverStatus === "missing_api_key" || (info && !info.ready)) {
    return { label: "no_api_key", cls: "tbd", detail: "本地服务在线，但 " + ((info && info.label) || state.llmProvider) + " 尚未配置 Key" };
  }
  if (state.serverStatus === "offline") return { label: "offline", cls: "risk", detail: "无法连接本地 Agent 服务" };
  return { label: "checking", cls: "proposed", detail: "正在检查连接…" };
}

function modelOptions() {
  const hi = selectedProviderInfo() || {};
  const models = hi.models || {};
  const legacy = state.healthInfo || {};
  return [
    { tier: "flash", label: "Flash", id: models.flash || legacy.flash_model || "未配置" },
    { tier: "lite", label: "Lite", id: models.lite || legacy.lite_model || "未配置" },
    { tier: "pro", label: "Pro", id: models.pro || legacy.pro_model || "未配置" },
  ];
}

function selectedModelId() {
  const hit = modelOptions().find(m => m.tier === state.modelTier);
  return (hit && hit.id) || "未配置";
}

function syncContextCollapsed() {
  const consoleEl = document.querySelector("main.console");
  const toggle = document.getElementById("contextToggle");
  const label = toggle && toggle.querySelector(".context-chevron-label");
  if (consoleEl) consoleEl.classList.toggle("context-collapsed", !!state.contextCollapsed);
  if (toggle) toggle.setAttribute("aria-expanded", state.contextCollapsed ? "false" : "true");
  if (label) label.textContent = state.contextCollapsed ? "展开" : "收起";
}

function renderContext() {
  syncContextCollapsed();
  const narStatus = state.narrativeError ? "error" : state.narrativeStatus;
  const clsStatus = state.agentError ? "error" : state.agentStatus;
  const extStatus = state.extractionError ? "error" : state.extractionStatus;
  const busy = narStatus === "running" || clsStatus === "running" || extStatus === "running";
  const conn = connectionMeta();
  const valStatus = state.agentResult ? state.agentResult.validation_status : null;
  const jdCount = state.agentResult && state.agentResult.candidate
    ? (state.agentResult.candidate.jd_candidates || []).length : 0;
  const tbdCount = state.agentResult && state.agentResult.candidate
    ? (state.agentResult.candidate.jd_candidates || []).filter(j => (j.binding_mode || "") === "TBD").length : 0;
  const lastModel = state.agentResult && state.agentResult.model;
  const lastProvider = state.agentResult && state.agentResult.provider;

  let h = '<div class="context-block"><div class="context-label">Server</div><div class="context-value">' + pill(state.serverStatus, state.serverStatus === "ready" ? "given" : "tbd") + '</div></div>';
  if (state.catalogSummary) h += '<div class="context-block"><div class="context-label">Catalog</div><div class="context-value">' + state.catalogSummary.counts.abilities + "A · " + state.catalogSummary.counts.gal_cells + " A×L · " + state.catalogSummary.counts.jd_fields + " JD</div></div>";

  h += '<div class="context-block"><div class="context-label">LLM Analysis</div><div class="context-value" style="display:grid;gap:8px">';
  h += '<div>Connection ' + pill(conn.label, conn.cls) +
    '<div class="action-note" style="margin-top:4px">' + escapeHtml(conn.detail) + "</div></div>";
  h += '<div><div class="field-label" style="margin:0 0 5px"><label>Provider</label><span>按本机 Key 可用</span></div>';
  h += '<select id="providerSelect" class="case-select" style="width:100%;max-width:none;min-height:34px;font-size:11px"' + (busy ? " disabled" : "") + '>';
  providerOptions().forEach(p => {
    h += '<option value="' + p.id + '"' + (p.id === state.llmProvider ? " selected" : "") + ">" +
      escapeHtml(p.label + (p.ready ? " · ready" : " · no key")) + "</option>";
  });
  h += "</select></div>";
  h += '<div><div class="field-label" style="margin:0 0 5px"><label>模型</label><span>' +
    escapeHtml(selectedModelId()) + "</span></div>";
  h += '<select id="modelTierSelect" class="case-select" style="width:100%;max-width:none;min-height:34px;font-size:11px"' +
    (busy || !providerReady() ? " disabled" : "") + ">";
  modelOptions().forEach(m => {
    h += '<option value="' + m.tier + '"' + (m.tier === state.modelTier ? " selected" : "") + ">" +
      escapeHtml(m.label + " · " + m.id) + "</option>";
  });
  h += "</select>";
  if (lastModel) h += '<div class="action-note" style="margin-top:4px">上次实际调用 · <span class="mono">' + escapeHtml((lastProvider || state.llmProvider) + " / " + lastModel) + "</span></div>";
  h += "</div>";
  h += '<div>STEP 2 文案扩充 ' + llmPhasePill(narStatus) +
    (state.narrativeRunId ? ' <span class="mono" style="font-size:9px;color:var(--muted)">' + escapeHtml(state.narrativeRunId) + "</span>" : "") + "</div>";
  const covProgLabel = (clsStatus === "running" && state.coverageProgress && state.coverageProgress.total > 1)
    ? (" · 第 " + state.coverageProgress.chunk + "/" + state.coverageProgress.total + " 批") : "";
  h += '<div>STEP 2 A×L 分类 ' + llmPhasePill(clsStatus) + escapeHtml(covProgLabel) +
    (state.agentRunId ? ' <span class="mono" style="font-size:9px;color:var(--muted)">' + escapeHtml(state.agentRunId) + "</span>" : "") + "</div>";
  const extProgLabel = (extStatus === "running" && state.extractionProgress && state.extractionProgress.total)
    ? (" · 第 " + state.extractionProgress.chunk + "/" + state.extractionProgress.total + " 批") : "";
  h += '<div>STEP 3 JD 域提取 ' + llmPhasePill(extStatus) + escapeHtml(extProgLabel) +
    (state.extractionRunId ? ' <span class="mono" style="font-size:9px;color:var(--muted)">' + escapeHtml(state.extractionRunId) + "</span>" : "") + "</div>";
  if (valStatus && jdCount) {
    h += '<div>校验 ' + pill(valStatus, valStatus === "pass" ? "given" : "tbd") +
      (' · JD ' + jdCount + (tbdCount ? ' · TBD ' + tbdCount : "")) + "</div>";
  }
  if (state.narrativeError) h += '<div style="color:var(--red);font-size:10px">' + escapeHtml(state.narrativeError) + "</div>";
  if (state.agentError) h += '<div style="color:var(--red);font-size:10px">' + escapeHtml(state.agentError) + "</div>";
  if (state.extractionError) h += '<div style="color:var(--red);font-size:10px">' + escapeHtml(state.extractionError) + "</div>";
  h += "</div></div>";

  if (state.agentResult && state.agentResult.candidate) {
    const covGroups = groupCoverageByG(state.agentResult.candidate.coverage_candidates || []);
    h += '<div class="context-block"><div class="context-label">Coverage · 按 G 分组</div>';
    covGroups.forEach(g => {
      h += '<div class="cov-g-row"><span class="cov-g-label">' + escapeHtml(g.title) + '</span>'
        + '<div class="mini-tags">' + g.cells.map(cell =>
          '<span class="mini-tag scored ' + cellLevelClass(cell) + '">' + escapeHtml(cell) + "</span>"
        ).join("") + "</div></div>";
    });
    h += "</div>";
  }
  h += '<div class="context-block"><div class="context-label">Progress</div><div class="progress-track"><div class="progress-fill" style="width:' + (state.completed.size / STAGES.length * 100) + '%"></div></div><div class="action-note">' + state.completed.size + '/' + STAGES.length + '</div></div>';
  document.getElementById("contextPanel").innerHTML = h;
  const ps = document.getElementById("providerSelect");
  if (ps) ps.addEventListener("change", () => { state.llmProvider = ps.value; render(); });
  const ms = document.getElementById("modelTierSelect");
  if (ms) ms.addEventListener("change", () => { state.modelTier = ms.value; render(); });
}
