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
  const factoryRunning = state.factoryRunStatus === "running";
  const step1Actions = '<button class="btn primary" type="button" id="confirmStep1Btn" onclick="confirmStep1()"'
    + (promptOk && !factoryRunning ? "" : " disabled") + '>'
    + (alreadyDone ? "进入 STEP 2" : "确认任务") + '</button>'
    + '<button class="btn" type="button" id="factoryRunBtn" onclick="runFactoryDraftToStep6()"'
    + (state.taskPrompt.trim().length >= 10 && providerReady() && !factoryRunning ? "" : " disabled") + '>'
    + (factoryRunning ? "生成中…" : "一键生成草案到 STEP 6") + '</button>';
  let h = workflowActionBar({
      note: "先确认任务；也可一键生成草案，之后仍能逐步检查和修改。",
      actions: step1Actions,
    })
    + '<p class="intro">写清任务即可。需要示例时，从下拉选一个场景，内容会直接填进文本框，可再改。</p>'
    + '<div class="field-label"><label>加载示例（可选）</label><span>选中即写入文本框</span></div>'
    + '<div class="control" style="margin-bottom:14px"><select id="scenarioSelect">' + opts + "</select></div>"
    + '<div class="field-label"><label>任务描述</label><span>必填 · 至少 5 个字</span></div>'
    + '<textarea class="task-input" id="taskPrompt" style="min-height:220px" placeholder="用几句话说明让无人机做什么、关注什么异常、希望得到什么结果。">' +
      escapeHtml(state.taskPrompt) + "</textarea>";
  if (state.factoryRunStatus !== "idle") {
    h += '<div class="factory-progress' + (state.factoryRunStatus === "error" ? " error" : "") + '"><b>'
      + escapeHtml(state.factoryRunStatus === "done" ? "一键草案已生成" : state.factoryRunStatus === "error" ? "一键生成中断" : "正在生成")
      + '</b> · ' + escapeHtml(state.factoryRunError || state.factoryRunStep || "准备中") + '</div>';
  }
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
    const factoryBtn = document.getElementById("factoryRunBtn");
    if (btn) btn.disabled = !ok;
    if (factoryBtn) factoryBtn.disabled = state.taskPrompt.trim().length < 10 || !providerReady();
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
  const cells = selectedCoverageCells();
  let step2Actions = "";
  let step2Note = "先确定 A×L，再依次扩充文案和运行分类。";
  if (!hasN) {
    const ready = providerReady() && cells.length > 0 && state.narrativeStatus !== "running";
    step2Actions = '<button class="btn primary" type="button" onclick="runNarrative()"'
      + (ready ? "" : " disabled") + '>'
      + (state.narrativeStatus === "running" ? "文案扩充中…" : "确认 A×L → 扩充文案") + '</button>';
  } else if (!hasA) {
    step2Actions = '<button class="btn" type="button" onclick="resetNarrativeForCoverage()">重选 A×L</button>'
      + '<button class="btn primary" type="button" onclick="confirmNar()"'
      + (state.agentStatus === "running" ? " disabled" : "") + '>'
      + (state.agentStatus === "running" ? "分类中…" : "确认文案 → 跑分类") + '</button>';
  } else {
    step2Note = "A×L 已生成；确认后按这些能力和等级加载变量树。";
    step2Actions = '<button class="btn" type="button" onclick="resetNarrativeForCoverage()">重选 A×L</button>'
      + '<button class="btn primary" type="button" onclick="confirmCoverageAndLoadV2()">确认 A×L → STEP 3</button>';
  }
  let h = workflowActionBar({note: step2Note, actions: step2Actions})
    + '<p class="intro">STEP 2：选目标 Coverage 并确认 → 扩充文案（自动保存）→ 确认文案后只跑 A×L 分类（按已选 A×L 分批进行，可看进度）。JD 域提取放到 STEP 3 单独运行。</p>';
  h += renderCoveragePickerHtml({ editable: canEditCov });
  h += '<div class="field-label" style="margin-top:10px"><label>① 文案扩充</label></div>';
  if (state.narrativeStatus === "running") h += '<div class="choice-card selected"><b>调用中...</b></div>';
  else if (hasN) {
    h += '<textarea class="task-input" id="narEdit" style="min-height:180px">' + escapeHtml(state.narrativeDraft) + '</textarea>';
    h += '<div class="action-row"><span class="action-note">可直接修改文案；确认与重选入口位于顶部“本步操作”。</span></div>';
  } else {
    const ready = providerReady() && cells.length > 0;
    const note = !providerReady()
      ? "请先在侧栏选好可用的 Provider / Key"
      : (!cells.length
        ? "请先在上方选择至少一个 A×L（可改等级或恢复默认）"
        : "已选 " + cells.length + " 个 A×L，确认后开始扩充文案");
    h += '<div class="action-row" style="margin-top:8px"><span class="action-note">' + escapeHtml(note)
      + '；运行入口位于顶部“本步操作”。</span></div>';
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
    h += '<div class="action-row" style="margin-top:14px"><span class="action-note">确认入口位于顶部；系统只加载 JD业务变量树中对应能力和累计等级的范围。</span></div>';
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
  const hasSelection = !!state.jdTreeSelection;
  setHeader(2, state.completed.has(2) ? "已完成" : hasJd ? "JD 域待确认" : state.extractionStatus === "running" ? "提取中" : hasSelection ? "变量清单已确认" : hasCoverage ? "选择业务变量" : "等待 STEP 2");
  let step3Actions = "";
  let step3Note = "按 A×L 和累计等级选择能力变量；全局变量不进入本流程。";
  if (!hasCoverage) {
    step3Actions = '<button class="btn" type="button" onclick="goToStage(1)">返回 STEP 2</button>';
  } else if (!state.jdTreeSlice) {
    step3Actions = '<button class="btn primary" type="button" onclick="loadJdV2Slice({preserveSelection:false})"'
      + (state.jdTreeStatus === "loading" ? " disabled" : "") + '>'
      + (state.jdTreeStatus === "loading" ? "加载中…" : "加载能力变量") + '</button>';
  } else {
    step3Actions = '<button class="btn" type="button" onclick="restoreSuggestedJdV2Selection()">恢复 L 累计建议</button>'
      + '<button class="btn" type="button" onclick="clearJdV2Selection()">全部清空</button>'
      + '<button class="btn" type="button" onclick="loadJdV2Slice({preserveSelection:true})">刷新变量树</button>';
    if (!hasSelection) {
      step3Actions += '<button class="btn primary" type="button" onclick="buildJdTreeSelectionArtifact()"'
        + (!(state.jdTreeSelectedNodeIds || []).length || state.jdTreeStatus === "building" ? " disabled" : "") + '>'
        + (state.jdTreeStatus === "building" ? "生成中…" : "确认选择并生成清单") + '</button>';
    } else {
      step3Actions += '<button class="btn" type="button" onclick="copyJdTreeSelection()">复制选择清单</button>'
        + '<button class="btn" type="button" onclick="downloadJdTreeSelection()">下载选择清单</button>';
      if (!hasJd) {
        step3Actions += '<button class="btn primary" type="button" onclick="runExtraction()"'
          + (state.extractionStatus === "running" || !providerReady() ? " disabled" : "") + '>'
          + (state.extractionStatus === "running" ? "提取中…" : "运行 JD 域提取") + '</button>';
      } else {
        step3Actions += '<button class="btn primary" type="button" onclick="completeStage(2)">确认 JD 域 → STEP 4</button>';
      }
    }
  }
  let h = workflowActionBar({note: step3Note, actions: step3Actions})
    + '<p class="intro">STEP 3：A×L 先限定 JD业务变量树范围；你再勾选本题需要的细粒度变量。确认后生成 <span class="mono">jd_tree_selection.json</span>，Agent 只能在其映射的 canonical JD 范围内提取。</p>';
  if (!hasCoverage) {
    h += '<div class="choice-card dependency selected"><b>尚未完成 STEP 2</b><p>请先在 STEP 2 完成文案确认与 A×L 分类。</p></div>';
    document.getElementById("workspaceBody").innerHTML = h;
    return;
  }
  const cov = state.agentResult.candidate.coverage_candidates || [];
  h += '<div class="field-label" style="margin-top:8px"><label>来自 STEP 2 的 A×L（' + cov.length + '）</label></div>';
  h += '<div class="coverage-chips">' + cov.map(x => '<span class="lvl-pill ' + cellLevelClass(x.cell) + '">' + escapeHtml(x.cell) + "</span>").join("") + '</div>';
  h += renderJdTreeSelectionHtml();
  if (state.jdTreeError) {
    h += '<div class="choice-card dependency selected" style="margin-top:10px"><b>变量选择错误</b><p>' + escapeHtml(state.jdTreeError) + '</p></div>';
  }
  if (state.jdTreeNotice) {
    h += '<div class="choice-card selected" style="margin-top:10px"><b>' + escapeHtml(state.jdTreeNotice) + '</b></div>';
  }

  if (!hasSelection) {
    document.getElementById("workspaceBody").innerHTML = h;
    return;
  }

  if (state.extractionStatus === "running") {
    const pr = state.extractionProgress;
    const note = pr && pr.total ? ("正在提取 JD 变量域…第 " + pr.chunk + "/" + pr.total + " 批") : "正在根据 A×L 提取 JD 变量域…";
    h += '<div class="choice-card selected" id="extractionProgressCard" style="margin-top:12px"><b>' + escapeHtml(note) + '</b>'
      + '<p>Agent 只看到选择清单映射出的 canonical JD；未确认字段继续保持 TBD。</p></div>';
  } else if (!hasJd) {
    const label = state.extractionError ? "重试 JD 域提取" : "运行 JD 域提取";
    const note = state.extractionError ? "上次提取失败，可直接重试" : "清单已锁定，现在可让 Agent 提取 canonical JD 变量域";
    if (state.extractionError) {
      h += '<div class="choice-card dependency selected" style="margin-top:12px"><b>提取失败</b><p>' + escapeHtml(state.extractionError) + "</p></div>";
    }
    h += '<div class="action-row" style="margin-top:12px"><span class="action-note">' + escapeHtml(note)
      + (providerReady() ? "" : "；当前未配置可用 API Key") + '；运行入口位于顶部“本步操作”。</span></div>';
    document.getElementById("workspaceBody").innerHTML = h;
    return;
  }

  {
    const c = state.agentResult.candidate;
    const issueIdx = indexValidationIssues();
    const tbdSlots = (c.jd_candidates || []).filter(j => (j.binding_mode || "") === "TBD");
    h += '<div class="action-row" style="margin-top:10px"><span class="action-note">已在变量选择范围内提取 '
      + (c.jd_candidates || []).length + ' 个 canonical JD 域；如需重跑，可先刷新或重新确认选择清单。</span></div>';
    h += '<div class="field-label"><label>结果 · JD 变量域（' + (c.jd_candidates || []).length + ' 个，按 A 分类）</label></div>';
    if (tbdSlots.length) {
      h += '<div class="tbd-banner"><b>待补全 TBD · ' + tbdSlots.length + ' 个</b>'
        + '<p>琥珀色行即未确认内容；进入 STEP 4 可人工补充。Agent 复核仍无明确来源时必须继续保持 TBD。</p>'
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
    h += '<div class="action-row" style="margin-top:14px"><span class="action-note">确认入口位于顶部“本步操作”。</span></div>';
  }
  document.getElementById("workspaceBody").innerHTML = h;
}

function renderStep3() {
  setHeader(3, state.completed.has(3) ? "已确认" : "编辑取值域");
  const edits = getEdits();
  const tbdCount = edits.filter(e => e.binding_mode === "TBD").length;
  const step4Actions = '<button class="btn" type="button" onclick="loadTreeDomains()"'
    + (state.fillTbdLoading ? " disabled" : "") + '>从变量树加载域</button>'
    + '<button class="btn" type="button" onclick="loadMetricsForStep3()"'
    + (state.fillTbdLoading ? " disabled" : "") + '>加载质量标准</button>'
    + '<button class="btn" type="button" onclick="fillTbdDomains()"'
    + (state.fillTbdLoading || tbdCount === 0 || !providerReady() ? " disabled" : "") + ">"
    + (state.fillTbdLoading ? "复核中…" : "按来源复核 TBD") + "</button>"
    + '<button class="btn primary" type="button" onclick="completeStage(3)">确认任务域 → STEP 5</button>';
  let h = workflowActionBar({
      note: "三个辅助按钮可按需分别使用，不是三选一；确认后进入 STEP 5。",
      actions: step4Actions,
    })
    + '<p class="intro">域编辑器：fixed=已确认固定值；enum=已确认离散选项；range=已确认数值区间；TBD=仍待确认。系统不会从枚举中偷偷挑默认值。</p>';
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
      + '<p>琥珀色行为 TBD。可让 Agent 按来源再复核，或由人工补充；来源不足时仍保持 TBD。</p>'
      + '<div class="coverage-chips">' + tbdList.map(e =>
        '<span class="lvl-pill lv-L3">' + escapeHtml(e.slot_id) + '</span>'
      ).join("") + '</div></div>';
  }
  if (state.fillTbdError) h += '<div class="choice-card dependency selected" style="margin-bottom:10px"><b>TBD 复核失败</b><p>' + escapeHtml(state.fillTbdError) + "</p></div>";
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
        h += "<td><div>" + escapeHtml((note && note.source_note) || "待按来源复核 / 人工补全域") + "</div>"
          + renderInlineHints(hints, { title: "提示 · " + hints.length, compact: true }) + "</td>";
      }
      h += "</tr>";
    });
    h += '</tbody></table>';
  });
  const variable = edits.filter(e => e.binding_mode === "enum" || e.binding_mode === "range").length;
  const history = state.domainEditHistory || [];
  if (history.length) {
    h += '<details class="hint-fold" style="margin-top:14px"><summary>修改记录 · ' + history.length
      + ' 条</summary><div class="hint-fold-body"><table class="data-table"><thead><tr>'
      + '<th>JD</th><th>字段</th><th>来源</th><th>时间</th></tr></thead><tbody>'
      + history.slice().reverse().slice(0, 100).map(item => '<tr><td class="mono">'
        + escapeHtml(item.slot_id) + '</td><td>' + escapeHtml(item.field) + '</td><td>'
        + escapeHtml(item.source) + '</td><td class="mono">' + escapeHtml(item.changed_at)
        + '</td></tr>').join("") + '</tbody></table></div></details>';
  }
  h += '<div class="action-row" style="margin-top:14px"><span class="action-note">' + variable
    + ' 个可变域 · TBD ' + tbdCount + '；所有未确认项都会原样进入交付清单。</span></div>';
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
      const selectedNodes = ((state.jdTreeSelection && state.jdTreeSelection.selected_nodes) || [])
        .filter(node => node.canonical_jd && node.canonical_jd.slot_id === e.slot_id);
      const hidden = selectedNodes.some(node => node.variable_role === "hidden_ground_truth"
        || (node.visibility || []).includes("hidden_gt")
        || (node.observation_channel || []).includes("hidden_gt"));
      const visible = selectedNodes.some(node => (node.visibility || []).includes("sut_visible"));
      const status = e.status === "given" ? "verified" : e.status === "proposed" ? "proposed" : "TBD";
      const b = {mode: e.binding_mode, status};
      if (e.binding_mode === "fixed") b.value = e.value;
      else if (e.binding_mode === "enum") { b.allowed_values = e.allowed_values; b.value = e.value; }
      else if (e.binding_mode === "range") { b.minimum = e.minimum; b.maximum = e.maximum; }
      else { b.mode = "TBD"; b.status = "TBD"; }
      return {
        slot_id: e.slot_id,
        description: e.name,
        visibility: hidden ? "grader_only" : visible ? "sut_visible" : "compiler_only",
        binding: b,
        provenance: [{
          source_id: e.provenance || "config_agent",
          locator: e.slot_id,
          status,
          notes: e.source_note || e.evidence_quote || null,
        }],
        extensions: {
          jd_v2_node_ids: selectedNodes.map(node => node.node_id),
          configuration_sides: [...new Set(selectedNodes.map(node => node.configuration_side))],
          variable_roles: [...new Set(selectedNodes.map(node => node.variable_role))],
          projection_targets: [...new Set(selectedNodes.flatMap(node => node.projection_targets || []))],
          visibility: [...new Set(selectedNodes.flatMap(node => node.visibility || []))],
          observation_channels: [...new Set(selectedNodes.flatMap(node => node.observation_channel || []))],
          edit_history: (state.domainEditHistory || []).filter(item => item.slot_id === e.slot_id),
        },
      };
    }),
  };
}

