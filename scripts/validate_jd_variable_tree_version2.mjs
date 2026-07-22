#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const catalog = readJson("knowledge/jd_variable_tree_version2.json");
const dictionary = readJson("knowledge/jd_dictionary.json");
const errors = [];
const nodes = catalog.nodes || [];
const ids = nodes.map((node) => node.node_id);
const idSet = new Set(ids);
const sourceIds = new Set((catalog.sources || []).map((source) => source.source_id));
const canonicalIds = new Set(dictionary.variables.map((variable) => variable.id));

if (catalog.schema_version !== "2.4") {
  errors.push(`schema_version 应为 2.4，实际为 ${catalog.schema_version}`);
}
if (ids.length !== idSet.size) {
  errors.push(`节点 ID 不唯一：${ids.length} 个节点、${idSet.size} 个唯一 ID。`);
}
if ((catalog.sources || []).length === 0) {
  errors.push("Version 2 合并树缺少来源目录。");
}

for (const node of nodes) {
  if (!node.node_id) errors.push("存在缺少 node_id 的节点。");
  if (node.parent_id && !idSet.has(node.parent_id)) {
    errors.push(`${node.node_id} 的父节点 ${node.parent_id} 不存在。`);
  }
  if (/EX\d+/i.test(node.node_id)) {
    errors.push(`${node.node_id} 仍含无业务语义的 EX 临时编号。`);
  }
  if (node.node_kind === "variable" && !node.variable_role) {
    errors.push(`${node.node_id} 缺少 variable_role。`);
  }
  if (
    node.node_kind === "variable" &&
    node.variable_role === "TBD" &&
    !/(待确认|无法确认)/.test(node.notes || "")
  ) {
    errors.push(`${node.node_id} 的变量角色为 TBD，但未记录待确认原因。`);
  }
  if (node.variable_role === "hidden_ground_truth") {
    if ((node.projection_targets || []).includes("sut_input")) {
      errors.push(`${node.node_id} 的 Hidden GT 被投影到 sut_input。`);
    }
    if ((node.visibility || []).includes("sut_visible")) {
      errors.push(`${node.node_id} 的 Hidden GT 被标记为 sut_visible。`);
    }
    if ((node.observation_channel || []).includes("sut_input")) {
      errors.push(`${node.node_id} 的 Hidden GT 出现在 sut_input 观测通道。`);
    }
  }
  for (const sourceId of node.source || []) {
    if (!sourceIds.has(sourceId)) {
      errors.push(`${node.node_id} 引用了不存在的来源 ${sourceId}。`);
    }
  }
  for (const canonicalId of node.canonical_jd_refs || []) {
    if (!canonicalIds.has(canonicalId)) {
      errors.push(`${node.node_id} 引用了不存在的 canonical JD ${canonicalId}。`);
    }
  }
  for (const value of node.value_domain || []) {
    for (const sourceId of value?.source_refs || []) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`${node.node_id} 的候选值引用了不存在的来源 ${sourceId}。`);
      }
    }
    if (value && typeof value === "object" && !value.status) {
      errors.push(`${node.node_id} 的候选值 ${value.value} 缺少逐值证据状态。`);
    }
  }
}

for (const node of nodes) {
  const visited = new Set();
  let cursor = node;
  while (cursor?.parent_id) {
    if (visited.has(cursor.node_id)) {
      errors.push(`${node.node_id} 所在父链存在环。`);
      break;
    }
    visited.add(cursor.node_id);
    cursor = nodes.find((candidate) => candidate.node_id === cursor.parent_id);
  }
}

const expectedAbilities = {
  A2: "实况填参",
  A15: "审计日志",
  A16: "合规申报",
  A17: "安全包络",
};
const abilityRoots = nodes.filter((node) => node.node_kind === "capability_root");
if (abilityRoots.length !== 17) {
  errors.push(`应有 17 个能力根，实际为 ${abilityRoots.length}。`);
}
for (const [abilityId, expectedName] of Object.entries(expectedAbilities)) {
  const node = nodes.find((candidate) => candidate.node_id === abilityId);
  if (!node || node.name !== expectedName) {
    errors.push(`${abilityId} 应为“${expectedName}”，实际为“${node?.name || "缺失"}”。`);
  }
}

for (const [abilityId, expectedIds] of Object.entries(
  catalog.canonical_jd_by_ability || {},
)) {
  const actualIds = dictionary.variables
    .filter(
      (variable) =>
        variable.scope === "local" && variable.owner_a === abilityId,
    )
    .map((variable) => variable.id);
  if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) {
    errors.push(`${abilityId} 的 canonical JD 索引与权威字典不一致。`);
  }
}

const globalCanonicalNodes = nodes.filter(
  (node) =>
    node.owner_a === "MULTI" &&
    node.canonical_slot &&
    /^jd-0\.\d+$/.test(node.node_id),
);
if (globalCanonicalNodes.length !== 10) {
  errors.push(`JD-global 应有 10 个 canonical 节点，实际为 ${globalCanonicalNodes.length}。`);
}
if (
  nodes.filter(
    (node) =>
      node.owner_a === "MULTI" &&
      node.parent_id === null &&
      node.node_id === "PROPOSED-jd-tree-global",
  ).length !== 1
) {
  errors.push("JD-global 必须只有一个独立根节点。");
}

for (const node of nodes.filter(
  (candidate) => candidate.node_id.startsWith("jd-11.1.3.") && candidate.node_kind === "variable",
)) {
  if (node.variable_role !== "hidden_ground_truth") {
    errors.push(`${node.node_id} 应保持为世界侧 Hidden GT。`);
  }
}

const count = catalog.counts || {};
if (count.node_count !== nodes.length) {
  errors.push(`counts.node_count=${count.node_count}，实际为 ${nodes.length}。`);
}
if (
  count.variable_leaf_count !==
  nodes.filter((node) => node.node_kind === "variable").length
) {
  errors.push("counts.variable_leaf_count 与实际变量节点数不一致。");
}

if (
  catalog.metric_annotation?.applies_by_default !== false ||
  catalog.metric_annotation?.threshold_authority !== "TBD"
) {
  errors.push("树内 metric 草案必须标记为不默认生效，threshold authority 保持 TBD。 ");
}
for (const relativePath of [
  "knowledge/metric_set_default.json",
  "knowledge/metric_set_a11_default.json",
  "knowledge/metric_set_a11_strict.json",
]) {
  const metricSet = readJson(relativePath);
  if (
    metricSet.authority_status !== "unreviewed_demo_candidate" ||
    metricSet.review_status !== "proposed" ||
    metricSet.applies_by_default !== false ||
    metricSet.threshold_authority !== "TBD"
  ) {
    errors.push(`${relativePath} 未正确标记为未受审且不默认生效。`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`OK: ${nodes.length} nodes, ${new Set(ids).size} unique IDs`);
console.log("OK: latest A2/A15/A16/A17 numbering and 17 ability roots");
console.log("OK: 10 JD-global canonical nodes and audited source references");
console.log("OK: no orphan, cycle, EX node, or Hidden GT/SUT conflict");
console.log("OK: metric drafts are explicitly non-authoritative and disabled by default");
