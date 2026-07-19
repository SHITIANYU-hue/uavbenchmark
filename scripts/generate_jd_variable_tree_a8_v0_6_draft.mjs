#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const outputPath = path.join(
  rootDir,
  "knowledge",
  "jd_variable_tree_a8_v0_6_draft.json",
);

const SCENE = ["white_wall_narrow_gap"];
const SOURCE_ID = "L-A8-V06";
const nodes = [];

function domain(value) {
  return {
    value,
    label_zh: value,
    source_refs: [SOURCE_ID],
    status: "team_material_only",
    applicable_scenarios: SCENE,
  };
}

function addNode({
  node_id,
  parent_id,
  canonical_slot = null,
  name,
  definition,
  node_kind,
  value_type = "none",
  value_domain = null,
  unit = null,
  activation_condition = null,
  multiplicity = "one",
  difficulty_direction = "TBD",
  configuration_side = "world",
  visibility = ["sut_visible"],
  related_global_jd = [],
  related_jd = [],
  used_by_axl = ["A8×L3", "A8×L4"],
  depends_on = [],
  constraints = [],
  notes = null,
}) {
  nodes.push({
    schema_version: "jd-tree/0.2.1",
    node_id,
    parent_id,
    canonical_slot,
    owner_a: "A8",
    name,
    definition,
    node_kind,
    value_type,
    value_domain,
    unit,
    activation_condition,
    multiplicity,
    difficulty_direction,
    configuration_side,
    visibility,
    applicable_scenarios: SCENE,
    related_global_jd,
    related_jd,
    used_by_axl,
    depends_on,
    mutual_exclusion_group: null,
    constraints,
    source: [SOURCE_ID],
    evidence_status: "team_material_only",
    review_status: "proposed",
    legacy_aliases: [],
    notes,
  });
}

function group(node_id, parent_id, canonical_slot, name, definition, options = {}) {
  addNode({
    node_id,
    parent_id,
    canonical_slot,
    name,
    definition,
    node_kind: "group",
    used_by_axl: options.used_by_axl,
    related_global_jd: options.related_global_jd,
    notes: options.notes,
  });
}

function variable(
  node_id,
  parent_id,
  canonical_slot,
  name,
  definition,
  values,
  options = {},
) {
  addNode({
    node_id,
    parent_id,
    canonical_slot,
    name,
    definition,
    node_kind: "variable",
    value_type: options.value_type ?? "enum",
    value_domain: values.map(domain),
    unit: options.unit,
    activation_condition: options.activation_condition,
    multiplicity: options.multiplicity,
    difficulty_direction: options.difficulty_direction,
    configuration_side: options.configuration_side,
    visibility: options.visibility,
    related_global_jd: options.related_global_jd,
    related_jd: options.related_jd,
    used_by_axl: options.used_by_axl,
    depends_on: options.depends_on,
    constraints: options.constraints,
    notes: options.notes,
  });
}

addNode({
  node_id: "PROPOSED-jd-tree-A8",
  parent_id: null,
  name: "飞行控制 / 避障（窄缝穿梭）",
  definition:
    "需求草案 v0.6 中的 A8 白墙避障（窄缝穿梭）变量树；本页仅按草案结构与取值原样展示。",
  node_kind: "capability_root",
  configuration_side: "shared",
  related_global_jd: ["jd-0.2", "jd-0.3"],
  notes:
    "未在此处处理需求草案 v0.6 与现有 66 槽位字典中 jd-8.1/8.2/8.3 的含义冲突；A8 分支不代表完成正式编号迁移。",
});

variable(
  "jd-8.1",
  "PROPOSED-jd-tree-A8",
  "jd-8.1",
  "控制接口/指令类型",
  "需求草案 v0.6 §2.5 的平台基准：控制接口/指令类型。",
  ["velocity-cmd", "waypoint-tracking"],
  {
    value_type: "multi_enum",
    configuration_side: "shared",
    difficulty_direction: "neutral",
    notes: "平台基准固定；按需求草案 v0.6 原样展示。",
  },
);