function selectedDeliveryCase() {
  const cases = (state.deliveryBatch && state.deliveryBatch.cases) || [];
  if (!cases.length) return null;
  const index = Math.max(0, Math.min(cases.length - 1, state.deliverySelectedCase || 0));
  return cases[index];
}

function selectDeliveryCase(index) {
  const cases = (state.deliveryBatch && state.deliveryBatch.cases) || [];
  const parsed = Number(index);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= cases.length) return;
  state.deliverySelectedCase = parsed;
  render();
}

function nextBatchSeed() {
  if (window.crypto && window.crypto.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return Number(values[0]);
  }
  return Math.floor(Math.random() * 1000000000);
}

async function generateDeliveryBatch(options) {
  const domain = buildDomainTemplate();
  if (!domain) {
    state.deliveryError = "缺少已确认的任务域模板，请先完成 STEP 2–4。";
    render();
    return false;
  }
  const serverContract = state.healthInfo && state.healthInfo.delivery_contract_version;
  if (serverContract !== DELIVERY_CONTRACT_VERSION) {
    state.deliveryError = "Pipeline 服务仍在运行旧版后端。请在启动服务的终端按 Control + C，"
      + "重新运行 ./scripts/start_agent_demo.sh，然后刷新页面再生成；STEP 1–4 的浏览器进度会保留。";
    render();
    return false;
  }
  const count = Math.max(1, parseInt(state.deliveryCaseCount, 10) || 10);
  state.deliveryCaseCount = count;
  state.deliveryLoading = true;
  state.deliveryError = null;
  state.deliveryNotice = null;
  render();
  try {
    const r = await fetch("/api/delivery/batch", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        domain_template: domain,
        case_count: count,
        batch_seed: Math.max(0, parseInt(state.deliveryBatchSeed, 10) || 0),
        source_task: state.taskPrompt,
        base_narrative: narrativeText(),
        jd_tree_selection: state.jdTreeSelection,
        case_overrides: state.deliveryOverrides || {},
        human_edits: state.deliveryHumanEdits || {},
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || d.error || JSON.stringify(d));
    state.deliveryBatch = d.delivery_batch;
    state.deliveryStale = false;
    if (!(options && options.keepSelected)) state.deliverySelectedCase = 0;
    state.deliveryNotice = (options && options.notice) || (
      "已生成 " + state.deliveryBatch.case_count
      + " 个可复现案例；每个案例都有 Task Template 和两侧配置。"
    );
  } catch (e) {
    state.deliveryError = String(e.message || e);
  }
  state.deliveryLoading = false;
  render();
  return !!state.deliveryBatch && !state.deliveryError;
}

