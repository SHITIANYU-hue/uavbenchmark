/* pipeline/js/steps.js */
function renderStep1() {
  const alreadyDone = state.completed.has(0);
  const ready = !!(state.scenarioRegistry && state.scenarioRegistry.scenarios);
  const promptOk = state.taskPrompt.trim().length >= 5;
  setHeader(0, alreadyDone ? "可继续修改" : "等待确认");
  if (!ready) {
    document.getElementById("workspaceBody").innerHTML = '<div class="choice-card">读取场景示例中...</div>';
    return;
  }
  const opts = ['<option value="' + SCENARIO_NONE + '"' + (!state.selectedScenarioId ? " selected" : "") + ">自己写（不加载示例）</option>"]
    .concat(((state.scenarioRegistry && state.scenarioRegistry.scenarios) || []).map(s =>
      '<option value="' + s.scenario_id + '"' + (s.scenario_id === state.selectedScenarioId ? " selected" : "") + ">" +
      escapeHtml(s.title) + "</option>"
    )).join("");
  let h = saveBar()
    + '<p class="intro">写清任务即可。需要示例时，从下拉选一个场景，内容会直接填进文本框，可再改。</p>'
    + '<div class="field-label"><label>加载示例（可选）</label><span>选中即写入文本框</span></div>'
    + '<div class="control" style="margin-bottom:14px"><select id="scenarioSelect">' + opts + "</select></div>"
    + '<div class="field-label"><label>任务描述</label><span>必填 · 至少 5 个字</span></div>'
    + '<textarea class="task-input" id="taskPrompt" style="min-height:220px" placeholder="用几句话说明让无人机做什么、关注什么异常、希望得到什么结果。">' +
      escapeHtml(state.taskPrompt) + "</textarea>";
  const note = promptOk
    ? (alreadyDone ? "可修改后再次确认，或直接进入下一步" : "确认后进入下一步")
    : "请先输入至少 5 个字的任务描述";
  h += '<div class="action-row"><span class="action-note" id="step1Note">' + note + '</span>'
    + '<button class="btn primary" type="button" id="confirmStep1Btn" onclick="confirmStep1()"' +
    (promptOk ? "" : " disabled") + ">" + (alreadyDone ? "进入下一步 →" : "确认 →") + "</button></div>";
  document.getElementById("workspaceBody").innerHTML = h;
  const sel = document.getElementById("scenarioSelect");
  if (sel) sel.addEventListener("change", () => {
    applyScenarioSelection(sel.value, { fillExample: !!sel.value });
    render();
  });
  const ta = document.getElementById("taskPrompt");
  if (ta) ta.addEventListener("input", () => {
    state.taskPrompt = ta.value;
    const ok = state.taskPrompt.trim().length >= 5;
    const btn = document.getElementById("confirmStep1Btn");
    const tip = document.getElementById("step1Note");
    if (btn) btn.disabled = !ok;
    if (tip) tip.textContent = ok
      ? (state.completed.has(0) ? "可修改后再次确认，或直接进入下一步" : "确认后进入下一步")
      : "请先输入至少 5 个字的任务描述";
  });
}

function confirmStep1() {
  if (state.taskPrompt.trim().length < 5) return;
  completeStage(0);
}

