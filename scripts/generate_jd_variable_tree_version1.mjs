import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const knowledgeDir = path.join(projectRoot, "knowledge");

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(knowledgeDir, name), "utf8"));
const writeJson = (name, value) =>
  fs.writeFileSync(
    path.join(knowledgeDir, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );

const oldInspection = readJson("jd_variable_tree_legacy_inspection_source.json");
const oldA8 = readJson("jd_variable_tree_legacy_white_wall_v0_6.json");
const currentJdDictionary = readJson("jd_dictionary.json");
const currentAxlCatalog = readJson("axl_responsibility_catalog.json");
const currentJdById = new Map(
  currentJdDictionary.variables.map((variable) => [variable.id, variable]),
);

const generatedAt = "2026-07-20";
const schemaVersion = "0.3.0";
const nodeSchemaVersion = "jd-tree/0.3.0";
const catalogRootId = "PROPOSED-jd-tree-version1";

const renumberingV1ToV2 = Object.entries(
  currentAxlCatalog.ability_id_migration,
).map(([from, to]) => ({ from, to }));
const renumberingV2ToV3 = Object.entries(
  currentAxlCatalog.ability_id_migration_v2_to_v3,
).map(([from, to]) => ({ from, to }));
const renumbering = [
  ["A1", "A1"],
  ["A2", "A2"],
  ["A3", "A3"],
  ["A4", "A4"],
  ["A14", "A5"],
  ["A5", "A6"],
  ["A6a", "A7"],
  ["A6b", "A8"],
  ["A11", "A9"],
  ["A7", "A10"],
  ["A8", "A11"],
  ["A9a", "A12"],
  ["A9b", "A13"],
  ["A10", "A14"],
  ["A13", "A15"],
  ["A12", "A16"],
  ["A15", "A17"],
].map(([from, to]) => ({ from, to }));

const jdPrefixMap = {
  "5": "6",
  "6a": "7",
  "6b": "8",
  "7": "10",
  "8": "11",
};
const abilityMap = {
  A5: "A6",
  A6a: "A7",
  A6b: "A8",
  A7: "A10",
  A8: "A11",
};

function migrateString(value) {
  if (value === "L-A8-V06") return value;
  return value
    .replaceAll("待团队确认", "待确认")
    .replace(
      /jd-(6a|6b|5|7|8)(?=\.|\b)/g,
      (_, prefix) => `jd-${jdPrefixMap[prefix]}`,
    )
    .replace(
      /A(6a|6b|5|7|8)(?=×|\b)/g,
      (ability) => abilityMap[ability] || ability,
    );
}

function migrateDeep(value) {
  if (typeof value === "string") return migrateString(value);
  if (Array.isArray(value)) return value.map(migrateDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, migrateDeep(item)]),
    );
  }
  return value;
}

function defaultProjectionTargets(configurationSide) {
  if (configurationSide === "world") return ["world_config", "harness"];
  if (configurationSide === "user") return ["user_config", "sut_input"];
  if (configurationSide === "shared") {
    return ["world_config", "user_config", "sut_input", "harness"];
  }
  return ["TBD"];
}

function defaultObservationChannel(visibility = []) {
  const channels = new Set();
  for (const item of visibility) {
    if (item === "sut_visible") channels.add("sut_input");
    if (item === "fixture_only") channels.add("fixture");
    if (item === "grader_visible" || item === "grader_only") {
      channels.add("grader");
    }
    if (item === "hidden_gt") channels.add("hidden_gt");
  }
  return channels.size ? [...channels] : ["TBD"];
}

function derivationFromEvidence(status) {
  if (status === "authoritative_existing") return "given";
  if (status === "source_supported") return "derived";
  if (status === "team_material_only") return "given";
  if (status === "inferred_candidate") return "proposed";
  return "TBD";
}

function migrateExistingNode(oldNode) {
  const migrated = migrateDeep(oldNode);
  const oldNodeId = oldNode.node_id;
  const oldCanonical = oldNode.canonical_slot;

  if (oldNodeId === "PROPOSED-jd-tree-inspection") {
    return null;
  }

  if (oldNodeId === "PROPOSED-jd-tree-A8") {
    migrated.parent_id = catalogRootId;
  } else if (oldNode.parent_id === "PROPOSED-jd-tree-inspection") {
    migrated.parent_id = catalogRootId;
  }

  migrated.schema_version = nodeSchemaVersion;
  migrated.projection_targets = defaultProjectionTargets(
    migrated.configuration_side,
  );
  migrated.observation_channel = defaultObservationChannel(
    migrated.visibility,
  );
  migrated.derivation_status = derivationFromEvidence(
    migrated.evidence_status,
  );
  migrated.legacy_aliases = [
    ...new Set([
      ...(migrated.legacy_aliases || []),
      oldNodeId,
      ...(oldCanonical && oldCanonical !== oldNodeId ? [oldCanonical] : []),
    ]),
  ];
  migrated.notes = [
    migrated.notes,
    `2026-07-20 连续编号迁移：${oldNode.owner_a} → ${migrated.owner_a}；语义与取值保持原来源口径。`,
  ]
    .filter(Boolean)
    .join("\n");
  return migrated;
}

const g1Sources = [
  {
    source_id: "L-G1-JD66",
    title: "JD业务变量字典_66槽位_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator: "旧编号 A1、A2、A3、A4、A14 canonical local JD",
    url: null,
    evidence_grade: "authoritative_local_legacy_numbering",
  },
  {
    source_id: "L-G1-AXL68",
    title: "AxL责任定义字典_17A_68单元_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator: "旧编号 A1–A4、A14 的 L1–L4 责任与 JD 引用",
    url: null,
    evidence_grade: "authoritative_local_legacy_numbering",
  },
  {
    source_id: "L-G1-HANDOFF",
    title: "UAV-benchmark_Codex_交接与启动提示.md",
    issuer: "UAV Benchmark team",
    source_type: "project_handoff",
    locator: "当前确认边界、JD/GAL/Pipeline 职责",
    url: null,
    evidence_grade: "authoritative_local",
  },
  {
    source_id: "L-G1-BRIEF",
    title: "AI_Pilot_Benchmark_GAL_Project_Brief_v0.1.md",
    issuer: "UAV Benchmark team",
    source_type: "project_brief",
    locator: "GAL、A×L、JD 和 Benchmark Factory 边界",
    url: null,
    evidence_grade: "team_material",
  },
  {
    source_id: "L-G1-PROJECT-HANDOFF",
    title: "AI飞手Project交接文档.md",
    issuer: "UAV Benchmark team",
    source_type: "project_handoff",
    locator: "系统边界、交互和任务执行链路",
    url: null,
    evidence_grade: "team_material",
  },
  {
    source_id: "L-G1-SETUP",
    title: "G1_benchmark_setup.zh.md",
    issuer: "UAV Benchmark team",
    source_type: "team_design",
    locator:
      "execution_anchors、persona、required_disclosures、required_confirmations、required_actions、bound_constraints",
    url: null,
    evidence_grade: "team_material",
  },
  {
    source_id: "L-G1-EXAMPLE",
    title: "G1示例_从AL到persona_config.zh.md",
    issuer: "UAV Benchmark team",
    source_type: "worked_example",
    locator: "A×L template → execution_anchors + persona → trace",
    url: null,
    evidence_grade: "team_material_scoped",
  },
  {
    source_id: "L-G1-RESEARCH",
    title: "deep-research-report-G1.md",
    issuer: "UAV Benchmark research",
    source_type: "research_synthesis",
    locator: "A1、A2、A3、A4、旧 A14 的证据矩阵、GT 与 Trace 清单",
    url: null,
    evidence_grade: "research_synthesis",
  },
  {
    source_id: "L-RENUMBER-20260719",
    title: "A 域重编号会议输入（2026-07-19）",
    issuer: "UAV Benchmark team",
    source_type: "team_decision",
    locator: "A14→A5 及后续 A 域顺延映射",
    url: null,
    evidence_grade: "confirmed_by_user_for_version1_draft",
  },
  {
    source_id: "L-RENUMBER-20260720",
    title: "A 域连续编号确认（2026-07-20）",
    issuer: "UAV Benchmark team",
    source_type: "team_decision",
    locator: "ability-id-v2 的 A7a/A7b/A11a/A11b 连续化，并将后续能力顺延为 A1–A17",
    url: null,
    evidence_grade: "confirmed_by_user",
  },
];

