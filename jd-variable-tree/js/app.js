(function () {
  "use strict";

  const DATA_URL = "knowledge/jd_variable_tree_version1.json";
  const COMMENT_STORAGE_KEY = "uav-benchmark-jd-comments-version1";
  const abilities = {
    A1: "意图 / 交互入口",
    A2: "任务规范 / 约束模型",
    A3: "意图推理 / 任务解释",
    A4: "交互到执行编排",
    A5: "监督 / 请求 / 交接",
    A6: "业务对象感知与状态理解",
    A7: "自定位",
    A8: "相对定位 / 相对几何",
    A9: "健康 / 能源 / 资源管理",
    A10: "导航与航迹执行",
    A11: "飞行控制 / 执行机构",
    GLOBAL: "JD-global / 共享业务变量",
  };
  const abilityVisualGroup = {
    A1: "human",
    A2: "human",
    A3: "human",
    A4: "human",
    A5: "human",
    A6: "perception",
    A7: "perception",
    A8: "perception",
    A9: "perception",
    A10: "motion",
    A11: "motion",
    GLOBAL: "global",
  };
  const scenarioLabels = {
    cross_scenario: "跨业务场景",
    highway_inspection: "高速巡检",
    campus_inspection: "园区巡检",
    white_wall_narrow_gap: "白墙窄缝穿梭",
  };
  const configurationLabels = {
    world: "世界侧",
    user: "用户侧",
    shared: "双侧共享",
    TBD: "TBD",
  };
  const projectionLabels = {
    world_config: "世界侧 Config",
    user_config: "用户侧 Config",
    sut_input: "SUT 输入",
    harness: "Harness",
    TBD: "TBD",
  };
  const observationLabels = {
    sut_input: "SUT 输入",
    sut_trace: "SUT Trace",
    fixture: "Fixture",
    grader: "Grader",
    hidden_gt: "Hidden GT",
    TBD: "TBD",
  };
  const visibilityLabels = {
    sut_visible: "SUT 可见",
    fixture_only: "Fixture 专用",
    grader_visible: "Grader 可见",
    grader_only: "Grader 专用",
    hidden_gt: "Hidden GT",
  };
  const difficultyLabels = {
    increasing: "递增",
    decreasing: "递减",
    neutral: "中性",
    context_dependent: "依上下文",
    non_monotonic: "非单调",
    TBD: "TBD",
  };
  const statusLabels = {
    authoritative_existing: ["已有定义", "existing"],
    source_supported: ["研究补充", "research"],
    inferred_candidate: ["推断候选", "inferred"],
    team_material_only: ["团队资料", "team"],
    TBD: ["待确认 / TBD", "tbd"],
  };
  const derivationLabels = {
    given: ["资料原文 / 已给定", "existing"],
    derived: ["合理归纳", "research"],
    proposed: ["待确认建议", "inferred"],
    TBD: ["TBD", "tbd"],
  };
  const reviewTopicLabels = {
    naming: "命名",
    definition: "定义",
    value_domain: "候选取值",
    hierarchy: "层级 / 归属",
    source: "来源依据",
    other: "其他",
  };

  const state = {
    catalog: null,
    nodes: [],
    nodeById: new Map(),
    sourceById: new Map(),
    childrenByParent: new Map(),
    selectedAbility: "A1",
    highlightedNodeId: null,
    activeNodeId: null,
    comments: [],
    storageAvailable: true,
  };

  const elements = {
    abilityTabs: document.getElementById("abilityTabs"),
    mapTitle: document.getElementById("mapTitle"),
    mapCount: document.getElementById("mapCount"),
    mapViewport: document.getElementById("mapViewport"),
    mindmap: document.getElementById("mindmap"),
    dialog: document.getElementById("detailDialog"),
    closeDialogButton: document.getElementById("closeDialogButton"),
    detailId: document.getElementById("detailId"),
    detailTitle: document.getElementById("detailTitle"),
    dialogBody: document.getElementById("dialogBody"),
    importCommentsButton: document.getElementById("importCommentsButton"),
    exportCommentsButton: document.getElementById("exportCommentsButton"),
    commentImportInput: document.getElementById("commentImportInput"),
    totalCommentCount: document.getElementById("totalCommentCount"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shortId(nodeId) {
    const abilityRoot = nodeId.match(
      /^PROPOSED-jd-tree-(A1|A2|A3|A4|A5|A6|A7|A8|A9|A10|A11)$/,
    );
    if (abilityRoot) return abilityRoot[1];
    if (nodeId === "PROPOSED-jd-tree-global") return "JD-global";
    return nodeId.replace(/^PROPOSED-/, "");
  }

  function rootIdForAbility(ability) {
    return ability === "GLOBAL"
      ? "PROPOSED-jd-tree-global"
      : `PROPOSED-jd-tree-${ability}`;
  }

  function nodesForAbility(ability) {
    if (ability !== "GLOBAL") {
      return state.nodes.filter((node) => node.owner_a === ability);
    }
    const result = [];
    const pending = [rootIdForAbility(ability)];
    const visited = new Set();
    while (pending.length) {
      const nodeId = pending.pop();
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const node = state.nodeById.get(nodeId);
      if (!node) continue;
      result.push(node);
      for (const child of state.childrenByParent.get(nodeId) || []) {
        pending.push(child.node_id);
      }
    }
    return result;
  }

  function displayAbilityForNode(node) {
    if (
      node.node_id === "PROPOSED-jd-tree-global" ||
      /^jd-0\.(?:[1-9]|10)$/.test(node.node_id) ||
      node.node_id.startsWith("PROPOSED-jd-0.")
    ) {
      return "GLOBAL";
    }
    return node.owner_a;
  }

  function loadReviewState() {
    try {
      state.comments = JSON.parse(
        window.localStorage.getItem(COMMENT_STORAGE_KEY) || "[]",
      );
      if (!Array.isArray(state.comments)) state.comments = [];
    } catch (error) {
      state.storageAvailable = false;
      state.comments = [];
      console.warn("修改建议无法写入本地存储，将仅保留在当前页面会话中。", error);
    }
  }

  function saveReviewState() {
    if (!state.storageAvailable) return;
    try {
      window.localStorage.setItem(
        COMMENT_STORAGE_KEY,
        JSON.stringify(state.comments),
      );
    } catch (error) {
      state.storageAvailable = false;
      console.warn("修改建议无法写入本地存储，将仅保留在当前页面会话中。", error);
    }
  }

  function commentsForNode(nodeId) {
    return state.comments
      .filter((comment) => comment.node_id === nodeId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  function updateReviewCount() {
    elements.totalCommentCount.textContent = String(state.comments.length);
  }

  function statusOf(item) {
    return (
      statusLabels[item.evidence_status || item.status] || [
        item.evidence_status || item.status || "未标注",
        "tbd",
      ]
    );
  }

  function badge(label, className = "") {
    return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
  }

  function tags(values, labels = {}) {
    if (!values || values.length === 0) return '<span class="tag">—</span>';
    return values
      .map((value) => `<span class="tag">${escapeHtml(labels[value] || value)}</span>`)
      .join("");
  }

  function buildIndexes() {
    state.nodes = state.catalog.nodes;
    state.nodeById = new Map(
      state.nodes.map((node) => [node.node_id, node]),
    );
    state.sourceById = new Map(
      state.catalog.sources.map((source) => [source.source_id, source]),
    );
    state.childrenByParent = new Map();
    for (const node of state.nodes) {
      if (!state.childrenByParent.has(node.parent_id)) {
        state.childrenByParent.set(node.parent_id, []);
      }
      state.childrenByParent.get(node.parent_id).push(node);
    }
    migrateLegacyComments();
  }

  function migrateLegacyComments() {
    const aliasToNodeId = new Map();
    for (const node of state.nodes) {
      for (const alias of node.legacy_aliases || []) {
        if (!aliasToNodeId.has(alias)) aliasToNodeId.set(alias, node.node_id);
      }
    }
    let changed = false;
    for (const comment of state.comments) {
      if (!state.nodeById.has(comment.node_id) && aliasToNodeId.has(comment.node_id)) {
        comment.legacy_node_id = comment.node_id;
        comment.node_id = aliasToNodeId.get(comment.node_id);
        comment.ability = state.nodeById.get(comment.node_id)?.owner_a || null;
        comment.updated_at = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) saveReviewState();
  }

  function renderTabs() {
    elements.abilityTabs.innerHTML = Object.entries(abilities)
      .map(([ability, name]) => {
        const count = nodesForAbility(ability).filter(
          (node) => node.node_kind === "variable",
        ).length;
        const displayName =
          ability === "GLOBAL"
            ? "JD-global · 共享业务变量"
            : `${ability} · ${name}`;
        return `<button class="ability-tab group-${abilityVisualGroup[ability]}" type="button" role="tab"
          data-ability="${ability}"
          aria-selected="${ability === state.selectedAbility}">
          <strong>${escapeHtml(displayName)}</strong>
          <span>${count} 个变量叶子</span>
        </button>`;
      })
      .join("");
  }

  function nodeClass(node) {
    if (node.node_kind === "global_root") return "root global-root";
    if (node.node_kind === "capability_root") return "root";
    if (
      node.node_id === "PROPOSED-jd-11.4" ||
      node.node_id === "PROPOSED-jd-11.5"
    ) {
      return "canonical";
    }
    if (node.review_status === "reviewed") return "canonical";
    if (node.node_kind === "example_profile") return "example";
    if (node.node_kind === "group") return "group";
    return "variable";
  }

  function renderBranch(node) {
    const children = state.childrenByParent.get(node.node_id) || [];
    const hasChildren = children.length > 0;
    const highlighted = state.highlightedNodeId === node.node_id;
    const commentCount = commentsForNode(node.node_id).length;
    return `<div class="mind-branch${hasChildren ? " has-children" : ""}">
      <button class="mind-node ${nodeClass(node)}${highlighted ? " is-highlighted" : ""}"
        type="button" data-node-id="${escapeHtml(node.node_id)}"
        aria-label="${escapeHtml(`${shortId(node.node_id)} ${node.name}，打开详情`)}">
        <code>${escapeHtml(shortId(node.node_id))}</code>
        <span>${escapeHtml(node.name)}</span>
        ${
          commentCount
            ? `<b class="comment-count" aria-label="${commentCount} 条修改建议">${commentCount}</b>`
            : ""
        }
      </button>
      ${
        hasChildren
          ? `<div class="mind-children">${children
              .map(
                (child) =>
                  `<div class="mind-child">${renderBranch(child)}</div>`,
              )
              .join("")}</div>`
          : ""
      }
    </div>`;
  }

  function renderMap() {
    const root = state.nodeById.get(rootIdForAbility(state.selectedAbility));
    const count = nodesForAbility(state.selectedAbility).length;
    elements.mapTitle.textContent =
      state.selectedAbility === "GLOBAL"
        ? "JD-global · 共享业务变量"
        : `${state.selectedAbility} · ${abilities[state.selectedAbility]}`;
    elements.mapCount.textContent = `${count} 个节点，点击任一标签查看详情`;
    elements.mindmap.innerHTML = root
      ? renderBranch(root)
      : '<div class="load-error">未找到能力树。</div>';
    document.body.dataset.abilityGroup =
      abilityVisualGroup[state.selectedAbility] || "human";
    requestAnimationFrame(() => {
      layoutConnectorSpines();
      centerMapRoot();
    });
  }

  function layoutConnectorSpines() {
    const childGroups = elements.mindmap.querySelectorAll(".mind-children");
    for (const childGroup of childGroups) {
      const directChildren = Array.from(childGroup.children).filter((child) =>
        child.classList.contains("mind-child"),
      );
      if (directChildren.length < 2) {
        childGroup.style.setProperty("--spine-height", "0px");
        continue;
      }

      const firstNode = directChildren[0].querySelector(
        ":scope > .mind-branch > .mind-node",
      );
      const lastNode = directChildren.at(-1).querySelector(
        ":scope > .mind-branch > .mind-node",
      );
      if (!firstNode || !lastNode) continue;

      const groupRect = childGroup.getBoundingClientRect();
      const firstRect = firstNode.getBoundingClientRect();
      const lastRect = lastNode.getBoundingClientRect();
      const spineTop =
        firstRect.top - groupRect.top + firstRect.height / 2;
      const spineBottom =
        lastRect.top - groupRect.top + lastRect.height / 2;

      childGroup.style.setProperty("--spine-top", `${spineTop}px`);
      childGroup.style.setProperty(
        "--spine-height",
        `${Math.max(0, spineBottom - spineTop)}px`,
      );
    }
  }

  function centerMapRoot() {
    const rootNode = elements.mindmap.querySelector(".mind-node.root");
    if (!rootNode) return;
    const viewportPaddingLeft =
      Number.parseFloat(
        window.getComputedStyle(elements.mapViewport).paddingLeft,
      ) || 0;
    const horizontalInset = Math.max(
      0,
      (elements.mapViewport.clientWidth - rootNode.offsetWidth) / 2 -
        viewportPaddingLeft,
    );
    elements.mindmap.style.paddingLeft = `${horizontalInset}px`;
    requestAnimationFrame(() => {
      const viewportRect = elements.mapViewport.getBoundingClientRect();
      const rootRect = rootNode.getBoundingClientRect();
      const rootCenter =
        rootRect.top -
        viewportRect.top +
        elements.mapViewport.scrollTop +
        rootRect.height / 2;
      elements.mapViewport.scrollTop = Math.max(
        0,
        rootCenter - elements.mapViewport.clientHeight / 2,
      );
      elements.mapViewport.scrollLeft = 0;
    });
  }

  function selectAbility(ability) {
    state.selectedAbility = ability;
    renderTabs();
    renderMap();
  }

  function detailField(label, value) {
    return `<div class="detail-field"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
  }

  function renderDomain(node) {
    const domain = node.value_domain;
    if (domain === null || domain === undefined) {
      return '<span class="tag">该节点是结构分组，无取值域</span>';
    }
    if (!Array.isArray(domain)) {
      return `<pre>${escapeHtml(JSON.stringify(domain, null, 2))}</pre>`;
    }
    if (domain.length === 0) return '<span class="tag">候选取值待补充</span>';
    return `<div class="value-list">${domain
      .map((item) => {
        if (item === null || typeof item !== "object") {
          return `<div class="value-item"><strong>${escapeHtml(item)}</strong></div>`;
        }
        const [, statusClass] = statusOf(item);
        return `<div class="value-item ${statusClass}">
          <strong>${escapeHtml(item.label_zh || item.value)}</strong>
          <code>${escapeHtml(item.value)}</code>
          <small>${escapeHtml(
            [
              statusLabels[item.status]?.[0] || item.status,
              (item.applicable_scenarios || [])
                .map((scenario) => scenarioLabels[scenario] || scenario)
                .join("、"),
              (item.source_refs || []).join("、"),
            ]
              .filter(Boolean)
              .join(" · "),
          )}</small>
        </div>`;
      })
      .join("")}</div>`;
  }

  function renderSources(node) {
    if (!node.source || node.source.length === 0) {
      return '<span class="tag">暂无来源</span>';
    }
    return `<div class="source-links">${node.source
      .map((sourceId) => {
        const source = state.sourceById.get(sourceId);
        const content = `<strong>${escapeHtml(sourceId)} · ${escapeHtml(
          source?.title || sourceId,
        )}</strong><span>${escapeHtml(
          [source?.issuer, source?.locator].filter(Boolean).join(" · "),
        )}</span>`;
        return source?.url
          ? `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${content}</a>`
          : `<div class="source-link">${content}</div>`;
      })
      .join("")}</div>`;
  }

  function renderExampleBindings(node) {
    if (!Array.isArray(node.example_bindings) || !node.example_bindings.length) {
      return "";
    }
    const bindingItems = node.example_bindings
      .map((binding) => {
        const values = Array.isArray(binding.value_domain)
          ? binding.value_domain
              .map((item) =>
                item && typeof item === "object"
                  ? item.label_zh || item.value
                  : item,
              )
              .filter((item) => item !== null && item !== undefined)
          : [];
        return `<article class="example-binding-item">
          <strong>${escapeHtml(binding.path || binding.source_node_id)}</strong>
          <code>${escapeHtml(binding.source_node_id)}</code>
          <small>${escapeHtml(
            [binding.value_type, binding.unit].filter(Boolean).join(" · "),
          )}</small>
          ${
            values.length
              ? `<div class="tag-list">${values
                  .map((value) => `<span class="tag">${escapeHtml(value)}</span>`)
                  .join("")}</div>`
              : '<span class="tag">无固定候选值</span>'
          }
        </article>`;
      })
      .join("");
    return `<section class="detail-section">
      <h3>白墙窄缝 v0.6 示例赋值</h3>
      <div class="example-binding-list">${bindingItems}</div>
    </section>`;
  }

  function renderConditions(node) {
    const conditions = {
      activation_condition: node.activation_condition,
      depends_on: node.depends_on,
      mutual_exclusion_group: node.mutual_exclusion_group,
      constraints: node.constraints,
    };
    const hasValue = Object.values(conditions).some(
      (value) =>
        value !== null &&
        value !== undefined &&
        (!Array.isArray(value) || value.length > 0),
    );
    return hasValue
      ? `<section class="detail-section"><h3>启用条件与依赖</h3><pre>${escapeHtml(
          JSON.stringify(conditions, null, 2),
        )}</pre></section>`
      : "";
  }

  function formatCommentTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return date.toLocaleString("zh-CN", { hour12: false });
  }

  function renderCommentSection(node) {
    const comments = commentsForNode(node.node_id);
    const topicOptions = Object.entries(reviewTopicLabels)
      .map(
        ([value, label]) =>
          `<option value="${value}">${escapeHtml(label)}</option>`,
      )
      .join("");
    const commentItems = comments.length
      ? comments
          .map(
            (comment) => `<article class="review-comment${
              comment.status === "resolved" ? " is-resolved" : ""
            }">
              <div class="review-comment-head">
                <strong>${escapeHtml(
                  reviewTopicLabels[comment.topic] || comment.topic || "其他",
                )} · ${escapeHtml(formatCommentTime(comment.created_at))}</strong>
                <span class="review-state">${
                  comment.status === "resolved" ? "已处理" : "待处理"
                }</span>
              </div>
              <p>${escapeHtml(comment.body)}</p>
              <div class="review-comment-actions">
                <button type="button" data-comment-action="toggle"
                  data-comment-id="${escapeHtml(comment.comment_id)}">${
                    comment.status === "resolved" ? "重新打开" : "标记已处理"
                  }</button>
                <button type="button" data-comment-action="delete"
                  data-comment-id="${escapeHtml(comment.comment_id)}">删除</button>
              </div>
            </article>`,
          )
          .join("")
      : '<p class="empty-comments">这个节点还没有修改建议。</p>';

    return `<section class="detail-section review-section">
      <div class="review-section-head">
        <h3>修改建议</h3>
        <span>${comments.length} 条</span>
      </div>
      <div class="review-form">
        <label>
          <span>评论类型</span>
          <select id="commentTopic">${topicOptions}</select>
        </label>
        <label class="review-message">
          <span>评论内容</span>
          <textarea id="commentMessage" rows="3" maxlength="2000"
            placeholder="填写修改建议"></textarea>
        </label>
        <div class="review-submit-row">
          <span id="commentFormError" role="alert"></span>
          <button class="review-submit" type="button"
            data-comment-action="add" data-node-id="${escapeHtml(
              node.node_id,
            )}">添加建议</button>
        </div>
      </div>
      <div class="review-comment-list">${commentItems}</div>
    </section>`;
  }

  function openNode(nodeId) {
    const node = state.nodeById.get(nodeId);
    if (!node) return;
    state.activeNodeId = nodeId;
    state.highlightedNodeId = nodeId;
    const displayAbility = displayAbilityForNode(node);
    if (displayAbility !== state.selectedAbility) {
      state.selectedAbility = displayAbility;
      renderTabs();
    }
    renderMap();

    const [statusLabel, statusClass] = statusOf(node);
    const [derivationLabel, derivationClass] =
      derivationLabels[node.derivation_status] || [
        node.derivation_status || "未标注",
        "tbd",
      ];
    elements.detailId.textContent = node.node_id;
    elements.detailTitle.textContent = node.name;
    const related = [
      ...(node.related_global_jd || []),
      ...(node.related_jd || []),
    ];
    elements.dialogBody.innerHTML = `
      <div class="detail-status">
        ${badge(statusLabel, statusClass)}
        ${badge(derivationLabel, derivationClass)}
        ${badge(node.review_status)}
        ${badge(node.owner_a)}
        ${badge(node.node_kind)}
      </div>
      <p class="detail-definition">${escapeHtml(node.definition)}</p>

      <section class="detail-section">
        <h3>节点属性</h3>
        <dl class="detail-grid">
          ${detailField("显示编号", `<code>${escapeHtml(shortId(node.node_id))}</code>`)}
          ${detailField("正式槽位", `<code>${escapeHtml(node.canonical_slot || "—")}</code>`)}
          ${detailField("旧编号 / 别名", tags(node.legacy_aliases))}
          ${detailField("父节点", `<code>${escapeHtml(node.parent_id || "—")}</code>`)}
          ${detailField("值类型", escapeHtml(node.value_type))}
          ${detailField("配置归属", escapeHtml(configurationLabels[node.configuration_side] || node.configuration_side))}
          ${detailField("配置投影", tags(node.projection_targets, projectionLabels))}
          ${detailField("可见性", tags(node.visibility, visibilityLabels))}
          ${detailField("观察通道", tags(node.observation_channel, observationLabels))}
          ${detailField("难度方向", escapeHtml(difficultyLabels[node.difficulty_direction] || node.difficulty_direction))}
          ${detailField("适用场景", tags(node.applicable_scenarios, scenarioLabels))}
          ${detailField("A×L 使用关系", tags(node.used_by_axl))}
          ${detailField("相关 JD", tags(related))}
          ${detailField("多重性", escapeHtml(node.multiplicity))}
          ${detailField("证据状态", escapeHtml(node.evidence_status))}
          ${detailField("推导状态", escapeHtml(node.derivation_status))}
        </dl>
      </section>

      <section class="detail-section">
        <h3>候选取值 / 取值范围</h3>
        ${renderDomain(node)}
      </section>

      ${renderExampleBindings(node)}

      ${renderConditions(node)}

      <section class="detail-section">
        <h3>定义依据</h3>
        ${renderSources(node)}
      </section>

      ${
        node.notes
          ? `<section class="detail-section"><h3>审阅备注</h3><div class="notes">${escapeHtml(node.notes)}</div></section>`
          : ""
      }

      ${renderCommentSection(node)}
    `;
    if (!elements.dialog.open) elements.dialog.showModal();
  }

  function addComment(nodeId) {
    const topicInput = document.getElementById("commentTopic");
    const messageInput = document.getElementById("commentMessage");
    const errorElement = document.getElementById("commentFormError");
    const body = messageInput?.value.trim() || "";
    if (!body) {
      if (errorElement) errorElement.textContent = "请填写建议内容。";
      return;
    }

    const now = new Date().toISOString();
    state.comments.push({
      comment_id:
        window.crypto?.randomUUID?.() ||
        `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      node_id: nodeId,
      ability: state.nodeById.get(nodeId)?.owner_a || null,
      topic: topicInput?.value || "other",
      body,
      status: "open",
      created_at: now,
      updated_at: now,
    });
    saveReviewState();
    updateReviewCount();
    renderMap();
    openNode(nodeId);
  }

  function updateComment(commentId, action) {
    const index = state.comments.findIndex(
      (comment) => comment.comment_id === commentId,
    );
    if (index < 0) return;
    if (action === "delete") {
      if (!window.confirm("确定删除这条评论吗？")) return;
      state.comments.splice(index, 1);
    } else if (action === "toggle") {
      state.comments[index].status =
        state.comments[index].status === "resolved" ? "open" : "resolved";
      state.comments[index].updated_at = new Date().toISOString();
    }
    saveReviewState();
    updateReviewCount();
    renderMap();
    if (state.activeNodeId) openNode(state.activeNodeId);
  }

  function exportComments() {
    const payload = {
      schema: "uav-benchmark-jd-review-comments",
      schema_version: "1.0",
      catalog_id: state.catalog.catalog_id,
      catalog_version: state.catalog.catalog_version,
      exported_at: new Date().toISOString(),
      comments: state.comments,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    link.href = url;
    link.download = `JD业务变量树_修改建议_${date}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importComments(file) {
    const payload = JSON.parse(await file.text());
    if (
      payload.schema !== "uav-benchmark-jd-review-comments" ||
      !Array.isArray(payload.comments)
    ) {
      throw new Error("不是有效的 JD 变量树修改建议文件。");
    }
    const commentsById = new Map(
      state.comments.map((comment) => [comment.comment_id, comment]),
    );
    let importedCount = 0;
    for (const comment of payload.comments) {
      if (
        !comment ||
        typeof comment.comment_id !== "string" ||
        typeof comment.node_id !== "string" ||
        typeof comment.body !== "string"
      ) {
        continue;
      }
      if (!state.nodeById.has(comment.node_id)) continue;
      const existing = commentsById.get(comment.comment_id);
      if (
        !existing ||
        String(comment.updated_at || "") >
          String(existing.updated_at || "")
      ) {
        commentsById.set(comment.comment_id, comment);
        importedCount += 1;
      }
    }
    state.comments = Array.from(commentsById.values());
    saveReviewState();
    updateReviewCount();
    renderMap();
    if (state.activeNodeId && elements.dialog.open) {
      openNode(state.activeNodeId);
    }
    window.alert(`已导入或更新 ${importedCount} 条修改建议。`);
  }

  function bindEvents() {
    elements.abilityTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-ability]");
      if (button) {
        state.highlightedNodeId = null;
        selectAbility(button.dataset.ability);
      }
    });

    elements.mindmap.addEventListener("click", (event) => {
      const button = event.target.closest("[data-node-id]");
      if (button) openNode(button.dataset.nodeId);
    });

    elements.closeDialogButton.addEventListener("click", () =>
      elements.dialog.close(),
    );
    elements.dialog.addEventListener("click", (event) => {
      if (event.target === elements.dialog) elements.dialog.close();
    });
    elements.dialogBody.addEventListener("click", (event) => {
      const button = event.target.closest("[data-comment-action]");
      if (!button) return;
      const action = button.dataset.commentAction;
      if (action === "add") {
        addComment(button.dataset.nodeId);
      } else {
        updateComment(button.dataset.commentId, action);
      }
    });
    elements.importCommentsButton.addEventListener("click", () =>
      elements.commentImportInput.click(),
    );
    elements.exportCommentsButton.addEventListener("click", exportComments);
    elements.commentImportInput.addEventListener("change", async () => {
      const [file] = elements.commentImportInput.files || [];
      if (!file) return;
      try {
        await importComments(file);
      } catch (error) {
        window.alert(error.message);
      } finally {
        elements.commentImportInput.value = "";
      }
    });
    window.addEventListener("resize", () => {
      layoutConnectorSpines();
      centerMapRoot();
    });
  }

  async function init() {
    try {
      if (window.__JD_VARIABLE_TREE_CATALOG__) {
        state.catalog = window.__JD_VARIABLE_TREE_CATALOG__;
      } else {
        const response = await fetch(DATA_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`数据加载失败：${response.status}`);
        state.catalog = await response.json();
      }
      loadReviewState();
      buildIndexes();
      updateReviewCount();
      renderTabs();
      renderMap();
      bindEvents();
    } catch (error) {
      elements.mindmap.innerHTML = `<div class="load-error">${escapeHtml(
        error.message,
      )}<br>请通过 127.0.0.1:8766 打开本页。</div>`;
      console.error(error);
    }
  }

  init();
})();