function renderStep2a() {
  setHeader(1, state.completed.has(1) ? "已完成" : state.agentStatus === "done" ? "A×L 待确认" : state.narrativeStatus === "done" ? "文案待确认" : "等待运行");
  const hasN = state.narrativeStatus === "done", hasA = state.agentStatus === "done";
  const canEditCov = !hasN && state.narrativeStatus !== "running";
  let h = saveBar() + '<p class="intro">STEP 2：选目标 Coverage 并确认 → 扩充文案（自动保存）→ 确认文案后只跑 A×L 分类（按已选 A×L 分批进行，可看进度）。JD 域提取放到 STEP 3 单独运行。</p>';
  h += renderCoveragePickerHtml({ editable: canEditCov });
  h += '<div class="field-label" style="margin-top:10px"><label>① 文案扩充</label></div>';
  if (state.narrativeStatus === "running") h += '<div class="choice-card selected"><b>调用中...</b></div>';
  else if (hasN) {
    h += '<textarea class="task-input" id="narEdit" style="min-height:180px">' + escapeHtml(state.narrativeDraft) + '</textarea>';
    h += '<div class="action-row"><span class="action-note">可直接修改文案；若要改 coverage，请点「重选 coverage 再扩充」</span>'
      + '<button class="btn" type="button" onclick="resetNarrativeForCoverage()">重选 coverage 再扩充</button>'
      + '<button class="btn primary" onclick="confirmNar()"'+ (state.agentStatus === "running" ? " disabled" : "") + '>确认文案 → 跑分类</button></div>';
  } else {
    const cells = selectedCoverageCells();
    const ready = providerReady() && cells.length > 0;
    const note = !providerReady()
      ? "请先在侧栏选好可用的 Provider / Key"
      : (!cells.length
        ? "请先在上方选择至少一个 A×L（可改等级或恢复默认）"
        : "已选 " + cells.length + " 个 A×L，确认后开始扩充文案");
    h += '<div class="action-row" style="margin-top:8px"><span class="action-note">' + escapeHtml(note) + '</span>'
      + '<button class="btn primary" type="button" onclick="runNarrative()"' + (ready ? "" : " disabled") + ">"
      + "确认 Coverage → 运行文案扩充</button></div>";
    if (state.narrativeError) h += '<div class="choice-card dependency selected" style="margin-top:8px"><b>错误</b><p>' + escapeHtml(state.narrativeError) + "</p></div>";
  }
  if (state.agentStatus === "running") {
    const cp = state.coverageProgress;
    const cpNote = cp && cp.total > 1 ? ("A×L 分类调用中…第 " + cp.chunk + "/" + cp.total + " 批") : "A×L 分类调用中...";
    const cpBody = cp && cp.total > 1
      ? "已选 A×L 分批分类，可看到进度并降低单次返回被截断的风险。"
      : "按目标 coverage 与文案确定计分 A×L 与责任边界。";
    h += '<div class="field-label" style="margin-top:16px"><label>② A×L 分类</label></div>';
    h += '<div class="choice-card selected" id="coverageProgressCard" style="margin-top:8px"><b>' + escapeHtml(cpNote) + '</b>'
      + '<p>' + escapeHtml(cpBody) + '</p></div>';
  }
  if (hasA) {
    const c = state.agentResult.candidate;
    const issueIdx = indexValidationIssues();
    h += '<div class="field-label" style="margin-top:16px"><label>结果 · A×L 覆盖（' + (c.coverage_candidates || []).length + '）</label></div>';
    h += '<div class="coverage-chips">' + (c.coverage_candidates || []).map(x => '<span class="lvl-pill ' + cellLevelClass(x.cell) + '">' + escapeHtml(x.cell) + "</span>").join("") + '</div>';
    h += renderCoverageHints(issueIdx.byCell);
    if (issueIdx.other.length) {
      h += renderInlineHints(issueIdx.other.slice(0, 8), { title: "其他校验 · " + issueIdx.other.length + " 条" });
    }
    h += '<div class="action-row" style="margin-top:14px"><span class="action-note">确认 A×L 后进入 STEP 3，单独运行 JD 域提取</span>'
      + '<button class="btn primary" onclick="completeStage(1)">确认 A×L → STEP 3</button></div>';
  }
  if (state.agentError) h += '<div class="choice-card dependency selected" style="margin-top:8px"><b>分类错误</b><p>' + escapeHtml(state.agentError) + "</p></div>";
  document.getElementById("workspaceBody").innerHTML = h;
  bindCoveragePicker();
  const ne = document.getElementById("narEdit");
  if (ne) ne.addEventListener("input", () => { state.narrativeDraft = ne.value; });
}

