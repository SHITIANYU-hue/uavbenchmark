#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(
    path.join(root, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\s/／·・,，、:：()（）\[\]【】_-]+/g, "")
    .toLowerCase();
}

function annotateMetric(metric) {
  if (!metric || typeof metric !== "object" || Array.isArray(metric)) return metric;
  return {
    ...metric,
    review_status: metric.review_status || "proposed",
    threshold_authority: metric.threshold_authority || "TBD",
    applies_by_default: false,
  };
}

function annotateMetricArray(value) {
  return Array.isArray(value) ? value.map(annotateMetric) : value;
}

const v1 = readJson("knowledge/jd_variable_tree_version1.json");
const v2 = readJson("knowledge/jd_variable_tree_version2.json");
const jdDictionary = readJson("knowledge/jd_dictionary.json");
const canonicalJdIds = new Set(
  jdDictionary.variables.map((variable) => variable.id),
);

const expectedAbilityNames = {
  A15: "审计日志",
  A16: "合规申报",
  A17: "安全包络",
};
for (const [abilityId, expectedName] of Object.entries(expectedAbilityNames)) {
  const actual = v2.nodes.find((node) => node.node_id === abilityId);
  if (!actual || actual.name !== expectedName) {
    throw new Error(
      `Version 2 编号基线不一致：${abilityId} 应为“${expectedName}”，实际为“${actual?.name || "缺失"}”。`,
    );
  }
}

const teamSourceId = "L-JD-TREE-V2-TEAM-2026-07-22";
const metricSourceId = "L-JD-TREE-V2-METRIC-DRAFT-2026-07-22";
const whiteWallSourceId = "L-JD-TREE-V2-WHITE-WALL-CASE";
const mergeSourceId = "L-JD-TREE-V1-AUDIT-MERGE";
const mergeSources = [
  {
    source_id: teamSourceId,
    title: "团队 JD 业务变量树 Version 2",
    issuer: "UAV Benchmark team",
    source_type: "team_working_material",
    locator: "knowledge/jd_variable_tree_version2.json（合并前 Version 2 主干）",
    url: null,
    evidence_grade: "team_material_only",
  },
  {
    source_id: metricSourceId,
    title: "Version 2 metric 草案",
    issuer: "UAV Benchmark team",
    source_type: "unreviewed_metric_draft",
    locator: "metric.md 与 knowledge/metric_set_*.json",
    url: null,
    evidence_grade: "inferred_candidate",
  },
  {
    source_id: whiteWallSourceId,
    title: "白墙窄缝案例覆盖层",
    issuer: "UAV Benchmark team",
    source_type: "case_overlay",
    locator: "knowledge/case_white_wall_narrow_gap.json",
    url: null,
    evidence_grade: "team_material_only",
  },
  {
    source_id: mergeSourceId,
    title: "Version 1 审计语义迁移规则",
    issuer: "UAV Benchmark project",
    source_type: "curation_rule",
    locator: "scripts/merge_jd_variable_tree_v1_into_v2.mjs",
    url: null,
    evidence_grade: "authoritative_existing",
  },
];

const v1BySemanticKey = new Map();
const v1NodeIds = new Set(v1.nodes.map((node) => node.node_id));
for (const node of v1.nodes) {
  if (node.owner_a === "MULTI") continue;
  if (
    node.variable_role === "example_profile" ||
    node.node_id.startsWith("CASE-") ||
    node.node_id.startsWith("PROPOSED-jd-11.5")
  ) {
    continue;
  }
  const key = `${node.owner_a}::${normalizeName(node.name)}`;
  if (!normalizeName(node.name)) continue;
  const matches = v1BySemanticKey.get(key) || [];
  matches.push(node);
  v1BySemanticKey.set(key, matches);
}

const canonicalByAbility = Object.fromEntries(
  Array.from({ length: 17 }, (_, index) => `A${index + 1}`).map((abilityId) => [
    abilityId,
    jdDictionary.variables
      .filter(
        (variable) =>
          variable.scope === "local" && variable.owner_a === abilityId,
      )
      .map((variable) => variable.id),
  ]),
);

let exactMatchCount = 0;
let hiddenGroundTruthCount = 0;

function defaultFlow(node) {
  if (node.node_kind !== "variable") {
    return {
      variable_role: "structural_group",
      projection_targets: [],
      visibility: node.visibility || [],
      observation_channel: node.observation_channel || [],
    };
  }
  return {
    variable_role: "TBD",
    projection_targets: [],
    visibility: node.visibility || ["grader_visible"],
    observation_channel: node.observation_channel || ["TBD"],
  };
}

