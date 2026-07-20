import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const catalogPath = path.join(
  projectRoot,
  "knowledge/jd_variable_tree_version1.json",
);
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const jdDictionary = JSON.parse(
  fs.readFileSync(
    path.join(projectRoot, "knowledge/jd_dictionary.json"),
    "utf8",
  ),
);
const axlCatalog = JSON.parse(
  fs.readFileSync(
    path.join(projectRoot, "knowledge/axl_responsibility_catalog.json"),
    "utf8",
  ),
);
const errors = [];
const nodes = catalog.nodes || [];
const sources = catalog.sources || [];
const nodeById = new Map();
const sourceIds = new Set(sources.map((source) => source.source_id));
const axlIds = new Set(
  axlCatalog.abilities.flatMap((ability) =>
    Object.keys(ability.levels).map(
      (level) => `${ability.a_id}×${level}`,
    ),
  ),
);
const expectedAbilityScheme = "ability-id-v3-2026-07-20";

if (
  catalog.ability_id_scheme !== expectedAbilityScheme ||
  catalog.numbering_scheme !== expectedAbilityScheme ||
  jdDictionary.ability_id_scheme !== expectedAbilityScheme ||
  axlCatalog.ability_id_scheme !== expectedAbilityScheme
) {
  errors.push(`变量树、JD 与 A×L 必须统一使用 ${expectedAbilityScheme}。`);
}

for (const node of nodes) {
  if (!node.node_id) {
    errors.push("存在缺少 node_id 的节点。");
    continue;
  }
  if (nodeById.has(node.node_id)) {
    errors.push(`重复 node_id：${node.node_id}`);
  }
  nodeById.set(node.node_id, node);
}

for (const node of nodes) {
  if (node.parent_id && !nodeById.has(node.parent_id)) {
    errors.push(`${node.node_id} 的父节点不存在：${node.parent_id}`);
  }
  if (node.node_kind === "variable" && (!node.source || !node.source.length)) {
    errors.push(`${node.node_id} 是叶子变量但没有来源。`);
  }
  if (!catalog.controlled_vocabularies.configuration_side.includes(
    node.configuration_side,
  )) {
    errors.push(
      `${node.node_id} 的 configuration_side 非法：${node.configuration_side}`,
    );
  }
  if (!catalog.controlled_vocabularies.derivation_status.includes(
    node.derivation_status,
  )) {
    errors.push(
      `${node.node_id} 的 derivation_status 非法：${node.derivation_status}`,
    );
  }
  if (!catalog.controlled_vocabularies.evidence_status.includes(
    node.evidence_status,
  )) {
    errors.push(
      `${node.node_id} 的 evidence_status 非法：${node.evidence_status}`,
    );
  }
  if (!catalog.controlled_vocabularies.difficulty_direction.includes(
    node.difficulty_direction,
  )) {
    errors.push(
      `${node.node_id} 的 difficulty_direction 非法：${node.difficulty_direction}`,
    );
  }
  for (const field of [
    "projection_targets",
    "visibility",
    "observation_channel",
  ]) {
    const allowed = new Set(
      catalog.controlled_vocabularies[field].items,
    );
    if (
      !Array.isArray(node[field]) ||
      node[field].some((value) => !allowed.has(value))
    ) {
      errors.push(`${node.node_id} 的 ${field} 非法。`);
    }
  }
  for (const field of catalog.schema_fields) {
    if (!(field in node)) {
      errors.push(`${node.node_id} 缺少 schema 字段：${field}`);
    }
  }
  for (const sourceId of node.source || []) {
    if (!sourceIds.has(sourceId)) {
      errors.push(`${node.node_id} 引用了不存在的来源：${sourceId}`);
    }
  }
  for (const item of Array.isArray(node.value_domain)
    ? node.value_domain
    : []) {
    for (const sourceId of item?.source_refs || []) {
      if (!sourceIds.has(sourceId)) {
        errors.push(
          `${node.node_id} 的候选值引用了不存在的来源：${sourceId}`,
        );
      }
    }
  }
  for (const binding of Array.isArray(node.example_bindings)
    ? node.example_bindings
    : []) {
    if (!binding.source_node_id || !binding.path) {
      errors.push(`${node.node_id} 的示例赋值缺少 source_node_id 或 path。`);
    }
    for (const item of Array.isArray(binding.value_domain)
      ? binding.value_domain
      : []) {
      for (const sourceId of item?.source_refs || []) {
        if (!sourceIds.has(sourceId)) {
          errors.push(
            `${node.node_id} 的示例赋值引用了不存在的来源：${sourceId}`,
          );
        }
      }
    }
  }
  for (const cell of node.used_by_axl || []) {
    if (!axlIds.has(cell)) {
      errors.push(`${node.node_id} 引用了不存在的 A×L：${cell}`);
    }
  }
}

for (const node of nodes) {
  const seen = new Set();
  let current = node;
  while (current?.parent_id) {
    if (seen.has(current.node_id)) {
      errors.push(`检测到循环依赖：${node.node_id}`);
      break;
    }
    seen.add(current.node_id);
    current = nodeById.get(current.parent_id);
  }
}

const scope = new Set(catalog.scope || []);
const expectedCanonicalVariables = jdDictionary.variables.filter(
  (variable) => variable.scope === "local" && scope.has(variable.owner_a),
);
const expectedCanonical = expectedCanonicalVariables.map(
  (variable) => variable.id,
);
const expectedCanonicalById = new Map(
  expectedCanonicalVariables.map((variable) => [variable.id, variable]),
);