function renderStep2b() {
  const hasCoverage = state.agentResult && state.agentResult.candidate && (state.agentResult.candidate.coverage_candidates || []).length;
  const hasJd = state.extractionStatus === "done" && state.agentResult && state.agentResult.candidate && (state.agentResult.candidate.jd_candidates || []).length;
  setHeader(2, state.completed.has(2) ? "已完成" : hasJd ? "待确认" : state.extractionStatus === "running" ? "提取中" : hasCoverage ? "待运行提取" : "等待 STEP 2");
  let h = saveBar() + '<p class="intro">STEP 3：在这里单独运行 JD 域提取（由 STEP 2 的 coverage 决定）。提取分批进行，避免一次返回过长被截断；失败可直接重试。</p>';
  if (!hasCoverage) {
    h += '<div class="choice-card dependency selected"><b>尚未完成 STEP 2</b><p>请先在 STEP 2 完成文案确认与 A×L 分类。</p></div>';
    h += '<div class="action-row" style="margin-top:12px"><button class="btn" type="button" onclick="goToStage(1)">← 回 STEP 2</button></div>';
    document.getElementById("workspaceBody").innerHTML = h;
    return;
  }
  const cov = state.agentResult.candidate.coverage_candidates || [];
  h += '<div class="field-label" style="margin-top:8px"><label>来自 STEP 2 的 A×L（' + cov.length + '）</label></div>';
  h += '<div class="coverage-chips">' + cov.map(x => '<span class="lvl-pill ' + cellLevelClass(x.cell) + '">' + escapeHtml(x.cell) + "</span>").join("") + '</div>';

  if (state.extractionStatus === "running") {
    const pr = state.extractionProgress;
    const note = pr && pr.total ? ("正在提取 JD 变量域…第 " + pr.chunk + "/" + pr.total + " 批") : "正在根据 A×L 提取 JD 变量域…";
    h += '<div class="choice-card selected" id="extractionProgressCard" style="margin-top:12px"><b>' + escapeHtml(note) + '</b>'
      + '<p>分批调用可避免单次响应过长被截断，请稍候。提取期间可随时点上方 STEP 跳转。</p></div>';
  } else if (!hasJd) {
    const label = state.extractionError ? "重试 JD 域提取" : "运行 JD 域提取";
    const note = state.extractionError ? "上次提取失败，可直接重试（不需重跑 STEP 2）" : "点下方按钮，根据已确认的 A×L 提取 JD 变量域";
    if (state.extractionError) {
      h += '<div class="choice-card dependency selected" style="margin-top:12px"><b>提取失败</b><p>' + escapeHtml(state.extractionError) + "</p></div>";
    }
    h += '<div class="action-row" style="margin-top:12px"><span class="action-note">' + escapeHtml(note) + '</span>'
      + '<button class="btn primary" type="button" onclick="runExtraction()"' + (providerReady() ? "" : " disabled") + ">" + escapeHtml(label) + "</button></div>";
    document.getElementById("workspaceBody").innerHTML = h;
    return;
  }

  {
    const c = state.agentResult.candidate;
    const issueIdx = indexValidationIssues();
    const tbdSlots = (c.jd_candidates || []).filter(j => (j.binding_mode || "") === "TBD");
    h += '<div class="action-row" style="margin-top:10px"><span class="action-note">已提取 ' + (c.jd_candidates || []).length + ' 个 JD 域；如需重跑可重试</span>'
      + '<button class="btn" type="button" onclick="runExtraction()"' + (providerReady() ? "" : " disabled") + ">重跑提取</button></div>";
    h += '<div class="field-label"><label>结果 · JD 变量域（' + (c.jd_candidates || []).length + ' 个，按 A 分类）</label></div>';
    if (tbdSlots.length) {
      h += '<div class="tbd-banner"><b>待补全 TBD · ' + tbdSlots.length + ' 个</b>'
        + '<p>琥珀色行即 TBD；进入 STEP 4 可「智能填写 TBD」或手改。</p>'
        + '<div class="coverage-chips">' + tbdSlots.map(j =>
          '<span class="lvl-pill lv-L3">' + escapeHtml(j.slot_id) + '</span>'
        ).join("") + '</div></div>';
    }
    groupJdItems(c.jd_candidates || [], j => j.slot_id).forEach(g => {
      h += '<div class="group-label" style="margin-top:14px">' + escapeHtml(g.title)
        + (g.subtitle ? (' · ' + escapeHtml(g.subtitle)) : "")
        + ' · ' + g.items.length + '</div>';
      h += '<table class="data-table"><thead><tr><th>Slot</th><th>Name</th><th>Domain（Agent 分析结果）</th><th>Mode</th></tr></thead><tbody>'
        + g.items.map(j => {
            const bm = j.binding_mode || "fixed";
            const hints = issueIdx.byJd[j.slot_id] || [];
            let v = "—";
            if (bm === "enum") v = (j.allowed_values || []).map(escapeHtml).join(", ") || "—";
            else if (bm === "range") v = (j.minimum != null && j.maximum != null) ? ("[" + j.minimum + "~" + j.maximum + "]") : "—";
            else if (j.value) v = escapeHtml(String(j.value));
            else if (bm === "TBD") v = escapeHtml(j.source_note || "Agent 未推出域 · STEP 4 可补");
            const rowCls = bm === "TBD" ? "row-tbd" : (hints.length ? "row-issue" : "");
            return "<tr class='" + rowCls + "'><td class='mono'>" + escapeHtml(j.slot_id) + "</td><td>" + escapeHtml(j.name)
              + "</td><td>" + v + renderInlineHints(hints, { title: "提示 · " + hints.length, compact: true })
              + "</td><td>" + pill(bm) + "</td></tr>";
          }).join("") + '</tbody></table>';
    });
    h += '<div class="action-row" style="margin-top:14px"><span class="action-note">确认后进入 STEP 4 编辑任务域模版</span>'
      + '<button class="btn primary" onclick="completeStage(2)">确认 → STEP 4</button></div>';
  }
  document.getElementById("workspaceBody").innerHTML = h;
}