function isA11WorldTruth(node) {
  return (
    node.node_kind === "variable" &&
    node.owner_a === "A11" &&
    node.node_id.startsWith("jd-11.1.3.")
  );
}

function enrichValueDomain(domain, matched) {
  if (!Array.isArray(domain)) return domain;
  const matchedDomain = Array.isArray(matched?.value_domain)
    ? matched.value_domain
    : [];
  return domain.map((item) => {
    if (!item || typeof item !== "object") return item;
    const candidate = matchedDomain.find(
      (sourceItem) =>
        normalizeName(sourceItem?.value) === normalizeName(item.value) ||
        normalizeName(sourceItem?.label_zh || sourceItem?.label) ===
          normalizeName(item.label_zh || item.label),
    );
    return {
      ...item,
      source_refs: unique(candidate?.source_refs || [teamSourceId]),
      status: candidate?.status || "inferred_candidate",
    };
  });
}

function stripPriorMergeNotes(value) {
  return String(value || "")
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.startsWith("审计语义由 ") &&
        !line.startsWith("未找到 Version 1 唯一语义对应") &&
        !line.startsWith("该节点描述世界侧实际几何、外观、布局或运动真值"),
    )
    .join("\n") || null;
}

const enrichedV2Nodes = v2.nodes
  .filter((node) => node.owner_a !== "MULTI")
  .map((node) => {
  const key = `${node.owner_a}::${normalizeName(node.name)}`;
  const matches = v1BySemanticKey.get(key) || [];
  const matched = matches.length === 1 ? matches[0] : null;
  const flow = defaultFlow(node);
  if (matched) {
    exactMatchCount += 1;
    flow.variable_role = matched.variable_role || flow.variable_role;
    flow.projection_targets = matched.projection_targets || [];
    flow.visibility = matched.visibility || flow.visibility;
    flow.observation_channel =
      matched.observation_channel || flow.observation_channel;
  }
  if (isA11WorldTruth(node)) {
    hiddenGroundTruthCount += 1;
    flow.variable_role = "hidden_ground_truth";
    flow.projection_targets = ["world_config", "harness"];
    flow.visibility = ["fixture_only", "grader_only", "hidden_gt"];
    flow.observation_channel = ["fixture", "grader", "hidden_gt"];
  }

  const canonicalRefs =
    node.node_kind === "capability_root"
      ? canonicalByAbility[node.owner_a] || []
      : unique(
          [matched?.canonical_slot, ...(matched?.related_jd || [])].filter(
            (item) => typeof item === "string" && canonicalJdIds.has(item),
          ),
        );
  const notes = unique([
    stripPriorMergeNotes(node.notes),
    matched
      ? `审计语义由 ${matched.node_id} 按同能力、同名称唯一匹配迁移；Version 2 层级仍为 proposed。`
      : node.node_kind === "variable"
        ? "未找到 Version 1 唯一语义对应；变量角色、生产者与投影关系保持待确认。"
        : null,
    flow.variable_role === "TBD"
      ? "生产者与变量角色尚无充分受审依据，继续保持 TBD，列为待确认。"
      : null,
    isA11WorldTruth(node)
      ? "该节点描述世界侧实际几何、外观、布局或运动真值；只供 Fixture / Harness / Grader 使用，不直接提供给 SUT。"
      : null,
  ]).join("\n") || null;

  return {
    ...node,
    schema_version: "jd-tree/2.4",
    variable_role: flow.variable_role,
    projection_targets: flow.projection_targets,
    visibility: flow.visibility,
    observation_channel: flow.observation_channel,
    canonical_jd_refs: canonicalRefs,
    source: unique([teamSourceId, ...(matched?.source || [])]),
    value_domain: enrichValueDomain(node.value_domain, matched),
    used_by_axl: unique([...(node.used_by_axl || []), ...(matched?.used_by_axl || [])]),
    legacy_aliases: unique([
      ...(node.legacy_aliases || []).filter((item) => !v1NodeIds.has(item)),
      ...(matched?.legacy_aliases || []),
      matched?.node_id,
    ]),
    notes,
    case_metrics: annotateMetricArray(node.case_metrics),
    runtime_metrics: annotateMetricArray(node.runtime_metrics),
    grader_metrics: annotateMetricArray(node.grader_metrics),
    merge_origin: matched ? "v1_exact_semantic_match" : "v2_team_structure",
  };
  });