for (const canonicalId of expectedCanonical) {
  const matches = nodes.filter(
    (node) =>
      node.node_id === canonicalId && node.canonical_slot === canonicalId,
  );
  if (matches.length !== 1) {
    errors.push(
      `${canonicalId} 应恰好有一个 canonical 节点，实际为 ${matches.length}。`,
    );
    continue;
  }
  const node = matches[0];
  const authoritative = expectedCanonicalById.get(canonicalId);
  if (
    node.owner_a !== authoritative.owner_a ||
    node.name !== authoritative.name ||
    node.definition !== authoritative.description
  ) {
    errors.push(`${canonicalId} 与 66 槽位权威字典不一致。`);
  }
}

const expectedCanonicalSet = new Set(expectedCanonical);
for (const node of nodes) {
  if (
    node.canonical_slot &&
    node.node_id === node.canonical_slot &&
    !expectedCanonicalSet.has(node.node_id)
  ) {
    errors.push(`${node.node_id} 被标成 canonical，但不在当前 66 槽位字典。`);
  }
}

for (const canonicalId of ["jd-11.1", "jd-11.2", "jd-11.3"]) {
  const childCount = nodes.filter(
    (node) => node.parent_id === canonicalId,
  ).length;
  if (childCount === 0) {
    errors.push(`${canonicalId} 尚未展开任何子维度。`);
  }
}

const a11Envelope = nodeById.get("PROPOSED-jd-11.4");
if (
  !a11Envelope ||
  a11Envelope.canonical_slot !== null ||
  !nodes.some((node) => node.parent_id === "PROPOSED-jd-11.4")
) {
  errors.push(
    "PROPOSED-jd-11.4 必须作为非 canonical 的控制执行条件与动态包络存在，并包含子维度。",
  );
}

const a11Profile = nodeById.get("PROPOSED-jd-11.5");
if (!a11Profile || a11Profile.canonical_slot !== null) {
  errors.push("PROPOSED-jd-11.5 必须存在，且不得标为 canonical 槽位。");
}
if (
  !nodes.some(
    (node) =>
      node.parent_id === "PROPOSED-jd-11.5.7" &&
      (node.related_jd || []).includes("PROPOSED-jd-11.4"),
  )
) {
  errors.push(
    "PROPOSED-jd-11.5 必须通过控制要求绑定引用 PROPOSED-jd-11.4。",
  );
}

const whiteWallExamples = nodes.filter(
  (node) => node.node_id === "EXAMPLE-jd-11.5-white-wall-v0.6",
);
if (whiteWallExamples.length !== 1) {
  errors.push(
    `白墙窄缝 v0.6 示例应恰好出现一次，实际为 ${whiteWallExamples.length}。`,
  );
} else {
  const example = whiteWallExamples[0];
  if (
    example.parent_id !== "PROPOSED-jd-11.5" ||
    example.node_kind !== "example_profile" ||
    !Array.isArray(example.example_bindings) ||
    example.example_bindings.length === 0
  ) {
    errors.push(
      "白墙窄缝 v0.6 必须作为 PROPOSED-jd-11.5 下的非 canonical 示例，并保留原始赋值。",
    );
  }
}

for (const obsoletePrefix of [
  "PROPOSED-jd-11.platform-",
  "PROPOSED-jd-11.control-interface",
  "PROPOSED-jd-11.control-constraint",
]) {
  if (nodes.some((node) => node.node_id.startsWith(obsoletePrefix))) {
    errors.push(`A11 主树仍含旧草案同级节点：${obsoletePrefix}`);
  }
}

const capabilityRoots = nodes.filter(
  (node) => node.node_kind === "capability_root",
);
const rootOwners = new Set(capabilityRoots.map((node) => node.owner_a));
if (
  capabilityRoots.length !== scope.size ||
  [...scope].some((ability) => !rootOwners.has(ability))
) {
  errors.push("catalog.scope 与 capability_root 不一致。");
}
if (catalog.node_count !== nodes.length) {
  errors.push(
    `node_count 不一致：声明 ${catalog.node_count}，实际 ${nodes.length}。`,
  );
}
const actualLeafCount = nodes.filter(
  (node) => node.node_kind === "variable",
).length;
if (catalog.leaf_count !== actualLeafCount) {
  errors.push(
    `leaf_count 不一致：声明 ${catalog.leaf_count}，实际 ${actualLeafCount}。`,
  );
}
for (const [owner, declared] of Object.entries(
  catalog.counts_by_owner || {},
)) {
  const actual = nodes.filter((node) => node.owner_a === owner).length;
  if (declared !== actual) {
    errors.push(
      `counts_by_owner.${owner} 不一致：声明 ${declared}，实际 ${actual}。`,
    );
  }
}
for (const [kind, declared] of Object.entries(
  catalog.counts_by_kind || {},
)) {
  const actual = nodes.filter((node) => node.node_kind === kind).length;
  if (declared !== actual) {
    errors.push(
      `counts_by_kind.${kind} 不一致：声明 ${declared}，实际 ${actual}。`,
    );
  }
}

for (const node of nodes) {
  if (
    node.owner_a !== "MULTI" &&
    (!scope.has(node.owner_a) || /[a-z]$/.test(node.owner_a))
  ) {
    errors.push(`${node.node_id} 使用了非当前 scope 的 owner_a：${node.owner_a}`);
  }
  if ((node.used_by_axl || []).some((cell) => /×L0$/.test(cell))) {
    errors.push(`${node.node_id} 将 L0 写入了 used_by_axl。`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  [
    `OK: ${nodes.length} nodes`,
    `OK: ${new Set(nodes.map((node) => node.node_id)).size} unique IDs`,
    `OK: ${expectedCanonical.length} canonical slots`,
    "OK: no orphan parent, cycle, missing leaf source, or A×L0 value",
  ].join("\n"),
);