const a9Sources = [
  {
    source_id: "L-A9-JD66-V3",
    title: "JD业务变量字典_66槽位_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator:
      "ability-id-v3-2026-07-20：A9 与 jd-9.1、jd-9.2、jd-9.3 的 canonical 定义",
    url: null,
    evidence_grade: "authoritative_local",
  },
  {
    source_id: "L-A9-AXL68-V3",
    title: "AxL责任定义字典_17A_68单元_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator:
      "ability-id-v3-2026-07-20：A9×L1–L4 的资源监测、预测、确认、处置与验证责任",
    url: null,
    evidence_grade: "authoritative_local",
  },
];

const a11Sources = [
  {
    source_id: "L-A11-JD66-V3",
    title: "JD业务变量字典_66槽位_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator:
      "ability-id-v3-2026-07-20：A11 与 jd-11.1、jd-11.2、jd-11.3 的 canonical 定义",
    url: null,
    evidence_grade: "authoritative_local",
  },
  {
    source_id: "L-A11-AXL68-V3",
    title: "AxL责任定义字典_17A_68单元_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator:
      "ability-id-v3-2026-07-20：A11×L1–L4 的控制质量、执行、异常确认、处置与验证责任",
    url: null,
    evidence_grade: "authoritative_local",
  },
];

const g1Scenario = ["cross_scenario"];
const abilityNames = {
  A1: "意图 / 交互入口",
  A2: "任务规范 / 约束模型",
  A3: "意图推理 / 任务解释",
  A4: "交互到执行编排",
  A5: "监督 / 请求 / 交接",
};
const abilityGlobalJd = {
  A1: ["jd-0.4"],
  A2: ["jd-0.6", "jd-0.10"],
  A3: ["jd-0.4"],
  A4: ["jd-0.1", "jd-0.7"],
  A5: ["jd-0.4", "jd-0.5"],
};

const enumItem = (
  value,
  label,
  sourceRefs,
  status = "inferred_candidate",
) => ({
  value,
  label_zh: label,
  source_refs: sourceRefs,
  status,
  applicable_scenarios: g1Scenario,
});

const E = {
  given: (value, label, refs = ["L-G1-JD66"]) =>
    enumItem(value, label, refs, "authoritative_existing"),
  derived: (value, label, refs = ["L-G1-RESEARCH"]) =>
    enumItem(value, label, refs, "source_supported"),
  proposed: (value, label, refs = []) =>
    enumItem(value, label, refs, "inferred_candidate"),
  tbd: (label = "TBD") => enumItem("TBD", label, [], "TBD"),
};

