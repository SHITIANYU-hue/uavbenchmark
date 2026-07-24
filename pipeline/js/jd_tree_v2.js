/* JD Version2 selection: A×L chooses the bounded slice; humans choose variables. */

function confirmedCoverageCells() {
  const c = state.agentResult && state.agentResult.candidate;
  return ((c && c.coverage_candidates) || []).map(item => item.cell).filter(Boolean);
}

function confirmedAbilityIds() {
  return [...new Set(confirmedCoverageCells().map(cellAbilityId).filter(Boolean))];
}

function v2NodeIndex() {
  const nodes = (state.jdTreeSlice && state.jdTreeSlice.nodes) || [];
  const index = {};
  nodes.forEach(node => { index[node.node_id] = node; });
  return index;
}

function v2CanonicalAnchor(node) {
  if (!node) return null;
  const canonicalIds = new Set(
    ((state.catalogSummary && state.catalogSummary.jd_fields) || []).map(item => item.id)
  );
  if (node.canonical_slot && canonicalIds.has(node.canonical_slot)) return node.canonical_slot;
  const path = node.node_path || [];
  for (let i = path.length - 2; i >= 0; i--) {
    if (canonicalIds.has(path[i])) return path[i];
  }
  return null;
}

function v2IsHidden(node) {
  const visibility = new Set(node.visibility || []);
  const channels = new Set(node.observation_channel || []);
  return node.variable_role === "hidden_ground_truth"
    || visibility.has("hidden_gt")
    || channels.has("hidden_gt");
}

function requiredCanonicalJdsForCoverage() {
  const wanted = new Set();
  const cells = new Set(confirmedCoverageCells());
  ((state.catalogSummary && state.catalogSummary.gal_cells) || []).forEach(item => {
    if (!cells.has(item.cell)) return;
    (item.required_jd_ids || []).forEach(id => wanted.add(id));
  });
  return wanted;
}

function confirmedLevelByAbility() {
  const result = {};
  confirmedCoverageCells().forEach(cell => {
    const match = String(cell).match(/^(A\d+)×L([1-4])$/);
    if (match) result[match[1]] = parseInt(match[2], 10);
  });
  return result;
}

function v2NodeMatchesCumulativeLevel(node, selectedLevels) {
  const declared = node.used_by_axl || [];
  if (!declared.length) return true;
  return declared.some(cell => {
    const match = String(cell).match(/^(A\d+)×L([1-4])$/);
    if (!match || selectedLevels[match[1]] == null) return false;
    return parseInt(match[2], 10) <= selectedLevels[match[1]];
  });
}

function suggestedV2VariableIds() {
  const required = requiredCanonicalJdsForCoverage();
  const selectedLevels = confirmedLevelByAbility();
  return ((state.jdTreeSlice && state.jdTreeSlice.nodes) || [])
    .filter(node =>
      node.node_kind === "variable"
      && node.owner_a !== "MULTI"
      && required.has(v2CanonicalAnchor(node))
      && v2NodeMatchesCumulativeLevel(node, selectedLevels)
    )
    .map(node => node.node_id);
}

function clearStaleJdExtraction() {
  clearDeliveryArtifacts();
  state.extractionStatus = "idle";
  state.extractionError = null;
  state.extractionProgress = null;
  state.domainEdits = {};
  state.domainEditHistory = [];
  if (state.agentResult && state.agentResult.candidate) {
    state.agentResult.candidate.jd_candidates = [];
    state.agentResult.candidate.runtime_dependencies = [];
    state.agentResult.validation_issues = (state.agentResult.validation_issues || [])
      .filter(issue => !String(issue.path || "").startsWith("jd_candidates")
        && issue.code !== "MISSING_REQUIRED_JD_SLOT");
  }
}

function invalidateJdTreeSelection() {
  state.jdTreeSelection = null;
  state.jdTreeNotice = null;
  clearStaleJdExtraction();
}

async function loadJdV2Slice(options) {
  const abilities = confirmedAbilityIds();
  if (!abilities.length) {
    state.jdTreeStatus = "error";
    state.jdTreeError = "没有已确认的 A×L，无法加载 JD业务变量树。";
    render();
    return false;
  }
  state.jdTreeStatus = "loading";
  state.jdTreeError = null;
  state.jdTreeNotice = null;
  render();
  try {
    const query = new URLSearchParams();
    query.set("ability", abilities.join(","));
    query.set("include_global", "false");
    const r = await fetch("/api/jd-tree/slice?" + query.toString(), {cache: "no-store"});
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || d.error || "JD业务变量树加载失败");
    state.jdTreeSlice = d;
    const existing = new Set(state.jdTreeSelectedNodeIds || []);
    const available = new Set(
      (d.nodes || []).filter(node => node.node_kind === "variable").map(node => node.node_id)
    );
    const preserve = options && options.preserveSelection;
    state.jdTreeSelectedNodeIds = preserve
      ? [...existing].filter(id => available.has(id))
      : suggestedV2VariableIds();
    state.jdTreeSelection = null;
    clearStaleJdExtraction();
    state.jdTreeStatus = "ready";
    state.jdTreeNotice = "已按 A×L 累计等级加载能力变量；全局变量已退出当前 Pipeline，勾选仍需人工确认。";
  } catch (e) {
    state.jdTreeStatus = "error";
    state.jdTreeError = String(e.message || e);
  }
  render();
  return state.jdTreeStatus === "ready";
}

