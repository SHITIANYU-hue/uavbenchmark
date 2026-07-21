/* pipeline/js/coverage.js */
function selectedCoverageCells() {
  return Object.entries(state.targetLevels || {})
    .filter(([, level]) => level)
    .map(([aId, level]) => aId + "×" + level);
}

function levelClass(level) {
  const lv = String(level || "L0").toUpperCase();
  return "lv-" + (["L0", "L1", "L2", "L3", "L4"].includes(lv) ? lv : "L0");
}

function cellLevelClass(cell) {
  const m = String(cell || "").match(/×(L[0-4])$/i);
  return levelClass(m ? m[1] : "L0");
}

function indexValidationIssues() {
  const issues = (state.agentResult && state.agentResult.validation_issues) || [];
  const jds = (state.agentResult && state.agentResult.candidate && state.agentResult.candidate.jd_candidates) || [];
  const cov = (state.agentResult && state.agentResult.candidate && state.agentResult.candidate.coverage_candidates) || [];
  const byJd = {};
  const byCell = {};
  const other = [];
  issues.forEach(v => {
    const path = String(v.path || "");
    const jdIdx = path.match(/^jd_candidates\[(\d+)\]/);
    if (jdIdx) {
      const slot = jds[parseInt(jdIdx[1], 10)] && jds[parseInt(jdIdx[1], 10)].slot_id;
      if (slot) {
        if (!byJd[slot]) byJd[slot] = [];
        byJd[slot].push(v);
        return;
      }
    }
    const miss = String(v.message || "").match(/\b(jd-[0-9a-z.]+)\b/i);
    if (v.code === "MISSING_REQUIRED_JD_SLOT" && miss) {
      const slot = miss[1];
      if (!byJd[slot]) byJd[slot] = [];
      byJd[slot].push(v);
      return;
    }
    const covIdx = path.match(/^coverage_candidates\[(\d+)\]/);
    if (covIdx) {
      const cell = cov[parseInt(covIdx[1], 10)] && cov[parseInt(covIdx[1], 10)].cell;
      if (cell) {
        if (!byCell[cell]) byCell[cell] = [];
        byCell[cell].push(v);
        return;
      }
    }
    other.push(v);
  });
  return { byJd, byCell, other, all: issues };
}

function issueTitle(v) {
  const hit = ISSUE_ZH[v && v.code];
  return (hit && hit.title) || (v && v.code) || "提示";
}

function issueMessage(v) {
  const raw = String((v && v.message) || "");
  // 已是中文（后端新消息或旧中文）直接用；英文则回退到词典
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;
  const hit = ISSUE_ZH[v && v.code];
  return (hit && hit.msg) || raw || "需要人工检查该项。";
}

function renderInlineHints(list, opts) {
  if (!list || !list.length) return "";
  const items = list.map(v =>
    '<div class="inline-hint"><b>' + escapeHtml(issueTitle(v)) + '</b>'
    + escapeHtml(issueMessage(v)) + '</div>'
  ).join("");
  if (opts && opts.plain) return items;
  const title = (opts && opts.title) || ("校验提示 · " + list.length + " 条");
  const openAttr = (opts && opts.open) ? " open" : "";
  const compact = (opts && opts.compact) ? " compact" : "";
  return '<details class="hint-fold' + compact + '"' + openAttr + '>'
    + '<summary>' + escapeHtml(title) + '</summary>'
    + '<div class="hint-fold-body">' + items + '</div></details>';
}

function renderCoverageHints(byCell) {
  const cells = Object.keys(byCell || {});
  if (!cells.length) return "";
  const total = cells.reduce((n, c) => n + byCell[c].length, 0);
  const body = cells.map(cell =>
    '<div class="inline-hint"><b>' + escapeHtml(cell) + ' · ' + byCell[cell].length + ' 条</b>'
    + byCell[cell].map(v => escapeHtml(issueTitle(v)) + " · " + escapeHtml(issueMessage(v))).join("<br>")
    + '</div>'
  ).join("");
  return '<details class="hint-fold">'
    + '<summary>A×L 校验提示 · ' + total + ' 条 / ' + cells.length + ' 个单元</summary>'
    + '<div class="hint-fold-body">' + body + '</div></details>';
}

function levelPolicyEntries() {
  const levels = (state.catalogSummary && state.catalogSummary.level_policy && state.catalogSummary.level_policy.levels) || {};
  const scored = ["L1", "L2", "L3", "L4"].map(id => {
    const meta = levels[id] || {};
    const inherits = (meta.inherits || []).join(" + ");
    return {
      id,
      label: meta.label || id,
      boundary: meta.general_boundary || "",
      inheritsNote: inherits ? ("累计含 " + inherits + " + " + id) : ("仅 " + id),
    };
  });
  return [{
    id: "L0",
    label: "不覆盖",
    boundary: "该能力本次不计分、不进入正式 A×L coverage；外部/执行器条件若需要，放在 runtime dependency。",
    inheritsNote: "下拉选「不覆盖」= L0",
  }].concat(scored);
}