const slotSpecs = [
  {
    id: "jd-1.1",
    owner: "A1",
    name: "指称对象目录",
    definition: "JD 中可被指称的业务对象或实体类型，包含统一 ID 体系。",
    global: ["jd-0.4"],
    used: ["A1×L2", "A1×L3", "A1×L4"],
    dimensions: [
      ["对象类型", "目录中被指称实体的业务类型。", "multi_enum", [
        E.derived("business_entity", "业务实体"),
        E.derived("spatial_region", "空间区域"),
        E.derived("event_or_state", "事件或状态"),
        E.derived("task_artifact", "任务或证据产物"),
        E.derived("human_role", "在场人角色"),
      ]],
      ["对象标识与命名空间", "对象 ID 的来源、命名空间及唯一性范围。", "object", []],
      ["目录版本与适用范围", "对象目录的版本、业务场景与生效范围。", "object", []],
      ["当前与历史对象关系", "当前任务对象与对话历史、既往任务记录之间的关联方式。", "enum", [
        E.derived("current_context", "当前任务上下文", ["L-G1-SETUP"]),
        E.derived("dialog_history", "当前对话历史", ["L-G1-SETUP"]),
        E.derived("prior_run_reference", "既往任务记录", ["L-G1-EXAMPLE"]),
      ]],
      ["对象解析状态", "指称解析后对象的存在性和唯一性状态。", "enum", [
        E.proposed("unique_match", "唯一匹配"),
        E.proposed("multiple_candidates", "多个候选"),
        E.proposed("not_found", "未找到"),
        E.proposed("unresolved", "尚未消解"),
      ]],
    ],
  },
  {
    id: "jd-1.2",
    owner: "A1",
    name: "指称方式集",
    definition:
      "该 JD 中指向同一对象的可用指称方式，例如按 ID、地图指示、视频指示或自然语言描述。",
    global: ["jd-0.4"],
    used: ["A1×L1", "A1×L3", "A1×L4"],
    dimensions: [
      ["输入与指示通道", "向系统提供指称的交互通道。", "multi_enum", [
        E.given("identifier", "ID 指称"),
        E.given("map_pointer", "地图指示"),
        E.given("video_or_image_pointer", "视频或图像指示"),
        E.given("natural_language", "自然语言描述"),
        E.derived("structured_form", "结构化输入", ["L-G1-AXL68"]),
      ]],
      ["语言指称形式", "自然语言中用于识别对象的表达形式。", "multi_enum", [
        E.derived("explicit_name_or_id", "显式名称或 ID"),
        E.derived("deictic", "指示性指称"),
        E.derived("historical_reference", "历史指代", ["L-G1-EXAMPLE"]),
        E.derived("relational_description", "关系描述"),
        E.derived("set_reference", "集合指称"),
      ]],
      ["上下文取用范围", "解析指称时允许引用的上下文范围。", "multi_enum", [
        E.derived("current_turn", "当前轮次"),
        E.derived("dialog_history", "对话历史"),
        E.derived("prior_task_history", "既往任务历史", ["L-G1-EXAMPLE"]),
      ]],
      ["指称基数", "一次指称表达期望解析出的对象数量语义。", "enum", [
        E.proposed("single", "单对象"),
        E.proposed("multiple", "多对象"),
        E.proposed("set_or_region", "对象集合或区域"),
        E.tbd(),
      ]],
      ["歧义与可推断性", "指称是否唯一、是否欠定以及是否需要澄清。", "enum", [
        E.derived("explicit", "显式且唯一"),
        E.derived("context_resolvable", "可由上下文消解"),
        E.derived("clarification_required", "需要澄清"),
        E.proposed("unresolvable", "当前信息无法消解"),
      ]],
    ],
  },
  {
    id: "jd-1.3",
    owner: "A1",
    name: "业务术语表",
    definition: "该 JD 的专有名词、动作动词与状态形容词词表。",
    global: ["jd-0.4"],
    used: ["A1×L1", "A1×L2", "A1×L3"],
    dimensions: [
      ["术语类型", "业务词项在术语表中的语义类别。", "multi_enum", [
        E.given("domain_noun", "专有名词"),
        E.given("action_verb", "动作动词"),
        E.given("state_adjective", "状态形容词"),
        E.proposed("constraint_term", "约束术语"),
      ]],
      ["规范词项", "术语的 canonical 表达与机器可引用标识。", "object", []],
      ["别名与同义表达", "规范词项允许对应的别名、缩写和口语表达。", "list", []],
      ["术语定义与消歧", "术语的业务定义、排除项和冲突说明。", "object", []],
      ["版本与适用场景", "术语表版本、适用业务场景和生效范围。", "object", []],
    ],
  },
  {
    id: "jd-2.1",
    owner: "A2",
    name: "任务参数表",
    definition:
      "JD 的任务级参数、类型、取值范围与默认值，例如飞行高度、拍摄间隔、覆盖率判据等。",
    global: ["jd-0.6", "jd-0.10"],
    used: ["A2×L1", "A2×L2", "A2×L3"],
    dimensions: [
      ["参数 schema 与版本", "任务参数表的 schema 标识、版本与兼容性。", "object", []],
      ["参数语义分组", "参数在任务对象、空间、时间、执行、输出或约束中的语义归属。", "enum", [
        E.proposed("task_object", "任务对象"),
        E.proposed("spatial", "空间"),
        E.proposed("temporal", "时间"),
        E.proposed("execution", "执行"),
        E.proposed("output", "输出"),
        E.proposed("constraint", "约束"),
      ]],
      ["值类型、单位与参考系", "参数的值类型、单位、坐标系或参考系声明。", "object", []],
      ["必填、可选与缺省状态", "参数是否必须显式给出，以及缺省值是否存在。", "enum", [
        E.derived("required_explicit", "必须显式给出", ["L-G1-AXL68"]),
        E.derived("optional", "可选"),
        E.derived("default_available", "存在受审缺省值", ["L-G1-AXL68"]),
        E.tbd("缺省规则待确认"),
      ]],
      ["参数依赖与约束引用", "参数之间的依赖，以及对合规域和安全包络的引用。", "object", []],
      ["值来源与确认状态", "参数值来自用户、世界、默认规则或推断，并记录是否已确认。", "enum", [
        E.derived("user_explicit", "用户显式给出"),
        E.derived("world_config", "世界配置提供"),
        E.derived("reviewed_default", "受审缺省值"),
        E.derived("context_inferred", "上下文推断"),
        E.tbd("来源待确认"),
      ]],
    ],
  },
  {
    id: "jd-2.2",
    owner: "A2",
    name: "平台参数表",
    definition:
      "无人机及其他实体的平台级参数、默认值与设计运行域，例如最大风速、续航与环境耐受范围。",
    global: ["jd-0.6", "jd-0.10"],
    used: ["A2×L1", "A2×L2", "A2×L4"],
    dimensions: [
      ["平台档案标识与版本", "被任务规范引用的平台档案 ID、类型与版本。", "object", []],
      ["物理与运动学参数", "平台静态物理和运动学边界的引用集合；具体数值必须来自平台资料。", "reference", []],
      ["载荷、传感器与计算能力", "平台可用载荷、传感器和计算资源的静态能力声明。", "reference", []],
      ["设计运行域与环境耐受", "平台受审 ODD 和环境耐受范围；未提供的阈值保持 TBD。", "reference", [
        E.tbd("ODD 与耐受阈值 TBD"),
      ]],
      ["任务兼容性", "平台档案与任务类型、载荷组合及场景要求的兼容关系。", "object", []],
      ["运行时状态边界", "仅声明静态平台档案；电量、健康和实时资源状态归 A9，不在本槽位复制。", "reference", [
        E.derived("static_profile_only", "仅静态平台档案", ["L-G1-JD66"]),
        E.proposed("runtime_state_reference_A9", "运行时状态引用 A9"),
      ]],
    ],
  },
  {
    id: "jd-2.3",
    owner: "A2",
    name: "隐式参数规则",
    definition:
      "上下文相关的参数自动推断规则，即专家默认知道但 JD-SOP 未显式写出的规则。",
    global: ["jd-0.6", "jd-0.10"],
    used: ["A2×L4"],
    dimensions: [
      ["规则标识、版本与来源", "隐式参数规则的唯一标识、版本及业务依据。", "object", []],
      ["启用上下文", "规则允许生效的业务场景、任务阶段和前置条件。", "object", []],
      ["被推断参数", "规则输出的参数槽位及其来源记录。", "reference", []],
      ["推断证据与可追溯性", "触发规则时必须保留的上下文证据和推断来源。", "object", []],
      ["确认要求", "推断结果是否必须请求用户确认；时限和阈值保持 TBD。", "enum", [
        E.derived("confirmation_required", "需要确认"),
        E.derived("confirmation_not_required_by_reviewed_rule", "受审规则允许免确认"),
        E.tbd("确认条件 TBD"),
      ]],
      ["例外与规则冲突", "规则不适用的例外、优先级和冲突解决状态。", "object", [
        E.tbd("优先级和冲突规则 TBD"),
      ]],
    ],
  },
  {
    id: "jd-3.1",
    owner: "A3",
    name: "任务技能库",
    definition:
      "该 JD 的可组合执行原语集，例如飞到、拍照、红外、喊话、采样、复检等。",
    global: ["jd-0.4"],
    used: ["A3×L1", "A3×L2", "A3×L3", "A3×L4"],
    dimensions: [
      ["技能标识与版本", "技能的 canonical 标识、版本和适用范围。", "object", []],
      ["技能类别", "技能在移动、观测、载荷、交互或任务控制中的类别。", "multi_enum", [
        E.given("fly_or_move", "飞到 / 移动"),
        E.given("capture", "拍照"),
        E.given("infrared_observe", "红外"),
        E.given("announce", "喊话"),
        E.given("sample", "采样"),
        E.given("reinspect", "复检"),
      ]],
      ["参数 schema", "技能输入参数、类型、单位与必填条件。", "reference", []],
      ["前置条件", "技能可被选择和执行前必须满足的状态。", "object", []],
      ["预期效果与副作用", "技能完成后的预期状态变化和已知副作用。", "object", []],
      ["组合与依赖", "技能与其他技能的可组合顺序、依赖和互斥关系。", "object", []],
      ["可用性状态", "技能在当前平台、场景和运行状态下是否可用。", "enum", [
        E.proposed("available", "可用"),
        E.proposed("conditionally_available", "有条件可用"),
        E.proposed("unavailable", "不可用"),
        E.tbd(),
      ]],
    ],
  },
  {
    id: "jd-3.2",
    owner: "A3",
    name: "任务完成语义",
    definition:
      "JD 任务级“完成”的语义：哪些子单元完成才算完成，什么异常算部分完成，什么状态算中止。",
    global: ["jd-0.7"],
    used: ["A3×L3", "A3×L4"],
    dimensions: [
      ["必要、可选与禁止子目标", "任务完成语义中的必要、可选和禁止子目标集合。", "object", []],
      ["完成谓词", "用于判断任务完成的结构化语义，引用全局 jd-0.7。", "reference", []],
      ["部分完成语义", "未满足全部目标时可接受的部分完成状态。", "object", [
        E.tbd("部分完成 taxonomy TBD"),
      ]],
      ["失败、终止与中止语义", "任务失败、正常终止和安全中止的区分。", "enum", [
        E.given("completed", "完成"),
        E.given("partially_completed", "部分完成"),
        E.given("failed", "失败"),
        E.given("terminated", "终止"),
        E.given("aborted", "中止"),
      ]],
      ["验证证据要求", "证明完成语义已满足所需的结果、状态或证据引用。", "object", []],
      ["版本与变更规则", "完成语义的版本、生效范围和变更记录。", "object", []],
    ],
  },
  {
    id: "jd-4.1",
    owner: "A4",
    name: "任务结构",
    definition:
      "JD 的标准相位以及相位间依赖和顺序约束，例如准备→起飞→巡检→返航→数据落地。",
    global: ["jd-0.1", "jd-0.7"],
    used: ["A4×L2", "A4×L3"],
    dimensions: [
      ["任务阶段目录", "JD 的标准任务阶段集合。", "list", [
        E.given("prepare", "准备"),
        E.given("takeoff", "起飞"),
        E.given("inspect", "巡检"),
        E.given("return", "返航"),
        E.given("data_delivery", "数据落地"),
      ]],
      ["阶段依赖与偏序", "任务阶段之间必须满足的依赖和先后约束。", "object", []],
      ["阶段转换条件", "进入下一阶段所需的状态、事件或人工决定。", "object", []],
      ["重复、分支与基数", "阶段允许的重复次数语义、条件分支和实例数量。", "object", [
        E.tbd("次数与分支规则 TBD"),
      ]],
      ["阶段入口与退出条件", "每个阶段的入口、完成、失败和退出语义。", "object", []],
      ["任务生命周期状态", "编排层可观察的任务生命周期状态。", "enum", [
        E.proposed("not_started", "未开始"),
        E.proposed("running", "执行中"),
        E.proposed("waiting_for_human", "等待人工"),
        E.proposed("completed", "已完成"),
        E.proposed("terminated_or_aborted", "已终止或中止"),
      ]],
    ],
  },
  {
    id: "jd-4.2",
    owner: "A4",
    name: "人机交接点",
    definition:
      "任务流中需要人介入的位置；A4 描述在哪里交接，新 A5 描述用什么协议交接。",
    global: ["jd-0.4", "jd-0.5"],
    used: ["A4×L3"],
    dimensions: [
      ["交接点类型", "任务流程中交接点的业务类型。", "multi_enum", [
        E.proposed("approval", "批准点"),
        E.proposed("clarification", "澄清点"),
        E.proposed("correction", "纠偏点"),
        E.proposed("takeover", "接管点"),
        E.proposed("audit", "审计点"),
      ]],
      ["流程位置", "交接点所属任务、阶段、步骤或阶段间边界。", "reference", []],
      ["有效窗口", "交接点允许触发和接受响应的业务窗口；具体时限 TBD。", "object", [
        E.tbd("交接时间窗口 TBD"),
      ]],
      ["安全暂停状态", "等待人工时允许保持的安全任务状态引用。", "reference", [
        E.tbd("安全暂停状态映射 TBD"),
      ]],
      ["状态快照与上下文", "交接时需要保存的任务状态、已完成项和未决问题。", "object", []],
      ["恢复位置", "交接结束后继续、重做或终止的流程位置。", "reference", []],
    ],
  },
  {
    id: "jd-4.3",
    owner: "A4",
    name: "重编排触发",
    definition:
      "JD 特定的任务级重规划触发条件，区别于 A10 的轨迹级重规划判据。",
    global: ["jd-0.1", "jd-0.7"],
    used: ["A4×L4"],
    dimensions: [
      ["触发类别", "引起任务结构或步骤变化的事件类别。", "multi_enum", [
        E.proposed("requirement_change", "任务需求变化"),
        E.proposed("task_step_failure", "任务步骤失败"),
        E.proposed("resource_or_capability_change", "资源或能力变化"),
        E.proposed("human_intervention", "人工介入"),
        E.proposed("completion_gap", "完成语义缺口"),
      ]],
      ["触发来源", "触发来自用户、SUT、世界状态、harness 或 grader 的哪一侧。", "multi_enum", [
        E.proposed("user"),
        E.proposed("sut_trace"),
        E.proposed("world_or_fixture"),
        E.proposed("harness"),
        E.proposed("grader"),
      ]],
      ["受影响范围", "触发影响的任务、阶段、步骤或目标集合。", "reference", []],
      ["触发窗口", "触发在任务生命周期中的有效范围；具体阈值和时限 TBD。", "object", [
        E.tbd("触发阈值与时限 TBD"),
      ]],
      ["可恢复性", "触发后的任务是否可继续、需重做或必须终止。", "enum", [
        E.proposed("recoverable", "可恢复"),
        E.proposed("recoverable_with_handoff", "经交接可恢复"),
        E.proposed("non_recoverable", "不可恢复"),
        E.tbd(),
      ]],
      ["触发证据", "支持触发判定的输入、状态或 Trace 证据。", "object", []],
    ],
  },
  {
    id: "jd-4.4",
    owner: "A4",
    name: "任务级重规划策略",
    definition:
      "JD 典型的多步重规划与恢复模式，区别于新 A14 的反射级兜底动作。",
    global: ["jd-0.7"],
    used: ["A4×L4"],
    dimensions: [
      ["重规划范围", "允许重规划的任务、阶段、步骤或子目标范围。", "reference", []],
      ["编排编辑操作", "对原任务结构可执行的编辑类型。", "multi_enum", [
        E.proposed("retain", "保留"),
        E.proposed("delete", "删除"),
        E.proposed("insert", "插入"),
        E.proposed("reorder", "重排"),
        E.proposed("replace", "替换"),
      ]],
      ["策略类别", "任务级修复策略的业务类别。", "multi_enum", [
        E.proposed("retry_step", "重试步骤"),
        E.proposed("skip_optional_step", "跳过可选步骤"),
        E.proposed("substitute_skill", "替换技能"),
        E.proposed("decompose_again", "重新分解"),
        E.proposed("request_human_decision", "请求人工决定"),
      ]],
      ["修复后验证", "重规划结果再次检查依赖、约束和完成语义的方式。", "object", []],
      ["继续、降级或终止", "修复后的任务状态选择。", "enum", [
        E.proposed("continue", "继续"),
        E.proposed("degraded_continue", "降级继续"),
        E.proposed("handoff", "交接"),
        E.proposed("terminate", "终止"),
      ]],
    ],
  },
  {
    id: "jd-4.5",
    owner: "A4",
    name: "编排输出机制",
    definition:
      "JD 的 A4 输出抽象层级，例如 tool call、skill 调用、trajectory 或 velocity。",
    global: [],
    used: ["A4×L1", "A4×L2"],
    dimensions: [
      ["输出抽象层级", "A4 向后续执行层输出的抽象形式。", "enum", [
        E.given("tool_call", "tool call"),
        E.given("skill_call", "skill 调用"),
        E.given("trajectory", "trajectory"),
        E.given("velocity", "velocity"),
      ]],
      ["输出 schema 与版本", "编排输出的数据合同标识、版本和兼容性。", "object", []],
      ["接收方类别", "编排输出被交付给的下游能力或执行组件类别。", "reference", []],
      ["下发模式", "输出是单次、流式、分段还是事务式提交。", "enum", [
        E.proposed("single"),
        E.proposed("stream"),
        E.proposed("segment"),
        E.proposed("transactional"),
        E.tbd(),
      ]],
      ["响应与验证 Trace", "下游响应、接受、拒绝和执行效果的可观察记录。", "object", []],
    ],
  },
  {
    id: "jd-5.1",
    legacyId: "jd-14.1",
    owner: "A5",
    name: "交接协议表",
    definition:
      "交接类型×优先级×延迟预算的综合协议表，覆盖确认、纠偏、批准、审计、通知等类型。",
    global: ["jd-0.4", "jd-0.5"],
    used: ["A5×L2", "A5×L3"],
    dimensions: [
      ["交接类型", "交互膜中请求或交接的类型。", "multi_enum", [
        E.given("confirmation", "确认"),
        E.given("correction", "纠偏"),
        E.given("approval", "批准"),
        E.given("audit", "审计"),
        E.given("notification", "通知"),
        E.derived("pause_cancel_takeover", "暂停、取消或接管", ["L-G1-AXL68"]),
      ]],
      ["接收角色与权限", "交接对象及其对批准、纠偏、暂停或接管的权限。", "reference", []],
      ["优先级", "交接消息或请求的优先级分类；正式档位和业务规则 TBD。", "enum", [
        E.tbd("优先级 taxonomy TBD"),
      ]],
      ["触发条件", "交接协议被启用的任务状态、风险或信息缺口。", "object", []],
      ["延迟预算", "请求发出、等待和升级的时间预算；具体数值不得推断。", "object", [
        E.tbd("延迟预算 TBD"),
      ]],
      ["交接载荷", "交接消息所需的任务上下文、状态、证据和请求内容。", "object", []],
      ["确认、回读与继续规则", "交接后的等待、确认、回读、恢复或终止状态机。", "object", [
        E.tbd("确认时限与状态机细节 TBD"),
      ]],
    ],
  },
  {
    id: "jd-5.2",
    legacyId: "jd-14.2",
    owner: "A5",
    name: "偏好对齐协议",
    definition:
      "JD 中用户偏好可表达的维度与系统对齐流程，包含 preference taxonomy。",
    global: ["jd-0.4", "jd-0.5"],
    used: ["A5×L4"],
    dimensions: [
      ["偏好类别", "业务中允许表达和对齐的偏好类别；最终 taxonomy TBD。", "multi_enum", [
        E.proposed("interaction_style", "交互方式偏好"),
        E.proposed("task_priority", "任务优先偏好"),
        E.proposed("output_presentation", "结果呈现偏好"),
        E.proposed("confirmation_style", "确认方式偏好"),
        E.tbd("其他类别 TBD"),
      ]],
      ["偏好值表示", "偏好值的类型、允许范围和不适用状态。", "object", []],
      ["偏好来源", "偏好来自用户显式声明、组织规则、历史记录或推断。", "enum", [
        E.derived("user_explicit", "用户显式声明", ["L-G1-SETUP"]),
        E.derived("organization_policy", "组织规则"),
        E.derived("history", "历史记录"),
        E.proposed("inferred", "推断候选"),
        E.tbd(),
      ]],
      ["适用范围与生效版本", "偏好对任务、场景、角色和时间范围的适用性。", "object", []],
      ["优先级与冲突", "多个偏好及其与合规、安全约束冲突时的状态；解决规则 TBD。", "object", [
        E.tbd("偏好优先级与冲突规则 TBD"),
      ]],
      ["更新与撤销", "用户或组织更新、暂停和撤销偏好的协议。", "object", []],
    ],
  },
  {
    id: "jd-5.3",
    legacyId: "jd-14.3",
    owner: "A5",
    name: "高层通知规则",
    definition: "L4 高层通知、边界发现与策略切换时采用的通知规则。",
    global: ["jd-0.4", "jd-0.5"],
    used: ["A5×L4"],
    dimensions: [
      ["高层事件类别", "需要产生高层通知的业务事件类别。", "multi_enum", [
        E.given("boundary_discovery", "边界发现", ["L-G1-JD66", "L-G1-AXL68"]),
        E.given("strategy_switch", "策略切换", ["L-G1-JD66", "L-G1-AXL68"]),
        E.derived("correction_audit_summary", "纠偏审计总结", ["L-G1-AXL68"]),
        E.proposed("mission_level_exception", "任务级异常"),
      ]],
      ["通知对象与路由", "通知面向的角色、渠道和路由关系。", "reference", []],
      ["通知优先级", "高层通知的优先级；正式档位和触发规则 TBD。", "enum", [
        E.tbd("通知优先级 taxonomy TBD"),
      ]],
      ["证据摘要", "通知中附带的任务状态、边界、原因和证据摘要。", "object", []],
      ["去重与抑制", "重复通知的合并、抑制和恢复条件；规则 TBD。", "object", [
        E.tbd("去重与抑制规则 TBD"),
      ]],
      ["升级与确认", "通知升级、人工确认和未确认处置；时限和阈值 TBD。", "object", [
        E.tbd("升级与确认条件 TBD"),
      ]],
      ["审计关联", "通知与任务 Trace、交接记录和审计证据的关联标识。", "reference", []],
    ],
  },
];