variable(
  "jd-8.2",
  "PROPOSED-jd-tree-A8",
  "jd-8.2",
  "控制约束（v_max / 姿态角 / Δt / f_c）",
  "需求草案 v0.6 §2.5 的平台基准：控制约束。",
  ["v_max ~3 m/s", "f_c≥10Hz"],
  {
    value_type: "multi_value",
    configuration_side: "shared",
    difficulty_direction: "neutral",
    notes:
      "草案只给出 v_max 与 f_c 的占位基准；姿态角、Δt 及最终可行值待仿真团队校准。",
  },
);

variable(
  "jd-8.3",
  "PROPOSED-jd-tree-A8",
  "jd-8.3",
  "执行包络（多旋翼 / 高度带 / 物理执行）",
  "需求草案 v0.6 §2.5 的平台基准：执行包络。",
  ["多旋翼", "机身等效直径 ~0.3 m（缝宽标尺）"],
  {
    value_type: "multi_value",
    configuration_side: "shared",
    difficulty_direction: "neutral",
    notes:
      "草案将平台基准整体固定；高度带与其他物理执行值待仿真团队校准。",
  },
);

group(
  "jd-8.5",
  "PROPOSED-jd-tree-A8",
  "jd-8.5",
  "避障树",
  "需求草案 v0.6 的白墙避障树，包括障碍物与障碍物布局。",
  {
    notes:
      "jd-8.5 为需求草案 v0.6 新增分支；是否进入正式 66 槽位编号体系仍待团队确认。",
  },
);

group(
  "jd-8.5.1",
  "jd-8.5",
  "jd-8.5",
  "障碍物",
  "单面白墙自身的几何、外观与缝属性。",
);

group(
  "jd-8.5.1.1",
  "jd-8.5.1",
  "jd-8.5",
  "几何",
  "白墙本体的几何属性。",
);
variable(
  "jd-8.5.1.1.1",
  "jd-8.5.1.1",
  "jd-8.5",
  "墙高",
  "白墙高度档位。",
  ["低", "中", "高"],
  { difficulty_direction: "increasing" },
);
variable(
  "jd-8.5.1.1.2",
  "jd-8.5.1.1",
  "jd-8.5",
  "墙厚",
  "白墙厚度档位；缝道长等于墙厚。",
  ["薄", "中", "厚"],
  { difficulty_direction: "increasing" },
);
variable(
  "jd-8.5.1.1.3",
  "jd-8.5.1.1",
  "jd-8.5",
  "墙宽",
  "白墙宽度档位；宽墙用于强制穿缝。",
  ["窄", "中", "宽（强制穿缝）"],
  { difficulty_direction: "context_dependent" },
);
variable(
  "jd-8.5.1.1.4",
  "jd-8.5.1.1",
  "jd-8.5",
  "墙外形",
  "白墙外形类别。",
  ["矩形板", "弧形", "不规则"],
  { difficulty_direction: "increasing" },
);

group(
  "jd-8.5.1.2",
  "jd-8.5.1",
  "jd-8.5",
  "外观（墙纹理 / 缝墙对比度）",
  "白墙纹理和缝/墙对比度。",
);
variable(
  "jd-8.5.1.2.1",
  "jd-8.5.1.2",
  "jd-8.5",
  "纹理复杂度",
  "墙面纹理复杂度。",
  ["无", "轻纹理", "复杂纹理"],
  { difficulty_direction: "increasing" },
);
variable(
  "jd-8.5.1.2.2",
  "jd-8.5.1.2",
  "jd-8.5",
  "缝/墙对比度",
  "缝与墙面的视觉对比度。",
  ["高", "中", "低"],
  { difficulty_direction: "decreasing" },
);