async function confirmCoverageAndLoadV2() {
  state.completed.add(1);
  state.maxUnlocked = Math.max(state.maxUnlocked, 2);
  state.currentStage = 2;
  state.jdTreeSelectedNodeIds = [];
  state.jdTreeSelection = null;
  render();
  await loadJdV2Slice({preserveSelection: false});
}

function toggleJdV2Node(nodeId, checked) {
  const selected = new Set(state.jdTreeSelectedNodeIds || []);
  if (checked) selected.add(nodeId); else selected.delete(nodeId);
  state.jdTreeSelectedNodeIds = [...selected];
  invalidateJdTreeSelection();
  render();
}

function setJdV2Group(groupId, checked) {
  const selected = new Set(state.jdTreeSelectedNodeIds || []);
  ((state.jdTreeSlice && state.jdTreeSlice.nodes) || []).forEach(node => {
    if (node.node_kind !== "variable" || !(node.node_path || []).includes(groupId)) return;
    if (checked) selected.add(node.node_id); else selected.delete(node.node_id);
  });
  state.jdTreeSelectedNodeIds = [...selected];
  invalidateJdTreeSelection();
  render();
}

function restoreSuggestedJdV2Selection() {
  state.jdTreeSelectedNodeIds = suggestedV2VariableIds();
  invalidateJdTreeSelection();
  render();
}

function clearJdV2Selection() {
  state.jdTreeSelectedNodeIds = [];
  invalidateJdTreeSelection();
  render();
}

async function buildJdTreeSelectionArtifact() {
  const selected = state.jdTreeSelectedNodeIds || [];
  if (!selected.length) {
    state.jdTreeError = "请至少勾选一个业务变量。";
    render();
    return null;
  }
  state.jdTreeStatus = "building";
  state.jdTreeError = null;
  render();
  try {
    const r = await fetch("/api/jd-tree/selection/build", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        abilities: confirmedAbilityIds(),
        coverage_cells: confirmedCoverageCells(),
        selected_node_ids: selected,
        include_global: false,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || d.error || "选择清单生成失败");
    state.jdTreeSelection = d.jd_tree_selection;
    state.jdTreeStatus = "ready";
    state.jdTreeNotice = "业务变量选择已确认；Agent 将只能使用清单映射到的 canonical JD。";
    render();
    return state.jdTreeSelection;
  } catch (e) {
    state.jdTreeStatus = "error";
    state.jdTreeError = String(e.message || e);
    render();
    return null;
  }
}

function downloadJdTreeSelection() {
  if (!state.jdTreeSelection) return;
  const blob = new Blob(
    [JSON.stringify(state.jdTreeSelection, null, 2)],
    {type: "application/json;charset=utf-8"}
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "jd_tree_selection.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function copyJdTreeSelection() {
  if (!state.jdTreeSelection) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.jdTreeSelection, null, 2));
    state.jdTreeNotice = "已复制 jd_tree_selection.json 内容。";
  } catch (_) {
    state.jdTreeError = "浏览器未允许复制，请使用下载 JSON。";
  }
  render();
}