function renderStep3() {
  setHeader(3, state.completed.has(3) ? "已确认" : "编辑取值域");
  const edits = getEdits();
  const tbdCount = edits.filter(e => e.binding_mode === "TBD").length;
  let h = saveBar() + '<p class="intro">域编辑器：为每个 JD 变量选模式。fixed=固定；enum=离散选项；range=数值区间；TBD=未知。可对 TBD 一键智能填写。</p>';
  h += narrativeReferencePanel({ open: false });
  const c = state.agentResult ? state.agentResult.candidate : null;
  if (c && c.coverage_candidates) {
    h += '<div class="field-label" style="margin-top:8px"><label>A×L（' + c.coverage_candidates.length + ' 个）</label></div>';
    h += '<div class="coverage-chips">' + c.coverage_candidates.map(x => '<span class="lvl-pill ' + cellLevelClass(x.cell) + '">' + escapeHtml(x.cell) + '</span>').join("") + '</div>';
  }
  const issueIdx = indexValidationIssues();
  const tbdList = edits.filter(e => e.binding_mode === "TBD");
  if (tbdCount) {
    h += '<div class="tbd-banner"><b>待处理 TBD · ' + tbdCount + ' 个</b>'
      + '<p>琥珀色行为 TBD。可点「智能填写 TBD」，或在行内改 Mode/Domain。对应校验提示已挂在行下。</p>'
      + '<div class="coverage-chips">' + tbdList.map(e =>
        '<span class="lvl-pill lv-L3">' + escapeHtml(e.slot_id) + '</span>'
      ).join("") + '</div></div>';
  }
  h += '<div class="action-row" style="margin:0 0 12px"><span class="action-note">当前 TBD ' + tbdCount + ' 个</span><div>'
    + '<button class="btn" type="button" onclick="loadTreeDomains()"' +
    (state.fillTbdLoading ? " disabled" : "") + '>从变量树加载</button> '
    + '<button class="btn" type="button" onclick="fillTbdDomains()"' +
    (state.fillTbdLoading || tbdCount === 0 || !providerReady() ? " disabled" : "") + ">" +
    (state.fillTbdLoading ? "智能填写中..." : "智能填写 TBD") + "</button></div></div>";
  if (state.fillTbdError) h += '<div class="choice-card dependency selected" style="margin-bottom:10px"><b>智能填写失败</b><p>' + escapeHtml(state.fillTbdError) + "</p></div>";
  if (state.fillTbdNotice) h += '<div class="choice-card selected" style="margin-bottom:10px"><b>' + escapeHtml(state.fillTbdNotice) + "</b></div>";
  const styleSelect = "padding:4px 8px;border:1px solid var(--line-strong);border-radius:6px;font-size:10px";
  const styleInput = "width:100%;padding:4px 8px;border:1px solid var(--line-strong);border-radius:6px;font-size:10px";
  const styleNum = "width:55px;padding:4px;border:1px solid var(--line-strong);border-radius:6px;font-size:10px";
  groupJdItems(edits, e => e.slot_id).forEach(g => {
    const gTbd = g.items.filter(e => e.binding_mode === "TBD").length;
    h += '<div class="group-label" style="margin-top:14px">' + escapeHtml(g.title)
      + (g.subtitle ? (' · ' + escapeHtml(g.subtitle)) : "")
      + ' · ' + g.items.length + (gTbd ? (' · TBD ' + gTbd) : "") + '</div>';
    h += '<table class="data-table"><thead><tr><th>Slot</th><th>Name</th><th>Mode</th><th>Domain</th></tr></thead><tbody>';
    g.items.forEach(e => {
      const bm = e.binding_mode;
      const sid = escapeHtml(e.slot_id);
      const hints = issueIdx.byJd[e.slot_id] || [];
      const rowCls = bm === "TBD" ? "row-tbd" : (hints.length ? "row-issue" : "");
      h += "<tr class=\"" + rowCls + "\"><td class='mono'>" + sid + "</td><td>" + escapeHtml(e.name) + "</td>";
      h += "<td><select data-slot=\"" + sid + "\" data-field=\"binding_mode\" class=\"domain-edit\" style=\"" + styleSelect + "\">";
      h += ["fixed", "enum", "range", "TBD"].map(m =>
        "<option value=\"" + m + "\"" + (m === bm ? " selected" : "") + ">" + m + "</option>"
      ).join("") + "</select></td>";
      if (bm === "fixed") {
        h += "<td><input type=\"text\" data-slot=\"" + sid + "\" data-field=\"value\" class=\"domain-edit\" value=\"" +
          escapeHtml(e.value || "") + "\" style=\"" + styleInput + "\">"
          + renderInlineHints(hints, { title: "提示 · " + hints.length, compact: true }) + "</td>";
      } else if (bm === "enum") {
        h += "<td><input type=\"text\" data-slot=\"" + sid + "\" data-field=\"allowed_values\" class=\"domain-edit\" value=\"" +
          escapeHtml((e.allowed_values || []).join(", ")) + "\" placeholder=\"A, B, C\" style=\"" + styleInput + "\">"
          + renderInlineHints(hints, { title: "提示 · " + hints.length, compact: true }) + "</td>";
      } else if (bm === "range") {
        h += "<td><input type=\"number\" data-slot=\"" + sid + "\" data-field=\"minimum\" class=\"domain-edit\" value=\"" +
          (e.minimum != null ? e.minimum : "") + "\" style=\"" + styleNum + "\"> ~ <input type=\"number\" data-slot=\"" +
          sid + "\" data-field=\"maximum\" class=\"domain-edit\" value=\"" +
          (e.maximum != null ? e.maximum : "") + "\" style=\"" + styleNum + "\">"
          + renderInlineHints(hints, { title: "提示 · " + hints.length, compact: true }) + "</td>";
      } else {
        const note = ((state.agentResult && state.agentResult.candidate && state.agentResult.candidate.jd_candidates) || [])
          .find(j => j.slot_id === e.slot_id);
        h += "<td><div>" + escapeHtml((note && note.source_note) || "待智能填写 / 人工补全域") + "</div>"
          + renderInlineHints(hints, { title: "提示 · " + hints.length, compact: true }) + "</td>";
      }
      h += "</tr>";
    });
    h += '</tbody></table>';
  });
  const variable = edits.filter(e => e.binding_mode === "enum" || e.binding_mode === "range").length;
  h += '<div class="action-row" style="margin-top:14px"><span class="action-note">' + variable + ' 个可变域 · TBD ' + tbdCount + '</span><button class="btn primary" onclick="completeStage(3)">确认 → STEP 5</button></div>';
  document.getElementById("workspaceBody").innerHTML = h;
  document.querySelectorAll(".domain-edit").forEach(el => {
    const apply = () => {
      const slot = el.getAttribute("data-slot");
      const field = el.getAttribute("data-field");
      let val = el.value;
      if (field === "minimum" || field === "maximum") val = val === "" ? null : parseFloat(val);
      setEdit(slot, field, val);
      if (field === "binding_mode") render();
    };
    el.addEventListener("change", apply);
    if (el.tagName === "INPUT") el.addEventListener("blur", apply);
  });
}