function baseNode(overrides) {
  return {
    schema_version: nodeSchemaVersion,
    node_id: null,
    parent_id: null,
    canonical_slot: null,
    owner_a: null,
    name: null,
    definition: null,
    node_kind: "variable",
    value_type: "none",
    value_domain: null,
    unit: null,
    activation_condition: null,
    multiplicity: "one",
    difficulty_direction: "TBD",
    configuration_side: "shared",
    projection_targets: ["sut_input", "harness"],
    visibility: ["sut_visible", "grader_visible"],
    observation_channel: ["sut_input", "sut_trace", "grader"],
    applicable_scenarios: g1Scenario,
    related_global_jd: [],
    related_jd: [],
    used_by_axl: [],
    depends_on: [],
    mutual_exclusion_group: null,
    constraints: [],
    source: [],
    evidence_status: "inferred_candidate",
    derivation_status: "proposed",
    review_status: "proposed",
    legacy_aliases: [],
    notes: null,
    ...overrides,
  };
}

function canonicalSourceForOwner(owner) {
  if (["A1", "A2", "A3", "A4", "A5"].includes(owner)) {
    return "L-G1-JD66";
  }
  if (owner === "A9") return "L-A9-JD66-V3";
  if (owner === "A11") return "L-A11-JD66-V3";
  return "L-JD66";
}