function renderCoveragePickerHtml(opts) {
  const editable = !!(opts && opts.editable);
  const cells = selectedCoverageCells();
  let h = '<div class="field-label" style="margin-top:10px"><label>目标 Coverage（先选再扩充）</label></div>';
  h += '<p class="intro" style="margin-top:4px">默认已预填巡检常用 <b>L2</b>，可逐项改等级。选 L3 = 累计 L1–L3；选「不覆盖」= <b>L0</b>（本次不考该能力）。</p>';
  h += '<div class="group-label">L 等级含义</div><div class="level-legend">';
  levelPolicyEntries().forEach(lv => {
    h += '<div class="level-legend-item ' + levelClass(lv.id) + '"><b>' + escapeHtml(lv.id) + '</b><span><em>'
      + escapeHtml(lv.label) + '</em>' + escapeHtml(lv.boundary)
      + '<br>' + escapeHtml(lv.inheritsNote) + '</span></div>';
  });
  h += '</div>';
  const abs = (state.catalogSummary && state.catalogSummary.abilities) || [];
  h += '<div class="group-label">能力列表 · 已选 ' + cells.length + '</div>';
  if (editable) {
    h += '<div class="action-row" style="margin:0 0 10px;flex-wrap:wrap;gap:8px">'
      + '<span class="action-note">灰=L0 · 蓝=L1 · 青=L2 · 琥珀=L3 · 绿=L4</span><div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">'
      + '<span class="action-note">Seed</span>'
      + '<input type="number" min="0" id="coverageSeedInput" value="' + (state.coverageSeed || 0) + '" '
      + 'style="padding:4px 8px;width:72px;border:1px solid var(--line-strong);border-radius:6px;font-size:10px">'
      + '<button class="btn" type="button" onclick="randomizeCoverageFromUi()">按 Seed 随机</button> '
      + '<button class="btn" type="button" onclick="rerollCoverageSeed()">换 Seed</button> '
      + '<button class="btn" type="button" onclick="resetCoverageDefaults()">恢复默认</button> '
      + '<button class="btn" type="button" onclick="clearCoverageSelection()">全部清空</button>'
      + '</div></div>';
  }
  if (cells.length) {
    h += '<div class="coverage-chips">' + cells.map(c => '<span class="lvl-pill ' + cellLevelClass(c) + '">'
      + escapeHtml(c) + '</span>').join("") + '</div>';
  }
  h += '<table class="coverage-picker"><thead><tr><th>A</th><th>能力</th><th>目标等级</th></tr></thead><tbody>';
  abs.forEach(a => {
    const cur = state.targetLevels[a.a_id] || "";
    const tone = levelClass(cur || "L0");
    h += '<tr class="' + tone + '"><td class="mono">' + escapeHtml(a.a_id)
      + '</td><td>' + escapeHtml(a.ability || "") + '</td><td>';
    if (editable) {
      h += '<select class="' + tone + '" data-cov-a="' + escapeHtml(a.a_id) + '">'
        + '<option value="">L0 · 不覆盖</option>'
        + ["L1", "L2", "L3", "L4"].map(lv => '<option value="' + lv + '"' + (cur === lv ? " selected" : "") + ">"
          + lv + " · " + escapeHtml((levelPolicyEntries().find(x => x.id === lv) || {}).label || lv)
          + "</option>").join("")
        + "</select>";
    } else {
      h += cur
        ? '<span class="lvl-text ' + tone + '">' + escapeHtml(cur) + '</span>'
        : '<span class="lvl-text lv-L0">L0 · 不覆盖</span>';
    }
    h += "</td></tr>";
  });
  h += "</tbody></table>";
  return h;
}

function bindCoveragePicker() {
  document.querySelectorAll("select[data-cov-a]").forEach(sel => {
    sel.addEventListener("change", () => {
      const aId = sel.getAttribute("data-cov-a");
      if (!aId) return;
      if (sel.value) state.targetLevels[aId] = sel.value;
      else delete state.targetLevels[aId];
      render();
    });
  });
  const seedEl = document.getElementById("coverageSeedInput");
  if (seedEl) {
    seedEl.addEventListener("change", () => {
      state.coverageSeed = Math.max(0, parseInt(seedEl.value, 10) || 0);
      persistState();
    });
  }
}

function resetCoverageDefaults() {
  state.targetLevels = defaultTargetLevels();
  render();
}

function clearCoverageSelection() {
  state.targetLevels = {};
  render();
}

/** Seeded PRNG (mulberry32) — same seed → same coverage. */
function coverageRng(seed) {
  let t = (seed >>> 0) + 0x6D2B79F5;
  return function next() {
    t |= 0; t = t + 0x6D2B79F5 | 0;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}

function pickRandomLevel(rand) {
  // 偏巡检常用：L2 最多，其次 L1/L3，偶发 L4
  const x = rand();
  if (x < 0.12) return "L1";
  if (x < 0.62) return "L2";
  if (x < 0.88) return "L3";
  return "L4";
}

function randomizeCoverage(seed) {
  const abs = ((state.catalogSummary && state.catalogSummary.abilities) || []).map(a => a.a_id).filter(Boolean);
  if (!abs.length) return;
  const s = Math.max(0, parseInt(seed, 10) || 0);
  state.coverageSeed = s;
  const rand = coverageRng(s);
  // 覆盖数量：约 8–14（不超过目录大小）
  const lo = Math.min(8, abs.length);
  const hi = Math.min(14, abs.length);
  const count = lo + Math.floor(rand() * (hi - lo + 1));
  const order = abs.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  const next = {};
  order.slice(0, count).forEach(aId => { next[aId] = pickRandomLevel(rand); });
  state.targetLevels = next;
}

function randomizeCoverageFromUi() {
  const el = document.getElementById("coverageSeedInput");
  const seed = el ? (parseInt(el.value, 10) || 0) : (state.coverageSeed || 0);
  randomizeCoverage(seed);
  persistState();
  render();
}

function rerollCoverageSeed() {
  const seed = Math.floor(Math.random() * 100000);
  randomizeCoverage(seed);
  persistState();
  render();
}
