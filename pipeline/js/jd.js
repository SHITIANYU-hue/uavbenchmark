/* pipeline/js/jd.js */
function cellAbilityId(cell) {
  const text = String(cell || "");
  const m = text.match(/^(A\d+[a-z]?)/i);
  return m ? m[1] : "";
}

function abilityMeta(aId) {
  const abs = (state.catalogSummary && state.catalogSummary.abilities) || [];
  return abs.find(a => a.a_id === aId) || null;
}

function abilityGroupOf(aId) {
  const meta = abilityMeta(aId);
  return (meta && meta.g_group) || "OTHER";
}

/** Group A×L cells by GAL G (G1–G6); sort within each group by A then L. */
function groupCoverageByG(cells) {
  const buckets = {};
  (cells || []).forEach(item => {
    const cell = typeof item === "string" ? item : (item && item.cell);
    if (!cell) return;
    const g = abilityGroupOf(cellAbilityId(cell));
    if (!buckets[g]) buckets[g] = [];
    buckets[g].push(cell);
  });
  const order = ["G1", "G2", "G3", "G4", "G5", "G6", "OTHER"];
  function cellSortKey(cell) {
    const m = String(cell).match(/^(A)(\d+)([a-z]?)(?:×|x)L(\d+)$/i);
    if (!m) return [999, "", 9, cell];
    return [parseInt(m[2], 10), m[3] || "", parseInt(m[4], 10), cell];
  }
  return order.filter(g => (buckets[g] || []).length).map(g => ({
    key: g,
    title: g === "OTHER" ? "其他" : g,
    cells: buckets[g].slice().sort((a, b) => {
      const ka = cellSortKey(a), kb = cellSortKey(b);
      for (let i = 0; i < ka.length; i++) {
        if (ka[i] < kb[i]) return -1;
        if (ka[i] > kb[i]) return 1;
      }
      return 0;
    }),
  }));
}

function jdOwnerOf(slotId) {
  const fields = (state.catalogSummary && state.catalogSummary.jd_fields) || [];
  const hit = fields.find(f => f.id === slotId);
  if (!hit) return "OTHER";
  return hit.owner_a || "GLOBAL";
}

function groupJdItems(items, getSlotId) {
  const coverageOrder = [];
  const seen = new Set();
  ((state.agentResult && state.agentResult.candidate && state.agentResult.candidate.coverage_candidates) || []).forEach(c => {
    const a = cellAbilityId(c.cell);
    if (a && !seen.has(a)) { seen.add(a); coverageOrder.push(a); }
  });
  const buckets = { GLOBAL: [], OTHER: [] };
  items.forEach(item => {
    const owner = jdOwnerOf(getSlotId(item));
    if (!buckets[owner]) buckets[owner] = [];
    buckets[owner].push(item);
  });
  const groups = [];
  if (buckets.GLOBAL.length) {
    groups.push({ key: "GLOBAL", title: "全局 JD", subtitle: "跨能力共享变量", items: buckets.GLOBAL, primary: true });
  }
  coverageOrder.forEach(aId => {
    if (!(buckets[aId] || []).length) return;
    const meta = abilityMeta(aId);
    groups.push({
      key: aId,
      title: aId + (meta ? (" · " + meta.ability) : ""),
      subtitle: "本次覆盖相关",
      items: buckets[aId],
      primary: true,
    });
    delete buckets[aId];
  });
  const abs = (state.catalogSummary && state.catalogSummary.abilities) || [];
  abs.forEach(a => {
    if (!(buckets[a.a_id] || []).length) return;
    groups.push({
      key: a.a_id,
      title: a.a_id + " · " + a.ability,
      subtitle: "其他能力",
      items: buckets[a.a_id],
      primary: false,
    });
    delete buckets[a.a_id];
  });
  Object.keys(buckets).forEach(key => {
    if (key === "GLOBAL" || key === "OTHER") return;
    if (!buckets[key].length) return;
    groups.push({ key: key, title: key, subtitle: "", items: buckets[key], primary: false });
  });
  if ((buckets.OTHER || []).length) {
    groups.push({ key: "OTHER", title: "未归类 JD", subtitle: "", items: buckets.OTHER, primary: false });
  }
  return groups;
}

function getEdits() {
  const c = state.agentResult ? state.agentResult.candidate : null;
  if (!c) return [];
  return (c.jd_candidates || []).map(j => {
    const e = state.domainEdits[j.slot_id] || {};
    return {slot_id: j.slot_id, name: j.name, binding_mode: e.binding_mode || j.binding_mode || "fixed",
      value: e.value !== undefined ? e.value : j.value, allowed_values: e.allowed_values || j.allowed_values || [],
      minimum: e.minimum !== undefined ? e.minimum : j.minimum, maximum: e.maximum !== undefined ? e.maximum : j.maximum,
      status: e.status || j.status || "TBD", provenance: e.provenance || j.provenance || "agent_extracted",
      source_note: e.source_note !== undefined ? e.source_note : j.source_note,
      evidence_quote: e.evidence_quote !== undefined ? e.evidence_quote : j.evidence_quote};
  });
}

function setEdit(id, f, v, source) {
  if (!state.domainEdits[id]) state.domainEdits[id] = {};
  const next = f === "allowed_values" && typeof v === "string"
    ? v.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    : v;
  const before = state.domainEdits[id][f];
  if (JSON.stringify(before) === JSON.stringify(next)) return;
  state.domainEdits[id][f] = next;
  clearDeliveryArtifacts();
  state.domainEditHistory.push({
    slot_id: id,
    field: f,
    before: before === undefined ? null : before,
    after: next,
    source: source || "human_edit",
    changed_at: new Date().toISOString(),
  });
}

function tbdEdits() {
  return getEdits().filter(e => e.binding_mode === "TBD");
}

function jdNameOf(slotId) {
  const edit = (getEdits() || []).find(e => e.slot_id === slotId);
  if (edit && edit.name) return edit.name;
  const fields = (state.catalogSummary && state.catalogSummary.jd_fields) || [];
  const hit = fields.find(f => f.id === slotId);
  return (hit && hit.name) || slotId;
}

function narrativeText() {
  const c = state.agentResult && state.agentResult.candidate;
  return state.narrativeDraft || (c && c.natural_language_template) || "";
}

function narrativeReferencePanel(opts) {
  const text = narrativeText();
  if (!text) return "";
  const open = !!(opts && opts.open);
  const title = (opts && opts.title) || "自然语言任务描述（特定模版的来源）";
  return '<details class="hint-fold narrative-ref"' + (open ? " open" : "") + ' style="margin:8px 0 14px">'
    + '<summary>' + escapeHtml(title) + '</summary>'
    + '<div class="hint-fold-body"><div class="narrative-body">' + escapeHtml(text) + '</div></div></details>';
}

function jdDomainSummary(slotId) {
  const edit = (getEdits() || []).find(item => item.slot_id === slotId);
  if (!edit) return "—";
  if (edit.binding_mode === "fixed") {
    return "固定 = " + (
      edit.value != null && edit.value !== "" ? formatJdValue(edit.value) : "—"
    );
  }
  if (edit.binding_mode === "enum") {
    return "枚举 { " + (
      (edit.allowed_values || []).map(formatJdValue).join(" | ") || "—"
    ) + " }";
  }
  if (edit.binding_mode === "range") {
    return "区间 [" + (edit.minimum != null ? edit.minimum : "?")
      + " ~ " + (edit.maximum != null ? edit.maximum : "?") + "]";
  }
  return "TBD（待定）";
}

function formatJdValue(value) {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch (_) { return String(value); }
}