function normalizeCanonicalNode(node) {
  if (!node.canonical_slot || node.node_id !== node.canonical_slot) {
    return node;
  }
  const authoritative = currentJdById.get(node.node_id);
  if (!authoritative) return node;
  node.owner_a = authoritative.owner_a;
  node.name = authoritative.name;
  node.definition = authoritative.description;
  node.source = [
    ...new Set([
      ...(node.source || []),
      canonicalSourceForOwner(authoritative.owner_a),
    ]),
  ];
  node.evidence_status = "authoritative_existing";
  node.derivation_status = "given";
  node.review_status = "reviewed";
  return node;
}

const g1Nodes = [
  baseNode({
    node_id: catalogRootId,
    parent_id: null,
    owner_a: "MULTI",
    name: "JD 业务变量树 version1",
    definition:
      "按 ability-id-v3-2026-07-20 汇总 A1–A11 当前已建设分支，包含 A9 健康 / 能源 / 资源管理；页面按单项能力切换，不显示组别标题。",
    node_kind: "catalog_root",
    value_type: "none",
    value_domain: null,
    related_global_jd: [],
    used_by_axl: [],
    source: ["L-RENUMBER-20260720"],
    evidence_status: "team_material_only",
    derivation_status: "given",
    legacy_aliases: ["PROPOSED-jd-tree-inspection"],
  }),
  ...Object.entries(abilityNames).map(([ability, name]) =>
    baseNode({
      node_id: `PROPOSED-jd-tree-${ability}`,
      parent_id: catalogRootId,
      owner_a: ability,
      name,
      definition: `描述 ${name} 对应的 JD 业务变量分支；A×L 只作为责任引用，不作为变量取值。`,
      node_kind: "capability_root",
      related_global_jd: abilityGlobalJd[ability],
      source:
        ability === "A5"
          ? ["L-G1-JD66", "L-G1-AXL68", "L-RENUMBER-20260719"]
          : ["L-G1-JD66", "L-G1-AXL68"],
      evidence_status: "authoritative_existing",
      derivation_status: "given",
      legacy_aliases: ability === "A5" ? ["PROPOSED-jd-tree-A14"] : [],
    }),
  ),
];

for (const slot of slotSpecs) {
  const slotSources = [
    "L-G1-JD66",
    "L-G1-AXL68",
    "L-G1-RESEARCH",
    ...(slot.owner === "A5" ? ["L-RENUMBER-20260719"] : []),
  ];
  g1Nodes.push(
    baseNode({
      node_id: slot.id,
      parent_id: `PROPOSED-jd-tree-${slot.owner}`,
      canonical_slot: slot.id,
      owner_a: slot.owner,
      name: slot.name,
      definition: slot.definition,
      node_kind: "group",
      related_global_jd: slot.global,
      used_by_axl: slot.used,
      source: slotSources,
      evidence_status: "authoritative_existing",
      derivation_status: "given",
      legacy_aliases: slot.legacyId ? [slot.legacyId] : [],
      notes:
        slot.owner === "A5"
          ? `语义继承旧 ${slot.legacyId}；编号按 2026-07-19 会议草案迁移。`
          : null,
    }),
  );

  slot.dimensions.forEach(
    ([name, definition, valueType, valueDomain], index) => {
      const domain = valueDomain || [];
      const statuses = domain.map((item) => item.status);
      const hasGiven = statuses.includes("authoritative_existing");
      const hasSupported = statuses.includes("source_supported");
      const allTbd = domain.length > 0 && statuses.every((item) => item === "TBD");
      const evidenceStatus = allTbd
        ? "TBD"
        : hasGiven
          ? "authoritative_existing"
          : hasSupported
            ? "source_supported"
            : "inferred_candidate";
      const derivationStatus = allTbd
        ? "TBD"
        : hasGiven
          ? "given"
          : hasSupported
            ? "derived"
            : "proposed";
      const sourceRefs = [
        ...new Set(
          domain
            .flatMap((item) => item.source_refs || [])
            .concat(
              slot.owner === "A5"
                ? ["L-G1-RESEARCH", "L-RENUMBER-20260719"]
                : ["L-G1-RESEARCH"],
            ),
        ),
      ];

      g1Nodes.push(
        baseNode({
          node_id: `PROPOSED-${slot.id}.${index + 1}`,
          parent_id: slot.id,
          canonical_slot: slot.id,
          owner_a: slot.owner,
          name,
          definition,
          node_kind: "variable",
          value_type: valueType,
          value_domain: domain,
          difficulty_direction: "context_dependent",
          related_global_jd: slot.global,
          used_by_axl: slot.used,
          source: sourceRefs,
          evidence_status: evidenceStatus,
          derivation_status: derivationStatus,
          legacy_aliases: slot.legacyId
            ? [`PROPOSED-${slot.legacyId}.${index + 1}`]
            : [],
        }),
      );
    },
  );
}

for (const node of g1Nodes) {
  if (node.owner_a === "A1" || node.owner_a === "A5") {
    node.projection_targets = ["user_config", "sut_input", "harness"];
  } else if (node.owner_a === "A2") {
    node.projection_targets = [
      "world_config",
      "user_config",
      "sut_input",
      "harness",
    ];
  } else if (node.owner_a === "A3" || node.owner_a === "A4") {
    node.projection_targets = ["sut_input", "harness"];
  }
  normalizeCanonicalNode(node);
}

const authoritativeA9Ability = currentAxlCatalog.abilities.find(
  (ability) => ability.a_id === "A9",
);
const authoritativeA9Slots = currentJdDictionary.variables.filter(
  (variable) => variable.owner_a === "A9" && variable.scope === "local",
);
const authoritativeA11Ability = currentAxlCatalog.abilities.find(
  (ability) => ability.a_id === "A11",
);
const authoritativeA11Slots = currentJdDictionary.variables.filter(
  (variable) => variable.owner_a === "A11" && variable.scope === "local",
);

const a9DomainItem = (
  value,
  label,
  sourceRefs,
  status = "source_supported",
) => ({
  value,
  label_zh: label,
  source_refs: sourceRefs,
  status,
  applicable_scenarios: ["cross_scenario"],
});