function buildDomainTemplate() {
  const c = state.agentResult ? state.agentResult.candidate : null;
  if (!c) return null;
  return {
    template_id: (c.task_title || "domain_tpl"),
    template_version: "0.1.0",
    title: c.task_title || "domain_tpl",
    scenario_summary: c.scenario_summary || "",
    natural_language_template: narrativeText(),
    coverage: c.coverage_candidates || [],
    runtime_dependencies: c.runtime_dependencies || [],
    jd_slots: getEdits().map(e => {
      const b = {mode: e.binding_mode, status: "verified"};
      if (e.binding_mode === "fixed") b.value = e.value;
      else if (e.binding_mode === "enum") { b.allowed_values = e.allowed_values; b.value = e.value; }
      else if (e.binding_mode === "range") { b.minimum = e.minimum; b.maximum = e.maximum; }
      else { b.mode = "TBD"; b.status = "TBD"; }
      return {slot_id: e.slot_id, description: e.name, visibility: "sut_visible", binding: b};
    }),
  };
}

function randomizeSeeds(n) {
  const count = Math.max(1, Math.min(50, parseInt(n) || 5));
  const pool = new Set();
  while (pool.size < count) pool.add(Math.floor(Math.random() * 100000));
  state.instanceRandomSeeds = Array.from(pool);
  return state.instanceRandomSeeds;
}

function rerollSeeds() {
  randomizeSeeds(state.instanceRandomCount);
  persistState();
  render();
}