group(
  "jd-8.5.1.3",
  "jd-8.5.1",
  "jd-8.5",
  "缝（单缝 schema；多缝时列表值）",
  "单缝 schema；一墙多缝时各叶子取列表值。",
);
variable(
  "jd-8.5.1.3.1",
  "jd-8.5.1.3",
  "jd-8.5",
  "缝宽（比值）",
  "目标缝宽相对机身等效直径的比值；连续值域，同档内可连续变化。",
  ["3.0×", "2.0×", "1.5×", "1.2×"],
  {
    value_type: "array_enum",
    multiplicity: "one_or_more",
    difficulty_direction: "decreasing",
  },
);
variable(
  "jd-8.5.1.3.2",
  "jd-8.5.1.3",
  "jd-8.5",
  "缝纵向位置",
  "缝在白墙纵向上的位置。",
  ["居中", "偏上", "偏下"],
  {
    value_type: "array_enum",
    multiplicity: "one_or_more",
    difficulty_direction: "context_dependent",
  },
);
variable(
  "jd-8.5.1.3.3",
  "jd-8.5.1.3",
  "jd-8.5",
  "缝横向位置",
  "缝在白墙横向上的位置。",
  ["居中", "偏左", "偏右"],
  {
    value_type: "array_enum",
    multiplicity: "one_or_more",
    difficulty_direction: "context_dependent",
  },
);
variable(
  "jd-8.5.1.3.4",
  "jd-8.5.1.3",
  "jd-8.5",
  "缝形状",
  "缝的形状类别。",
  ["矩形", "圆孔", "拱形"],
  {
    value_type: "array_enum",
    multiplicity: "one_or_more",
    difficulty_direction: "increasing",
  },
);

variable(
  "jd-8.5.1.4",
  "jd-8.5.1",
  "jd-8.5",
  "缝数",
  "单面墙上的缝数量；约束缝列表长度。",
  ["1", "2", "3"],
  {
    value_type: "integer_enum",
    difficulty_direction: "increasing",
    constraints: [
      "len(jd-8.5.1.3.1..jd-8.5.1.3.4) == jd-8.5.1.4",
    ],
  },
);
variable(
  "jd-8.5.1.5",
  "jd-8.5.1",
  "jd-8.5",
  "缝间排列",
  "同一面墙上多缝之间的排列方式。",
  ["并排（横向）", "上下（纵向）", "混合"],
  {
    activation_condition: {
      node: "jd-8.5.1.4",
      operator: ">=",
      value: 2,
    },
    difficulty_direction: "increasing",
  },
);
variable(
  "jd-8.5.1.6",
  "jd-8.5.1",
  "jd-8.5",
  "缝间距",
  "同一面墙上多缝之间的距离档位。",
  ["大", "中", "近"],
  {
    activation_condition: {
      node: "jd-8.5.1.4",
      operator: ">=",
      value: 2,
    },
    difficulty_direction: "decreasing",
  },
);
variable(
  "jd-8.5.1.7",
  "jd-8.5.1",
  "jd-8.5",
  "目标缝",
  "需要穿越的目标缝编号；作为评分锚点和缝宽难度取值对象。",
  ["1", "2", "3"],
  {
    value_type: "integer_enum",
    visibility: ["hidden_gt"],
    difficulty_direction: "neutral",
    constraints: ["jd-8.5.1.7 <= jd-8.5.1.4"],
  },
);