const globalNodes = v1.nodes
  .filter(
    (node) =>
      node.owner_a === "MULTI" && node.node_id !== v1.catalog_id,
  )
  .filter(
    (node) =>
      node.node_id !== "PROPOSED-jd-tree-version1" &&
      node.node_kind !== "catalog_root",
  )
  .map((node) => ({
    ...node,
    schema_version: "jd-tree/2.4",
    parent_id:
      node.node_id === "PROPOSED-jd-tree-global" ? null : node.parent_id,
    source: unique([mergeSourceId, ...(node.source || [])]),
    canonical_jd_refs: unique([
      node.canonical_slot,
      ...(node.related_global_jd || []),
    ]),
    merge_origin: "v1_audited_global_branch",
  }));

const existingIds = new Set(enrichedV2Nodes.map((node) => node.node_id));
for (const node of globalNodes) {
  if (existingIds.has(node.node_id)) {
    throw new Error(`Version 2 与 JD-global 节点 ID 冲突：${node.node_id}`);
  }
  existingIds.add(node.node_id);
}

const nodes = [...enrichedV2Nodes, ...globalNodes];
const sourcesById = new Map();
for (const source of [...(v1.sources || []), ...mergeSources]) {
  sourcesById.set(source.source_id, source);
}

const merged = {
  ...v2,
  schema_version: "2.4",
  catalog_version: "2.4.0-audited-merge",
  generated_at: "2026-07-22",
  generated_by: "scripts/merge_jd_variable_tree_v1_into_v2.mjs",
  merged_from: [
    {
      catalog_id: v2.catalog_id,
      catalog_version: v2.catalog_version,
      role: "primary_structure_and_ui",
    },
    {
      catalog_id: v1.catalog_id,
      catalog_version: v1.catalog_version,
      role: "audited_semantics_and_global_jd",
    },
  ],
  authority_rules: unique([
    ...(v1.authority_rules || []),
    "Version 2 四层结构为团队 proposed 工作树；canonical JD 名称与定义仍以 66 槽位权威字典为准。",
    "仅按同能力、同名称的唯一匹配迁移 Version 1 审计语义；无唯一匹配的变量角色与生产者保持 TBD。",
    "metric set 中现有数值是未受审演示候选，不默认生效，不构成 threshold、业务规则或安全判据。",
    "白墙窄缝继续作为 CASE 覆盖层，不升级为 canonical JD。",
  ]),
  controlled_vocabularies: v1.controlled_vocabularies,
  canonical_jd_by_ability: canonicalByAbility,
  global_scope: v1.global_scope,
  open_questions_document: v1.open_questions_document,
  curation_audit_document: v1.curation_audit_document,
  metric_annotation: {
    ...(v2.metric_annotation || {}),
    review_status: "proposed",
    threshold_authority: "TBD",
    applies_by_default: false,
    note: `${v2.metric_annotation?.note || ""} 现有 metric 数值仅为未受审演示候选；未获业务或安全依据前不得作为默认评分阈值。`.trim(),
  },
  sources: [...sourcesById.values()],
  counts: {
    node_count: nodes.length,
    variable_leaf_count: nodes.filter((node) => node.node_kind === "variable").length,
    ability_count: 17,
    global_node_count: globalNodes.length,
    exact_v1_semantic_matches: exactMatchCount,
    hidden_ground_truth_nodes: hiddenGroundTruthCount,
    tbd_variable_roles: nodes.filter(
      (node) => node.node_kind === "variable" && node.variable_role === "TBD",
    ).length,
  },
  nodes,
};

writeJson("knowledge/jd_variable_tree_version2.json", merged);

for (const relativePath of [
  "knowledge/metric_set_default.json",
  "knowledge/metric_set_a11_default.json",
  "knowledge/metric_set_a11_strict.json",
]) {
  const metricSet = readJson(relativePath);
  writeJson(relativePath, {
    ...metricSet,
    authority_status: "unreviewed_demo_candidate",
    review_status: "proposed",
    applies_by_default: false,
    threshold_authority: "TBD",
    notes: unique([
      metricSet.notes,
      "现有数值来自团队演示草案，尚无受审业务、安全或法规依据；不得作为默认阈值，使用前必须人工确认并记录来源。",
    ]).join("\n"),
  });
}

console.log(
  `Merged Version 2: ${nodes.length} nodes, ${exactMatchCount} exact v1 matches, ${globalNodes.length} JD-global nodes, ${hiddenGroundTruthCount} hidden GT nodes.`,
);
