import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const catalogPath = process.argv[2]
  ? path.resolve(projectRoot, process.argv[2])
  : path.join(projectRoot, "knowledge/jd_variable_tree_version1.json");
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

const siblingsByParent = new Map();
for (const node of nodes.filter((item) => item.parent_id)) {
  if (!siblingsByParent.has(node.parent_id)) {
    siblingsByParent.set(node.parent_id, []);
  }
  siblingsByParent.get(node.parent_id).push(node);
}
for (const [parentId, siblings] of siblingsByParent) {
  const normalizedNames = new Map();
  for (const sibling of siblings) {
    const normalized = String(sibling.name || "")
      .replace(/\s+/g, "")
      .toLowerCase();
    if (!normalizedNames.has(normalized)) normalizedNames.set(normalized, []);
    normalizedNames.get(normalized).push(sibling.node_id);
  }
  for (const [name, ids] of normalizedNames) {
    if (name && ids.length > 1) {
      errors.push(`${parentId} 下存在同名节点：${ids.join(", ")}`);
    }
  }
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
  if (!catalog.controlled_vocabularies.variable_role.includes(
    node.variable_role,
  )) {
    errors.push(
      `${node.node_id} 的 variable_role 非法：${node.variable_role}`,
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
    if (!item || typeof item !== "object") continue;
    if (
      !catalog.controlled_vocabularies.evidence_status.includes(item?.status)
    ) {
      errors.push(`${node.node_id} 的候选值 evidence status 非法。`);
    }
    if (
      [
        "authoritative_existing",
        "source_supported",
        "team_material_only",
      ].includes(item?.status) &&
      !(item?.source_refs || []).length
    ) {
      errors.push(
        `${node.node_id} 的候选值标为 ${item.status}，但没有值级来源。`,
      );
    }
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
  for (const relatedId of [
    ...(node.related_global_jd || []),
    ...(node.related_jd || []),
  ]) {
    if (!nodeById.has(relatedId)) {
      errors.push(`${node.node_id} 引用了不存在的 related_jd：${relatedId}`);
    }
  }
  for (const dependencyId of node.depends_on || []) {
    if (!nodeById.has(dependencyId)) {
      errors.push(`${node.node_id} 引用了不存在的 depends_on：${dependencyId}`);
    }
  }
  const activationNode = node.activation_condition?.node;
  if (activationNode && !nodeById.has(activationNode)) {
    errors.push(
      `${node.node_id} 引用了不存在的 activation_condition.node：${activationNode}`,
    );
  }
  const hiddenGroundTruth =
    node.variable_role === "hidden_ground_truth" ||
    (node.visibility || []).includes("hidden_gt");
  if (
    hiddenGroundTruth &&
    (node.visibility || []).includes("sut_visible")
  ) {
    errors.push(`${node.node_id} 将 Hidden GT 同时标记为 SUT 可见。`);
  }
  if (
    hiddenGroundTruth &&
    (node.projection_targets || []).includes("sut_input")
  ) {
    errors.push(`${node.node_id} 将 Hidden GT 投影为 SUT 输入。`);
  }
  if (
    node.variable_role === "hidden_ground_truth" &&
    !(node.observation_channel || []).includes("hidden_gt")
  ) {
    errors.push(`${node.node_id} 是 Hidden GT，但 observation_channel 未标记 hidden_gt。`);
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
const expectedGlobalCanonicalVariables = jdDictionary.variables.filter(
  (variable) =>
    variable.scope === "global" &&
    nodes.some((node) => node.node_id === variable.id),
);
const allowedCanonicalSet = new Set([
  ...expectedCanonical,
  ...expectedGlobalCanonicalVariables.map((variable) => variable.id),
]);
for (const node of nodes) {
  if (
    node.canonical_slot &&
    node.node_id === node.canonical_slot &&
    !allowedCanonicalSet.has(node.node_id)
  ) {
    errors.push(`${node.node_id} 被标成 canonical，但不在当前 66 槽位字典。`);
  }
}

for (const variable of expectedGlobalCanonicalVariables) {
  const matches = nodes.filter(
    (node) =>
      node.node_id === variable.id && node.canonical_slot === variable.id,
  );
  if (matches.length !== 1) {
    errors.push(
      `${variable.id} 应恰好有一个 global canonical 节点，实际为 ${matches.length}。`,
    );
    continue;
  }
  if (
    matches[0].owner_a !== "MULTI" ||
    matches[0].name !== variable.name ||
    matches[0].definition !== variable.description
  ) {
    errors.push(`${variable.id} 与全局 JD 权威定义不一致。`);
  }
}

const a11Envelope = nodeById.get("PROPOSED-jd-11.4");
if (a11Envelope) {
  if (
    a11Envelope.canonical_slot !== null ||
    a11Envelope.parent_id !== "PROPOSED-jd-tree-A11" ||
    !nodes.some((node) => node.parent_id === "PROPOSED-jd-11.4")
  ) {
    errors.push(
      "PROPOSED-jd-11.4 若存在，必须作为 A11 下的非 canonical 子树，并包含子维度。",
    );
  }
}

const a11Profile = nodeById.get("PROPOSED-jd-11.5");
if (a11Profile) {
  if (
    a11Profile.canonical_slot !== null ||
    a11Profile.parent_id !== "PROPOSED-jd-tree-A11" ||
    !nodes.some((node) => node.parent_id === "PROPOSED-jd-11.5")
  ) {
    errors.push(
      "PROPOSED-jd-11.5 若存在，必须作为 A11 下的非 canonical 子树，并包含子维度。",
    );
  }
  if (
    a11Envelope &&
    !nodes.some(
      (node) =>
        node.parent_id === "PROPOSED-jd-11.5.7" &&
        (node.related_jd || []).includes("PROPOSED-jd-11.4"),
    )
  ) {
    errors.push(
      "PROPOSED-jd-11.5 若与 11.4 同时存在，必须通过控制要求绑定引用 PROPOSED-jd-11.4。",
    );
  }

  const passageCollection = nodeById.get("PROPOSED-jd-11.5.2.6");
  if (
    passageCollection &&
    (passageCollection.multiplicity !== "many" ||
      !(passageCollection.depends_on || []).includes(
        "PROPOSED-jd-11.5.2.5",
      ))
  ) {
    errors.push("通行空间实例集合必须支持 many，并依赖通行空间数量。");
  }

  const targetPassage = nodeById.get("PROPOSED-jd-11.5.5.3");
  if (
    targetPassage &&
    !(targetPassage.depends_on || []).includes("PROPOSED-jd-11.5.2.6")
  ) {
    errors.push("目标通行空间必须引用通行空间实例集合。");
  }
}

const globalRoots = nodes.filter((node) => node.node_kind === "global_root");
if (
  globalRoots.length !== 1 ||
  globalRoots[0].node_id !== "PROPOSED-jd-tree-global" ||
  globalRoots[0].owner_a !== "MULTI"
) {
  errors.push("必须恰好有一个 MULTI 所有的 JD-global 根节点。");
}
const expectedGlobalIds = jdDictionary.variables
  .filter((variable) => variable.scope === "global")
  .map((variable) => variable.id);
if (
  JSON.stringify(catalog.global_scope || []) !==
  JSON.stringify(expectedGlobalIds)
) {
  errors.push("catalog.global_scope 必须按权威字典顺序完整列出 jd-0.1–jd-0.10。");
}
for (const globalId of expectedGlobalIds) {
  const canonical = nodeById.get(globalId);
  if (
    !canonical ||
    canonical.parent_id !== "PROPOSED-jd-tree-global" ||
    canonical.canonical_slot !== globalId
  ) {
    errors.push(`${globalId} 必须作为 JD-global 下的 canonical 节点出现一次。`);
  }
  if (!nodes.some((node) => node.parent_id === globalId)) {
    errors.push(`${globalId} 尚未展开任何子维度。`);
  }
}
for (const requiredNode of [
  "jd-0.3",
  "PROPOSED-jd-0.3.1",
  "PROPOSED-jd-0.3.2",
  "PROPOSED-jd-0.3.3",
  "PROPOSED-jd-0.3.4",
  "PROPOSED-jd-0.3.5",
  "PROPOSED-jd-0.3.3.1",
  "PROPOSED-jd-0.3.3.2",
  "PROPOSED-jd-0.3.5.1",
  "PROPOSED-jd-0.3.5.2",
  "PROPOSED-jd-0.3.6",
  "PROPOSED-jd-0.3.7",
]) {
  if (!nodeById.has(requiredNode)) {
    errors.push(`jd-0.3 共享扰动树缺少节点：${requiredNode}`);
  }
}
if (
  nodeById.get("PROPOSED-jd-0.3.6")?.variable_role !==
    "contract_schema" ||
  (nodeById.get("PROPOSED-jd-0.3.6")?.visibility || []).includes(
    "hidden_gt",
  )
) {
  errors.push("jd-0.3 的允许扰动范围必须作为公开合同表达。");
}
if (
  nodeById.get("PROPOSED-jd-0.3.7")?.variable_role !==
  "hidden_ground_truth"
) {
  errors.push("jd-0.3 的本实例实际注入必须标记为 Hidden Ground Truth。");
}
if (
  (nodeById.get("PROPOSED-jd-0.3.3.1")?.notes || "").includes("光照=0") ===
    false ||
  (nodeById.get("PROPOSED-jd-0.3.3.2")?.notes || "").includes("光线=0") ===
    false
) {
  errors.push("jd-0.3 必须显式区分静态光照基线与动态光线扰动布尔语义。");
}

for (const node of nodes.filter(
  (item) =>
    item.node_kind === "variable" &&
    ["A12", "A13", "A14", "A15", "A16", "A17"].includes(item.owner_a),
)) {
  if (
    node.variable_role === "TBD" &&
    !/(生产者|角色).*(待确认|无法确认)|待确认.*(生产者|角色)/.test(
      node.notes || "",
    )
  ) {
    errors.push(
      `${node.node_id} 的数据流角色为 TBD，但未记录生产者或角色待确认原因。`,
    );
  }
}
const a14InjectionWindow = nodeById.get("PROPOSED-jd-14.1.4");
if (
  !a14InjectionWindow ||
  a14InjectionWindow.variable_role !== "hidden_ground_truth" ||
  (a14InjectionWindow.projection_targets || []).includes("sut_input")
) {
  errors.push("A14 的实例异常注入窗口必须保留为 Fixture / Hidden GT。");
}
if (
  nodeById.get("PROPOSED-jd-14.3.4")?.configuration_side !== "shared"
) {
  errors.push("A14 人工确认要求必须使用 shared 配置归属。");
}
if (
  (nodeById.get("PROPOSED-jd-14.3.2")?.value_domain || []).some(
    (item) => item.value === "perform_handover",
  )
) {
  errors.push("A14 处置动作仍含与 switch_link 重复的 perform_handover。");
}
for (const nodeId of [
  "PROPOSED-jd-13.2.5",
  "PROPOSED-jd-15.2.5",
  "PROPOSED-jd-16.3.5",
  "PROPOSED-jd-17.1.5",
]) {
  if (nodeById.get(nodeId)?.variable_role !== "TBD") {
    errors.push(`${nodeId} 的生产者未确认，variable_role 必须保持 TBD。`);
  }
}

const whiteWallExamples = nodes.filter(
  (node) => node.node_id === "CASE-jd-11.5-white-wall-v0.6",
);
if (whiteWallExamples.length > 1) {
  errors.push(
    `白墙窄缝 v0.6 示例不得重复，实际为 ${whiteWallExamples.length}。`,
  );
} else if (a11Profile && whiteWallExamples.length !== 1) {
  errors.push("PROPOSED-jd-11.5 存在时，必须保留一个白墙窄缝 v0.6 示例。");
} else if (whiteWallExamples.length === 1) {
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
if (catalog.source_count !== sources.length) {
  errors.push(
    `source_count 不一致：声明 ${catalog.source_count}，实际 ${sources.length}。`,
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

for (const node of nodes.filter((item) => item.node_id.includes(".EX"))) {
  errors.push(`${node.node_id} 使用了已废弃的 EX 临时编号。`);
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
    `OK: ${expectedCanonical.length} local canonical slots`,
    `OK: ${expectedGlobalCanonicalVariables.length} global canonical slots`,
    "OK: no orphan parent, cycle, invalid related_jd, missing leaf source, or A×L0 value",
    "OK: no Hidden GT / SUT visibility or input conflict",
    "OK: proposed 11.4/11.5 are optional, internally validated when present, and never allow dangling references",
  ].join("\n"),
);