async function genTaskTemplate() {
  const domain = buildDomainTemplate();
  if (!domain) { state.instanceError = "缺少任务域模版（请先完成 STEP 2–4）"; render(); return; }
  if (state.instanceMode === "random" && !(state.instanceRandomSeeds || []).length) {
    randomizeSeeds(state.instanceRandomCount);
  }
  state.instanceLoading = true; state.instanceError = null; state.instanceResult = null; state.instanceResults = null; render();
  try {
    const ep = (state.instanceMode === "traverse") ? "/api/task-template/traverse"
      : (state.instanceMode === "batch" || state.instanceMode === "random") ? "/api/task-template/batch"
      : "/api/task-template/generate";
    const body = state.instanceMode === "single"
      ? {domain_template: domain, seed: parseInt(state.instanceSeed) || 0}
      : state.instanceMode === "batch"
        ? {domain_template: domain, seeds: state.instanceBatchSeeds}
        : state.instanceMode === "random"
          ? {domain_template: domain, seeds: state.instanceRandomSeeds}
          : {domain_template: domain, steps_per_range: 3};
    const r = await fetch(ep, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
    const d = await r.json(); if (!r.ok) throw new Error(d.message || d.error || JSON.stringify(d));
    if (state.instanceMode === "single") state.instanceResult = d.task_template || d.instance;
    else state.instanceResults = d.task_templates || d.instances || [];
  } catch(e) { state.instanceError = String(e.message || e); }
  state.instanceLoading = false; render();
}

function buildSpecificTemplateDescription(tpl) {
  const c = state.agentResult && state.agentResult.candidate;
  const title = (c && c.task_title) || (tpl.template_ref && tpl.template_ref.template_id) || "特定任务模版";
  const summary = (c && c.scenario_summary) || "";
  const narrative = (c && c.natural_language_template) || state.narrativeDraft || "";
  const firstPara = narrative.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)[0] || "";
  const bindings = (tpl.slot_bindings || []).filter(s => s.status !== "TBD" && s.value != null && s.value !== "");
  const cov = (c && c.coverage_candidates) || [];
  const priorityIds = ["jd-0.1", "jd-0.2", "jd-0.3", "jd-0.4", "jd-0.7", "jd-0.9", "jd-6.1", "jd-2.2", "jd-9.1"];
  function bulletsFor(side) {
    const rows = bindings.filter(s => jdSide(s.slot_id) === side);
    rows.sort((a, b) => {
      const ia = priorityIds.indexOf(a.slot_id), ib = priorityIds.indexOf(b.slot_id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return rows.slice(0, 8).map(s => "- " + jdNameOf(s.slot_id) + "：" + formatJdValue(s.value));
  }
  const userBullets = bulletsFor("user");
  const worldBullets = bulletsFor("world");
  const lines = [];
  lines.push("【" + title + " · Seed " + tpl.seed + "】");
  if (summary) lines.push(summary);
  else if (firstPara) lines.push(firstPara);
  lines.push("");
  if (cov.length) lines.push("能力等级（A×L）：" + cov.map(x => x.cell).join("、"));
  lines.push("");
  lines.push("① 用户侧配置需求（交给 SUT 的任务与接口）：");
  lines.push(userBullets.length ? userBullets.join("\n") : "- 暂无已赋值 JD");
  lines.push("");
  lines.push("② 世界侧配置需求（仿真/环境/平台需实例化）：");
  lines.push(worldBullets.length ? worldBullets.join("\n") : "- 暂无已赋值 JD");
  const tbdCount = (tpl.slot_bindings || []).filter(s => s.status === "TBD").length;
  if (tbdCount) lines.push("\n另有 " + tbdCount + " 个 JD 仍为 TBD，需补齐后整套配置才能跑起来。");
  return lines.join("\n");
}

function renderSpecificTemplateCard(tpl, opts) {
  const open = !!(opts && opts.open);
  const bindings = tpl.slot_bindings || [];
  const resolved = bindings.filter(s => s.status !== "TBD").length;
  const desc = buildSpecificTemplateDescription(tpl);
  let h = '<details class="spec-tpl-card"' + (open ? " open" : "") + '>';
  h += '<summary><div><div class="spec-tpl-title">特定任务模版 · Seed '
    + escapeHtml(String(tpl.seed)) + '</div><div class="spec-tpl-meta mono">'
    + escapeHtml(tpl.instance_id || "") + ' · 已赋值 ' + resolved + '/' + bindings.length
    + '</div></div><span class="spec-tpl-toggle"></span></summary>';
  const domainTitle = (state.agentResult && state.agentResult.candidate && state.agentResult.candidate.task_title) || "任务域模版";
  h += '<div class="spec-tpl-body">';
  h += '<div class="rel-note">这张卡是<b>「' + escapeHtml(domainTitle) + '」任务域模版</b>在 <b>Seed ' + escapeHtml(String(tpl.seed))
    + '</b> 下采样出的<b>一个具体实例</b>。域模版规定每个 JD 的<b>取值范围</b>（fixed / enum / range / TBD），本卡在范围内<b>取定一组具体值</b>；同一 Seed 结果可复现。完整取值域见页面底部「参考：STEP 4 任务域模版」。</div>';
  h += '<div class="spec-desc"><b>模版文字说明</b>' + escapeHtml(desc) + coverageLevelChips() + '</div>';
  h += '<div class="field-label" style="margin-top:12px"><label>JD 取值域 → 具体值（按配置侧分组）</label><span>左：域模版范围 · 右：本实例取值</span></div>';
  [
    { side: "user", title: "① 用户侧配置需求", note: "交给 SUT 的任务与接口契约" },
    { side: "world", title: "② 世界侧配置需求", note: "仿真/环境/平台需实例化，含隐藏真值来源" },
  ].forEach(sec => {
    const sideItems = bindings.filter(s => jdSide(s.slot_id) === sec.side);
    if (!sideItems.length) return;
    const sideTbd = sideItems.filter(s => s.status === "TBD").length;
    h += '<div class="side-block side-' + sec.side + '" style="margin-top:12px">';
    h += '<div class="side-block-head">' + escapeHtml(sec.title) + ' · ' + sideItems.length + ' 个'
      + (sideTbd ? (' · TBD ' + sideTbd) : "") + '<span>' + escapeHtml(sec.note) + '</span></div>';
    groupJdItems(sideItems, s => s.slot_id).forEach(g => {
      h += '<details class="hint-fold compact" style="margin-top:8px">';
      h += '<summary>' + escapeHtml(g.title) + ' · ' + g.items.length + ' 个具体值</summary>';
      h += '<div class="hint-fold-body"><table class="data-table"><thead><tr><th>JD</th><th>名称</th><th>取值域(域模版)</th><th>具体值(本实例)</th><th>Status</th></tr></thead><tbody>';
      h += g.items.map(s => {
        const rowCls = s.status === "TBD" ? "row-tbd" : "";
        return "<tr class='" + rowCls + "'><td class='mono'>" + escapeHtml(s.slot_id)
          + "</td><td>" + escapeHtml(jdNameOf(s.slot_id))
          + "</td><td class='dom-cell'>" + escapeHtml(jdDomainSummary(s.slot_id))
          + "</td><td><b>" + escapeHtml(formatJdValue(s.value)) + "</b></td><td>"
          + pill(s.status) + "</td></tr>";
      }).join("");
      h += '</tbody></table></div></details>';
    });
    h += '</div>';
  });
  h += '</div></details>';
  return h;
}

function renderStep4() {
  const hasOne = !!state.instanceResult;
  const hasMany = !!(state.instanceResults && state.instanceResults.length);
  setHeader(4, hasOne || hasMany ? "已生成" : "等待 Seed");
  const domain = buildDomainTemplate();
  let h = saveBar() + '<p class="intro">STEP 5 重点是<strong>特定任务模版</strong>：每个 Seed 下各 JD 取到的具体值。同一 Seed 结果可复现。</p>';
  h += narrativeReferencePanel({ open: false, title: "自然语言任务描述（所有特定模版共同的来源）" });

  h += '<div class="field-label" style="margin-top:8px"><label>生成控制</label></div>';
  h += '<div class="control" style="margin-bottom:8px"><select id="im">'
    + [["single","单个 Seed"],["random","随机一批"],["batch","批量范围"],["traverse","全遍历"]].map(m =>
      "<option value='" + m[0] + "'" + (m[0] === state.instanceMode ? " selected" : "") + ">" + m[1] + "</option>"
    ).join("") + "</select></div>";
  if (state.instanceMode === "single") {
    h += '<input type="number" min="0" value="' + state.instanceSeed + '" id="is" style="padding:4px 8px;width:100px;border:1px solid var(--line-strong);border-radius:6px">';
  } else if (state.instanceMode === "random") {
    h += '<div class="control" style="gap:8px;align-items:center;flex-wrap:wrap">'
      + '<span class="action-note">随机</span>'
      + '<input type="number" min="1" max="50" value="' + (state.instanceRandomCount || 5) + '" id="irc" style="padding:4px 8px;width:70px;border:1px solid var(--line-strong);border-radius:6px">'
      + '<span class="action-note">个不同 Seed</span>'
      + '<button class="btn" type="button" onclick="rerollSeeds()">换一批</button></div>';
    const seeds = state.instanceRandomSeeds || [];
    if (seeds.length) {
      h += '<div class="coverage-chips" style="margin-top:8px">'
        + seeds.map(s => '<span class="lvl-pill lv-L2 mono">' + escapeHtml(String(s)) + '</span>').join("")
        + '</div>';
    } else {
      h += '<p class="intro" style="margin-top:6px">点「换一批」或直接生成，会随机抽取一组互不相同的 Seed。</p>';
    }
  } else if (state.instanceMode === "batch") {
    h += '<input type="text" value="' + escapeHtml(state.instanceBatchSeeds) + '" id="ib" style="padding:4px 8px;width:200px;border:1px solid var(--line-strong);border-radius:6px" placeholder="如 0-4">';
  }
  h += '<div class="action-row" style="margin-top:10px"><span class="action-note">基于 STEP 4 已确认的任务域模版</span>'
    + '<button class="btn primary" onclick="genTaskTemplate()"' + (state.instanceLoading || !domain ? " disabled" : "") + ">"
    + (state.instanceLoading ? "生成中..." : "生成特定任务模版") + "</button></div>";

  if (state.instanceError) {
    h += '<div class="choice-card dependency selected" style="margin-top:10px"><b>错误</b><p>' + escapeHtml(state.instanceError) + "</p></div>";
  } else if (state.instanceResult) {
    h += '<div class="field-label" style="margin-top:18px"><label>特定任务模版（具体 JD 值）</label></div>';
    h += renderSpecificTemplateCard(state.instanceResult, { open: true });
  } else if (hasMany) {
    h += '<div class="field-label" style="margin-top:18px"><label>特定任务模版列表 · ' + state.instanceResults.length + '</label></div>';
    h += '<p class="intro" style="margin-top:4px">点开每个 Seed 查看该模版下 JD 的具体取值。</p>';
    state.instanceResults.forEach((tpl, idx) => {
      h += renderSpecificTemplateCard(tpl, { open: idx === 0 });
    });
  } else {
    h += '<div class="choice-card" style="margin-top:14px"><b>尚未生成</b><p>选好 Seed 后点「生成特定任务模版」，这里会列出每个模版的具体 JD 值。</p></div>';
  }

  if (domain) {
    const slotCount = (domain.jd_slots || []).length;
    h += '<details class="hint-fold" style="margin-top:18px"><summary>参考：STEP 4 任务域模版（上面所有特定模版的共同来源 · 取值域 · ' + slotCount + '）</summary><div class="hint-fold-body">';
    groupJdItems(domain.jd_slots, s => s.slot_id).forEach(g => {
      h += '<div class="group-label" style="margin-top:8px">' + escapeHtml(g.title) + ' · ' + g.items.length + '</div>';
      h += '<table class="data-table"><thead><tr><th>Slot</th><th>Mode</th><th>Domain</th></tr></thead><tbody>'
        + g.items.map(s => {
            let v = "—";
            if (s.binding.mode === "fixed") v = escapeHtml(String(s.binding.value));
            else if (s.binding.mode === "enum") v = escapeHtml((s.binding.allowed_values || []).join(" | "));
            else if (s.binding.mode === "range") v = "[" + s.binding.minimum + "~" + s.binding.maximum + "]";
            return "<tr><td class='mono'>" + escapeHtml(s.slot_id) + "</td><td>" + pill(s.binding.mode) + "</td><td>" + v + "</td></tr>";
          }).join("")
        + '</tbody></table>';
    });
    h += '</div></details>';
  }

  document.getElementById("workspaceBody").innerHTML = h;
  const im = document.getElementById("im"); if (im) im.addEventListener("change", () => { state.instanceMode = im.value; render(); });
  const is = document.getElementById("is"); if (is) is.addEventListener("change", () => { state.instanceSeed = parseInt(is.value) || 0; });
  const ib = document.getElementById("ib"); if (ib) ib.addEventListener("change", () => { state.instanceBatchSeeds = ib.value; });
  const irc = document.getElementById("irc"); if (irc) irc.addEventListener("change", () => { state.instanceRandomCount = Math.max(1, Math.min(50, parseInt(irc.value) || 5)); persistState(); });
}