async function regenerateReviewedDelivery() {
  const domain = buildDomainTemplate();
  if (!domain || !state.jdTreeSelection || state.extractionStatus !== "done") {
    state.deliveryError = "上游复核尚未完成：请先确认 A×L、变量选择和任务域，再重新生成。";
    render();
    return false;
  }
  const ok = await generateDeliveryBatch({
    keepSelected: true,
    notice: "已按当前复核结果重新生成 Task Template、world_config 和 user_config。",
  });
  if (ok) {
    state.completed.add(4);
    state.maxUnlocked = 5;
    state.currentStage = 5;
    render();
  }
  return ok;
}

function rerollDeliveryBatch() {
  state.deliveryBatchSeed = nextBatchSeed();
  state.deliveryOverrides = {};
  state.deliveryHumanEdits = {};
  generateDeliveryBatch();
}

function parseHumanValue(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

async function applyDeliveryTbd(slotId) {
  const current = selectedDeliveryCase();
  if (!current || !slotId) return;
  const key = String(current.seed);
  const valueEl = document.getElementById("tbdValue-" + slotId);
  const sourceEl = document.getElementById("tbdSource-" + slotId);
  const value = parseHumanValue(valueEl && valueEl.value);
  const sourceNote = String((sourceEl && sourceEl.value) || "").trim();
  if (value == null || !sourceNote) {
    state.deliveryError = "人工补充必须同时填写具体值和来源说明。";
    render();
    return;
  }
  if (!state.deliveryOverrides[key]) state.deliveryOverrides[key] = {};
  if (!state.deliveryHumanEdits[key]) state.deliveryHumanEdits[key] = {};
  state.deliveryOverrides[key][slotId] = value;
  state.deliveryHumanEdits[key][slotId] = {
    value,
    source_note: sourceNote,
    changed_at: new Date().toISOString(),
  };
  await generateDeliveryBatch({
    keepSelected: true,
    notice: "已记录人工补充：" + slotId + "，并保留了来源与人工修改记录。",
  });
}

function deliveryDownload(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {type: "application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function deliveryCopy(value, label) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    state.deliveryNotice = "已复制 " + label + "。";
    state.deliveryError = null;
  } catch (_) {
    state.deliveryError = "浏览器未允许复制，请使用下载 JSON。";
  }
  render();
}

function renderDeliveryCaseTabs() {
  const batch = state.deliveryBatch;
  if (!batch) return "";
  return '<div class="delivery-case-tabs" aria-label="案例切换">'
    + batch.cases.map((item, index) => {
      const status = item.validation.status;
      const tbd = (item.task_template.manifest.tbd_items || []).length;
      return '<button type="button" class="delivery-case-tab'
        + (index === state.deliverySelectedCase ? " selected" : "")
        + '" onclick="selectDeliveryCase(' + index + ')"><b>案例 '
        + String(index + 1).padStart(2, "0") + '</b><span>Seed '
        + escapeHtml(String(item.seed)) + ' · ' + escapeHtml(status)
        + (tbd ? " · TBD " + tbd : "") + '</span></button>';
    }).join("") + '</div>';
}

function renderBindingTable(items) {
  if (!items || !items.length) return '<p class="empty-copy">本侧暂无已分配的 JD 配置项。</p>';
  return '<div class="delivery-binding-list">' + items.map(item => {
    const source = (item.provenance && item.provenance[0]) || {};
    return '<div class="delivery-binding' + (item.status === "TBD" ? " is-tbd" : "") + '">'
      + '<div class="delivery-binding-head"><b class="mono">' + escapeHtml(item.canonical_jd)
      + '</b><span>' + escapeHtml(item.configuration_assignment) + '</span></div>'
      + '<strong>' + escapeHtml(item.name) + '</strong>'
      + '<div class="delivery-binding-value">' + escapeHtml(formatJdValue(item.value)) + '</div>'
      + '<div class="delivery-binding-meta">' + pill(item.status)
      + ' <span>来源：' + escapeHtml(source.source_id || "TBD") + '</span>'
      + ' <span>细粒度节点：' + escapeHtml((item.selected_node_ids || []).join(", ") || "TBD") + '</span></div>'
      + '</div>';
  }).join("") + '</div>';
}

function deliveryBindingValue(item) {
  return item && item.status === "TBD" ? "TBD" : formatJdValue(item && item.value);
}

function renderInstantiationTable(items) {
  if (!items.length) return '<p class="empty-copy">本组暂无 JD。</p>';
  return '<table class="data-table"><thead><tr><th>Canonical JD</th><th>名称</th>'
    + '<th>STEP 4 取值域</th><th>本案例具体值</th><th>状态 / 来源</th></tr></thead><tbody>'
    + items.map(item => {
      const source = (item.provenance && item.provenance[0]) || {};
      return '<tr' + (item.status === "TBD" ? ' class="row-tbd"' : "")
        + '><td class="mono">' + escapeHtml(item.canonical_jd)
        + '</td><td>' + escapeHtml(item.name)
        + '</td><td class="dom-cell">' + escapeHtml(jdDomainSummary(item.canonical_jd))
        + '</td><td><b>' + escapeHtml(deliveryBindingValue(item))
        + '</b></td><td>' + pill(item.status) + '<div class="dom-cell">'
        + escapeHtml(source.source_id || "TBD") + '</div></td></tr>';
    }).join("") + '</tbody></table>';
}

function renderInstantiationGroup(title, note, items, className) {
  if (!items.length) return "";
  const tbdCount = items.filter(item => item.status === "TBD").length;
  let html = '<section class="side-block ' + escapeHtml(className || "")
    + '"><div class="side-block-head">' + escapeHtml(title) + ' · ' + items.length
    + (tbdCount ? " · TBD " + tbdCount : "") + '<span>' + escapeHtml(note) + '</span></div>';
  groupJdItems(items, item => item.canonical_jd).forEach(group => {
    html += '<div class="group-label instantiation-group-label">' + escapeHtml(group.title)
      + ' · ' + group.items.length + '</div>' + renderInstantiationTable(group.items);
  });
  return html + '</section>';
}

function renderCaseJdComparison(item) {
  if (!item || !item.task_template) return "";
  const task = item.task_template;
  const items = task.manifest.jd_bindings || [];
  if (!items.length) return "";
  const resolved = items.filter(binding =>
    binding.status !== "TBD" && binding.value != null
  ).length;
  const coverage = (task.manifest.coverage || []).map(entry =>
    entry.cell || entry.coverage_id
  ).filter(Boolean);
  const byAssignment = assignment => items.filter(binding =>
    binding.configuration_assignment === assignment
  );
  const user = byAssignment("user");
  const world = byAssignment("world");
  const shared = byAssignment("shared");
  const hidden = byAssignment("hidden_gt");
  const pending = byAssignment("TBD");
  let html = '<details class="spec-tpl-card" open><summary><div><div class="spec-tpl-title">'
    + '本案例具体化明细 · 任务域 → 本案例具体值</div><div class="spec-tpl-meta mono">Seed '
    + escapeHtml(String(item.seed)) + ' · 已赋值 ' + resolved + "/" + items.length
    + ' · TBD ' + (items.length - resolved) + '</div></div><span class="spec-tpl-toggle"></span></summary>'
    + '<div class="spec-tpl-body"><div class="rel-note">本案例由 <b>STEP 4 任务域模版</b>'
    + '在 <b>Seed ' + escapeHtml(String(item.seed)) + '</b> 下具体化得到。任务域规定'
    + ' fixed / enum / range / TBD，下面保留“取值域 → 本案例值”的完整对应；同一任务域与'
    + '同一 Seed 可复现同一结果。</div>';
  if (coverage.length) {
    html += '<div class="instantiation-coverage"><b>A×L：</b>'
      + coverage.map(cell => '<span class="lvl-pill ' + cellLevelClass(cell) + '">'
        + escapeHtml(cell) + '</span>').join("") + '</div>';
  }
  html += '<div class="instantiation-sides">'
    + renderInstantiationGroup(
      "用户侧配置项", "交给 SUT / 用户侧 Config Agent", user, "side-user",
    )
    + renderInstantiationGroup(
      "世界侧配置项", "由 Simulator / Fixture / Harness 实例化", world, "side-world",
    )
    + renderInstantiationGroup(
      "双侧共享引用", "两侧使用相同 binding_id，分别交付", shared, "side-shared",
    )
    + renderInstantiationGroup(
      "Hidden GT", "仅进入世界侧，不进入 SUT 输入", hidden, "side-hidden",
    )
    + renderInstantiationGroup(
      "配置归属待确认", "保持 TBD，不自动分配到任一侧", pending, "side-pending",
    )
    + '</div><details class="hint-fold compact" style="margin-top:10px"><summary>'
    + 'Seed 运行计划 JSON</summary><div class="hint-fold-body"><pre class="code-preview">'
    + escapeHtml(JSON.stringify(item.run_plan || {}, null, 2))
    + '</pre></div></details></div></details>';
  return html;
}

function deliveryVariationSummary(batch) {
  const cases = (batch && batch.cases) || [];
  const configured = batch && batch.summary && batch.summary.unique_configurations;
  const configuredVarying = batch && batch.summary && batch.summary.varying_jd;
  if (Number.isInteger(configured) && Array.isArray(configuredVarying)) {
    return {unique: configured, varyingJd: configuredVarying};
  }
  const signatures = new Set();
  const values = {};
  cases.forEach(item => {
    const bindings = (((item || {}).task_template || {}).manifest || {}).jd_bindings || [];
    const signature = bindings.map(binding => [
      binding.canonical_jd,
      binding.status,
      binding.value,
    ]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    signatures.add(JSON.stringify(signature));
    bindings.forEach(binding => {
      const slotId = binding.canonical_jd;
      if (!values[slotId]) values[slotId] = new Set();
      values[slotId].add(JSON.stringify([binding.status, binding.value]));
    });
  });
  return {
    unique: signatures.size,
    varyingJd: Object.keys(values).filter(slotId => values[slotId].size > 1).sort(),
  };
}

function renderDeliveryVariationNotice(batch) {
  const variation = deliveryVariationSummary(batch);
  const total = (batch && batch.case_count) || 0;
  const varyingText = variation.varyingJd.length
    ? variation.varyingJd.map(slotId => slotId + " " + jdNameOf(slotId)).join("、")
    : "无";
  if (variation.unique < total) {
    return '<div class="choice-card dependency selected" style="margin-top:12px"><b>'
      + total + ' 个案例中只有 ' + variation.unique + ' 种不同 JD 配置</b><p>当前发生变化的 JD：'
      + escapeHtml(varyingText)
      + '。其余案例仅 Seed 不同，任务事实相同。若需要 ' + total
      + ' 个实质不同案例，需要先在 STEP 4 为更多 JD 确认多个可选值；系统不会自行编造取值。</p></div>';
  }
  return '<div class="choice-card selected" style="margin-top:12px"><b>'
    + total + ' 个案例对应 ' + variation.unique + ' 种不同 JD 配置</b><p>发生变化的 JD：'
    + escapeHtml(varyingText) + '。</p></div>';
}

function renderTaskTemplateDelivery(item) {
  if (!item) return "";
  const task = item.task_template;
  const bindings = task.manifest.jd_bindings || [];
  const tbd = task.manifest.tbd_items || [];
  return '<div class="task-delivery-card">'
    + '<div class="task-delivery-head"><div><span>案例 ' + String(item.case_index).padStart(2, "0")
    + ' · Seed ' + escapeHtml(String(item.seed)) + '</span><h2>' + escapeHtml(task.title)
    + '</h2></div>' + pill(item.validation.status, item.validation.status === "pass" ? "given" : "tbd") + '</div>'
    + '<div class="field-label"><label>JD 标注版任务叙事</label><span>给评审者阅读，可逐句追溯</span></div>'
    + '<div class="annotated-narrative">' + escapeHtml(task.narratives.review_annotated) + '</div>'
    + renderCaseJdComparison(item)
    + '<details class="hint-fold" style="margin-top:12px"><summary>SUT 可见任务正文</summary><div class="hint-fold-body">'
    + '<div class="clean-narrative">' + escapeHtml(task.narratives.sut_visible) + '</div></div></details>'
    + '<details class="hint-fold" style="margin-top:10px"><summary>机器 Manifest · JD '
    + bindings.length + ' · TBD ' + tbd.length + '</summary><div class="hint-fold-body">'
    + renderBindingTable(bindings)
    + '<pre class="code-preview">' + escapeHtml(JSON.stringify(task.manifest, null, 2)) + '</pre></div></details>'
    + '</div>';
}

function renderStep4() {
  const batch = state.deliveryBatch;
  const domain = buildDomainTemplate();
  setHeader(4, batch ? ("已生成 " + batch.case_count + " 个案例") : "等待生成");
  const step5Actions = '<button class="btn primary" type="button" onclick="generateDeliveryBatch()"'
    + (state.deliveryLoading || !domain ? " disabled" : "") + '>'
    + (state.deliveryLoading ? "生成中…" : batch ? "重新生成案例" : "生成 Task Template 案例") + '</button>'
    + (batch
      ? '<button class="btn primary" type="button" onclick="completeStage(4)">确认 Task Template → STEP 6</button>'
      : "");
  let h = workflowActionBar({
      note: batch ? "先审阅案例；如无修改，确认后查看两侧配置。" : "填写案例数量后，在这里生成 Task Template。",
      actions: step5Actions,
    })
    + '<p class="intro">STEP 5 专门生成可审阅的 <strong>Task Template</strong>。每个案例同时包含你要求的'
    + '<strong>【canonical JD＝实际值】标注叙事</strong>、SUT 可见正文和机器 Manifest。</p>';
  h += '<div class="batch-generator">'
    + '<div><div class="field-label"><label for="deliveryCaseCount">生成案例数量</label><span>团队演示默认 10，可直接修改</span></div>'
    + '<input id="deliveryCaseCount" class="batch-count-input" type="number" min="1" value="'
    + escapeHtml(String(state.deliveryCaseCount || 10)) + '"></div></div>';
  h += '<details class="hint-fold compact"><summary>高级设置 · 批次复现信息</summary><div class="hint-fold-body">'
    + '<div class="field-label"><label for="deliveryBatchSeed">批次 Seed</label><span>无需理解；同一 Seed 可重现同一批案例</span></div>'
    + '<div class="control"><input id="deliveryBatchSeed" class="batch-seed-input" type="number" min="0" value="'
    + escapeHtml(String(state.deliveryBatchSeed)) + '"> '
    + '<button class="btn" type="button" onclick="rerollDeliveryBatch()"'
    + (state.deliveryLoading || !domain ? " disabled" : "") + '>换一批案例</button></div></div></details>';
  if (state.deliveryError) {
    h += '<div class="choice-card dependency selected" style="margin-top:12px"><b>生成失败</b><p>'
      + escapeHtml(state.deliveryError) + '</p></div>';
  }
  if (state.deliveryNotice) {
    h += '<div class="choice-card selected" style="margin-top:12px"><b>'
      + escapeHtml(state.deliveryNotice) + '</b></div>';
  }
  if (batch) {
    h += '<div class="delivery-summary"><div><b>' + batch.case_count + '</b><span>案例</span></div>'
      + '<div><b>' + batch.summary.pass + '</b><span>校验通过</span></div>'
      + '<div><b>' + batch.summary.needs_review + '</b><span>需复核</span></div>'
      + '<div><b>' + batch.summary.tbd_items + '</b><span>TBD</span></div></div>';
    h += renderDeliveryVariationNotice(batch);
    h += renderDeliveryCaseTabs();
    h += renderTaskTemplateDelivery(selectedDeliveryCase());
    h += '<div class="action-row" style="margin-top:16px"><span class="action-note">确认入口已集中在页面顶部的“本步操作”。</span></div>';
  } else {
    h += '<div class="choice-card" style="margin-top:14px"><b>尚未生成案例</b>'
      + '<p>输入数量后点击生成。系统只从 STEP 4 已确认的 fixed / enum / range 中取值，TBD 保持 TBD。</p></div>';
  }
  document.getElementById("workspaceBody").innerHTML = h;
  const countInput = document.getElementById("deliveryCaseCount");
  if (countInput) countInput.addEventListener("change", () => {
    state.deliveryCaseCount = Math.max(1, parseInt(countInput.value, 10) || 10);
    countInput.value = state.deliveryCaseCount;
    persistState();
  });
  const seedInput = document.getElementById("deliveryBatchSeed");
  if (seedInput) seedInput.addEventListener("change", () => {
    state.deliveryBatchSeed = Math.max(0, parseInt(seedInput.value, 10) || 0);
    persistState();
  });
}

function renderValidationChecks(validation) {
  const checks = (validation && validation.checks) || [];
  return '<div class="validation-list">' + checks.map(check =>
    '<div class="validation-check ' + escapeHtml(check.status) + '"><span>'
      + (check.status === "pass" ? "✓" : check.status === "fail" ? "×" : "!")
      + '</span><div><b>' + escapeHtml(check.message) + '</b>'
      + ((check.evidence || []).length
        ? '<small>' + escapeHtml(check.evidence.join(", ")) + '</small>' : "")
      + '</div></div>'
  ).join("") + '</div>';
}

function tbdResolutionInfo(tbd) {
  const ownerLabels = {
    business_task_owner: "业务 / 任务负责人",
    jd_tree_maintainer: "JD 变量树维护方",
    task_interface_or_safety_owner: "任务接口 / 安全负责人",
    simulator_adapter_owner: "Simulator / Fixture 适配方",
  };
  const stageLabels = {
    config_agent_handoff: "交给 Config Agent 前",
    simulator_integration: "接入 Simulator 时",
    benchmark_run: "正式运行 benchmark 前",
  };
  let rawOwners = [...(tbd.resolution_owners || [])];
  if (!rawOwners.length) {
    if (tbd.tbd_id === "tbd:simulator_adapter") {
      rawOwners = ["simulator_adapter_owner"];
    } else if (tbd.tbd_id === "tbd:allowed_actions") {
      rawOwners = ["task_interface_or_safety_owner"];
    } else {
      if ((tbd.missing || []).includes("value")) {
        rawOwners.push("business_task_owner");
      }
      if ((tbd.missing || []).some(value => value !== "value")) {
        rawOwners.push("jd_tree_maintainer");
      }
    }
  }
  const owners = rawOwners.map(owner => ownerLabels[owner] || owner);
  const canEdit = !!tbd.canonical_jd
    && (tbd.missing || []).includes("value")
    && rawOwners.includes("business_task_owner");
  let action = "保持 TBD，并由标注责任方确认。";
  if (canEdit) {
    action = "取得明确业务来源后填写；来源未确认时保持 TBD。";
  } else if (rawOwners.includes("jd_tree_maintainer")) {
    action = "该项属于变量树元数据缺口，由 JD 变量树维护方补充。";
  } else if (rawOwners.includes("simulator_adapter_owner")) {
    action = "当前没有确认的 Simulator API，等平台接入方提供合同。";
  } else if (rawOwners.includes("task_interface_or_safety_owner")) {
    action = "允许动作涉及权限和安全边界，应由接口或安全负责人确认。";
  }
  let requiredBefore = tbd.required_before;
  if (!requiredBefore) {
    requiredBefore = rawOwners.includes("simulator_adapter_owner")
      ? "simulator_integration"
      : (
          rawOwners.length === 1 && rawOwners.includes("jd_tree_maintainer")
            ? "config_agent_handoff"
            : "benchmark_run"
        );
  }
  return {
    owners,
    ownerIds: rawOwners,
    canEdit,
    requiredBefore: stageLabels[requiredBefore] || "正式运行前",
    action,
  };
}

function renderTbdWorkbench(item) {
  const taskTbds = (item.task_template.manifest.tbd_items || []);
  const worldTbds = (item.world_config.tbd_items || []);
  const userTbds = (item.user_config.tbd_items || []);
  const seen = new Set();
  const all = taskTbds.concat(worldTbds, userTbds).filter(tbd => {
    if (seen.has(tbd.tbd_id)) return false;
    seen.add(tbd.tbd_id);
    return true;
  });
  if (!all.length) return '<div class="choice-card selected"><b>本案例没有待补充项</b></div>';
  const tbdWithInfo = all.map(tbd => ({tbd, info: tbdResolutionInfo(tbd)}));
  const businessCount = tbdWithInfo.filter(entry =>
    entry.info.ownerIds.includes("business_task_owner")
  ).length;
  const treeCount = tbdWithInfo.filter(entry =>
    entry.info.ownerIds.includes("jd_tree_maintainer")
  ).length;
  const externalCount = tbdWithInfo.filter(entry =>
    entry.info.ownerIds.some(owner =>
      owner === "task_interface_or_safety_owner"
      || owner === "simulator_adapter_owner"
    )
  ).length;
  return '<div class="tbd-explainer"><div><b>TBD 处理说明</b>'
    + '<p>没有权威来源的项目保持 TBD。当前交付包可作为草案下载，并由对应负责人在所需阶段前确认。</p></div>'
    + '<div class="tbd-owner-summary"><span><b>' + businessCount
    + '</b> 业务负责人</span><span><b>' + treeCount
    + '</b> JD 树维护方</span><span><b>' + externalCount
    + '</b> 接口 / 适配方</span></div></div>'
    + '<div class="tbd-workbench">' + tbdWithInfo.map(entry => {
    const tbd = entry.tbd;
    const info = entry.info;
    return '<div class="tbd-work-item"><div class="tbd-work-head"><div><b>'
      + escapeHtml(tbd.canonical_jd || "交付依赖")
      + ' · ' + escapeHtml(tbd.name) + '</b><span>缺少：'
      + escapeHtml((tbd.missing || []).join("、")) + '</span></div><div class="tbd-owner-badges">'
      + info.owners.map(owner => '<span>' + escapeHtml(owner) + '</span>').join("")
      + '</div></div><p class="tbd-action-hint">' + escapeHtml(info.action)
      + ' 最晚确认时间：' + escapeHtml(info.requiredBefore) + '。</p>'
      + (info.canEdit
        ? '<div class="tbd-edit-row"><input id="tbdValue-' + escapeHtml(tbd.canonical_jd)
          + '" placeholder="填写已确认值，可填写 JSON"><input id="tbdSource-' + escapeHtml(tbd.canonical_jd)
          + '" placeholder="来源说明（必填）"><button class="btn small" type="button" onclick="applyDeliveryTbd(\''
          + escapeHtml(tbd.canonical_jd) + '\')">保存并重新生成</button></div>'
        : '<small>该项不能由 Pipeline 自动补值，由标注责任方确认。</small>')
      + '</div>';
  }).join("") + '</div>';
}

function renderStep5() {
  const batch = state.deliveryBatch;
  const item = selectedDeliveryCase();
  setHeader(5, batch ? "可导出" : "等待 STEP 5");
  const step6Actions = item
    ? '<button class="btn primary" type="button" onclick="regenerateReviewedDelivery()"'
      + (state.deliveryLoading ? " disabled" : "") + '>'
      + (state.deliveryLoading ? "重新生成中…" : "按复核结果重新生成") + '</button>'
      + '<button class="btn" type="button" onclick="deliveryCopy(selectedDeliveryCase().task_template,\'task_template JSON\')">复制 Task Template</button>'
      + '<button class="btn" type="button" onclick="deliveryDownload(\'task_template.json\',selectedDeliveryCase().task_template)">下载 Task Template</button>'
      + '<button class="btn" type="button" onclick="deliveryCopy(selectedDeliveryCase().world_config,\'world_config\')">复制 world_config</button>'
      + '<button class="btn" type="button" onclick="deliveryDownload(\'world_config.json\',selectedDeliveryCase().world_config)">下载 world_config</button>'
      + '<button class="btn" type="button" onclick="deliveryCopy(selectedDeliveryCase().user_config,\'user_config\')">复制 user_config</button>'
      + '<button class="btn" type="button" onclick="deliveryDownload(\'user_config.json\',selectedDeliveryCase().user_config)">下载 user_config</button>'
      + '<button class="btn" type="button" onclick="deliveryDownload(\'delivery_batch.json\',state.deliveryBatch)">下载完整交付包</button>'
      + '<button class="btn" type="button" onclick="completeStage(5)">标记交付完成</button>'
    : '<button class="btn" type="button" onclick="goToStage(4)">返回 STEP 5</button>';
  let h = workflowActionBar({
      note: state.deliveryStale
        ? "上游已经修改，请先按复核结果重新生成，再导出。"
        : "重生成、三类产物导出和完成操作都集中在这里。",
      actions: step6Actions,
    })
    + '<p class="intro">STEP 6 将当前案例拆成 <strong>world_config</strong> 与 <strong>user_config</strong>，'
    + '并用确定性规则检查 Hidden GT、canonical JD、TBD 和两侧共享引用。</p>';
  if (!batch || !item) {
    h += '<div class="choice-card dependency selected"><b>尚未生成 Task Template</b>'
      + '<p>请先在 STEP 5 生成并确认案例。</p></div>'
      + '<div class="action-row"><button class="btn" type="button" onclick="goToStage(4)">← 回 STEP 5</button></div>';
    document.getElementById("workspaceBody").innerHTML = h;
    return;
  }
  if (state.deliveryStale) {
    h += '<div class="tbd-banner"><b>交付物需要更新</b>'
      + '<p>你修改了前面的 A×L、变量或任务域。顶部点击“按复核结果重新生成”，即可刷新 Task Template 和两侧配置。</p></div>';
  }
  h += renderDeliveryCaseTabs();
  h += '<div class="delivery-export-bar"><div><b>案例 ' + String(item.case_index).padStart(2, "0")
    + '</b><span class="mono">' + escapeHtml(item.case_id)
    + '</span></div><span class="action-note">复制和下载入口位于顶部“本步操作”</span></div>';
  h += '<div class="config-columns">';
  [
    {key: "world_config", title: "世界侧 world_config", note: "Simulator / Fixture / Harness 使用"},
    {key: "user_config", title: "用户侧 user_config", note: "SUT / 用户侧 Config Agent 使用"},
  ].forEach(section => {
    const config = item[section.key];
    const bindings = section.key === "world_config"
      ? (config.adjustable_variables || []).concat(config.hidden_ground_truth || [])
      : (config.runtime_constraints || []);
    h += '<section class="config-panel ' + (section.key === "world_config" ? "world" : "user") + '">'
      + '<div class="config-panel-head"><div><b>' + escapeHtml(section.title) + '</b><span>'
      + escapeHtml(section.note) + '</span></div></div>'
      + renderBindingTable(bindings)
      + '<details class="hint-fold compact"><summary>查看完整 JSON</summary><div class="hint-fold-body"><pre class="code-preview">'
      + escapeHtml(JSON.stringify(config, null, 2)) + '</pre></div></details></section>';
  });
  h += '</div>';
  const hiddenCount = (item.world_config.hidden_ground_truth || []).length;
  h += '<div class="hidden-summary"><b>Hidden GT：' + hiddenCount + ' 项</b><span>'
    + (hiddenCount ? "仅存在于 world_config；user_config 中为 0。" : "本案例没有已绑定的 Hidden GT。")
    + '</span></div>';
  h += '<div class="field-label" style="margin-top:16px"><label>确定性校验</label><span>'
    + escapeHtml(item.validation.status) + '</span></div>' + renderValidationChecks(item.validation);
  h += '<div class="field-label" style="margin-top:16px"><label>统一 TBD 待确认清单</label>'
    + '<span>按责任方分流；不确定时保持 TBD，仍可导出草案</span></div>'
    + renderTbdWorkbench(item);
  h += '<details class="hint-fold" style="margin-top:16px"><summary>批次 Manifest · '
    + batch.case_count + ' 个案例</summary><div class="hint-fold-body"><pre class="code-preview">'
    + escapeHtml(JSON.stringify({
      batch_id: batch.batch_id,
      batch_seed: batch.batch_seed,
      case_count: batch.case_count,
      cases: batch.cases.map(c => ({case_id: c.case_id, case_index: c.case_index, seed: c.seed, validation: c.validation.status})),
      summary: batch.summary,
      provenance: batch.provenance,
    }, null, 2)) + '</pre></div></details>';
  h += '<div class="action-row" style="margin-top:16px"><span class="action-note">三类产物、校验结果和 TBD 已生成；所有主操作均位于页面顶部。</span></div>';
  document.getElementById("workspaceBody").innerHTML = h;
}