function renderJdTreeSelectionHtml() {
  if (state.jdTreeStatus === "loading") {
    return '<div class="choice-card selected" style="margin-top:12px"><b>正在加载 JD业务变量树…</b>'
      + '<p>仅加载已确认 A×L 对应的能力变量，不加载全局变量，也不展开完整 444 节点。</p></div>';
  }
  if (!state.jdTreeSlice) {
    return '<div class="choice-card dependency selected" style="margin-top:12px"><b>尚未加载 JD业务变量树</b>'
      + '<p>请在顶部“本步操作”按本轮 A×L 加载能力变量。</p></div>';
  }

  const slice = state.jdTreeSlice;
  const selected = new Set(state.jdTreeSelectedNodeIds || []);
  const variables = (slice.nodes || []).filter(node => node.node_kind === "variable");
  const index = v2NodeIndex();
  const groups = {};
  variables.forEach(node => {
    const anchor = v2CanonicalAnchor(node) || node.parent_id || "UNRESOLVED";
    const key = (node.owner_a || "OTHER") + "::" + anchor;
    if (!groups[key]) groups[key] = {
      owner: node.owner_a || "OTHER",
      anchor,
      name: (index[anchor] && index[anchor].name) || anchor,
      nodes: [],
    };
    groups[key].nodes.push(node);
  });
  const ownerOrder = confirmedAbilityIds();
  const ordered = Object.values(groups).sort((a, b) => {
    const ai = ownerOrder.indexOf(a.owner), bi = ownerOrder.indexOf(b.owner);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.anchor.localeCompare(b.anchor);
  });
  const tbdMetadata = variables.filter(node =>
    !node.variable_role || !node.configuration_side
    || !(node.projection_targets || []).length
    || !(node.visibility || []).length
    || !(node.observation_channel || []).length
  ).length;
  let h = '<div class="jd-v2-summary">'
    + '<div><b>JD业务变量树</b>'
    + '<span>团队当前交付树 · 仅能力变量 · 本次加载 ' + variables.length + ' 个</span></div>'
    + '<div class="jd-v2-count"><b>' + selected.size + '</b><span>已勾选</span></div></div>';
  h += '<div class="action-row" style="margin-top:10px"><span class="action-note">默认勾选按 L 累计：L2 含 L1–L2，L3 含 L1–L3，L4 含 L1–L4；无等级标注的结构变量随对应 canonical JD 保留。主要操作位于顶部。</span></div>';
  if (tbdMetadata) {
    h += '<div class="tbd-banner"><b>变量树元数据仍有 TBD</b><p>本次子树中有 ' + tbdMetadata
      + ' 个变量缺少 role / projection / visibility 等字段。页面原样显示，不推断配置侧。</p></div>';
  }
  ordered.forEach((group, groupIndex) => {
    const picked = group.nodes.filter(node => selected.has(node.node_id)).length;
    h += '<details class="jd-v2-group"' + (groupIndex < 2 ? " open" : "") + '>'
      + '<summary><div><b>' + escapeHtml(group.owner === "MULTI" ? "全局变量" : group.owner)
      + ' · ' + escapeHtml(group.anchor) + ' · ' + escapeHtml(group.name) + '</b>'
      + '<span>已选 ' + picked + '/' + group.nodes.length + '</span></div><span class="jd-v2-toggle"></span></summary>'
      + '<div class="jd-v2-group-actions"><button class="btn" type="button" onclick="setJdV2Group(\''
      + escapeHtml(group.anchor) + '\',true)">选本组</button> '
      + '<button class="btn" type="button" onclick="setJdV2Group(\'' + escapeHtml(group.anchor)
      + '\',false)">清本组</button></div><div class="jd-v2-node-list">';
    group.nodes.forEach(node => {
      const hidden = v2IsHidden(node);
      const role = node.variable_role || "TBD";
      const side = node.configuration_side || "TBD";
      const gaps = [];
      if (!node.variable_role) gaps.push("role");
      if (!node.configuration_side) gaps.push("side");
      if (!(node.projection_targets || []).length) gaps.push("projection");
      if (!(node.visibility || []).length) gaps.push("visibility");
      if (!(node.observation_channel || []).length) gaps.push("channel");
      const usedBy = node.used_by_axl || [];
      h += '<label class="jd-v2-node' + (selected.has(node.node_id) ? " selected" : "") + '">'
        + '<input type="checkbox" onchange="toggleJdV2Node(\'' + escapeHtml(node.node_id)
        + '\',this.checked)"' + (selected.has(node.node_id) ? " checked" : "") + '>'
        + '<span class="jd-v2-node-copy"><b><span class="mono">' + escapeHtml(node.node_id)
        + '</span> · ' + escapeHtml(node.name || "") + '</b><span>'
        + '<em>canonical: ' + escapeHtml(v2CanonicalAnchor(node) || "TBD") + '</em>'
        + '<em>side: ' + escapeHtml(side) + '</em><em>role: ' + escapeHtml(role) + '</em>'
        + (hidden ? '<em class="danger">Hidden GT</em>' : '')
        + (gaps.length ? '<em class="warn">TBD: ' + escapeHtml(gaps.join(", ")) + '</em>' : '')
        + (usedBy.length ? '<em>等级: ' + escapeHtml(usedBy.join(", ")) + '</em>' : '<em>结构变量</em>')
        + '<em>候选细粒度节点</em></span></span></label>';
    });
    h += '</div></details>';
  });
  h += '<div class="action-row"><span class="action-note">在顶部“本步操作”确认选择并生成清单，再让 Agent 提取变量域。</span></div>';
  if (state.jdTreeSelection) {
    const selection = state.jdTreeSelection;
    h += '<div class="choice-card selected" style="margin-top:12px"><b>选择清单已生成 · '
      + escapeHtml(selection.selection_id) + '</b><p>细粒度变量 ' + selection.selected_nodes.length
      + ' 个；允许 Agent 使用的 canonical JD ' + selection.allowed_agent_slot_ids.length
      + ' 个；元数据 TBD ' + selection.unresolved_nodes.length + ' 个。复制与下载入口位于顶部。</p></div>'
      + '<details class="hint-fold"><summary>查看 jd_tree_selection JSON</summary><div class="hint-fold-body">'
      + '<pre class="code-preview">' + escapeHtml(JSON.stringify(selection, null, 2)) + '</pre></div></details>';
  }
  return h;
}