const a9Specs = {
  "jd-9.1": {
    relatedGlobal: ["jd-0.9", "jd-0.1"],
    usedByAxl: ["A9×L1", "A9×L2"],
    dimensions: [
      {
        name: "资源对象类型",
        definition:
          "资源消耗包络所覆盖的资源对象；类别来自受审 JD 与 A9×L1–L3 责任原文。",
        valueType: "multi_enum",
        domain: [
          a9DomainItem("battery_energy", "电量 / 能源", ["L-A9-JD66-V3"]),
          a9DomainItem("compute", "算力", ["L-A9-JD66-V3"]),
          a9DomainItem(
            "communication_link_or_bandwidth",
            "链路 / 带宽",
            ["L-A9-JD66-V3", "L-A9-AXL68-V3"],
          ),
          a9DomainItem("payload_capacity", "载重 / 载荷资源", [
            "L-A9-JD66-V3",
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("sensor_state", "传感器资源状态", [
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("actuator_state", "执行器资源状态", [
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("thermal_headroom", "热余量 / 热风险", [
            "L-A9-AXL68-V3",
          ]),
        ],
        difficulty: "context_dependent",
      },
      {
        name: "消耗包络表示",
        definition:
          "资源典型消耗曲线及其当前、趋势和预测表达；具体采样频率、窗口与模型保持 TBD。",
        valueType: "multi_enum",
        domain: [
          a9DomainItem("current_state", "当前资源状态", ["L-A9-AXL68-V3"]),
          a9DomainItem("consumption_curve", "典型消耗曲线", [
            "L-A9-JD66-V3",
          ]),
          a9DomainItem("consumption_trend", "消耗趋势", [
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("projected_remaining_resource", "预测资源余量", [
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("TBD", "采样窗口与预测模型 TBD", [], "TBD"),
        ],
        difficulty: "context_dependent",
      },
      {
        name: "任务阶段与时间参照",
        definition:
          "资源包络对应的任务阶段、当前执行片段或任务时长参照；复用 jd-0.1，不在 A9 内重复定义任务时长。",
        valueType: "reference",
        domain: [
          a9DomainItem("current_execution_segment", "当前执行片段", [
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("mission_duration_reference", "引用 jd-0.1 任务时长", [
            "L-A9-AXL68-V3",
          ]),
        ],
        difficulty: "context_dependent",
      },
      {
        name: "资源状态质量",
        definition:
          "资源状态或预测值的可用性、来源和可信状态；正式质量码与阈值尚无依据。",
        valueType: "enum",
        domain: [
          a9DomainItem("observed", "直接观测", ["L-A9-AXL68-V3"]),
          a9DomainItem("estimated", "估计 / 预测", ["L-A9-AXL68-V3"]),
          a9DomainItem("unavailable", "不可用", ["L-A9-AXL68-V3"]),
          a9DomainItem("TBD", "质量码与不确定度表达 TBD", [], "TBD"),
        ],
        difficulty: "context_dependent",
      },
      {
        name: "执行片段资源充足性",
        definition:
          "按资源消耗包络判断资源是否足以完成当前执行片段；判定阈值不得从常识推断。",
        valueType: "enum",
        domain: [
          a9DomainItem("sufficient", "足以完成当前执行片段", [
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("insufficient", "不足以完成当前执行片段", [
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("unknown", "无法判定", ["L-A9-AXL68-V3"]),
          a9DomainItem("TBD", "充足性判定阈值 TBD", [], "TBD"),
        ],
        difficulty: "decreasing",
      },
    ],
  },
  "jd-9.2": {
    relatedGlobal: ["jd-0.1", "jd-0.5"],
    usedByAxl: ["A9×L2", "A9×L3"],
    dimensions: [
      {
        name: "预警风险类别",
        definition:
          "需要由资源预警策略识别的风险类别；类别直接来自 A9×L3 责任原文。",
        valueType: "multi_enum",
        domain: [
          a9DomainItem("low_energy_trend", "低电趋势", ["L-A9-AXL68-V3"]),
          a9DomainItem("link_degradation", "链路退化", ["L-A9-AXL68-V3"]),
          a9DomainItem("payload_anomaly", "载荷异常", ["L-A9-AXL68-V3"]),
          a9DomainItem("compute_congestion", "算力拥塞", [
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("thermal_risk", "热风险", ["L-A9-AXL68-V3"]),
        ],
        difficulty: "context_dependent",
      },
      {
        name: "预警触发表达",
        definition:
          "描述何时预警的条件、趋势窗口和持续性；具体阈值、窗口与业务判据保持 TBD。",
        valueType: "object",
        domain: [
          a9DomainItem("TBD", "预警阈值、趋势窗口与持续性 TBD", [], "TBD"),
        ],
        difficulty: "context_dependent",
      },
      {
        name: "返航预留对象",
        definition:
          "预留策略必须保护的返航资源或返航窗口；具体资源分解仍待确认。",
        valueType: "multi_enum",
        domain: [
          a9DomainItem("return_reserve", "返航资源余量", [
            "L-A9-JD66-V3",
          ]),
          a9DomainItem("return_window", "返航窗口", [
            "L-A9-JD66-V3",
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("TBD", "其他必保资源对象 TBD", [], "TBD"),
        ],
        difficulty: "context_dependent",
      },
      {
        name: "预留量表示",
        definition:
          "返航预留比、预留量及其单位和参照；资料未给出的数值范围全部保持 TBD。",
        valueType: "object",
        domain: [
          a9DomainItem("return_reserve_ratio", "返航预留比", [
            "L-A9-JD66-V3",
          ]),
          a9DomainItem("TBD", "预留比数值、单位与计算规则 TBD", [], "TBD"),
        ],
        difficulty: "context_dependent",
      },
      {
        name: "人工确认与升级",
        definition:
          "资源或健康风险何时按 jd-0.5 请求人工确认，以及无响应时如何升级；时限与规则保持 TBD。",
        valueType: "object",
        domain: [
          a9DomainItem("request_human_confirmation", "请求人工确认", [
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("TBD", "确认时限、升级条件与无响应处置 TBD", [], "TBD"),
        ],
        difficulty: "context_dependent",
      },
    ],
  },
  "jd-9.3": {
    relatedGlobal: ["jd-0.5", "jd-0.9"],
    usedByAxl: ["A9×L4"],
    dimensions: [
      {
        name: "处置启用条件",
        definition:
          "允许从资源处置策略集中选择动作的资源或健康异常类型；阈值引用 jd-9.2，不在本槽位重复。",
        valueType: "multi_enum",
        domain: [
          a9DomainItem("resource_anomaly", "资源异常", ["L-A9-AXL68-V3"]),
          a9DomainItem("health_anomaly", "健康异常", ["L-A9-AXL68-V3"]),
          a9DomainItem("TBD", "异常判定与启用阈值 TBD", [], "TBD"),
        ],
        difficulty: "context_dependent",
      },
      {
        name: "可用处置动作",
        definition:
          "当前 JD 下 L4 可用且有效的资源处置策略子集；动作来自受审 JD 与 A9×L4 原文。",
        valueType: "multi_enum",
        domain: [
          a9DomainItem("shed_load", "降载", [
            "L-A9-JD66-V3",
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("switch_link", "切链路", [
            "L-A9-JD66-V3",
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("disable_noncritical_payload", "关闭非关键载荷", [
            "L-A9-JD66-V3",
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("reduce_sampling_rate", "降采样率", [
            "L-A9-JD66-V3",
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("preserve_return_window", "保留返航窗口", [
            "L-A9-JD66-V3",
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("wait_for_cooling", "等待冷却", [
            "L-A9-JD66-V3",
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("request_support_or_maintenance", "请求支援 / 维护", [
            "L-A9-JD66-V3",
            "L-A9-AXL68-V3",
          ]),
        ],
        difficulty: "non_monotonic",
      },
      {
        name: "动作参数与执行约束",
        definition:
          "处置动作所需的参数、允许范围、执行条件和约束；资料未提供具体数值或接口。",
        valueType: "object",
        domain: [
          a9DomainItem("TBD", "动作参数、范围与执行接口 TBD", [], "TBD"),
        ],
        difficulty: "context_dependent",
      },
      {
        name: "策略选择与冲突",
        definition:
          "多个可用处置动作之间的适用性、优先级、组合与互斥关系；正式规则保持 TBD。",
        valueType: "object",
        domain: [
          a9DomainItem("TBD", "优先级、组合与互斥规则 TBD", [], "TBD"),
        ],
        difficulty: "non_monotonic",
      },
      {
        name: "处置后状态验证",
        definition:
          "执行资源处置后对新资源与健康状态进行验证；通过标准和升级规则保持 TBD。",
        valueType: "enum",
        domain: [
          a9DomainItem("recovered", "已恢复", ["L-A9-AXL68-V3"]),
          a9DomainItem("partially_recovered", "部分恢复", [
            "L-A9-AXL68-V3",
          ]),
          a9DomainItem("not_recovered", "未恢复", ["L-A9-AXL68-V3"]),
          a9DomainItem("unknown", "无法验证", ["L-A9-AXL68-V3"]),
          a9DomainItem("TBD", "验证标准与升级规则 TBD", [], "TBD"),
        ],
        difficulty: "context_dependent",
      },
    ],
  },
};

const a9Root = baseNode({
  node_id: "PROPOSED-jd-tree-A9",
  parent_id: catalogRootId,
  owner_a: "A9",
  name: authoritativeA9Ability.ability,
  definition:
    "描述健康、能源与资源管理相关的 JD 业务变量；A×L 仅作为责任引用，不作为变量取值。",
  node_kind: "capability_root",
  related_global_jd: authoritativeA9Ability.global_jd,
  source: ["L-A9-JD66-V3", "L-A9-AXL68-V3"],
  evidence_status: "authoritative_existing",
  derivation_status: "given",
  review_status: "reviewed",
  applicable_scenarios: ["cross_scenario"],
  configuration_side: "shared",
  projection_targets: [
    "world_config",
    "user_config",
    "sut_input",
    "harness",
  ],
});

const a9Nodes = [a9Root];
for (const slot of authoritativeA9Slots) {
  const spec = a9Specs[slot.id];
  if (!spec) {
    throw new Error(`A9 canonical 槽位缺少细分规格：${slot.id}`);
  }
  a9Nodes.push(
    baseNode({
      node_id: slot.id,
      parent_id: a9Root.node_id,
      canonical_slot: slot.id,
      owner_a: "A9",
      name: slot.name,
      definition: slot.description,
      node_kind: "group",
      related_global_jd: spec.relatedGlobal,
      used_by_axl: spec.usedByAxl,
      source: ["L-A9-JD66-V3", "L-A9-AXL68-V3"],
      evidence_status: "authoritative_existing",
      derivation_status: "given",
      review_status: "reviewed",
      applicable_scenarios: ["cross_scenario"],
      configuration_side: "shared",
      projection_targets: [
        "world_config",
        "user_config",
        "sut_input",
        "harness",
      ],
      notes:
        "canonical 名称与定义取自 ability-id-v3 权威机读源；下级子维度为保守归纳，尚待审阅。",
    }),
  );
  spec.dimensions.forEach((dimension, index) => {
    const statuses = dimension.domain.map((item) => item.status);
    const allTbd = statuses.every((status) => status === "TBD");
    const sourceRefs = [
      ...new Set(
        dimension.domain
          .flatMap((item) => item.source_refs || [])
          .concat(["L-A9-JD66-V3", "L-A9-AXL68-V3"]),
      ),
    ];
    a9Nodes.push(
      baseNode({
        node_id: `PROPOSED-${slot.id}.${index + 1}`,
        parent_id: slot.id,
        canonical_slot: slot.id,
        owner_a: "A9",
        name: dimension.name,
        definition: dimension.definition,
        node_kind: "variable",
        value_type: dimension.valueType,
        value_domain: dimension.domain,
        difficulty_direction: dimension.difficulty,
        related_global_jd: spec.relatedGlobal,
        used_by_axl: spec.usedByAxl,
        source: sourceRefs,
        evidence_status: allTbd ? "TBD" : "source_supported",
        derivation_status: allTbd ? "TBD" : "derived",
        review_status: "proposed",
        applicable_scenarios: ["cross_scenario"],
        configuration_side: "shared",
        projection_targets: [
          "world_config",
          "user_config",
          "sut_input",
          "harness",
        ],
        visibility: ["sut_visible", "grader_visible"],
        observation_channel: ["sut_input", "sut_trace", "grader"],
      }),
    );
  });
}

const levelsUsingSlot = (ability, slotId) =>
  Object.entries(ability.levels)
    .filter(([, level]) => level.jd_refs.includes(slotId))
    .map(([level]) => `${ability.a_id}×${level}`);

function demoteLegacyA11Draft(nodes) {
  const legacyPlatformIds = new Map([
    ["jd-11.1", "PROPOSED-jd-11.platform-interface-v0.6"],
    ["jd-11.2", "PROPOSED-jd-11.platform-constraints-v0.6"],
    ["jd-11.3", "PROPOSED-jd-11.execution-envelope-v0.6"],
  ]);
  const idMap = new Map(legacyPlatformIds);
  for (const node of nodes) {
    if (node.node_id.startsWith("jd-11.5")) {
      idMap.set(node.node_id, `PROPOSED-${node.node_id}`);
    }
  }

  const rewriteReferences = (value) => {
    if (typeof value === "string") return idMap.get(value) || value;
    if (Array.isArray(value)) return value.map(rewriteReferences);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          rewriteReferences(item),
        ]),
      );
    }
    return value;
  };

  return nodes.map((inputNode) => {
    const node = rewriteReferences(inputNode);
    const originalMigratedId = inputNode.node_id;
    if (originalMigratedId === "PROPOSED-jd-tree-A11") {
      node.name = authoritativeA11Ability.ability;
      node.definition =
        "描述飞行控制、控制质量、控制工作机制与控制处置策略相关的 JD 业务变量；白墙窄缝内容保留为场景化候选分支。";
      node.related_global_jd = authoritativeA11Ability.global_jd;
      node.source = [
        ...new Set([
          ...(node.source || []),
          "L-A11-JD66-V3",
          "L-A11-AXL68-V3",
        ]),
      ];
      node.evidence_status = "authoritative_existing";
      node.derivation_status = "given";
      node.review_status = "reviewed";
      node.notes = [
        node.notes,
        "A11 能力根与 canonical 槽位以 ability-id-v3 权威字典为准；v0.6 平台基准和避障树仅作为非 canonical 候选保留。",
      ]
        .filter(Boolean)
        .join("\n");
      return node;
    }
    if (!idMap.has(originalMigratedId)) return node;

    node.canonical_slot = null;
    node.legacy_aliases = [
      ...new Set([...(node.legacy_aliases || []), originalMigratedId]),
    ];
    node.review_status = "proposed";
    if (legacyPlatformIds.has(originalMigratedId)) {
      node.name = `v0.6 候选：${inputNode.name}`;
      node.notes = [
        node.notes,
        "该节点来自旧 A8 白墙 v0.6 平台基准，与新 A11 canonical 槽位语义冲突；当前保留为非 canonical 候选，不覆盖 jd-11.1/jd-11.2/jd-11.3。",
      ]
        .filter(Boolean)
        .join("\n");
    } else if (originalMigratedId === "jd-11.5") {
      node.name = "候选避障变量树（旧 jd-8.5 草案）";
      node.notes = [
        node.notes,
        "jd-11.5 尚未进入 66 槽位权威字典；本分支及其子节点均为非 canonical 候选。",
      ]
        .filter(Boolean)
        .join("\n");
    }
    return node;
  });
}

const migratedInspectionNodes = oldInspection.nodes
  .map(migrateExistingNode)
  .filter(Boolean)
  .map(normalizeCanonicalNode);
const migratedA11DraftNodes = demoteLegacyA11Draft(
  oldA8.nodes.map(migrateExistingNode).filter(Boolean),
);
const migratedA11Root = migratedA11DraftNodes.find(
  (node) => node.node_id === "PROPOSED-jd-tree-A11",
);
if (!migratedA11Root) {
  throw new Error("A11 草案迁移后缺少能力根节点。");
}
const authoritativeA11Nodes = authoritativeA11Slots.map((slot) =>
  normalizeCanonicalNode(
    baseNode({
      node_id: slot.id,
      parent_id: migratedA11Root.node_id,
      canonical_slot: slot.id,
      owner_a: "A11",
      name: slot.name,
      definition: slot.description,
      node_kind: "group",
      related_global_jd: authoritativeA11Ability.global_jd,
      used_by_axl: levelsUsingSlot(authoritativeA11Ability, slot.id),
      source: ["L-A11-JD66-V3", "L-A11-AXL68-V3"],
      evidence_status: "authoritative_existing",
      derivation_status: "given",
      review_status: "reviewed",
      applicable_scenarios: ["cross_scenario"],
      configuration_side: "shared",
      projection_targets: [
        "world_config",
        "user_config",
        "sut_input",
        "harness",
      ],
      notes:
        "canonical 名称与定义取自 ability-id-v3 权威机读源；具体子维度尚待建设。",
    }),
  ),
);
const migratedA11Nodes = [
  migratedA11Root,
  ...authoritativeA11Nodes,
  ...migratedA11DraftNodes.filter((node) => node !== migratedA11Root),
];
const migratedNodes = [...migratedInspectionNodes, ...migratedA11Nodes];

const migrateSource = (source) => ({
  ...source,
  locator: migrateString(source.locator || ""),
});

const uniqueSources = (sources) => [
  ...new Map(sources.map((source) => [source.source_id, source])).values(),
];

const schemaFields = [
  "node_id",
  "parent_id",
  "canonical_slot",
  "owner_a",
  "name",
  "definition",
  "node_kind",
  "value_type",
  "value_domain",
  "unit",
  "activation_condition",
  "multiplicity",
  "difficulty_direction",
  "configuration_side",
  "projection_targets",
  "visibility",
  "observation_channel",
  "applicable_scenarios",
  "related_global_jd",
  "related_jd",
  "used_by_axl",
  "depends_on",
  "mutual_exclusion_group",
  "constraints",
  "source",
  "evidence_status",
  "derivation_status",
  "review_status",
  "legacy_aliases",
  "notes",
];

const controlledVocabularies = {
  configuration_side: ["world", "user", "shared", "TBD"],
  projection_targets: {
    type: "array",
    items: ["world_config", "user_config", "sut_input", "harness", "TBD"],
  },
  visibility: {
    type: "array",
    items: [
      "sut_visible",
      "fixture_only",
      "grader_visible",
      "grader_only",
      "hidden_gt",
    ],
  },
  observation_channel: {
    type: "array",
    items: ["sut_input", "sut_trace", "fixture", "grader", "hidden_gt", "TBD"],
  },
  difficulty_direction: [
    "increasing",
    "decreasing",
    "neutral",
    "context_dependent",
    "non_monotonic",
    "TBD",
  ],
  derivation_status: ["given", "derived", "proposed", "TBD"],
  evidence_status: [
    "authoritative_existing",
    "source_supported",
    "inferred_candidate",
    "team_material_only",
    "TBD",
  ],
};

const commonMetadata = {
  schema: "uav-benchmark-jd-variable-tree",
  schema_version: schemaVersion,
  generated_at: generatedAt,
  generated_by: "scripts/generate_jd_variable_tree_version1.mjs",
  ability_id_scheme: "ability-id-v3-2026-07-20",
  numbering_scheme: "ability-id-v3-2026-07-20",
  numbering_authority_status: "current_authoritative_machine_baseline",
  ability_renumbering: renumbering,
  l0_policy: {
    status: "accepted_project_sentinel",
    meaning: "能力在任务中出现，但该能力不采集、不评分且不计入覆盖。",
    formal_axl_dictionary_level: false,
    jd_rule:
      "L0 不进入 JD 值域，也不写入 used_by_axl；episode 层另存 coverage_level=L0。",
  },
  controlled_vocabularies: controlledVocabularies,
  schema_fields: schemaFields,
  authority_rules: [
    "本 version1 使用 ability-id-v3-2026-07-20 权威机读编号；旧树仅作为迁移输入和审计证据。",
    "canonical 语义继承旧受审资料；迁移后的 ID 通过 legacy_aliases 可追溯。",
    "A×L 仅作责任引用，L1–L4 不进入 JD 取值域；L0 是 episode 覆盖哨兵。",
    "缺少依据的阈值、时限、业务判据、安全规则和 simulator 接口保持 TBD。",
    "configuration_side、projection_targets、visibility 和 observation_channel 分列。",
    "derivation_status 与 evidence_status 分列。",
  ],
  decision_log: [
    {
      decision_id: "ability-renumbering-20260719",
      status: "historical_superseded",
      decision: renumberingV1ToV2,
    },
    {
      decision_id: "ability-renumbering-20260720",
      status: "current_authoritative_machine_baseline",
      decision: renumberingV2ToV3,
    },
    {
      decision_id: "l0-project-sentinel",
      status: "confirmed_by_user",
      decision: "L0 表示能力出现但不采集、不评分、不计入覆盖。",
    },
    {
      decision_id: "schema-configuration-and-observation-split",
      status: "confirmed_by_user",
      decision:
        "配置归属、配置投影、信息可见性、评测观察通道分列；configuration_side 允许 shared。",
    },
    {
      decision_id: "schema-derivation-status",
      status: "confirmed_by_user",
      decision: "derivation_status 与 evidence_status 分列。",
    },
  ],
};

const g1Catalog = {
  ...commonMetadata,
  catalog_id: "jd-variable-tree-g1-a1-a5-version1-draft",
  catalog_version: "version1-g1-a1-a5-2026-07-20",
  scope: ["A1", "A2", "A3", "A4", "A5"],
  scenario_scope: g1Scenario,
  sources: g1Sources,
  nodes: g1Nodes,
};

const migratedCatalog = {
  ...commonMetadata,
  catalog_id: "jd-variable-tree-g2-g3-renumbered-version1-draft",
  catalog_version: "version1-a6-a7-a8-a10-a11-2026-07-20",
  scope: ["A6", "A7", "A8", "A10", "A11"],
  scenario_scope: [
    ...new Set([
      ...(oldInspection.scenario_scope || []),
      ...(oldA8.scenario_scope || []),
    ]),
  ],
  sources: uniqueSources([
    ...oldInspection.sources.map(migrateSource),
    ...oldA8.sources.map(migrateSource),
    ...a11Sources,
    g1Sources.find((source) => source.source_id === "L-RENUMBER-20260719"),
    g1Sources.find((source) => source.source_id === "L-RENUMBER-20260720"),
  ]),
  nodes: migratedNodes,
};

const a9Catalog = {
  ...commonMetadata,
  catalog_id: "jd-variable-tree-a9-resource-management-version1-draft",
  catalog_version: "version1-a9-resource-management-2026-07-20",
  scope: ["A9"],
  scenario_scope: ["cross_scenario"],
  sources: a9Sources,
  nodes: a9Nodes,
};

const allNodes = [
  ...g1Nodes,
  ...migratedInspectionNodes,
  ...a9Nodes,
  ...migratedA11Nodes,
];
const allSources = uniqueSources([
  ...g1Catalog.sources,
  ...migratedCatalog.sources,
  ...a9Catalog.sources,
  ...a11Sources,
]);
const countBy = (key) =>
  allNodes.reduce((counts, node) => {
    const value = node[key] ?? "null";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});

const combinedCatalog = {
  ...commonMetadata,
  catalog_id: "jd-variable-tree-review-version1",
  catalog_version: "review-version1-ability-id-v3-a1-a11-2026-07-20",
  included_catalogs: [
    g1Catalog.catalog_id,
    migratedCatalog.catalog_id,
    a9Catalog.catalog_id,
  ],
  scope: [
    "A1",
    "A2",
    "A3",
    "A4",
    "A5",
    "A6",
    "A7",
    "A8",
    "A9",
    "A10",
    "A11",
  ],
  scenario_scope: [
    "cross_scenario",
    "highway_inspection",
    "campus_inspection",
    "white_wall_narrow_gap",
  ],
  source_count: allSources.length,
  node_count: allNodes.length,
  leaf_count: allNodes.filter((node) => node.node_kind === "variable").length,
  counts_by_owner: countBy("owner_a"),
  counts_by_kind: countBy("node_kind"),
  sources: allSources,
  nodes: allNodes,
  open_questions_document:
    "docs/jd-variable-tree/JD业务变量树_version1_待确认问题与暂定方案.md",
};

writeJson("jd_variable_tree_g1_a1_a5_draft.json", g1Catalog);
writeJson("jd_variable_tree_g2_g3_renumbered_draft.json", migratedCatalog);
writeJson("jd_variable_tree_a9_resource_management_draft.json", a9Catalog);
writeJson("jd_variable_tree_version1.json", combinedCatalog);

console.log(
  [
    "knowledge/jd_variable_tree_g1_a1_a5_draft.json",
    "knowledge/jd_variable_tree_g2_g3_renumbered_draft.json",
    "knowledge/jd_variable_tree_a9_resource_management_draft.json",
    "knowledge/jd_variable_tree_version1.json",
    `${allNodes.length} nodes`,
  ].join("\n"),
);