group(
  "jd-8.5.2",
  "jd-8.5",
  "jd-8.5",
  "障碍物布局",
  "多面白墙的数量、间距、角度、缝对齐、排列拓扑和运动。",
);
variable(
  "jd-8.5.2.1",
  "jd-8.5.2",
  "jd-8.5",
  "墙数",
  "场景中的白墙数量。",
  ["1", "2", "3", "4+"],
  { difficulty_direction: "increasing" },
);
variable(
  "jd-8.5.2.2",
  "jd-8.5.2",
  "jd-8.5",
  "墙间距",
  "多面墙之间的距离档位。",
  ["大", "中", "近"],
  { difficulty_direction: "decreasing" },
);
variable(
  "jd-8.5.2.3",
  "jd-8.5.2",
  "jd-8.5",
  "摆放角度 θ",
  "白墙相对飞行方向的摆放角度；草案给出有效缝宽 = 缝宽·cosθ。",
  ["0°", "15°", "30°", "45°"],
  { difficulty_direction: "increasing", unit: "degree" },
);
variable(
  "jd-8.5.2.4",
  "jd-8.5.2",
  "jd-8.5",
  "缝对齐性",
  "多面墙之间缝的对齐关系。",
  ["对齐（廊道）", "部分错开", "错开（迷宫）"],
  { difficulty_direction: "increasing" },
);
variable(
  "jd-8.5.2.5",
  "jd-8.5.2",
  "jd-8.5",
  "排列拓扑",
  "多面墙的排列拓扑。",
  ["直线", "扇形", "错位", "网格"],
  { difficulty_direction: "increasing" },
);
variable(
  "jd-8.5.2.6",
  "jd-8.5.2",
  "jd-8.5",
  "墙运动",
  "白墙是静止还是运动；运动仅在 D3–D4 启用。",
  ["静止", "运动"],
  { difficulty_direction: "increasing" },
);
variable(
  "jd-8.5.2.6.1",
  "jd-8.5.2.6",
  "jd-8.5",
  "速度",
  "运动墙的速度档位。",
  ["慢", "中", "快"],
  {
    activation_condition: {
      node: "jd-8.5.2.6",
      operator: "equals",
      value: "运动",
    },
    difficulty_direction: "TBD",
  },
);
variable(
  "jd-8.5.2.6.2",
  "jd-8.5.2.6",
  "jd-8.5",
  "方向",
  "运动墙的运动方向。",
  ["X+", "X-", "Y+", "Y-"],
  {
    activation_condition: {
      node: "jd-8.5.2.6",
      operator: "equals",
      value: "运动",
    },
    difficulty_direction: "TBD",
  },
);
variable(
  "jd-8.5.2.6.3",
  "jd-8.5.2.6",
  "jd-8.5",
  "运动模式",
  "运动墙的运动模式。",
  ["匀速", "往复", "随机"],
  {
    activation_condition: {
      node: "jd-8.5.2.6",
      operator: "equals",
      value: "运动",
    },
    difficulty_direction: "TBD",
  },
);

const ids = new Set();
for (const node of nodes) {
  if (ids.has(node.node_id)) {
    throw new Error(`duplicate node_id: ${node.node_id}`);
  }
  ids.add(node.node_id);
}
for (const node of nodes) {
  if (node.parent_id !== null && !ids.has(node.parent_id)) {
    throw new Error(`missing parent ${node.parent_id}: ${node.node_id}`);
  }
}

const catalog = {
  catalog_id: "jd-variable-tree-a8-v0-6-draft",
  schema: "uav-benchmark-jd-variable-tree",
  schema_version: "0.2.1",
  catalog_version: "a8-demand-draft-v0.6-preserved-2026-07-19",
  generated_at: "2026-07-19",
  generated_by: "scripts/generate_jd_variable_tree_a8_v0_6_draft.mjs",
  scenario_scope: SCENE,
  preservation_rule:
    "A8 节点结构、名称与候选取值按《需求草案-v0.6.md》展示，不在此目录中解决正式编号冲突。",
  sources: [
    {
      source_id: SOURCE_ID,
      title: "需求草案-v0.6.md",
      issuer: "UAV Benchmark team",
      source_type: "team_draft",
      locator: "§2.0、§2.1、§2.2、§2.5",
      url: null,
      evidence_grade: "team_material_only",
    },
  ],
  source_count: 1,
  node_count: nodes.length,
  leaf_count: nodes.filter((node) => node.node_kind === "variable").length,
  nodes,
};

fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      outputPath,
      node_count: catalog.node_count,
      leaf_count: catalog.leaf_count,
    },
    null,
    2,
  ),
);
