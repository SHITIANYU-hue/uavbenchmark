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

const generatedAt = "2026-07-22";
const schemaVersion = "0.4.0";
const nodeSchemaVersion = "jd-tree/0.4.0";
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
  ["A15", "A15"],
  ["A13", "A16"],
  ["A12", "A17"],
].map(([from, to]) => ({ from, to }));

const jdPrefixMap = {
  "5": "6",
  "6a": "7",
  "6b": "8",
  "7": "10",
  "8": "11",
  "9a": "12",
  "9b": "13",
};
const abilityMap = {
  A5: "A6",
  A6a: "A7",
  A6b: "A8",
  A7: "A10",
  A8: "A11",
  A9a: "A12",
  A9b: "A13",
};

function migrateString(value) {
  if (value === "L-A8-V06") return value;
  return value
    .replaceAll("待团队确认", "待确认")
    .replace(
      /jd-(6a|6b|9a|9b|5|7|8)(?=\.|\b)/g,
      (_, prefix) => `jd-${jdPrefixMap[prefix]}`,
    )
    .replace(
      /A(6a|6b|9a|9b|5|7|8)(?=×|\b)/g,
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

function inferVariableRole(nodeKind) {
  if (nodeKind === "variable") return "TBD";
  if (nodeKind === "example_profile") return "example_profile";
  return "structural_group";
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
  migrated.variable_role =
    migrated.variable_role || inferVariableRole(migrated.node_kind);
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
  {
    source_id: "W-MAVLINK-OFFBOARD",
    title: "MAVLink Offboard Control Interface",
    issuer: "MAVLink",
    source_type: "official_protocol_documentation",
    locator:
      "SET_POSITION_TARGET_LOCAL_NED、SET_POSITION_TARGET_GLOBAL_INT、SET_ATTITUDE_TARGET 与能力声明",
    url: "https://mavlink.io/en/services/offboard_control.html",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-MAVLINK-COMMON",
    title: "MAVLink Common Message Set",
    issuer: "MAVLink",
    source_type: "official_protocol_documentation",
    locator:
      "位置、速度、加速度、姿态、角速度、航向、推力目标及其参考系和单位",
    url: "https://mavlink.io/en/messages/common.html",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-PX4-CONTROL-ARCH",
    title: "PX4 Controller Diagrams and Controller Modules",
    issuer: "PX4",
    source_type: "official_platform_documentation",
    locator:
      "多旋翼位置、速度、姿态、角速度级联控制，外环旁路、设定值跟踪与限幅",
    url: "https://docs.px4.io/v1.16/en/modules/modules_controller",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-PX4-CONTROL-ALLOCATOR",
    title: "PX4 ControlAllocatorStatus",
    issuer: "PX4",
    source_type: "official_platform_documentation",
    locator: "执行机构饱和、控制分配状态与已处理电机故障",
    url: "https://docs.px4.io/v1.14/en/msg_docs/ControlAllocatorStatus",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-PX4-CONTROL-TUNING",
    title: "PX4 Multicopter PID Tuning Guide",
    issuer: "PX4",
    source_type: "official_platform_documentation",
    locator: "设定值跟踪、超调、振荡、响应与稳定性观察",
    url: "https://docs.px4.io/v1.12/en/config_mc/pid_tuning_guide_multicopter_basic",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-MOT-UAV-BRIDGE",
    title: "低空无人机应用公路桥梁巡检技术指南（试行）",
    issuer: "交通运输部",
    source_type: "official_guideline",
    locator:
      "交办公路〔2026〕8号；巡检飞行方式、抵近检查、定点定视角、飞行状态与影像质量要求",
    url: "https://xxgk.mot.gov.cn/jigou/glj/202602/P020260228435553861410.pdf",
    evidence_grade: "authoritative_external_scoped",
  },
];

const globalCorrectionSources = [
  {
    source_id: "L-GLOBAL-JD66-V3",
    title: "JD业务变量字典_66槽位_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator:
      "ability-id-v3-2026-07-20：jd-0.1–jd-0.10 canonical 全局定义与 related_a",
    url: null,
    evidence_grade: "authoritative_local",
  },
  {
    source_id: "L-GLOBAL-AXL68-V3",
    title: "AxL责任定义字典_17A_68单元_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator: "ability-id-v3-2026-07-20：A×L 对 jd-0.1–jd-0.10 的责任引用",
    url: null,
    evidence_grade: "authoritative_local",
  },
  {
    source_id: "L-GLOBAL-SCENARIO-REGISTRY",
    title: "knowledge/business_scenario_registry.json",
    issuer: "UAV Benchmark team",
    source_type: "machine_readable_scenario_registry",
    locator: "高速、油田、桥梁、园区等场景对 global JD 的现有绑定与 TBD 口径",
    url: null,
    evidence_grade: "team_material",
  },
  {
    source_id: "L-GLOBAL-TASK-BACKBONE",
    title: "knowledge/task_template_backbone.json",
    issuer: "UAV Benchmark team",
    source_type: "machine_readable_task_contract",
    locator: "任务模板对工作空间和任务完成判据等 global JD 的使用关系",
    url: null,
    evidence_grade: "team_material",
  },
  {
    source_id: "L-GLOBAL-G1-SETUP",
    title: "G1_benchmark_setup.zh.md",
    issuer: "UAV Benchmark team",
    source_type: "team_design",
    locator: "在场人角色、人机确认、任务约束、完成语义和审计关系",
    url: null,
    evidence_grade: "team_material",
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
  const node = {
    schema_version: nodeSchemaVersion,
    node_id: null,
    parent_id: null,
    canonical_slot: null,
    owner_a: null,
    name: null,
    definition: null,
    node_kind: "variable",
    variable_role: "TBD",
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
  if (!overrides.variable_role) {
    node.variable_role = inferVariableRole(node.node_kind);
  }
  return node;
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
      "按 ability-id-v3-2026-07-20 汇总 A1–A11 当前已建设分支，并单列跨能力共享的 JD-global 审阅分支；页面按单项能力或 global 分支切换，不显示组别标题。",
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

const migratedInspectionNodes = oldInspection.nodes
  .map(migrateExistingNode)
  .filter(Boolean)
  .map(normalizeCanonicalNode);

const hiddenInspectionTruthIds = new Set([
  "PROPOSED-jd-6.1.2.4",
  "PROPOSED-jd-7.1.2.5",
  "PROPOSED-jd-7.2.2.2",
  "PROPOSED-jd-8.2.1.3",
  "PROPOSED-jd-10.1.2.2",
  "PROPOSED-jd-10.3.2.1",
]);
for (const node of migratedInspectionNodes) {
  if (!hiddenInspectionTruthIds.has(node.node_id)) continue;
  node.variable_role = "hidden_ground_truth";
  node.configuration_side = "world";
  node.projection_targets = ["world_config", "harness"];
  node.visibility = ["fixture_only", "grader_only", "hidden_gt"];
  node.observation_channel = ["fixture", "grader", "hidden_gt"];
  node.notes = [
    node.notes,
    "本节点表示 Fixture 配置或 Grader 使用的实例真值，不作为 SUT 输入；SUT 只能从传感器、遥测或任务接口获得其可观测表现。",
  ]
    .filter(Boolean)
    .join("\n");
}

const correctionScenarios = [
  "cross_scenario",
  "highway_inspection",
  "campus_inspection",
  "white_wall_narrow_gap",
];
const correctionDomainItem = (
  value,
  label,
  sourceRefs = [],
  status = "inferred_candidate",
  scenarios = correctionScenarios,
) => ({
  value,
  label_zh: label,
  source_refs: sourceRefs,
  status,
  applicable_scenarios: scenarios,
});

// 纹理与局部对比度首先是世界侧可感知性条件。A11 只通过场景 Profile
// 引用这些变量，避免把感知条件重复定义成飞控内在属性。
migratedInspectionNodes.push(
  baseNode({
    node_id: "PROPOSED-jd-6.2.2.6",
    parent_id: "PROPOSED-jd-6.2.2",
    canonical_slot: "jd-6.2",
    owner_a: "A6",
    name: "目标 / 背景表面纹理复杂度",
    definition:
      "目标、障碍物或检查面相对背景的表面纹理复杂程度；用于配置可感知性条件，不等同于控制器能力或观测结果。",
    node_kind: "variable",
    variable_role: "hidden_ground_truth",
    value_type: "enum_or_metric",
    value_domain: [
      correctionDomainItem(
        "none",
        "无明显纹理",
        ["L-A8-V06"],
        "team_material_only",
      ),
      correctionDomainItem(
        "light_texture",
        "轻纹理",
        ["L-A8-V06"],
        "team_material_only",
      ),
      correctionDomainItem(
        "complex_texture",
        "复杂纹理",
        ["L-A8-V06"],
        "team_material_only",
      ),
      correctionDomainItem("TBD", "跨场景度量方法与阈值 TBD", [], "TBD"),
    ],
    multiplicity: "one_per_observed_surface",
    difficulty_direction: "context_dependent",
    configuration_side: "world",
    projection_targets: ["world_config", "harness"],
    visibility: ["fixture_only", "grader_only", "hidden_gt"],
    observation_channel: ["fixture", "grader", "hidden_gt"],
    applicable_scenarios: correctionScenarios,
    related_global_jd: ["jd-0.3"],
    related_jd: ["PROPOSED-jd-11.5.8.1"],
    used_by_axl: ["A6×L1", "A6×L2", "A6×L3", "A6×L4"],
    source: ["L-A8-V06"],
    evidence_status: "inferred_candidate",
    derivation_status: "proposed",
    review_status: "proposed",
    notes:
      "无 / 轻纹理 / 复杂纹理仅来自白墙窄缝 v0.6 团队草案。能否跨高速、园区和其他场景复用，以及客观度量方法，均待确认。",
  }),
  baseNode({
    node_id: "PROPOSED-jd-6.2.2.7",
    parent_id: "PROPOSED-jd-6.2.2",
    canonical_slot: "jd-6.2",
    owner_a: "A6",
    name: "目标 / 开口—背景局部对比度",
    definition:
      "目标、病害、开口或通行空间与其局部背景之间的可辨识对比条件；它是世界侧场景变量，观测后的低对比退化状态仍由 PROPOSED-jd-6.2.2.4 表达。",
    node_kind: "variable",
    variable_role: "hidden_ground_truth",
    value_type: "enum_or_metric",
    value_domain: [
      correctionDomainItem(
        "high",
        "高",
        ["L-A8-V06"],
        "team_material_only",
      ),
      correctionDomainItem(
        "medium",
        "中",
        ["L-A8-V06"],
        "team_material_only",
      ),
      correctionDomainItem(
        "low",
        "低",
        ["L-A8-V06"],
        "team_material_only",
      ),
      correctionDomainItem("TBD", "对比度计算口径与档位阈值 TBD", [], "TBD"),
    ],
    multiplicity: "one_per_target_background_pair",
    difficulty_direction: "decreasing",
    configuration_side: "world",
    projection_targets: ["world_config", "harness"],
    visibility: ["fixture_only", "grader_only", "hidden_gt"],
    observation_channel: ["fixture", "grader", "hidden_gt"],
    applicable_scenarios: correctionScenarios,
    related_global_jd: ["jd-0.3"],
    related_jd: [
      "PROPOSED-jd-6.2.2.4",
      "PROPOSED-jd-11.5.8.2",
    ],
    used_by_axl: ["A6×L1", "A6×L2", "A6×L3", "A6×L4"],
    source: ["L-A8-V06"],
    evidence_status: "inferred_candidate",
    derivation_status: "proposed",
    review_status: "proposed",
    notes:
      "高 / 中 / 低只保留白墙窄缝 v0.6 原始档位；未发明亮度、色差、纹理或传感器域的计算公式与阈值。",
  }),
);

const a11Scenarios = [
  "cross_scenario",
  "highway_inspection",
  "campus_inspection",
];
const a11CanonicalSources = ["L-A11-JD66-V3", "L-A11-AXL68-V3"];

const a11DomainItem = (
  value,
  label,
  sourceRefs,
  status = "source_supported",
  scenarios = a11Scenarios,
) => ({
  value,
  label_zh: label,
  source_refs: sourceRefs,
  status,
  applicable_scenarios: scenarios,
});

const a11Tbd = (label) =>
  a11DomainItem("TBD", label, [], "TBD", a11Scenarios);

const a11Nodes = [
  baseNode({
    node_id: "PROPOSED-jd-tree-A11",
    parent_id: catalogRootId,
    owner_a: "A11",
    name: authoritativeA11Ability.ability,
    definition:
      "描述飞行控制、执行机构、控制质量、控制工作机制与局部控制恢复相关的 JD 业务变量；近障与受限空间条件通过非 canonical 场景 Profile 绑定到正式槽位。",
    node_kind: "capability_root",
    related_global_jd: authoritativeA11Ability.global_jd,
    source: a11CanonicalSources,
    evidence_status: "authoritative_existing",
    derivation_status: "given",
    review_status: "reviewed",
    applicable_scenarios: a11Scenarios,
    configuration_side: "shared",
    projection_targets: [
      "world_config",
      "user_config",
      "sut_input",
      "harness",
    ],
    legacy_aliases: ["PROPOSED-jd-tree-A8"],
    notes:
      "A11 能力根及 jd-11.1、jd-11.2、jd-11.3 以 ability-id-v3 权威字典为准；PROPOSED-jd-11.4 与 PROPOSED-jd-11.5 均不计入当前 66 个 canonical 槽位。",
  }),
];

const a11SlotById = new Map(
  authoritativeA11Slots.map((slot) => [slot.id, slot]),
);
for (const slot of authoritativeA11Slots) {
  a11Nodes.push(
    normalizeCanonicalNode(
      baseNode({
        node_id: slot.id,
        parent_id: "PROPOSED-jd-tree-A11",
        canonical_slot: slot.id,
        owner_a: "A11",
        name: slot.name,
        definition: slot.description,
        node_kind: "group",
        related_global_jd: authoritativeA11Ability.global_jd,
        used_by_axl: levelsUsingSlot(authoritativeA11Ability, slot.id),
        source: a11CanonicalSources,
        evidence_status: "authoritative_existing",
        derivation_status: "given",
        review_status: "reviewed",
        applicable_scenarios: a11Scenarios,
        configuration_side: "shared",
        projection_targets: [
          "user_config",
          "sut_input",
          "harness",
        ],
        notes:
          "canonical 名称与定义取自 ability-id-v3 权威机读源；下级 PROPOSED 节点为巡检类保守归纳。",
      }),
    ),
  );
}

function addA11Group({
  id,
  parent,
  canonical = null,
  name,
  definition,
  relatedJd = [],
  source = a11CanonicalSources,
  configurationSide = "shared",
  projectionTargets = ["user_config", "sut_input", "harness"],
  variableRole = "structural_group",
  visibility = ["sut_visible", "grader_visible"],
  observationChannel = ["sut_input", "sut_trace", "grader"],
  scenarios = a11Scenarios,
  evidenceStatus = "source_supported",
  derivationStatus = "derived",
  notes = null,
}) {
  const slot = canonical ? a11SlotById.get(canonical) : null;
  a11Nodes.push(
    baseNode({
      node_id: id,
      parent_id: parent,
      canonical_slot: canonical,
      owner_a: "A11",
      name,
      definition,
      node_kind: "group",
      variable_role: variableRole,
      related_global_jd: authoritativeA11Ability.global_jd,
      related_jd: relatedJd,
      used_by_axl: slot
        ? levelsUsingSlot(authoritativeA11Ability, slot.id)
        : [],
      source,
      evidence_status: evidenceStatus,
      derivation_status: derivationStatus,
      review_status: "proposed",
      applicable_scenarios: scenarios,
      configuration_side: configurationSide,
      projection_targets: projectionTargets,
      visibility,
      observation_channel: observationChannel,
      notes,
    }),
  );
}

function addA11Leaf({
  id,
  parent,
  canonical = null,
  name,
  definition,
  valueType,
  domain,
  unit = null,
  multiplicity = "one",
  difficulty = "context_dependent",
  activationCondition = null,
  relatedJd = [],
  dependsOn = [],
  constraints = [],
  source = null,
  configurationSide = "shared",
  projectionTargets = ["user_config", "sut_input", "harness"],
  visibility = ["sut_visible", "grader_visible"],
  observationChannel = ["sut_input", "sut_trace", "grader"],
  variableRole = "TBD",
  scenarios = a11Scenarios,
  evidenceStatus = null,
  derivationStatus = null,
  notes = null,
}) {
  const slot = canonical ? a11SlotById.get(canonical) : null;
  const statuses = (domain || [])
    .filter((item) => item && typeof item === "object")
    .map((item) => item.status);
  const allTbd =
    statuses.length > 0 && statuses.every((status) => status === "TBD");
  const domainSources = (domain || [])
    .filter((item) => item && typeof item === "object")
    .flatMap((item) => item.source_refs || []);
  const resolvedEvidence =
    evidenceStatus || (allTbd ? "TBD" : "source_supported");
  const resolvedDerivation =
    derivationStatus ||
    (resolvedEvidence === "TBD"
      ? "TBD"
      : resolvedEvidence === "team_material_only"
        ? "given"
        : resolvedEvidence === "inferred_candidate"
          ? "proposed"
          : "derived");
  const resolvedSources = [
    ...new Set([
      ...(source || a11CanonicalSources),
      ...domainSources,
    ]),
  ];

  a11Nodes.push(
    baseNode({
      node_id: id,
      parent_id: parent,
      canonical_slot: canonical,
      owner_a: "A11",
      name,
      definition,
      node_kind: "variable",
      variable_role: variableRole,
      value_type: valueType,
      value_domain: domain,
      unit,
      activation_condition: activationCondition,
      multiplicity,
      difficulty_direction: difficulty,
      related_global_jd: authoritativeA11Ability.global_jd,
      related_jd: relatedJd,
      used_by_axl: slot
        ? levelsUsingSlot(authoritativeA11Ability, slot.id)
        : [],
      depends_on: dependsOn,
      constraints,
      source: resolvedSources,
      evidence_status: resolvedEvidence,
      derivation_status: resolvedDerivation,
      review_status: "proposed",
      applicable_scenarios: scenarios,
      configuration_side: configurationSide,
      projection_targets: projectionTargets,
      visibility,
      observation_channel: observationChannel,
      notes,
    }),
  );
}

addA11Group({
  id: "PROPOSED-jd-11.1.1",
  parent: "jd-11.1",
  canonical: "jd-11.1",
  name: "跟踪误差要求",
  definition:
    "任务允许的期望控制状态与实际控制状态之间的误差要求；具体数值须由场景、平台和评测方案共同确认。",
  source: [
    ...a11CanonicalSources,
    "W-MAVLINK-COMMON",
    "W-PX4-CONTROL-ARCH",
  ],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.1.1",
  parent: "PROPOSED-jd-11.1.1",
  canonical: "jd-11.1",
  name: "位置误差容忍范围",
  definition:
    "水平与垂向位置设定值相对实际位置的允许误差向量；阈值按巡检阶段分别配置。",
  valueType: "object",
  domain: [a11Tbd("水平 / 垂向位置误差范围 TBD")],
  unit: "m",
  difficulty: "decreasing",
  source: [...a11CanonicalSources, "W-MAVLINK-COMMON"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.1.2",
  parent: "PROPOSED-jd-11.1.1",
  canonical: "jd-11.1",
  name: "速度误差容忍范围",
  definition:
    "水平与垂向速度设定值相对实际速度的允许误差向量；阈值保持 TBD。",
  valueType: "object",
  domain: [a11Tbd("水平 / 垂向速度误差范围 TBD")],
  unit: "m/s",
  difficulty: "decreasing",
  source: [...a11CanonicalSources, "W-MAVLINK-COMMON"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.1.3",
  parent: "PROPOSED-jd-11.1.1",
  canonical: "jd-11.1",
  name: "姿态误差容忍范围",
  definition:
    "横滚与俯仰姿态设定值相对实际姿态的允许误差向量；阈值保持 TBD。",
  valueType: "object",
  domain: [a11Tbd("横滚 / 俯仰误差范围 TBD")],
  unit: "degree_or_rad",
  difficulty: "decreasing",
  source: [...a11CanonicalSources, "W-MAVLINK-COMMON"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.1.4",
  parent: "PROPOSED-jd-11.1.1",
  canonical: "jd-11.1",
  name: "航向误差容忍范围",
  definition:
    "航向或偏航设定值相对实际航向的允许误差；角度表示和阈值保持 TBD。",
  valueType: "number_or_range",
  domain: [a11Tbd("航向 / 偏航误差范围 TBD")],
  unit: "degree_or_rad",
  difficulty: "decreasing",
  source: [...a11CanonicalSources, "W-MAVLINK-COMMON"],
});

addA11Group({
  id: "PROPOSED-jd-11.1.2",
  parent: "jd-11.1",
  canonical: "jd-11.1",
  name: "瞬态与稳定性质量",
  definition:
    "描述控制响应、超调、调节过程、振荡与抖动等质量要求，不预设具体阈值。",
  source: [
    ...a11CanonicalSources,
    "W-PX4-CONTROL-TUNING",
    "W-PX4-CONTROL-ARCH",
  ],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.2.1",
  parent: "PROPOSED-jd-11.1.2",
  canonical: "jd-11.1",
  name: "误差评价方式",
  definition:
    "用于汇总控制误差的评价方式；正式评测窗口、统计量和组合规则待确认。",
  valueType: "enum",
  domain: [
    a11DomainItem("instantaneous_error", "瞬时误差", [
      "W-PX4-CONTROL-TUNING",
    ]),
    a11DomainItem("maximum_absolute_error", "最大绝对误差", [
      "W-PX4-CONTROL-TUNING",
    ]),
    a11DomainItem("rms_error", "均方根误差", [], "inferred_candidate"),
    a11DomainItem("steady_state_error", "稳态误差", [
      "W-PX4-CONTROL-TUNING",
    ]),
    a11Tbd("评价窗口与组合规则 TBD"),
  ],
  source: [...a11CanonicalSources, "W-PX4-CONTROL-TUNING"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.2.2",
  parent: "PROPOSED-jd-11.1.2",
  canonical: "jd-11.1",
  name: "超调容忍范围",
  definition: "设定值变化后的超调允许范围；数值和计算窗口保持 TBD。",
  valueType: "number_or_range",
  domain: [a11Tbd("超调范围与计算窗口 TBD")],
  difficulty: "decreasing",
  source: [...a11CanonicalSources, "W-PX4-CONTROL-TUNING"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.2.3",
  parent: "PROPOSED-jd-11.1.2",
  canonical: "jd-11.1",
  name: "稳定 / 调节时间要求",
  definition:
    "控制状态进入并持续保持在允许范围内所需的时间要求；具体窗口保持 TBD。",
  valueType: "duration_or_range",
  domain: [a11Tbd("稳定判定带、调节时间与持续窗口 TBD")],
  unit: "s",
  difficulty: "decreasing",
  source: [...a11CanonicalSources, "W-PX4-CONTROL-TUNING"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.2.4",
  parent: "PROPOSED-jd-11.1.2",
  canonical: "jd-11.1",
  name: "振荡与抖动容忍范围",
  definition:
    "控制状态振荡、姿态抖动或高频变化的允许程度；频段、幅值和持续时间保持 TBD。",
  valueType: "object",
  domain: [a11Tbd("振荡频段、幅值与持续时间 TBD")],
  difficulty: "decreasing",
  source: [...a11CanonicalSources, "W-PX4-CONTROL-TUNING"],
});

addA11Group({
  id: "PROPOSED-jd-11.1.3",
  parent: "jd-11.1",
  canonical: "jd-11.1",
  name: "控制与执行余量",
  definition:
    "描述执行机构饱和及剩余控制权威，作为控制异常识别和局部恢复的输入。",
  source: [
    ...a11CanonicalSources,
    "W-PX4-CONTROL-ALLOCATOR",
  ],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.3.1",
  parent: "PROPOSED-jd-11.1.3",
  canonical: "jd-11.1",
  name: "执行机构饱和状态",
  definition:
    "执行机构或控制分配是否发生上限、下限或动态速率饱和；正式状态映射待确认。",
  valueType: "enum",
  domain: [
    a11DomainItem("not_saturated", "未饱和", [
      "W-PX4-CONTROL-ALLOCATOR",
    ]),
    a11DomainItem("upper_saturation", "上限饱和", [
      "W-PX4-CONTROL-ALLOCATOR",
    ]),
    a11DomainItem("lower_saturation", "下限饱和", [
      "W-PX4-CONTROL-ALLOCATOR",
    ]),
    a11DomainItem("dynamic_rate_saturation", "动态速率饱和", [
      "W-PX4-CONTROL-ALLOCATOR",
    ]),
    a11DomainItem("unknown", "未知", ["W-PX4-CONTROL-ALLOCATOR"]),
  ],
  difficulty: "context_dependent",
  source: [...a11CanonicalSources, "W-PX4-CONTROL-ALLOCATOR"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.3.2",
  parent: "PROPOSED-jd-11.1.3",
  canonical: "jd-11.1",
  name: "剩余控制权威",
  definition:
    "当前状态下用于继续跟踪或恢复稳定的剩余控制能力；表示方式和阈值保持 TBD。",
  valueType: "object",
  domain: [a11Tbd("控制权威表示、单位和阈值 TBD")],
  difficulty: "decreasing",
  source: [...a11CanonicalSources, "W-PX4-CONTROL-ALLOCATOR"],
});

addA11Group({
  id: "PROPOSED-jd-11.1.4",
  parent: "jd-11.1",
  canonical: "jd-11.1",
  name: "巡检阶段质量 Profile",
  definition:
    "按巡检阶段激活不同控制质量要求；具体阈值由对应场景 Profile 绑定。",
  source: [...a11CanonicalSources, "W-MOT-UAV-BRIDGE"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.1.4.1",
  parent: "PROPOSED-jd-11.1.4",
  canonical: "jd-11.1",
  name: "控制质量激活阶段",
  definition:
    "选择当前控制质量要求适用的巡检作业阶段；阶段名称为跨场景候选。",
  valueType: "multi_enum",
  domain: [
    a11DomainItem("takeoff_or_landing", "起飞 / 降落", [
      "W-MOT-UAV-BRIDGE",
    ]),
    a11DomainItem("route_transit", "航线飞行 / 转场", [
      "W-MOT-UAV-BRIDGE",
    ]),
    a11DomainItem("continuous_scan", "连续扫描", [
      "W-MOT-UAV-BRIDGE",
    ]),
    a11DomainItem("point_fixed_view", "定点定视角", [
      "W-MOT-UAV-BRIDGE",
    ]),
    a11DomainItem("close_range_inspection", "抵近检查", [
      "W-MOT-UAV-BRIDGE",
    ]),
  ],
  difficulty: "non_monotonic",
  source: [...a11CanonicalSources, "W-MOT-UAV-BRIDGE"],
});

addA11Group({
  id: "PROPOSED-jd-11.2.1",
  parent: "jd-11.2",
  canonical: "jd-11.2",
  name: "控制目标与指令层级",
  definition:
    "描述 A11 接收和跟踪的飞控级目标类型、参考系与指令连续性要求。",
  source: [
    ...a11CanonicalSources,
    "W-MAVLINK-OFFBOARD",
    "W-MAVLINK-COMMON",
    "W-PX4-CONTROL-ARCH",
  ],
});
addA11Leaf({
  id: "PROPOSED-jd-11.2.1.1",
  parent: "PROPOSED-jd-11.2.1",
  canonical: "jd-11.2",
  name: "控制目标类型",
  definition:
    "控制器接收的设定值层级；组合支持情况由具体平台能力声明决定。",
  valueType: "multi_enum",
  domain: [
    a11DomainItem("position", "位置", [
      "W-MAVLINK-OFFBOARD",
      "W-MAVLINK-COMMON",
    ]),
    a11DomainItem("velocity", "速度", [
      "W-MAVLINK-OFFBOARD",
      "W-MAVLINK-COMMON",
    ]),
    a11DomainItem("acceleration_or_force", "加速度 / 力", [
      "W-MAVLINK-COMMON",
    ]),
    a11DomainItem("attitude", "姿态", [
      "W-MAVLINK-OFFBOARD",
      "W-MAVLINK-COMMON",
    ]),
    a11DomainItem("body_rate", "机体系角速度", [
      "W-MAVLINK-OFFBOARD",
      "W-MAVLINK-COMMON",
    ]),
    a11DomainItem("thrust", "推力", [
      "W-MAVLINK-OFFBOARD",
      "W-MAVLINK-COMMON",
    ]),
  ],
  difficulty: "non_monotonic",
  source: [
    ...a11CanonicalSources,
    "W-MAVLINK-OFFBOARD",
    "W-MAVLINK-COMMON",
  ],
});
addA11Leaf({
  id: "PROPOSED-jd-11.2.1.2",
  parent: "PROPOSED-jd-11.2.1",
  canonical: "jd-11.2",
  name: "指令参考系",
  definition:
    "控制目标所采用的坐标或机体参考系；需与 A7/A8 的状态估计和相对几何保持一致。",
  valueType: "enum",
  domain: [
    a11DomainItem("local_ned", "局部 NED", ["W-MAVLINK-COMMON"]),
    a11DomainItem("body_frd", "机体系 FRD", ["W-MAVLINK-COMMON"]),
    a11DomainItem("global", "全局坐标参考", ["W-MAVLINK-COMMON"]),
    a11Tbd("其他参考系与转换规则 TBD"),
  ],
  difficulty: "non_monotonic",
  relatedJd: ["jd-7.1", "jd-8.1"],
  source: [...a11CanonicalSources, "W-MAVLINK-COMMON"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.2.1.3",
  parent: "PROPOSED-jd-11.2.1",
  canonical: "jd-11.2",
  name: "指令更新与连续性要求",
  definition:
    "指令更新频率、延迟、丢帧容忍和设定值连续性要求；v0.6 数值不推广，正式范围保持 TBD。",
  valueType: "object",
  domain: [a11Tbd("更新频率、延迟、丢帧和连续性规则 TBD")],
  source: [
    ...a11CanonicalSources,
    "W-MAVLINK-OFFBOARD",
    "L-A8-V06",
  ],
});

addA11Group({
  id: "PROPOSED-jd-11.2.2",
  parent: "jd-11.2",
  canonical: "jd-11.2",
  name: "保持与跟踪模式",
  definition:
    "A11 在当前执行片段内采用的飞控级保持或跟踪模式；任务路径仍由 A10 决定。",
  source: [
    ...a11CanonicalSources,
    "W-PX4-CONTROL-ARCH",
    "W-MAVLINK-OFFBOARD",
  ],
});
addA11Leaf({
  id: "PROPOSED-jd-11.2.2.1",
  parent: "PROPOSED-jd-11.2.2",
  canonical: "jd-11.2",
  name: "控制保持 / 跟踪模式",
  definition:
    "当前片段采用的姿态、高度、位置、速度或轨迹片段保持与跟踪模式。",
  valueType: "multi_enum",
  domain: [
    a11DomainItem("attitude_hold", "姿态保持", [
      "L-A11-AXL68-V3",
      "W-PX4-CONTROL-ARCH",
    ]),
    a11DomainItem("altitude_hold", "高度保持", ["L-A11-AXL68-V3"]),
    a11DomainItem("position_or_hover_hold", "位置 / 悬停保持", [
      "L-A11-AXL68-V3",
      "W-PX4-CONTROL-ARCH",
    ]),
    a11DomainItem("velocity_tracking", "速度跟踪", [
      "L-A11-AXL68-V3",
      "W-PX4-CONTROL-ARCH",
    ]),
    a11DomainItem("trajectory_segment_tracking", "轨迹片段跟踪", [
      "W-PX4-CONTROL-ARCH",
    ]),
    a11DomainItem("offboard_external", "外部 / Offboard 控制", [
      "W-MAVLINK-OFFBOARD",
    ]),
  ],
  difficulty: "non_monotonic",
  relatedJd: ["jd-10.2"],
  source: [
    ...a11CanonicalSources,
    "W-PX4-CONTROL-ARCH",
    "W-MAVLINK-OFFBOARD",
  ],
});

addA11Group({
  id: "PROPOSED-jd-11.2.3",
  parent: "jd-11.2",
  canonical: "jd-11.2",
  name: "控制回路与执行分配",
  definition:
    "控制回路层级、外环旁路和控制分配机制；用于描述可配置或可声明的工作范式。",
  source: [
    ...a11CanonicalSources,
    "W-PX4-CONTROL-ARCH",
    "W-PX4-CONTROL-ALLOCATOR",
  ],
});
addA11Leaf({
  id: "PROPOSED-jd-11.2.3.1",
  parent: "PROPOSED-jd-11.2.3",
  canonical: "jd-11.2",
  name: "控制回路结构",
  definition:
    "控制器使用的外环与内环组合；具体实现可以按控制目标旁路部分外环。",
  valueType: "enum",
  domain: [
    a11DomainItem(
      "cascaded_position_velocity_attitude_rate",
      "位置—速度—姿态—角速度级联",
      ["W-PX4-CONTROL-ARCH"],
    ),
    a11DomainItem("outer_loop_bypassed", "部分外环旁路", [
      "W-PX4-CONTROL-ARCH",
    ]),
    a11Tbd("其他回路结构 TBD"),
  ],
  difficulty: "non_monotonic",
  source: [...a11CanonicalSources, "W-PX4-CONTROL-ARCH"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.2.3.2",
  parent: "PROPOSED-jd-11.2.3",
  canonical: "jd-11.2",
  name: "控制分配机制",
  definition:
    "期望力与力矩到执行机构输出的分配方式；平台支持和参数范围必须由平台资料声明。",
  valueType: "enum",
  domain: [
    a11DomainItem("static_mixer", "静态 Mixer", [
      "W-PX4-CONTROL-ALLOCATOR",
    ]),
    a11DomainItem(
      "effectiveness_matrix_control_allocation",
      "基于效能矩阵的控制分配",
      ["W-PX4-CONTROL-ALLOCATOR"],
    ),
    a11Tbd("其他控制分配机制 TBD"),
  ],
  difficulty: "non_monotonic",
  relatedJd: ["jd-2.2", "jd-9.1"],
  source: [...a11CanonicalSources, "W-PX4-CONTROL-ALLOCATOR"],
});

addA11Group({
  id: "PROPOSED-jd-11.2.4",
  parent: "jd-11.2",
  canonical: "jd-11.2",
  name: "控制器类型声明",
  definition:
    "保留受审 JD 中的控制器家族示例，用作 SUT 声明或 Trace，不默认作为场景难度变量。",
  source: [...a11CanonicalSources, "W-PX4-CONTROL-ARCH"],
  notes:
    "PX4 文档中的 MPC 常指 Multicopter Position Controller；机读枚举使用完整名称 model_predictive_control 避免缩写混淆。",
});
addA11Leaf({
  id: "PROPOSED-jd-11.2.4.1",
  parent: "PROPOSED-jd-11.2.4",
  canonical: "jd-11.2",
  name: "控制器家族",
  definition:
    "SUT 声明的控制器家族；taxonomy 完整性和是否进入 benchmark 分层仍待确认。",
  valueType: "enum",
  domain: [
    a11DomainItem("pid", "PID", [
      "L-A11-JD66-V3",
      "W-PX4-CONTROL-ARCH",
    ]),
    a11DomainItem("model_predictive_control", "Model Predictive Control", [
      "L-A11-JD66-V3",
    ]),
    a11DomainItem("adaptive_control", "自适应控制", [
      "L-A11-JD66-V3",
    ]),
    a11DomainItem("gain_scheduled_control", "增益调度", [
      "L-A11-JD66-V3",
    ]),
    a11DomainItem(
      "reinforcement_learning_controller",
      "RL controller",
      ["L-A11-JD66-V3"],
    ),
    a11DomainItem("other", "其他", [], "inferred_candidate"),
    a11Tbd("正式分类与披露要求 TBD"),
  ],
  difficulty: "neutral",
  source: [...a11CanonicalSources, "W-PX4-CONTROL-ARCH"],
  configurationSide: "TBD",
  projectionTargets: ["sut_input", "harness"],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_trace", "grader"],
  notes:
    "该节点描述 SUT 实现声明，不应默认投影为 world_config 或由 Seed 随机采样。",
});

addA11Group({
  id: "PROPOSED-jd-11.2.5",
  parent: "jd-11.2",
  canonical: "jd-11.2",
  name: "控制输入前提",
  definition:
    "控制模式启用所需的状态估计和执行机构可用性；只保存引用，不复制 A7/A8/A9 的变量。",
  relatedJd: ["jd-7.2", "jd-8.2", "jd-9.1"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.2.5.1",
  parent: "PROPOSED-jd-11.2.5",
  canonical: "jd-11.2",
  name: "所需状态估计引用",
  definition:
    "当前控制目标需要的位置、速度、姿态、航向或相对几何状态引用。",
  valueType: "multi_reference",
  domain: [
    a11DomainItem("absolute_position_state", "绝对位置 / 速度状态", [
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("attitude_and_heading_state", "姿态 / 航向状态", [
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("relative_geometry_state", "相对几何状态", [
      "L-A11-AXL68-V3",
    ]),
    a11Tbd("状态质量前提与失效规则 TBD"),
  ],
  relatedJd: ["jd-7.2", "jd-8.2"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.2.5.2",
  parent: "PROPOSED-jd-11.2.5",
  canonical: "jd-11.2",
  name: "执行机构可用状态",
  definition:
    "执行机构及控制分配对当前控制模式的可用程度；故障分类引用平台与 A9 资源健康状态。",
  valueType: "enum",
  domain: [
    a11DomainItem("available", "可用", ["W-PX4-CONTROL-ALLOCATOR"]),
    a11DomainItem("degraded", "降级可用", [
      "W-PX4-CONTROL-ALLOCATOR",
    ]),
    a11DomainItem("unavailable", "不可用", [
      "W-PX4-CONTROL-ALLOCATOR",
    ]),
    a11DomainItem("unknown", "未知", ["W-PX4-CONTROL-ALLOCATOR"]),
  ],
  difficulty: "decreasing",
  relatedJd: ["jd-2.2", "jd-9.1"],
  source: [...a11CanonicalSources, "W-PX4-CONTROL-ALLOCATOR"],
});

addA11Group({
  id: "PROPOSED-jd-11.3.1",
  parent: "jd-11.3",
  canonical: "jd-11.3",
  name: "控制异常触发",
  definition:
    "按 A11×L3 责任识别需要局部控制处置的异常类别；具体判据引用 jd-11.1。",
  relatedJd: ["jd-11.1", "jd-0.3"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.3.1.1",
  parent: "PROPOSED-jd-11.3.1",
  canonical: "jd-11.3",
  name: "控制异常类别",
  definition:
    "触发局部控制恢复的偏差、饱和、振荡、姿态异常、风扰退化或执行余量下降。",
  valueType: "multi_enum",
  domain: [
    a11DomainItem("sustained_tracking_error", "持续控制误差", [
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("actuator_saturation", "执行机构饱和", [
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("oscillation", "振荡", ["L-A11-AXL68-V3"]),
    a11DomainItem("attitude_anomaly", "姿态异常", [
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("wind_disturbance_degradation", "风扰导致的控制退化", [
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("control_authority_degradation", "执行余量下降", [
      "L-A11-AXL68-V3",
    ]),
  ],
  relatedJd: ["jd-11.1", "jd-0.3"],
});

addA11Group({
  id: "PROPOSED-jd-11.3.2",
  parent: "jd-11.3",
  canonical: "jd-11.3",
  name: "可用局部处置动作",
  definition:
    "当前 JD 下允许由 A11 选择、且不直接改变任务级航路或进入安全态的局部控制动作。",
  relatedJd: ["jd-10.4", "jd-17.2"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.3.2.1",
  parent: "PROPOSED-jd-11.3.2",
  canonical: "jd-11.3",
  name: "局部控制处置动作集",
  definition:
    "处置动作直接继承受审 JD 与 A11×L4；动作参数、组合与优先级仍待确认。",
  valueType: "multi_enum",
  domain: [
    a11DomainItem("reduce_control_aggressiveness", "局部降速 / 降低控制激进度", [
      "L-A11-JD66-V3",
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("increase_control_margin", "增大控制余量", [
      "L-A11-JD66-V3",
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("switch_control_mode", "切换控制模式", [
      "L-A11-JD66-V3",
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("wait_for_stability", "等待稳定", [
      "L-A11-JD66-V3",
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("request_inspection", "请求检查", [
      "L-A11-JD66-V3",
      "L-A11-AXL68-V3",
    ]),
  ],
  difficulty: "non_monotonic",
  relatedJd: ["jd-10.4", "jd-17.2"],
  notes:
    "改变任务速度 Profile、航路或高度属于 A10；返航、迫降或进入 safe state 属于 A17。",
});

addA11Group({
  id: "PROPOSED-jd-11.3.3",
  parent: "jd-11.3",
  canonical: "jd-11.3",
  name: "策略适用条件",
  definition:
    "控制处置动作在任务阶段、当前模式、异常类型和剩余控制权威上的适用范围。",
});
addA11Leaf({
  id: "PROPOSED-jd-11.3.3.1",
  parent: "PROPOSED-jd-11.3.3",
  canonical: "jd-11.3",
  name: "适用任务阶段",
  definition: "策略允许启用的巡检阶段集合。",
  valueType: "multi_reference",
  domain: [
    a11DomainItem("inspection_phase_profile", "引用 jd-11.1.4 巡检阶段", [
      "W-MOT-UAV-BRIDGE",
    ]),
  ],
  dependsOn: ["PROPOSED-jd-11.1.4.1"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.3.3.2",
  parent: "PROPOSED-jd-11.3.3",
  canonical: "jd-11.3",
  name: "适用控制模式",
  definition: "策略允许作用的当前保持或跟踪模式集合。",
  valueType: "multi_reference",
  domain: [
    a11DomainItem("control_mode_profile", "引用 jd-11.2.2 控制模式", [
      "L-A11-AXL68-V3",
    ]),
  ],
  dependsOn: ["PROPOSED-jd-11.2.2.1"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.3.3.3",
  parent: "PROPOSED-jd-11.3.3",
  canonical: "jd-11.3",
  name: "所需剩余控制权威",
  definition:
    "执行策略前必须具备的最低剩余控制权威；表示方式和阈值保持 TBD。",
  valueType: "object",
  domain: [a11Tbd("最低控制权威要求 TBD")],
  dependsOn: ["PROPOSED-jd-11.1.3.2"],
  difficulty: "decreasing",
});

addA11Group({
  id: "PROPOSED-jd-11.3.4",
  parent: "jd-11.3",
  canonical: "jd-11.3",
  name: "模式切换保护",
  definition:
    "控制模式切换的入口、设定值连续性、回退与超时条件；正式状态机保持 TBD。",
});
addA11Leaf({
  id: "PROPOSED-jd-11.3.4.1",
  parent: "PROPOSED-jd-11.3.4",
  canonical: "jd-11.3",
  name: "模式切换保护规则",
  definition:
    "描述切换入口、状态交接、设定值连续性、回退和超时；不得推断具体时限。",
  valueType: "object",
  domain: [a11Tbd("切换入口、连续性、回退与超时规则 TBD")],
});

addA11Group({
  id: "PROPOSED-jd-11.3.5",
  parent: "jd-11.3",
  canonical: "jd-11.3",
  name: "处置后验证与升级",
  definition:
    "验证控制状态是否恢复可信，并在无法局部恢复时升级给其他能力或人工。",
  relatedJd: ["jd-7.2", "jd-9.3", "jd-10.4", "jd-17.2", "jd-0.5"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.3.5.1",
  parent: "PROPOSED-jd-11.3.5",
  canonical: "jd-11.3",
  name: "处置后控制状态",
  definition:
    "处置动作后控制质量、振荡、饱和和控制权威的综合恢复状态；通过标准保持 TBD。",
  valueType: "enum",
  domain: [
    a11DomainItem("recovered", "已恢复", ["L-A11-AXL68-V3"]),
    a11DomainItem("partially_recovered", "部分恢复", [
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("not_recovered", "未恢复", ["L-A11-AXL68-V3"]),
    a11DomainItem("unknown", "无法验证", ["L-A11-AXL68-V3"]),
    a11Tbd("恢复可信判据 TBD"),
  ],
});
addA11Leaf({
  id: "PROPOSED-jd-11.3.5.2",
  parent: "PROPOSED-jd-11.3.5",
  canonical: "jd-11.3",
  name: "跨能力升级目标",
  definition:
    "A11 无法在当前执行片段内恢复控制质量时，将问题升级到定位、资源、航迹、安全或人工确认。",
  valueType: "multi_reference",
  domain: [
    a11DomainItem("A7", "A7 自定位", ["L-A11-AXL68-V3"]),
    a11DomainItem("A9", "A9 健康 / 能源 / 资源管理", [
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("A10", "A10 导航 / 航迹 / 轨迹管理", [
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("A17", "A17 安全包络 / 运行保证", [
      "L-A11-AXL68-V3",
    ]),
    a11DomainItem("jd-0.5", "人机确认协议", ["L-A11-AXL68-V3"]),
  ],
  difficulty: "non_monotonic",
  relatedJd: ["jd-7.2", "jd-9.3", "jd-10.4", "jd-17.2", "jd-0.5"],
});

addA11Group({
  id: "PROPOSED-jd-11.4",
  parent: "PROPOSED-jd-tree-A11",
  name: "当前可执行控制包络",
  definition:
    "描述某个平台、载荷、控制接口和运行状态下可实际执行的控制边界；用于连接 jd-11.1 控制质量、jd-11.2 控制机制、jd-11.3 处置策略与具体场景 Profile。",
  relatedJd: [
    "jd-2.2",
    "jd-0.3",
    "jd-0.9",
    "jd-11.1",
    "jd-11.2",
    "jd-11.3",
    "jd-17.1",
  ],
  source: [
    "L-A8-V06",
    "W-MAVLINK-OFFBOARD",
    "W-MAVLINK-COMMON",
    "W-PX4-CONTROL-ARCH",
    "W-PX4-CONTROL-ALLOCATOR",
  ],
  configurationSide: "shared",
  projectionTargets: [
    "world_config",
    "user_config",
    "sut_input",
    "harness",
  ],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
  notes:
    "该节点用于补齐 A11 的结构空档，但不是当前 66 槽位中的 canonical JD。具体范围、阈值和正式编号均待确认。",
});

addA11Group({
  id: "PROPOSED-jd-11.4.1",
  parent: "PROPOSED-jd-11.4",
  name: "平台与载荷执行基准",
  definition:
    "引用决定控制执行边界的平台静态档案、机体占用空间和当前任务载荷配置，不在 A11 重复保存平台静态参数。",
  relatedJd: ["jd-2.2", "jd-0.9"],
  source: ["L-A8-V06", "W-MOT-UAV-BRIDGE"],
  configurationSide: "shared",
  projectionTargets: ["world_config", "user_config", "harness"],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.1.1",
  parent: "PROPOSED-jd-11.4.1",
  name: "平台档案引用",
  definition:
    "引用 jd-2.2 中的平台类型、尺寸、质量、运动学能力和设计运行域；A11 只读取其对控制执行的约束。",
  valueType: "reference",
  domain: [
    a11DomainItem(
      "jd-2.2",
      "引用平台参数表",
      ["L-A11-JD66-V3"],
      "authoritative_existing",
    ),
  ],
  relatedJd: ["jd-2.2"],
  source: ["L-A11-JD66-V3", "L-A8-V06"],
  configurationSide: "shared",
  projectionTargets: ["world_config", "user_config", "harness"],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.1.2",
  parent: "PROPOSED-jd-11.4.1",
  name: "机体占用空间引用",
  definition:
    "引用机体、旋翼、起落架和外伸部件共同形成的有效占用空间；正式几何表示和来源待确认。",
  valueType: "reference_or_geometry_profile",
  domain: [a11Tbd("机体有效占用空间的引用方式与几何表示 TBD")],
  unit: "m",
  relatedJd: ["jd-2.2", "jd-17.1"],
  source: ["L-A8-V06", "W-MOT-UAV-BRIDGE"],
  configurationSide: "world",
  projectionTargets: ["world_config", "harness"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.1.3",
  parent: "PROPOSED-jd-11.4.1",
  name: "载荷配置引用",
  definition:
    "引用当前任务载荷及其质量、重心、外形和工作状态对控制执行包络的影响。",
  valueType: "reference",
  domain: [
    a11DomainItem(
      "jd-0.9",
      "引用载荷集与当前载荷配置",
      ["L-A11-JD66-V3"],
      "authoritative_existing",
    ),
    a11Tbd("载荷影响字段及其组合规则 TBD"),
  ],
  relatedJd: ["jd-0.9", "jd-2.2"],
  source: ["L-A11-JD66-V3", "W-MOT-UAV-BRIDGE"],
  configurationSide: "shared",
  projectionTargets: ["world_config", "user_config", "harness"],
  difficulty: "context_dependent",
});

addA11Group({
  id: "PROPOSED-jd-11.4.2",
  parent: "PROPOSED-jd-11.4",
  name: "指令接口执行约束",
  definition:
    "描述已选控制目标在接口层的更新、时序、连续性和失效边界；不重复定义 jd-11.2 的控制目标 taxonomy。",
  relatedJd: ["jd-11.2"],
  source: ["L-A8-V06", "W-MAVLINK-OFFBOARD", "W-MAVLINK-COMMON"],
  configurationSide: "shared",
  projectionTargets: ["user_config", "sut_input", "harness"],
  evidenceStatus: "source_supported",
  derivationStatus: "derived",
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.2.1",
  parent: "PROPOSED-jd-11.4.2",
  name: "控制目标引用",
  definition:
    "引用 jd-11.2 下当前启用的位置、速度、加速度 / 力、姿态、角速度或推力控制目标。",
  valueType: "reference",
  domain: [
    a11DomainItem(
      "PROPOSED-jd-11.2.1.1",
      "引用控制目标类型",
      ["W-MAVLINK-OFFBOARD", "W-MAVLINK-COMMON"],
    ),
  ],
  relatedJd: ["jd-11.2"],
  source: ["W-MAVLINK-OFFBOARD", "W-MAVLINK-COMMON"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.2.2",
  parent: "PROPOSED-jd-11.4.2",
  name: "指令更新频率范围",
  definition:
    "控制指令或设定值被接受并持续有效所需的更新频率范围；不得套用白墙示例的固定值。",
  valueType: "number_or_range",
  domain: [a11Tbd("最小、目标与最大更新频率范围 TBD")],
  unit: "Hz",
  difficulty: "context_dependent",
  source: ["L-A8-V06", "W-MAVLINK-OFFBOARD"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.2.3",
  parent: "PROPOSED-jd-11.4.2",
  name: "指令时延与超时边界",
  definition:
    "指令从生成到生效的允许时延、丢更容忍和超时失效边界；具体时限保持 TBD。",
  valueType: "object",
  domain: [a11Tbd("时延、丢更容忍和超时边界 TBD")],
  unit: "ms_or_s",
  difficulty: "decreasing",
  source: ["W-MAVLINK-OFFBOARD"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.2.4",
  parent: "PROPOSED-jd-11.4.2",
  name: "指令连续性要求",
  definition:
    "模式切换或设定值更新过程中，对位置、速度、姿态、推力等指令连续性的要求。",
  valueType: "object",
  domain: [a11Tbd("连续性维度、允许跃变和切换规则 TBD")],
  difficulty: "context_dependent",
  relatedJd: ["jd-11.2", "jd-11.3"],
  source: ["W-MAVLINK-OFFBOARD", "W-MAVLINK-COMMON"],
});

addA11Group({
  id: "PROPOSED-jd-11.4.3",
  parent: "PROPOSED-jd-11.4",
  name: "运动与姿态动态包络",
  definition:
    "描述在当前平台、载荷、模式和环境下允许执行的速度、加速度、姿态与角速度范围。",
  relatedJd: ["jd-2.2", "jd-0.3", "jd-0.9", "jd-11.2", "jd-17.1"],
  source: ["L-A8-V06", "W-MAVLINK-COMMON", "W-PX4-CONTROL-ARCH"],
  configurationSide: "shared",
  projectionTargets: [
    "world_config",
    "user_config",
    "sut_input",
    "harness",
  ],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
});
for (const envelopeLeaf of [
  [
    "PROPOSED-jd-11.4.3.1",
    "水平速度包络",
    "当前条件下可指令和可稳定跟踪的水平速度范围。",
    "m/s",
  ],
  [
    "PROPOSED-jd-11.4.3.2",
    "垂向速度包络",
    "当前条件下可指令和可稳定跟踪的爬升、下降速度范围。",
    "m/s",
  ],
  [
    "PROPOSED-jd-11.4.3.3",
    "加速度 / 减速度包络",
    "当前条件下可指令和可稳定实现的平动加速度与减速度范围。",
    "m/s^2",
  ],
  [
    "PROPOSED-jd-11.4.3.4",
    "姿态角包络",
    "当前条件下可指令和可保持的滚转、俯仰与航向角范围。",
    "degree_or_rad",
  ],
  [
    "PROPOSED-jd-11.4.3.5",
    "角速度包络",
    "当前条件下可指令和可稳定实现的机体系角速度范围。",
    "degree/s_or_rad/s",
  ],
]) {
  addA11Leaf({
    id: envelopeLeaf[0],
    parent: "PROPOSED-jd-11.4.3",
    name: envelopeLeaf[1],
    definition: envelopeLeaf[2],
    valueType: "number_or_range_or_axis_object",
    domain: [a11Tbd(`${envelopeLeaf[1]}的单位、范围和适用条件 TBD`)],
    unit: envelopeLeaf[3],
    difficulty: "context_dependent",
    relatedJd: ["jd-2.2", "jd-11.1", "jd-11.2", "jd-17.1"],
    source: ["L-A8-V06", "W-MAVLINK-COMMON", "W-PX4-CONTROL-ARCH"],
    configurationSide: "shared",
    projectionTargets: [
      "world_config",
      "user_config",
      "sut_input",
      "harness",
    ],
  });
}

addA11Group({
  id: "PROPOSED-jd-11.4.4",
  parent: "PROPOSED-jd-11.4",
  name: "执行机构约束",
  definition:
    "描述执行机构与控制分配在各控制轴上的可用性、限幅、速率和剩余执行能力。",
  relatedJd: ["jd-9.1", "jd-11.1", "jd-11.2"],
  source: ["W-PX4-CONTROL-ALLOCATOR", "W-PX4-CONTROL-ARCH"],
  configurationSide: "world",
  projectionTargets: ["world_config", "sut_input", "harness"],
  evidenceStatus: "source_supported",
  derivationStatus: "derived",
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.4.1",
  parent: "PROPOSED-jd-11.4.4",
  name: "控制轴可用性",
  definition:
    "滚转、俯仰、偏航、升力及平动控制轴当前是否具备有效控制分配能力。",
  valueType: "axis_status_object",
  domain: [
    a11DomainItem("available", "可用", ["W-PX4-CONTROL-ALLOCATOR"]),
    a11DomainItem(
      "partially_available",
      "部分可用",
      ["W-PX4-CONTROL-ALLOCATOR"],
    ),
    a11DomainItem("unavailable", "不可用", ["W-PX4-CONTROL-ALLOCATOR"]),
    a11DomainItem("unknown", "未知", ["W-PX4-CONTROL-ALLOCATOR"]),
  ],
  difficulty: "decreasing",
  relatedJd: ["jd-9.1", "jd-11.1"],
  source: ["W-PX4-CONTROL-ALLOCATOR"],
  configurationSide: "world",
  projectionTargets: ["world_config", "sut_input", "harness"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.4.2",
  parent: "PROPOSED-jd-11.4.4",
  name: "执行机构输出与速率限制",
  definition:
    "各执行机构或控制轴的输出上下限、变化速率和可能的死区；具体参数必须由平台资料给出。",
  valueType: "actuator_limit_object",
  domain: [a11Tbd("输出上下限、变化速率和死区参数 TBD")],
  difficulty: "context_dependent",
  relatedJd: ["jd-2.2", "jd-9.1", "jd-11.1"],
  source: ["W-PX4-CONTROL-ALLOCATOR"],
  configurationSide: "world",
  projectionTargets: ["world_config", "sut_input", "harness"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.4.3",
  parent: "PROPOSED-jd-11.4.4",
  name: "执行余量下限",
  definition:
    "允许继续执行当前控制片段所需的最低剩余执行能力；阈值及其安全含义必须与 A17 联合确认。",
  valueType: "number_range_or_axis_object",
  domain: [a11Tbd("剩余执行能力的表示、下限与判定规则 TBD")],
  difficulty: "decreasing",
  relatedJd: ["jd-11.1", "jd-11.3", "jd-17.1"],
  source: ["W-PX4-CONTROL-ALLOCATOR", "L-A11-AXL68-V3"],
  configurationSide: "shared",
  projectionTargets: [
    "world_config",
    "user_config",
    "sut_input",
    "harness",
  ],
});

addA11Group({
  id: "PROPOSED-jd-11.4.5",
  parent: "PROPOSED-jd-11.4",
  name: "包络修正与适用条件",
  definition:
    "描述环境、载荷、控制模式和任务阶段对基础执行包络的降额、收缩或失效条件。",
  relatedJd: ["jd-0.3", "jd-0.9", "jd-11.2", "jd-11.3", "jd-17.1"],
  source: ["W-PX4-CONTROL-TUNING", "W-MOT-UAV-BRIDGE"],
  configurationSide: "shared",
  projectionTargets: [
    "world_config",
    "user_config",
    "sut_input",
    "harness",
  ],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.5.1",
  parent: "PROPOSED-jd-11.4.5",
  name: "环境扰动修正",
  definition:
    "风、气流和其他扰动对基础速度、姿态、控制余量及跟踪质量包络的修正关系。",
  valueType: "reference_or_rule_object",
  domain: [
    a11DomainItem(
      "jd-0.3",
      "引用扰动谱",
      ["L-A11-JD66-V3"],
      "authoritative_existing",
    ),
    a11Tbd("扰动到包络修正的规则与阈值 TBD"),
  ],
  difficulty: "context_dependent",
  relatedJd: ["jd-0.3", "jd-11.1", "jd-17.1"],
  source: ["L-A11-JD66-V3", "W-PX4-CONTROL-TUNING"],
  configurationSide: "shared",
  projectionTargets: [
    "world_config",
    "user_config",
    "sut_input",
    "harness",
  ],
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.5.2",
  parent: "PROPOSED-jd-11.4.5",
  name: "载荷配置修正",
  definition:
    "载荷质量、重心、外形或工作状态对基础执行包络的修正关系。",
  valueType: "reference_or_rule_object",
  domain: [
    a11DomainItem(
      "jd-0.9",
      "引用当前载荷配置",
      ["L-A11-JD66-V3"],
      "authoritative_existing",
    ),
    a11Tbd("载荷到包络修正的规则与阈值 TBD"),
  ],
  difficulty: "context_dependent",
  relatedJd: ["jd-0.9", "jd-11.1"],
  source: ["L-A11-JD66-V3", "W-MOT-UAV-BRIDGE"],
  configurationSide: "shared",
  projectionTargets: [
    "world_config",
    "user_config",
    "sut_input",
    "harness",
  ],
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.5.3",
  parent: "PROPOSED-jd-11.4.5",
  name: "控制模式修正",
  definition:
    "不同保持、跟踪或降级模式对可用控制目标、动态包络和执行余量的修正关系。",
  valueType: "reference_or_rule_object",
  domain: [
    a11DomainItem(
      "PROPOSED-jd-11.2.2.1",
      "引用控制保持 / 跟踪模式",
      ["W-PX4-CONTROL-ARCH"],
    ),
    a11Tbd("模式到包络修正的规则 TBD"),
  ],
  difficulty: "context_dependent",
  relatedJd: ["jd-11.2", "jd-11.3"],
  source: ["W-PX4-CONTROL-ARCH"],
});
addA11Leaf({
  id: "PROPOSED-jd-11.4.5.4",
  parent: "PROPOSED-jd-11.4.5",
  name: "任务阶段适用性",
  definition:
    "执行包络在起降、航路转场、连续扫描、定点观测和抵近检查阶段的适用范围。",
  valueType: "reference_or_multi_enum",
  domain: [
    a11DomainItem(
      "PROPOSED-jd-11.1.4.1",
      "引用控制质量激活阶段",
      ["W-MOT-UAV-BRIDGE"],
    ),
    a11Tbd("阶段专用包络与切换条件 TBD"),
  ],
  difficulty: "non_monotonic",
  relatedJd: ["jd-10.1", "jd-11.1", "jd-11.3"],
  source: ["W-MOT-UAV-BRIDGE"],
});

addA11Group({
  id: "PROPOSED-jd-11.5",
  parent: "PROPOSED-jd-tree-A11",
  name: "近障 / 受限空间控制场景 Profile",
  definition:
    "将障碍物、通行空间、布局、动态性和遭遇关系抽象为跨巡检场景可复用的控制压力 Profile；该分支不是当前 66 槽位中的 canonical JD。",
  relatedJd: [
    "jd-8.1",
    "jd-10.1",
    "jd-11.1",
    "jd-11.2",
    "jd-11.3",
    "PROPOSED-jd-11.4",
    "jd-17.1",
  ],
  source: ["L-A8-V06", "W-MOT-UAV-BRIDGE"],
  configurationSide: "world",
  projectionTargets: ["world_config", "harness"],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
  notes:
    "白墙窄缝 v0.6 已降为本 Profile 的示例；是否将 jd-11.5 正式纳入 JD 字典仍待确认。",
});

const profileGroups = [
  [
    "PROPOSED-jd-11.5.1",
    "障碍物几何",
    "障碍物本体的形态、尺寸与边缘规则性。",
  ],
  [
    "PROPOSED-jd-11.5.2",
    "通行空间几何",
    "障碍物之间或内部可供通过、抵近或观察的净空间。",
  ],
  [
    "PROPOSED-jd-11.5.3",
    "障碍物布局",
    "多个障碍物之间的数量、间距、角度、对齐和拓扑关系。",
  ],
  [
    "PROPOSED-jd-11.5.4",
    "障碍物动态性",
    "障碍物的运动状态、速度、方向、模式与可预测性。",
  ],
  [
    "PROPOSED-jd-11.5.5",
    "遭遇与通过关系",
    "巡检任务相对障碍物的绕行、穿越、沿面、抵近或定点观察关系。",
  ],
  [
    "PROPOSED-jd-11.5.6",
    "控制压力派生量",
    "由世界几何、平台包络和任务关系推导的通行余量与响应窗口。",
  ],
  [
    "PROPOSED-jd-11.5.7",
    "A11 控制要求绑定",
    "将场景 Profile 投影到 jd-11.1、jd-11.2、jd-11.3、PROPOSED-jd-11.4，并引用 A17 安全边界。",
  ],
  [
    "PROPOSED-jd-11.5.8",
    "外观与可感知性 Profile 引用",
    "引用 A6 的表面纹理与局部对比变量，以及 jd-0.3 的光学基线和动态光线扰动；A11 不重复定义感知变量。",
  ],
];
for (const [id, name, definition] of profileGroups) {
  addA11Group({
    id,
    parent: "PROPOSED-jd-11.5",
    name,
    definition,
    relatedJd:
      id === "PROPOSED-jd-11.5.7"
        ? [
            "jd-11.1",
            "jd-11.2",
            "jd-11.3",
            "PROPOSED-jd-11.4",
            "jd-17.1",
          ]
        : [],
    source: ["L-A8-V06", "W-MOT-UAV-BRIDGE"],
    configurationSide: "world",
    projectionTargets: ["world_config", "harness"],
    evidenceStatus: "inferred_candidate",
    derivationStatus: "proposed",
  });
}

const profileLeaf = (spec) =>
  addA11Leaf({
    ...spec,
    variableRole: spec.variableRole ?? "hidden_ground_truth",
    configurationSide: spec.configurationSide ?? "world",
    projectionTargets: spec.projectionTargets ?? [
      "world_config",
      "harness",
    ],
    visibility: spec.visibility ?? [
      "fixture_only",
      "grader_only",
      "hidden_gt",
    ],
    observationChannel: spec.observationChannel ?? [
      "fixture",
      "grader",
      "hidden_gt",
    ],
    evidenceStatus: spec.evidenceStatus || "inferred_candidate",
    derivationStatus: spec.derivationStatus || "proposed",
    source: spec.source || ["L-A8-V06", "W-MOT-UAV-BRIDGE"],
  });

profileLeaf({
  id: "PROPOSED-jd-11.5.1.1",
  parent: "PROPOSED-jd-11.5.1",
  name: "障碍物形态",
  definition: "障碍物本体的几何形态类别；正式 taxonomy 待巡检场景研究确认。",
  valueType: "enum",
  domain: [
    a11DomainItem("planar_surface", "面状结构", ["L-A8-V06"]),
    a11DomainItem("linear_structure", "线状结构", [], "inferred_candidate"),
    a11DomainItem("volumetric_object", "体状物体", [], "inferred_candidate"),
    a11DomainItem("irregular_object", "不规则物体", [], "inferred_candidate"),
    a11Tbd("其他形态 TBD"),
  ],
});
profileLeaf({
  id: "PROPOSED-jd-11.5.1.2",
  parent: "PROPOSED-jd-11.5.1",
  name: "障碍物尺寸向量",
  definition: "障碍物的高度、宽度与纵深；单位和数值必须来自世界配置。",
  valueType: "vector3_or_object",
  domain: [a11Tbd("高度、宽度与纵深范围 TBD")],
  unit: "m",
  difficulty: "context_dependent",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.1.3",
  parent: "PROPOSED-jd-11.5.1",
  name: "边缘规则性",
  definition: "障碍物边缘和轮廓是否规则、混合或不规则。",
  valueType: "enum",
  domain: [
    a11DomainItem("regular", "规则", ["L-A8-V06"]),
    a11DomainItem("mixed", "混合", [], "inferred_candidate"),
    a11DomainItem("irregular", "不规则", [], "inferred_candidate"),
    a11Tbd("正式档位 TBD"),
  ],
});

profileLeaf({
  id: "PROPOSED-jd-11.5.2.1",
  parent: "PROPOSED-jd-11.5.2",
  name: "通行空间类型",
  definition: "任务需要穿越、沿行或抵近的可用空间类型。",
  valueType: "enum",
  domain: [
    a11DomainItem("open_gap", "开放间隙", ["L-A8-V06"]),
    a11DomainItem("aperture", "孔洞 / 开口", ["L-A8-V06"]),
    a11DomainItem("narrow_corridor", "狭窄通道", [], "inferred_candidate"),
    a11DomainItem("structural_clearance", "结构间隙", [
      "W-MOT-UAV-BRIDGE",
    ]),
    a11DomainItem("above_or_below_clearance", "上方 / 下方净空", [
      "W-MOT-UAV-BRIDGE",
    ]),
    a11Tbd("其他空间类型 TBD"),
  ],
  difficulty: "non_monotonic",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.2.2",
  parent: "PROPOSED-jd-11.5.2",
  name: "通行空间尺寸向量",
  definition: "可用通行空间的净宽、净高与纵深。",
  valueType: "vector3_or_object",
  domain: [a11Tbd("净宽、净高与纵深范围 TBD")],
  unit: "m",
  difficulty: "decreasing",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.2.3",
  parent: "PROPOSED-jd-11.5.2",
  name: "通行空间偏移",
  definition: "开口或通道相对障碍物、任务目标或参考中心的横向与垂向偏移。",
  valueType: "vector2_or_object",
  domain: [a11Tbd("横向 / 垂向偏移范围 TBD")],
  unit: "m",
  difficulty: "context_dependent",
  relatedJd: ["jd-8.1"],
});
profileLeaf({
  id: "PROPOSED-jd-11.5.2.4",
  parent: "PROPOSED-jd-11.5.2",
  name: "通行截面形状",
  definition: "通行空间截面的几何形状。",
  valueType: "enum",
  domain: [
    a11DomainItem("rectangular", "矩形", ["L-A8-V06"]),
    a11DomainItem("circular", "圆形", [], "inferred_candidate"),
    a11DomainItem("irregular", "不规则", [], "inferred_candidate"),
    a11Tbd("其他截面形状 TBD"),
  ],
});
profileLeaf({
  id: "PROPOSED-jd-11.5.2.5",
  parent: "PROPOSED-jd-11.5.2",
  name: "通行空间数量",
  definition:
    "同一宿主障碍物或当前局部场景中可被引用的通行空间实例数量。",
  valueType: "integer_or_range",
  domain: [
    a11DomainItem(1, "1", ["L-A8-V06"], "team_material_only"),
    a11DomainItem(2, "2", ["L-A8-V06"], "team_material_only"),
    a11DomainItem(3, "3", ["L-A8-V06"], "team_material_only"),
    a11Tbd("跨场景数量范围与上限 TBD"),
  ],
  difficulty: "context_dependent",
  notes:
    "1 / 2 / 3 来自白墙窄缝 v0.6 的缝数档位，只是已给示例值，不是跨场景通用上限。",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.2.6",
  parent: "PROPOSED-jd-11.5.2",
  name: "通行空间实例集合",
  definition:
    "由稳定实例 ID、所属障碍物、空间类型、尺寸、形状与偏移组成的通行空间列表；允许同一墙体或结构包含多个孔洞 / 缝隙。",
  valueType: "array_of_reference_objects",
  domain: [a11Tbd("实例对象 schema、唯一 ID 规则与数量上限 TBD")],
  multiplicity: "many",
  difficulty: "context_dependent",
  dependsOn: ["PROPOSED-jd-11.5.2.5"],
  constraints: [
    {
      rule: "collection_length_matches_count",
      count_node: "PROPOSED-jd-11.5.2.5",
      status: "proposed",
    },
  ],
  notes:
    "本节点抽象 v0.6 的“一墙多缝 + 列表值”方法，但不直接规定 simulator 字段。",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.2.7",
  parent: "PROPOSED-jd-11.5.2",
  name: "同一障碍物内排列",
  definition:
    "同一宿主障碍物内多个通行空间的相对排列关系；仅在通行空间数量不少于 2 时启用。",
  valueType: "enum",
  domain: [
    a11DomainItem(
      "horizontal",
      "并排（横向）",
      ["L-A8-V06"],
      "team_material_only",
    ),
    a11DomainItem(
      "vertical",
      "上下（纵向）",
      ["L-A8-V06"],
      "team_material_only",
    ),
    a11DomainItem(
      "mixed",
      "混合",
      ["L-A8-V06"],
      "team_material_only",
    ),
    a11Tbd("跨场景排列 taxonomy TBD"),
  ],
  activationCondition: {
    node: "PROPOSED-jd-11.5.2.5",
    operator: "greater_than_or_equal",
    value: 2,
  },
  difficulty: "non_monotonic",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.2.8",
  parent: "PROPOSED-jd-11.5.2",
  name: "同一障碍物内通行空间间距",
  definition:
    "同一宿主障碍物内多个通行空间之间的距离或距离集合；仅在通行空间数量不少于 2 时启用。",
  valueType: "number_range_or_enum",
  domain: [
    a11DomainItem("large", "大", ["L-A8-V06"], "team_material_only"),
    a11DomainItem("medium", "中", ["L-A8-V06"], "team_material_only"),
    a11DomainItem("near", "近", ["L-A8-V06"], "team_material_only"),
    a11Tbd("距离定义、单位与档位阈值 TBD"),
  ],
  unit: "m_or_normalized_TBD",
  activationCondition: {
    node: "PROPOSED-jd-11.5.2.5",
    operator: "greater_than_or_equal",
    value: 2,
  },
  difficulty: "context_dependent",
});

profileLeaf({
  id: "PROPOSED-jd-11.5.3.1",
  parent: "PROPOSED-jd-11.5.3",
  name: "障碍物数量",
  definition: "当前控制压力 Profile 涉及的障碍物实例数量。",
  valueType: "integer_or_range",
  domain: [a11Tbd("数量范围与上限 TBD")],
  difficulty: "increasing",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.3.2",
  parent: "PROPOSED-jd-11.5.3",
  name: "障碍物间距",
  definition: "连续障碍物之间的空间距离。",
  valueType: "number_or_range",
  domain: [a11Tbd("障碍物间距范围 TBD")],
  unit: "m",
  difficulty: "decreasing",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.3.3",
  parent: "PROPOSED-jd-11.5.3",
  name: "相对摆放角度",
  definition: "障碍物相对任务运动方向或前一障碍物的摆放角度。",
  valueType: "number_or_range",
  domain: [a11Tbd("角度范围与参考方向 TBD")],
  unit: "degree_or_rad",
  difficulty: "context_dependent",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.3.4",
  parent: "PROPOSED-jd-11.5.3",
  name: "通行空间对齐关系",
  definition: "多个通行空间之间的对齐或错位关系。",
  valueType: "enum",
  domain: [
    a11DomainItem("aligned", "对齐", ["L-A8-V06"]),
    a11DomainItem("partially_staggered", "部分错开", ["L-A8-V06"]),
    a11DomainItem("staggered", "错开", ["L-A8-V06"]),
    a11Tbd("正式对齐 taxonomy TBD"),
  ],
  difficulty: "increasing",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.3.5",
  parent: "PROPOSED-jd-11.5.3",
  name: "排列拓扑",
  definition: "多个障碍物构成的空间排列拓扑。",
  valueType: "enum",
  domain: [
    a11DomainItem("linear", "直线", ["L-A8-V06"]),
    a11DomainItem("fan", "扇形", ["L-A8-V06"]),
    a11DomainItem("staggered", "错位", ["L-A8-V06"]),
    a11DomainItem("grid", "网格", ["L-A8-V06"]),
    a11Tbd("其他拓扑 TBD"),
  ],
  difficulty: "non_monotonic",
});

profileLeaf({
  id: "PROPOSED-jd-11.5.4.1",
  parent: "PROPOSED-jd-11.5.4",
  name: "障碍物运动状态",
  definition: "障碍物是静止、运动还是当前状态未知。",
  valueType: "enum",
  domain: [
    a11DomainItem("static", "静止", ["L-A8-V06"]),
    a11DomainItem("moving", "运动", ["L-A8-V06"]),
    a11DomainItem("unknown", "未知", [], "inferred_candidate"),
  ],
  difficulty: "increasing",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.4.2",
  parent: "PROPOSED-jd-11.5.4",
  name: "障碍物速度向量",
  definition: "运动障碍物的速度大小和方向；仅在运动状态启用。",
  valueType: "vector3_or_object",
  domain: [a11Tbd("速度向量范围与参考系 TBD")],
  unit: "m/s",
  activationCondition: {
    node: "PROPOSED-jd-11.5.4.1",
    operator: "equals",
    value: "moving",
  },
  difficulty: "context_dependent",
  relatedJd: ["jd-8.1"],
});
profileLeaf({
  id: "PROPOSED-jd-11.5.4.3",
  parent: "PROPOSED-jd-11.5.4",
  name: "运动模式",
  definition: "运动障碍物的时间变化模式；白墙草案只提供部分实例。",
  valueType: "enum",
  domain: [
    a11DomainItem("constant_velocity", "匀速", ["L-A8-V06"]),
    a11DomainItem("reciprocating", "往复", ["L-A8-V06"]),
    a11DomainItem("stochastic", "随机", ["L-A8-V06"]),
    a11Tbd("其他运动模式 TBD"),
  ],
  activationCondition: {
    node: "PROPOSED-jd-11.5.4.1",
    operator: "equals",
    value: "moving",
  },
  difficulty: "non_monotonic",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.4.4",
  parent: "PROPOSED-jd-11.5.4",
  name: "运动可预测性",
  definition: "障碍物未来运动对 SUT 是否可预测及预测依据的可用程度。",
  valueType: "enum",
  domain: [
    a11DomainItem("predictable", "可预测", [], "inferred_candidate"),
    a11DomainItem(
      "partially_predictable",
      "部分可预测",
      [],
      "inferred_candidate",
    ),
    a11DomainItem("unpredictable", "不可预测", [], "inferred_candidate"),
    a11Tbd("正式预测性定义 TBD"),
  ],
  difficulty: "decreasing",
});

profileLeaf({
  id: "PROPOSED-jd-11.5.5.1",
  parent: "PROPOSED-jd-11.5.5",
  name: "任务—障碍物关系",
  definition: "任务要求相对障碍物采取的空间关系。",
  valueType: "enum",
  domain: [
    a11DomainItem("bypass", "绕行", [], "inferred_candidate"),
    a11DomainItem("traverse", "穿越", ["L-A8-V06"]),
    a11DomainItem("along_surface", "沿面飞行", [
      "W-MOT-UAV-BRIDGE",
    ]),
    a11DomainItem("close_approach", "抵近观察", [
      "W-MOT-UAV-BRIDGE",
    ]),
    a11DomainItem("fixed_hover", "定点悬停 / 定视角", [
      "W-MOT-UAV-BRIDGE",
    ]),
  ],
  difficulty: "non_monotonic",
  relatedJd: ["jd-10.1", "jd-10.2"],
  variableRole: "contract_schema",
  configurationSide: "user",
  projectionTargets: ["user_config", "sut_input", "harness"],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_input", "grader"],
});
profileLeaf({
  id: "PROPOSED-jd-11.5.5.2",
  parent: "PROPOSED-jd-11.5.5",
  name: "接近关系",
  definition: "无人机相对目标障碍物或通行空间的接近方向、相对速度与相对航向。",
  valueType: "object",
  domain: [a11Tbd("接近方向、相对速度与相对航向范围 TBD")],
  relatedJd: ["jd-8.1"],
  difficulty: "context_dependent",
});
profileLeaf({
  id: "PROPOSED-jd-11.5.5.3",
  parent: "PROPOSED-jd-11.5.5",
  name: "目标通行空间",
  definition: "任务指定需要通过、沿行或抵近的通行空间实例引用。",
  valueType: "reference",
  domain: [a11Tbd("目标实例 ID 与选择规则 TBD")],
  relatedJd: ["jd-10.1", "jd-10.2"],
  dependsOn: ["PROPOSED-jd-11.5.2.6"],
  variableRole: "contract_schema",
  configurationSide: "user",
  projectionTargets: ["user_config", "sut_input", "harness"],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_input", "grader"],
});
profileLeaf({
  id: "PROPOSED-jd-11.5.5.4",
  parent: "PROPOSED-jd-11.5.5",
  name: "载荷朝向保持要求",
  definition: "近障控制过程中需要保持的相机或任务载荷朝向关系。",
  valueType: "object",
  domain: [a11Tbd("载荷朝向、容差与启用阶段 TBD")],
  relatedJd: ["jd-8.1"],
  source: ["W-MOT-UAV-BRIDGE"],
  variableRole: "contract_schema",
  configurationSide: "shared",
  projectionTargets: [
    "user_config",
    "world_config",
    "sut_input",
    "harness",
  ],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_input", "sut_trace", "grader"],
});

profileLeaf({
  id: "PROPOSED-jd-11.5.6.1",
  parent: "PROPOSED-jd-11.5.6",
  name: "有效通行空间",
  definition:
    "根据通行空间尺寸、障碍物角度和布局推导的有效净宽与净高；公式与阈值保持 TBD。",
  valueType: "derived_object",
  domain: [a11Tbd("有效净宽 / 净高公式与范围 TBD")],
  unit: "m",
  variableRole: "derived_metric",
  visibility: ["grader_only", "hidden_gt"],
  observationChannel: ["grader", "hidden_gt"],
  difficulty: "decreasing",
  dependsOn: [
    "PROPOSED-jd-11.5.2.2",
    "PROPOSED-jd-11.5.3.3",
    "PROPOSED-jd-11.5.3.4",
  ],
});
profileLeaf({
  id: "PROPOSED-jd-11.5.6.2",
  parent: "PROPOSED-jd-11.5.6",
  name: "剩余几何余量",
  definition:
    "有效通行空间扣除平台执行包络和附加安全裕度后的剩余几何余量。",
  valueType: "derived_object",
  domain: [a11Tbd("平台包络、安全裕度、公式和阈值 TBD")],
  unit: "m",
  variableRole: "derived_metric",
  visibility: ["grader_only", "hidden_gt"],
  observationChannel: ["grader", "hidden_gt"],
  difficulty: "decreasing",
  relatedJd: [
    "jd-2.2",
    "jd-0.9",
    "PROPOSED-jd-11.4",
    "jd-17.1",
  ],
  dependsOn: ["PROPOSED-jd-11.5.6.1"],
});
profileLeaf({
  id: "PROPOSED-jd-11.5.6.3",
  parent: "PROPOSED-jd-11.5.6",
  name: "控制响应窗口",
  definition:
    "由相对运动、剩余距离和任务关系推导的局部控制响应时间窗口；公式保持 TBD。",
  valueType: "derived_object",
  domain: [a11Tbd("响应窗口公式、单位和阈值 TBD")],
  unit: "s",
  variableRole: "derived_metric",
  visibility: ["grader_only", "hidden_gt"],
  observationChannel: ["grader", "hidden_gt"],
  difficulty: "decreasing",
  relatedJd: ["jd-8.1", "jd-11.1"],
  dependsOn: [
    "PROPOSED-jd-11.5.4.2",
    "PROPOSED-jd-11.5.5.2",
  ],
});

for (const binding of [
  [
    "PROPOSED-jd-11.5.7.1",
    "控制质量 Profile 引用",
    "jd-11.1",
    "选择本场景启用的误差、稳定性、振荡和控制余量要求。",
  ],
  [
    "PROPOSED-jd-11.5.7.2",
    "控制机制 Profile 引用",
    "jd-11.2",
    "选择本场景允许或要求的控制目标、模式和输入前提。",
  ],
  [
    "PROPOSED-jd-11.5.7.3",
    "控制策略 Profile 引用",
    "jd-11.3",
    "选择本场景允许的局部控制异常处置和恢复验证规则。",
  ],
  [
    "PROPOSED-jd-11.5.7.4",
    "安全包络引用",
    "jd-17.1",
    "引用 A17 分相位安全阈值；A11 不在本分支重复定义安全态。",
  ],
  [
    "PROPOSED-jd-11.5.7.5",
    "控制执行包络 Profile 引用",
    "PROPOSED-jd-11.4",
    "选择本场景适用的平台、指令接口、动态包络、执行机构约束和包络修正规则。",
  ],
]) {
  profileLeaf({
    id: binding[0],
    parent: "PROPOSED-jd-11.5.7",
    name: binding[1],
    definition: binding[3],
    valueType: "reference",
    domain: [
      a11DomainItem(
        binding[2],
        `引用 ${binding[2]}`,
        binding[2].startsWith("jd-11")
          ? a11CanonicalSources
          : [],
        binding[2].startsWith("jd-11")
          ? "authoritative_existing"
          : "inferred_candidate",
      ),
    ],
    relatedJd: [binding[2]],
    variableRole: "contract_schema",
    configurationSide: "shared",
    projectionTargets: [
      "world_config",
      "user_config",
      "sut_input",
      "harness",
    ],
    visibility: ["sut_visible", "grader_visible"],
    observationChannel: ["sut_input", "sut_trace", "grader"],
  });
}

for (const appearanceBinding of [
  [
    "PROPOSED-jd-11.5.8.1",
    "表面纹理条件引用",
    "PROPOSED-jd-6.2.2.6",
    "引用 A6 的目标 / 背景表面纹理复杂度；A11 只消费该条件形成控制场景 Profile。",
  ],
  [
    "PROPOSED-jd-11.5.8.2",
    "局部对比条件引用",
    "PROPOSED-jd-6.2.2.7",
    "引用 A6 的目标 / 开口—背景局部对比度；A11 不复制感知退化 taxonomy。",
  ],
  [
    "PROPOSED-jd-11.5.8.3",
    "光学基线与动态光线扰动引用",
    "PROPOSED-jd-0.3.3",
    "引用 jd-0.3 下的静态光照基线与动态光线扰动，并保持两者分别启用。",
  ],
]) {
  profileLeaf({
    id: appearanceBinding[0],
    parent: "PROPOSED-jd-11.5.8",
    name: appearanceBinding[1],
    definition: appearanceBinding[3],
    valueType: "reference",
    domain: [
      a11DomainItem(
        appearanceBinding[2],
        `引用 ${appearanceBinding[2]}`,
        ["L-A8-V06"],
        "inferred_candidate",
      ),
    ],
    relatedJd: [appearanceBinding[2]],
    configurationSide: "world",
    projectionTargets: ["world_config", "harness"],
    source: ["L-A8-V06"],
  });
}

const oldA8NodeById = new Map(
  oldA8.nodes.map((node) => [node.node_id, node]),
);
function oldA8NodePath(node) {
  const names = [];
  let current = node;
  while (current && current.node_id !== "PROPOSED-jd-tree-A8") {
    names.unshift(current.name);
    current = oldA8NodeById.get(current.parent_id);
  }
  return names.join(" / ");
}

const whiteWallExampleBindings = oldA8.nodes
  .filter((node) => node.node_kind === "variable")
  .map((node) => ({
    source_node_id: node.node_id,
    path: oldA8NodePath(node),
    value_type: node.value_type,
    value_domain: node.value_domain,
    unit: node.unit,
    activation_condition: node.activation_condition,
  }));

a11Nodes.push(
  baseNode({
    node_id: "CASE-jd-11.5-white-wall-v0.6",
    parent_id: "PROPOSED-jd-11.5",
    canonical_slot: null,
    owner_a: "A11",
    name: "白墙窄缝草案 v0.6 示例",
    definition:
      "需求草案 v0.6 的白墙、缝、布局、运动和平台基准原始内容；作为 PROPOSED-jd-11.5 的具体实例保留，不代表跨巡检场景的通用取值。",
    node_kind: "example_profile",
    variable_role: "example_profile",
    value_type: "example_profile",
    value_domain: [
      a11DomainItem(
        "white_wall_narrow_gap_v0_6",
        "白墙窄缝穿越 v0.6",
        ["L-A8-V06"],
        "team_material_only",
        ["white_wall_narrow_gap"],
      ),
    ],
    configuration_side: "world",
    projection_targets: ["world_config", "harness"],
    visibility: ["fixture_only", "grader_only", "hidden_gt"],
    observation_channel: ["fixture", "grader", "hidden_gt"],
    applicable_scenarios: ["white_wall_narrow_gap"],
    related_global_jd: [],
    related_jd: [
      "PROPOSED-jd-11.4",
      "PROPOSED-jd-11.5.1",
      "PROPOSED-jd-11.5.2",
      "PROPOSED-jd-11.5.3",
      "PROPOSED-jd-11.5.4",
      "PROPOSED-jd-11.5.5",
      "PROPOSED-jd-11.5.6",
      "PROPOSED-jd-11.5.7",
      "PROPOSED-jd-11.5.8",
    ],
    used_by_axl: ["A11×L3", "A11×L4"],
    source: ["L-A8-V06"],
    evidence_status: "team_material_only",
    derivation_status: "given",
    review_status: "proposed",
    legacy_aliases: ["jd-8.5", "PROPOSED-jd-11.5-white-wall-v0.6"],
    notes:
      "所有原始数值和枚举来自需求草案 v0.6；原控制接口、控制约束和执行包络现作为 PROPOSED-jd-11.4 的示例输入保留，未将其提升为正式阈值、通用 taxonomy 或 simulator 接口。",
    example_bindings: whiteWallExampleBindings,
  }),
);

const globalCanonicalVariables = currentJdDictionary.variables.filter(
  (variable) => variable.scope === "global",
);
const globalCanonicalIds = globalCanonicalVariables.map(
  (variable) => variable.id,
);
const axlRefsUsingGlobal = (globalId) =>
  currentAxlCatalog.abilities.flatMap((ability) =>
    Object.entries(ability.levels)
      .filter(([, level]) => (level.jd_refs || []).includes(globalId))
      .map(([level]) => `${ability.a_id}×${level}`),
  );
const globalScenarios = [
  "cross_scenario",
  "highway_inspection",
  "campus_inspection",
  "white_wall_narrow_gap",
];
const globalDomainItem = (
  value,
  label,
  sourceRefs = [],
  status = "team_material_only",
) => ({
  value,
  label_zh: label,
  source_refs: sourceRefs,
  status,
  applicable_scenarios: globalScenarios,
});
const globalTbd = (label) =>
  globalDomainItem("TBD", label, [], "TBD");
const globalSlotConfiguration = {
  "jd-0.1": "shared",
  "jd-0.2": "world",
  "jd-0.3": "world",
  "jd-0.4": "user",
  "jd-0.5": "shared",
  "jd-0.6": "shared",
  "jd-0.7": "shared",
  "jd-0.8": "world",
  "jd-0.9": "shared",
  "jd-0.10": "shared",
};
const globalNodes = [
  baseNode({
    node_id: "PROPOSED-jd-tree-global",
    parent_id: catalogRootId,
    owner_a: "MULTI",
    name: "JD-global / 共享业务变量",
    definition:
      "展示跨多项能力共享、但不归任何单一 A 独占的 jd-0.1–jd-0.10 全局 JD 分支。",
    node_kind: "global_root",
    variable_role: "structural_group",
    applicable_scenarios: globalScenarios,
    configuration_side: "shared",
    projection_targets: ["world_config", "user_config", "sut_input", "harness"],
    visibility: ["sut_visible", "grader_visible"],
    observation_channel: ["sut_input", "grader"],
    related_global_jd: globalCanonicalIds,
    source: ["L-GLOBAL-JD66-V3", "L-GLOBAL-AXL68-V3"],
    evidence_status: "authoritative_existing",
    derivation_status: "derived",
    review_status: "proposed",
    notes:
      "global JD 不是新的 Axx，也不改写 A×L 责任边界。页面单列只是为了审阅共享变量。",
  }),
];

for (const variable of globalCanonicalVariables) {
  const configurationSide = globalSlotConfiguration[variable.id] || "shared";
  globalNodes.push(
    baseNode({
      node_id: variable.id,
      parent_id: "PROPOSED-jd-tree-global",
      canonical_slot: variable.id,
      owner_a: "MULTI",
      name: variable.name,
      definition: variable.description,
      node_kind: "group",
      variable_role: "structural_group",
      applicable_scenarios: globalScenarios,
      configuration_side: configurationSide,
      projection_targets: defaultProjectionTargets(configurationSide),
      visibility: ["sut_visible", "grader_visible"],
      observation_channel: ["sut_input", "grader"],
      related_global_jd: [variable.id],
      related_jd: [],
      used_by_axl: axlRefsUsingGlobal(variable.id),
      source: ["L-GLOBAL-JD66-V3", "L-GLOBAL-AXL68-V3"],
      evidence_status: "authoritative_existing",
      derivation_status: "given",
      review_status: "reviewed",
      notes:
        "canonical 名称与定义来自当前 66 槽位字典；下级 PROPOSED 节点只做可审计细分，不改变 global JD 权威语义。",
    }),
  );
}

function addGlobalGroup(id, name, definition, options = {}) {
  const globalId = options.globalId || "jd-0.3";
  const configurationSide =
    options.configurationSide || globalSlotConfiguration[globalId] || "shared";
  globalNodes.push(
    baseNode({
      node_id: id,
      parent_id: options.parent || globalId,
      canonical_slot: globalId,
      owner_a: "MULTI",
      name,
      definition,
      node_kind: "group",
      variable_role: options.variableRole || "structural_group",
      applicable_scenarios: globalScenarios,
      configuration_side: configurationSide,
      projection_targets:
        options.projectionTargets || defaultProjectionTargets(configurationSide),
      visibility: options.visibility || ["sut_visible", "grader_visible"],
      observation_channel:
        options.observationChannel || ["sut_input", "grader"],
      related_global_jd: [globalId],
      related_jd: options.relatedJd || [],
      used_by_axl: axlRefsUsingGlobal(globalId),
      source: options.source || ["L-A8-V06"],
      evidence_status: options.evidenceStatus || "team_material_only",
      derivation_status: options.derivationStatus || "given",
      review_status: "proposed",
      notes: options.notes || null,
    }),
  );
}

function addGlobalLeaf({
  id,
  parent,
  name,
  definition,
  valueType,
  domain,
  unit = null,
  difficulty = "context_dependent",
  activationCondition = null,
  multiplicity = "one",
  dependsOn = [],
  constraints = [],
  relatedJd = [],
  globalId = "jd-0.3",
  source = ["L-A8-V06"],
  configurationSide = null,
  projectionTargets = null,
  visibility = ["sut_visible", "grader_visible"],
  observationChannel = ["sut_input", "grader"],
  variableRole = "configuration_input",
  evidenceStatus = null,
  derivationStatus = null,
  notes = null,
}) {
  const resolvedConfigurationSide =
    configurationSide || globalSlotConfiguration[globalId] || "shared";
  const statuses = (domain || []).map((item) => item?.status).filter(Boolean);
  const allTbd = statuses.length > 0 && statuses.every((status) => status === "TBD");
  globalNodes.push(
    baseNode({
      node_id: id,
      parent_id: parent,
      canonical_slot: globalId,
      owner_a: "MULTI",
      name,
      definition,
      node_kind: "variable",
      variable_role: variableRole,
      value_type: valueType,
      value_domain: domain,
      unit,
      activation_condition: activationCondition,
      multiplicity,
      difficulty_direction: difficulty,
      configuration_side: resolvedConfigurationSide,
      projection_targets:
        projectionTargets || defaultProjectionTargets(resolvedConfigurationSide),
      visibility,
      observation_channel: observationChannel,
      applicable_scenarios: globalScenarios,
      related_global_jd: [globalId],
      related_jd: relatedJd,
      used_by_axl: axlRefsUsingGlobal(globalId),
      depends_on: dependsOn,
      constraints,
      source,
      evidence_status:
        evidenceStatus || (allTbd ? "TBD" : "team_material_only"),
      derivation_status:
        derivationStatus || (allTbd ? "TBD" : "given"),
      review_status: "proposed",
      notes,
    }),
  );
}

const globalAuthoritativeItem = (value, label) =>
  globalDomainItem(
    value,
    label,
    ["L-GLOBAL-JD66-V3"],
    "authoritative_existing",
  );
const globalProposedItem = (value, label, refs = []) =>
  globalDomainItem(value, label, refs, "inferred_candidate");
const globalCommonSources = [
  "L-GLOBAL-JD66-V3",
  "L-GLOBAL-AXL68-V3",
  "L-GLOBAL-SCENARIO-REGISTRY",
];

const globalSimpleLeafSpecs = [
  // jd-0.1 任务时长
  {
    globalId: "jd-0.1",
    id: "PROPOSED-jd-0.1.1",
    name: "时间作用范围",
    definition: "时长或时间预算作用于整个任务、任务阶段、航段还是单项活动。",
    valueType: "enum",
    domain: [
      globalProposedItem("mission", "整个任务", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("phase", "任务阶段", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("segment", "航段", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("activity", "单项活动", ["L-GLOBAL-TASK-BACKBONE"]),
    ],
  },
  {
    globalId: "jd-0.1",
    id: "PROPOSED-jd-0.1.2",
    name: "持续时间值 / 范围",
    definition: "指定时间作用范围对应的持续时间、允许范围及不确定度。",
    valueType: "duration_range_object",
    domain: [globalTbd("数值范围、不确定度和单位换算规则 TBD")],
    unit: "s_or_declared_unit",
  },
  {
    globalId: "jd-0.1",
    id: "PROPOSED-jd-0.1.3",
    name: "时间预算",
    definition: "可供任务、阶段、航段或活动使用的时间预算。",
    valueType: "duration_or_range",
    domain: [globalTbd("预算值、软硬约束属性和阈值 TBD")],
    unit: "s_or_declared_unit",
  },
  {
    globalId: "jd-0.1",
    id: "PROPOSED-jd-0.1.4",
    name: "截止时间 / 时间窗",
    definition: "任务或活动允许开始、持续或完成的绝对或相对时间窗。",
    valueType: "absolute_or_relative_time_window",
    domain: [globalTbd("时间基准、起止值和时区规则 TBD")],
  },
  {
    globalId: "jd-0.1",
    id: "PROPOSED-jd-0.1.5",
    name: "长短程属性",
    definition: "对任务时间跨度的业务分档；正式分档阈值保持 TBD。",
    valueType: "enum_or_rule",
    domain: [
      globalAuthoritativeItem("short_duration", "短程"),
      globalAuthoritativeItem("long_duration", "长程"),
      globalTbd("分档边界及是否增加中程 TBD"),
    ],
  },

  // jd-0.2 工作空间结构
  {
    globalId: "jd-0.2",
    id: "PROPOSED-jd-0.2.1",
    name: "场景空间类型",
    definition: "任务空间按开放区域、沿线走廊、网络、表面、封闭空间或混合结构组织的类别。",
    valueType: "multi_enum",
    domain: [
      globalProposedItem("open_area", "开放区域", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("linear_corridor", "沿线 / 走廊", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("network", "道路 / 通道网络", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("surface_or_facade", "检查面 / 立面", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("enclosed_or_restricted", "封闭 / 受限空间", ["L-A8-V06"]),
      globalProposedItem("mixed", "混合结构", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalTbd("正式空间 taxonomy TBD"),
    ],
    source: [...globalCommonSources, "L-A8-V06"],
  },
  {
    globalId: "jd-0.2",
    id: "PROPOSED-jd-0.2.2",
    name: "空间尺度与外包边界",
    definition: "工作空间的尺度、范围、外包几何和高度层范围。",
    valueType: "geometry_or_bounds_object",
    domain: [globalTbd("几何表示、坐标参考和数值范围 TBD")],
  },
  {
    globalId: "jd-0.2",
    id: "PROPOSED-jd-0.2.3",
    name: "空间拓扑表示",
    definition: "区域、走廊、节点、边、表面与体空间之间的连接和包含关系。",
    valueType: "graph_or_geometry_reference",
    domain: [globalTbd("拓扑 schema 与引用格式 TBD")],
    relatedJd: ["jd-10.1"],
  },
  {
    globalId: "jd-0.2",
    id: "PROPOSED-jd-0.2.4",
    name: "工作空间边界集合",
    definition: "描述任务空间范围的物理、地理或业务边界；安全阈值另引用 jd-0.10。",
    valueType: "array_of_geometry_references",
    domain: [globalTbd("边界类别、几何和版本规则 TBD")],
    multiplicity: "one_or_more",
    relatedJd: ["jd-0.10"],
  },
  {
    globalId: "jd-0.2",
    id: "PROPOSED-jd-0.2.5",
    name: "障碍物区域集合",
    definition: "工作空间中影响可达性或观察关系的静态、动态或临时障碍区域引用。",
    valueType: "array_of_object_or_geometry_references",
    domain: [globalTbd("障碍物 registry、动态属性和引用规则 TBD")],
    multiplicity: "zero_or_more",
    relatedJd: ["PROPOSED-jd-11.5"],
  },
  {
    globalId: "jd-0.2",
    id: "PROPOSED-jd-0.2.6",
    name: "可通行 / 可观察区域集合",
    definition: "任务允许进入、穿越、驻留或获得有效观察的区域、走廊、表面和通行空间集合。",
    valueType: "array_of_geometry_references",
    domain: [globalTbd("区域分类、可达条件和有效期 TBD")],
    multiplicity: "one_or_more",
    relatedJd: ["jd-10.1", "PROPOSED-jd-11.5.2"],
  },

  // jd-0.4 在场人角色
  {
    globalId: "jd-0.4",
    id: "PROPOSED-jd-0.4.1",
    name: "角色类别",
    definition: "任务中存在、监督、请求、批准、处置或接收结果的人类角色类别。",
    valueType: "multi_enum_or_registry_ref",
    domain: [
      globalProposedItem("requester", "任务请求者", ["L-GLOBAL-G1-SETUP"]),
      globalProposedItem("operator", "操作员 / 飞手", ["L-GLOBAL-G1-SETUP"]),
      globalProposedItem("supervisor", "任务监督者", ["L-GLOBAL-G1-SETUP"]),
      globalProposedItem("approver", "批准 / 决策角色", ["L-GLOBAL-G1-SETUP"]),
      globalProposedItem("field_personnel", "现场人员", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("result_recipient", "结果接收者", ["L-GLOBAL-G1-SETUP"]),
      globalTbd("正式角色 registry 与 taxonomy TBD"),
    ],
    source: ["L-GLOBAL-JD66-V3", "L-GLOBAL-G1-SETUP", "L-GLOBAL-SCENARIO-REGISTRY"],
  },
  {
    globalId: "jd-0.4",
    id: "PROPOSED-jd-0.4.2",
    name: "职责范围",
    definition: "角色在本任务、阶段或事件中的职责边界。",
    valueType: "role_scope_object",
    domain: [globalTbd("职责 schema 与边界表达 TBD")],
  },
  {
    globalId: "jd-0.4",
    id: "PROPOSED-jd-0.4.3",
    name: "权限与决策权",
    definition: "角色可查看、请求、批准、纠偏、暂停、继续或接管的权限集合。",
    valueType: "permission_set",
    domain: [globalTbd("权限 taxonomy 与冲突规则 TBD")],
    relatedJd: ["jd-0.5"],
  },
  {
    globalId: "jd-0.4",
    id: "PROPOSED-jd-0.4.4",
    name: "位置与可达性",
    definition: "角色的现场 / 远程位置、可联系状态和交互可达性。",
    valueType: "presence_and_reachability_object",
    domain: [globalTbd("位置粒度、可达状态和更新时间 TBD")],
  },
  {
    globalId: "jd-0.4",
    id: "PROPOSED-jd-0.4.5",
    name: "角色关系与升级链",
    definition: "多个角色之间的委托、监督、批准、替代和升级关系。",
    valueType: "directed_role_graph",
    domain: [globalTbd("关系类型、优先级和闭环规则 TBD")],
    multiplicity: "zero_or_more",
    relatedJd: ["jd-0.5"],
  },

  // jd-0.5 人机确认协议
  {
    globalId: "jd-0.5",
    id: "PROPOSED-jd-0.5.1",
    name: "交互 / 确认类型",
    definition: "人机之间需要执行的确认、纠偏、批准、审计、通知、等待或继续动作。",
    valueType: "multi_enum",
    domain: [
      globalAuthoritativeItem("confirm", "确认"),
      globalAuthoritativeItem("correct", "纠偏"),
      globalAuthoritativeItem("approve", "批准"),
      globalAuthoritativeItem("audit", "审计"),
      globalAuthoritativeItem("notify", "通知"),
      globalAuthoritativeItem("wait", "等待"),
      globalAuthoritativeItem("continue", "继续执行"),
    ],
  },
  {
    globalId: "jd-0.5",
    id: "PROPOSED-jd-0.5.2",
    name: "发起者与接收者",
    definition: "一次交互的发起角色、目标角色及替代 / 升级接收者。",
    valueType: "role_reference_object",
    domain: [globalTbd("角色引用、广播和替代规则 TBD")],
    relatedJd: ["jd-0.4"],
  },
  {
    globalId: "jd-0.5",
    id: "PROPOSED-jd-0.5.3",
    name: "触发条件",
    definition: "确认、通知、等待或纠偏协议被启用的任务状态、风险或边界条件。",
    valueType: "condition_expression_or_reference",
    domain: [globalTbd("条件表达式和优先级 TBD")],
  },
  {
    globalId: "jd-0.5",
    id: "PROPOSED-jd-0.5.4",
    name: "交互载荷与必要披露",
    definition: "交互中必须提供的状态、风险、选项、证据和影响说明。",
    valueType: "message_contract_object",
    domain: [globalTbd("必要字段、证据级别和呈现规则 TBD")],
  },
  {
    globalId: "jd-0.5",
    id: "PROPOSED-jd-0.5.5",
    name: "响应状态",
    definition: "交互请求从等待到批准、拒绝、纠偏、取消或无响应的状态。",
    valueType: "enum",
    domain: [
      globalProposedItem("pending", "等待响应", ["L-GLOBAL-G1-SETUP"]),
      globalProposedItem("approved", "已批准", ["L-GLOBAL-G1-SETUP"]),
      globalProposedItem("rejected", "已拒绝", ["L-GLOBAL-G1-SETUP"]),
      globalProposedItem("corrected", "已纠偏", ["L-GLOBAL-G1-SETUP"]),
      globalProposedItem("cancelled", "已取消", ["L-GLOBAL-G1-SETUP"]),
      globalProposedItem("no_response", "无响应", ["L-GLOBAL-G1-SETUP"]),
      globalTbd("正式状态机 TBD"),
    ],
    source: ["L-GLOBAL-JD66-V3", "L-GLOBAL-G1-SETUP"],
  },
  {
    globalId: "jd-0.5",
    id: "PROPOSED-jd-0.5.6",
    name: "等待与响应时间窗",
    definition: "等待响应、提醒、失效和继续执行的时间窗口；具体时限保持 TBD。",
    valueType: "time_window_object",
    domain: [globalTbd("响应时限、提醒与超时规则 TBD")],
    relatedJd: ["jd-0.1"],
  },
  {
    globalId: "jd-0.5",
    id: "PROPOSED-jd-0.5.7",
    name: "后续动作与升级规则",
    definition: "不同响应状态下允许继续、等待、重试、升级、暂停或交接的规则。",
    valueType: "state_transition_rule_set",
    domain: [globalTbd("状态迁移、优先级与安全引用 TBD")],
    relatedJd: ["jd-5.1", "jd-0.10"],
  },
  {
    globalId: "jd-0.5",
    id: "PROPOSED-jd-0.5.8",
    name: "审计与证据关联",
    definition: "交互事件与请求、响应、任务 Trace、证据和最终处置之间的可追溯关联。",
    valueType: "reference_set",
    domain: [globalTbd("事件 ID、Trace 和证据引用格式 TBD")],
  },

  // jd-0.6 合规域
  {
    globalId: "jd-0.6",
    id: "PROPOSED-jd-0.6.1",
    name: "合规来源类别",
    definition: "任务适用约束来自空域、法规、组织制度、业务规范或其他受审规则的类别。",
    valueType: "multi_enum",
    domain: [
      globalAuthoritativeItem("airspace", "空域约束"),
      globalAuthoritativeItem("law_or_regulation", "法规 / 规章"),
      globalAuthoritativeItem("organizational_policy", "组织制度"),
      globalAuthoritativeItem("business_specification", "业务规范"),
      globalProposedItem("contract_or_site_rule", "合同 / 场地规则", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalTbd("正式合规来源 taxonomy TBD"),
    ],
  },
  {
    globalId: "jd-0.6",
    id: "PROPOSED-jd-0.6.2",
    name: "适用辖区与场景范围",
    definition: "合规规则适用的地域、空域、组织、场地、业务场景和任务阶段。",
    valueType: "scope_object",
    domain: [globalTbd("辖区、场景和阶段引用格式 TBD")],
  },
  {
    globalId: "jd-0.6",
    id: "PROPOSED-jd-0.6.3",
    name: "规则与约束引用集",
    definition: "适用标准、法规条款、组织规则或业务规范的版本化引用集合。",
    valueType: "array_of_versioned_references",
    domain: [globalTbd("来源标识、条款粒度和版本格式 TBD")],
    multiplicity: "one_or_more",
  },
  {
    globalId: "jd-0.6",
    id: "PROPOSED-jd-0.6.4",
    name: "生效时间与版本",
    definition: "合规规则的版本、发布日期、生效期、失效期和替代关系。",
    valueType: "version_and_validity_object",
    domain: [globalTbd("日期格式、版本冲突和追溯规则 TBD")],
  },
  {
    globalId: "jd-0.6",
    id: "PROPOSED-jd-0.6.5",
    name: "优先级与冲突关系",
    definition: "多项合规约束之间的优先级、覆盖、并行适用和冲突状态。",
    valueType: "rule_relation_graph",
    domain: [globalTbd("优先级、冲突消解和人工确认规则 TBD")],
    relatedJd: ["jd-0.5"],
  },
  {
    globalId: "jd-0.6",
    id: "PROPOSED-jd-0.6.6",
    name: "许可 / 批准证据",
    definition: "任务执行所需许可、批准、豁免或证明材料的引用和有效状态。",
    valueType: "array_of_evidence_references",
    domain: [globalTbd("证据类型、有效性和可见性规则 TBD")],
    multiplicity: "zero_or_more",
  },

  // jd-0.7 任务完成判据
  {
    globalId: "jd-0.7",
    id: "PROPOSED-jd-0.7.1",
    name: "任务结果状态",
    definition: "任务整体或局部单元的完成、部分完成、失败、终止或中止状态。",
    valueType: "enum",
    domain: [
      globalAuthoritativeItem("completed", "完成"),
      globalAuthoritativeItem("partially_completed", "部分完成"),
      globalAuthoritativeItem("failed", "失败"),
      globalAuthoritativeItem("terminated", "终止"),
      globalAuthoritativeItem("aborted", "中止"),
    ],
  },
  {
    globalId: "jd-0.7",
    id: "PROPOSED-jd-0.7.2",
    name: "判定作用范围",
    definition: "完成判据作用于任务、阶段、航段、业务对象、事件或输出产物的范围。",
    valueType: "multi_enum_or_reference",
    domain: [
      globalProposedItem("mission", "任务", ["L-GLOBAL-TASK-BACKBONE"]),
      globalProposedItem("phase", "阶段", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("segment", "航段", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("business_object", "业务对象", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("output_artifact", "输出产物", ["L-GLOBAL-SCENARIO-REGISTRY"]),
    ],
  },
  {
    globalId: "jd-0.7",
    id: "PROPOSED-jd-0.7.3",
    name: "完成谓词集合",
    definition: "用于判断任务结果状态的结构化业务条件集合。",
    valueType: "array_of_predicate_objects",
    domain: [globalTbd("谓词 schema、变量引用和比较规则 TBD")],
    multiplicity: "one_or_more",
  },
  {
    globalId: "jd-0.7",
    id: "PROPOSED-jd-0.7.4",
    name: "必要证据集合",
    definition: "支持完成、部分完成、失败或终止判断所需的输出、事件、Trace 或 Grader 证据。",
    valueType: "array_of_evidence_requirements",
    domain: [globalTbd("证据类型、完整性和可见性规则 TBD")],
    multiplicity: "zero_or_more",
  },
  {
    globalId: "jd-0.7",
    id: "PROPOSED-jd-0.7.5",
    name: "判据聚合逻辑",
    definition: "多个对象、航段、阶段和证据如何聚合为任务级结果状态。",
    valueType: "logic_expression_or_rule_set",
    domain: [globalTbd("AND / OR、数量、比例和例外规则 TBD")],
  },
  {
    globalId: "jd-0.7",
    id: "PROPOSED-jd-0.7.6",
    name: "未完成 / 终止原因",
    definition: "部分完成、失败、终止或中止状态对应的业务原因与责任引用。",
    valueType: "reason_code_or_reference_set",
    domain: [globalTbd("原因 taxonomy、归因和多原因规则 TBD")],
  },

  // jd-0.8 通信基建
  {
    globalId: "jd-0.8",
    id: "PROPOSED-jd-0.8.1",
    name: "通信链路类别",
    definition: "任务可用的指挥控制、遥测、载荷数据、告警或地面回传链路类别。",
    valueType: "multi_enum_or_registry_ref",
    domain: [
      globalProposedItem("command_and_control", "指挥控制链路", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("telemetry", "遥测链路", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("payload_data", "载荷数据链路", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("alerting", "告警 / 通知链路", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("backhaul", "地面回传 / 骨干链路", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalTbd("正式链路 taxonomy TBD"),
    ],
  },
  {
    globalId: "jd-0.8",
    id: "PROPOSED-jd-0.8.2",
    name: "基础设施节点集合",
    definition: "地面站、基站、中继、边缘节点、远端平台或其他通信基础设施实例集合。",
    valueType: "array_of_infrastructure_references",
    domain: [globalTbd("节点 registry、能力和归属字段 TBD")],
    multiplicity: "one_or_more",
  },
  {
    globalId: "jd-0.8",
    id: "PROPOSED-jd-0.8.3",
    name: "网络拓扑",
    definition: "平台、地面站、中继、边缘节点和远端服务之间的连接关系。",
    valueType: "network_graph",
    domain: [globalTbd("拓扑 schema、方向性和动态变化规则 TBD")],
  },
  {
    globalId: "jd-0.8",
    id: "PROPOSED-jd-0.8.4",
    name: "覆盖区域 / 时间窗",
    definition: "链路或基础设施在空间和时间上的可用覆盖范围。",
    valueType: "spatiotemporal_coverage_object",
    domain: [globalTbd("覆盖几何、时间窗和更新规则 TBD")],
    relatedJd: ["jd-0.2", "jd-0.1"],
  },
  {
    globalId: "jd-0.8",
    id: "PROPOSED-jd-0.8.5",
    name: "链路可用性与质量状态",
    definition: "链路可用、退化、间歇、中断或未知的状态及其质量观测。",
    valueType: "state_and_quality_object",
    domain: [globalTbd("质量指标、阈值、更新频率和不确定度 TBD")],
  },
  {
    globalId: "jd-0.8",
    id: "PROPOSED-jd-0.8.6",
    name: "冗余与切换关系",
    definition: "主备链路、中继路径、替代基础设施及其切换适用条件。",
    valueType: "redundancy_and_failover_rule_set",
    domain: [globalTbd("主备优先级、切换和恢复规则 TBD")],
  },

  // jd-0.9 载荷集
  {
    globalId: "jd-0.9",
    id: "PROPOSED-jd-0.9.1",
    name: "载荷类别",
    definition: "任务所需传感、成像、测距、通信、照明、喊话或其他执行载荷的类别。",
    valueType: "multi_enum_or_registry_ref",
    domain: [
      globalProposedItem("rgb_imaging", "RGB 成像", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("thermal_imaging", "热红外成像", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("depth_or_ranging", "深度 / 测距", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("radar", "雷达", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("lighting", "照明 / 灯光", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("speaker", "喊话 / 声学执行载荷", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("other_task_actuator", "其他任务执行载荷", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalTbd("正式载荷 taxonomy TBD"),
    ],
  },
  {
    globalId: "jd-0.9",
    id: "PROPOSED-jd-0.9.2",
    name: "载荷实例集合",
    definition: "本任务可用载荷的稳定实例 ID、型号、版本、安装位和状态引用集合。",
    valueType: "array_of_payload_profile_references",
    domain: [globalTbd("载荷 profile schema、ID 和版本规则 TBD")],
    multiplicity: "one_or_more",
  },
  {
    globalId: "jd-0.9",
    id: "PROPOSED-jd-0.9.3",
    name: "载荷能力与模态",
    definition: "各载荷提供的观测模态、执行能力和输出产品类型。",
    valueType: "capability_set_or_reference",
    domain: [globalTbd("能力 taxonomy、产品类型和参数引用 TBD")],
    relatedJd: ["jd-6.3", "jd-12.1"],
  },
  {
    globalId: "jd-0.9",
    id: "PROPOSED-jd-0.9.4",
    name: "安装与朝向关系",
    definition: "载荷相对平台的安装位置、可动轴、视场和默认朝向关系。",
    valueType: "mount_and_orientation_object",
    domain: [globalTbd("安装参考系、视场和云台关系 TBD")],
    relatedJd: ["jd-2.2", "PROPOSED-jd-11.5.5.4"],
  },
  {
    globalId: "jd-0.9",
    id: "PROPOSED-jd-0.9.5",
    name: "载荷组合与依赖",
    definition: "多个载荷同时、互斥、主辅、校准依赖或融合使用的关系。",
    valueType: "dependency_and_exclusion_rule_set",
    domain: [globalTbd("组合、互斥和依赖规则 TBD")],
    multiplicity: "zero_or_more",
  },
  {
    globalId: "jd-0.9",
    id: "PROPOSED-jd-0.9.6",
    name: "可用与工作状态",
    definition: "载荷是否安装、可用、校准、启用、退化、故障或未知。",
    valueType: "state_object",
    domain: [globalTbd("正式状态机、退化原因和更新时间 TBD")],
  },
  {
    globalId: "jd-0.9",
    id: "PROPOSED-jd-0.9.7",
    name: "校准与时间同步状态",
    definition: "载荷内参、外参、跨载荷配准和时间同步的可用状态及版本。",
    valueType: "calibration_and_sync_object",
    domain: [globalTbd("校准状态、误差指标和有效期 TBD")],
  },
  {
    globalId: "jd-0.9",
    id: "PROPOSED-jd-0.9.8",
    name: "资源需求引用",
    definition: "载荷对电力、计算、存储、带宽和执行机构资源的需求引用。",
    valueType: "resource_profile_reference",
    domain: [globalTbd("资源 profile schema 与单位 TBD")],
    relatedJd: ["jd-9.1", "jd-0.8"],
  },

  // jd-0.10 安全包络先验
  {
    globalId: "jd-0.10",
    id: "PROPOSED-jd-0.10.1",
    name: "安全边界类别",
    definition: "任务执行前声明的空间、运动、姿态、间隔、资源、环境或任务阶段安全边界类别。",
    valueType: "multi_enum",
    domain: [
      globalProposedItem("spatial", "空间 / 区域边界", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("kinematic", "速度 / 加速度边界", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("attitude", "姿态 / 航向边界", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("separation", "净空 / 间隔边界", ["L-GLOBAL-AXL68-V3"]),
      globalProposedItem("resource_reserve", "资源 / 最低储备", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("environmental", "环境条件边界", ["L-GLOBAL-SCENARIO-REGISTRY"]),
      globalProposedItem("phase_specific", "任务阶段专用边界", ["L-GLOBAL-AXL68-V3"]),
      globalTbd("正式安全边界 taxonomy TBD"),
    ],
  },
  {
    globalId: "jd-0.10",
    id: "PROPOSED-jd-0.10.2",
    name: "允许范围 / 阈值对象",
    definition: "安全边界对应的允许范围、上限、下限、单位和比较方向。",
    valueType: "typed_bound_object",
    domain: [globalTbd("各类别的变量、单位、范围和阈值 TBD")],
  },
  {
    globalId: "jd-0.10",
    id: "PROPOSED-jd-0.10.3",
    name: "适用对象与任务阶段",
    definition: "安全边界适用的平台、载荷、人员、空间、航段、阶段或任务状态。",
    valueType: "scope_and_reference_object",
    domain: [globalTbd("对象引用、阶段和状态条件 TBD")],
  },
  {
    globalId: "jd-0.10",
    id: "PROPOSED-jd-0.10.4",
    name: "最低安全储备",
    definition: "任务执行前声明的最低能源、时间、通信、控制或其他安全储备。",
    valueType: "reserve_requirement_object",
    domain: [globalTbd("储备类别、数值、单位和计算方法 TBD")],
    relatedJd: ["jd-0.1", "jd-0.8", "jd-0.9", "jd-9.2"],
  },
  {
    globalId: "jd-0.10",
    id: "PROPOSED-jd-0.10.5",
    name: "边界来源与权威级别",
    definition: "安全边界来自法规、组织制度、平台限制、任务合同或风险评估的来源及权威关系。",
    valueType: "source_and_authority_reference",
    domain: [globalTbd("来源类别、权威级别和版本规则 TBD")],
    relatedJd: ["jd-0.6", "jd-2.2"],
  },
  {
    globalId: "jd-0.10",
    id: "PROPOSED-jd-0.10.6",
    name: "边界组合与优先级",
    definition: "多项安全边界同时适用时的交集、覆盖、优先级和冲突状态。",
    valueType: "constraint_relation_rule_set",
    domain: [globalTbd("组合、冲突消解和保守选择规则 TBD")],
  },
  {
    globalId: "jd-0.10",
    id: "PROPOSED-jd-0.10.7",
    name: "违反状态与处置引用",
    definition: "安全边界正常、接近、违反或未知的状态，以及对 A17 处置责任的引用。",
    valueType: "state_and_action_reference",
    domain: [globalTbd("状态阈值、迟滞和 A17 处置映射 TBD")],
    relatedJd: ["jd-17.1", "jd-17.2"],
  },
];

for (const spec of globalSimpleLeafSpecs) {
  addGlobalLeaf({
    parent: spec.globalId,
    source: spec.source || globalCommonSources,
    evidenceStatus: spec.evidenceStatus || "inferred_candidate",
    derivationStatus: spec.derivationStatus || "proposed",
    ...spec,
  });
}

addGlobalGroup(
  "PROPOSED-jd-0.3.1",
  "风扰动",
  "风速、风向和风场时间 / 空间结构；实际数值范围由平台与场景资料决定。",
  { source: ["L-A8-V06", "W-AIRSIM"] },
);
addGlobalGroup(
  "PROPOSED-jd-0.3.2",
  "定位扰动",
  "对定位来源或融合结果施加的退化类型、强度、持续时间和发生窗口。",
  { source: ["L-A8-V06", "W-PX4-EKF"] },
);
addGlobalGroup(
  "PROPOSED-jd-0.3.3",
  "光学基线与光线扰动",
  "将静态光照基线与动态光线扰动分开配置；光照基线存在不等于光线扰动已启用。",
  { source: ["L-A8-V06", "W-AIRSIM"] },
);
addGlobalGroup(
  "PROPOSED-jd-0.3.4",
  "天气与能见度条件",
  "天气基线、能见度退化及其强度和发生窗口。",
  { source: ["L-A8-V06", "W-AIRSIM", "W-CARLA"] },
);
addGlobalGroup(
  "PROPOSED-jd-0.3.5",
  "启用、组合与发生窗口",
  "统一表达扰动 Profile 是否启用、哪些类型处于活动状态、如何组合及何时生效。",
  {
    source: ["L-GLOBAL-JD66-V3", "L-A8-V06"],
    evidenceStatus: "inferred_candidate",
    derivationStatus: "proposed",
    notes:
      "本组用于替换“光照=0、天气=1”一类含义不清的扁平布尔写法，不规定 simulator 字段。",
  },
);

addGlobalLeaf({
  id: "PROPOSED-jd-0.3.1.1",
  parent: "PROPOSED-jd-0.3.1",
  name: "风速大小",
  definition: "风速度向量的大小；跨场景取值范围和档位阈值保持 TBD。",
  valueType: "number_or_range",
  domain: [globalTbd("风速范围与档位阈值 TBD")],
  unit: "m/s",
  source: ["L-A8-V06", "W-AIRSIM"],
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.1.2",
  parent: "PROPOSED-jd-0.3.1",
  name: "风向与参考系",
  definition: "风向向量及其坐标参考系。",
  valueType: "vector3_with_reference_frame",
  domain: [
    globalDomainItem("X+", "X+", ["L-A8-V06"]),
    globalDomainItem("X-", "X-", ["L-A8-V06"]),
    globalDomainItem("Y+", "Y+", ["L-A8-V06"]),
    globalDomainItem("Y-", "Y-", ["L-A8-V06"]),
    globalTbd("其他方向与参考系 TBD"),
  ],
  source: ["L-A8-V06", "W-AIRSIM"],
  notes: "X / Y 方向只保留 v0.6 原始示例；通用坐标系和 3D 方向表达待确认。",
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.1.3",
  parent: "PROPOSED-jd-0.3.1",
  name: "风场类型",
  definition: "风扰动在时间和空间上的结构类别。",
  valueType: "enum",
  domain: [
    globalDomainItem("uniform", "均匀", ["L-A8-V06"]),
    globalDomainItem("gust", "阵风", ["L-A8-V06"]),
    globalDomainItem("shear", "切变", ["L-A8-V06"]),
    globalTbd("正式风场 taxonomy TBD"),
  ],
  source: ["L-A8-V06", "W-AIRSIM"],
});

addGlobalLeaf({
  id: "PROPOSED-jd-0.3.2.1",
  parent: "PROPOSED-jd-0.3.2",
  name: "定位扰动类型",
  definition: "定位来源或融合状态的退化类别。",
  valueType: "multi_enum",
  domain: [
    globalDomainItem("gnss_multipath", "GNSS 多径", ["L-A8-V06", "W-PX4-EKF"]),
    globalDomainItem("jump", "跳变", ["L-A8-V06", "W-PX4-EKF"]),
    globalDomainItem("loss", "失锁", ["L-A8-V06", "W-PX4-EKF"]),
    globalDomainItem("source_inconsistency", "源不一致", ["L-A8-V06", "W-PX4-EKF"]),
    globalTbd("正式退化 taxonomy TBD"),
  ],
  source: ["L-A8-V06", "W-PX4-EKF"],
  relatedJd: ["jd-7.2"],
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.2.2",
  parent: "PROPOSED-jd-0.3.2",
  name: "定位扰动强度",
  definition: "定位扰动的幅度或质量影响程度；指标和阈值保持 TBD。",
  valueType: "metric_or_enum",
  domain: [globalTbd("强度指标、单位与阈值 TBD")],
  source: ["L-A8-V06", "W-PX4-EKF"],
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.2.3",
  parent: "PROPOSED-jd-0.3.2",
  name: "定位扰动持续时间",
  definition: "一次定位扰动持续或保持的时间。",
  valueType: "duration_or_range",
  domain: [globalTbd("持续时间范围与档位阈值 TBD")],
  unit: "s",
  source: ["L-A8-V06"],
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.2.4",
  parent: "PROPOSED-jd-0.3.2",
  name: "定位扰动发生窗口",
  definition: "定位扰动相对任务阶段、事件或时间轴的开始与结束窗口。",
  valueType: "event_or_time_window",
  domain: [globalTbd("任务阶段 / 事件锚点和时间范围 TBD")],
  source: ["L-A8-V06"],
});

addGlobalLeaf({
  id: "PROPOSED-jd-0.3.3.1",
  parent: "PROPOSED-jd-0.3.3",
  name: "光照基线（静态）",
  definition: "未施加动态光线扰动时的场景基础光照状态。",
  valueType: "enum_or_metric",
  domain: [
    globalDomainItem("bright", "明亮", ["L-A8-V06"]),
    globalDomainItem("dim", "昏暗", ["L-A8-V06"]),
    globalDomainItem("night", "夜间", ["L-A8-V06"]),
    globalTbd("客观光照量、单位与档位阈值 TBD"),
  ],
  source: ["L-A8-V06", "W-AIRSIM"],
  notes:
    "光照基线是始终需要配置的场景状态，不应使用“光照=0”表达未启用。",
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.3.2",
  parent: "PROPOSED-jd-0.3.3",
  name: "动态光线扰动类型",
  definition: "相对光照基线随时间变化或局部扫掠的光线扰动类别。",
  valueType: "multi_enum",
  domain: [
    globalDomainItem("none", "无", ["L-A8-V06"]),
    globalDomainItem("backlight", "逆光", ["L-A8-V06"]),
    globalDomainItem("moving_shadow", "阴影扫掠", ["L-A8-V06"]),
    globalDomainItem("flicker", "频闪", ["L-A8-V06"]),
    globalDomainItem("intensity_step", "光强突变", ["L-A8-V06"]),
    globalTbd("正式光线扰动 taxonomy TBD"),
  ],
  source: ["L-A8-V06", "W-AIRSIM"],
  notes:
    "“光线=0”只能解释为本节点未激活，不能解释为没有基础光照。",
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.3.3",
  parent: "PROPOSED-jd-0.3.3",
  name: "动态光线扰动强度",
  definition: "动态光线变化相对基线的幅度或速率；指标和阈值保持 TBD。",
  valueType: "metric_or_enum",
  domain: [globalTbd("强度指标、单位与阈值 TBD")],
  activationCondition: {
    node: "PROPOSED-jd-0.3.3.2",
    operator: "not_contains_only",
    value: "none",
  },
  source: ["L-A8-V06", "W-AIRSIM"],
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.3.4",
  parent: "PROPOSED-jd-0.3.3",
  name: "动态光线扰动发生窗口",
  definition: "动态光线扰动相对任务阶段、事件或时间轴的开始与结束窗口。",
  valueType: "event_or_time_window",
  domain: [globalTbd("任务阶段 / 事件锚点和时间范围 TBD")],
  activationCondition: {
    node: "PROPOSED-jd-0.3.3.2",
    operator: "not_contains_only",
    value: "none",
  },
  source: ["L-A8-V06"],
});

addGlobalLeaf({
  id: "PROPOSED-jd-0.3.4.1",
  parent: "PROPOSED-jd-0.3.4",
  name: "天气 / 大气状态类型",
  definition: "天气或大气能见度状态类别；昼夜和光照强弱仍归光照基线。",
  valueType: "multi_enum",
  domain: [
    globalDomainItem("clear", "晴", ["L-A8-V06"]),
    globalDomainItem("cloudy", "阴", ["L-A8-V06"]),
    globalDomainItem("fog", "雾", ["L-A8-V06"]),
    globalDomainItem("rain", "雨", ["L-A8-V06"]),
    globalTbd("正式天气 taxonomy TBD"),
  ],
  source: ["L-A8-V06", "W-AIRSIM", "W-CARLA"],
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.4.2",
  parent: "PROPOSED-jd-0.3.4",
  name: "天气 / 能见度退化强度",
  definition: "雾、雨、云量等条件的物理或归一化强度；变量和阈值保持 TBD。",
  valueType: "metric_object",
  domain: [globalTbd("按天气类型选择的强度变量、单位与阈值 TBD")],
  source: ["L-A8-V06", "W-AIRSIM", "W-CARLA"],
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.4.3",
  parent: "PROPOSED-jd-0.3.4",
  name: "天气变化发生窗口",
  definition: "非基线天气条件相对任务阶段、事件或时间轴的开始与结束窗口。",
  valueType: "event_or_time_window",
  domain: [globalTbd("任务阶段 / 事件锚点和时间范围 TBD")],
  source: ["L-A8-V06"],
});

addGlobalLeaf({
  id: "PROPOSED-jd-0.3.5.1",
  parent: "PROPOSED-jd-0.3.5",
  name: "扰动 Profile 启用状态",
  definition: "是否为本任务实例启用 jd-0.3 扰动 Profile。",
  valueType: "boolean",
  domain: [
    globalDomainItem(false, "未启用", ["L-GLOBAL-JD66-V3"], "inferred_candidate"),
    globalDomainItem(true, "已启用", ["L-GLOBAL-JD66-V3"], "inferred_candidate"),
  ],
  source: ["L-GLOBAL-JD66-V3"],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.5.2",
  parent: "PROPOSED-jd-0.3.5",
  name: "活动扰动类型集合",
  definition: "当前 Profile 中实际启用的扰动类型集合；静态光照基线不计入活动扰动。",
  valueType: "multi_enum",
  domain: [
    globalDomainItem("wind", "风扰动", ["L-A8-V06"]),
    globalDomainItem("localization", "定位扰动", ["L-A8-V06"]),
    globalDomainItem("dynamic_light", "动态光线扰动", ["L-A8-V06"]),
    globalDomainItem("adverse_weather", "非基线天气 / 能见度退化", ["L-A8-V06"]),
  ],
  activationCondition: {
    node: "PROPOSED-jd-0.3.5.1",
    operator: "equals",
    value: true,
  },
  source: ["L-A8-V06"],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.5.3",
  parent: "PROPOSED-jd-0.3.5",
  name: "同时活动扰动数量",
  definition: "由活动扰动类型集合在给定发生窗口内派生的同时活动类型数量。",
  valueType: "derived_integer",
  domain: [globalTbd("计算窗口和重叠规则 TBD")],
  difficulty: "context_dependent",
  dependsOn: ["PROPOSED-jd-0.3.5.2"],
  source: ["L-GLOBAL-JD66-V3", "L-A8-V06"],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.5.4",
  parent: "PROPOSED-jd-0.3.5",
  name: "扰动组合关系",
  definition: "多个扰动按同时、顺序、重叠或条件触发方式组合的关系。",
  valueType: "rule_or_event_graph",
  domain: [globalTbd("组合关系 schema 与冲突规则 TBD")],
  multiplicity: "one_or_more",
  dependsOn: ["PROPOSED-jd-0.3.5.2"],
  source: ["L-GLOBAL-JD66-V3", "L-A8-V06"],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
});
addGlobalLeaf({
  id: "PROPOSED-jd-0.3.5.5",
  parent: "PROPOSED-jd-0.3.5",
  name: "Profile 总体发生窗口",
  definition: "整个扰动 Profile 相对任务阶段、事件或时间轴的总生效窗口。",
  valueType: "event_or_time_window",
  domain: [globalTbd("任务阶段 / 事件锚点和时间范围 TBD")],
  source: ["L-GLOBAL-JD66-V3", "L-A8-V06"],
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
});

addGlobalLeaf({
  id: "PROPOSED-jd-0.3.6",
  parent: "jd-0.3",
  name: "允许扰动范围声明",
  definition:
    "向 SUT 公开本任务允许出现的扰动维度、候选域或约束引用；不暴露当前实例实际采用的扰动类型、强度和发生窗口。",
  valueType: "constraint_set_reference",
  domain: [globalTbd("允许扰动范围合同的结构与取值边界 TBD")],
  source: ["L-GLOBAL-JD66-V3", "L-A8-V06"],
  configurationSide: "shared",
  projectionTargets: ["user_config", "sut_input", "harness"],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_input", "grader"],
  variableRole: "contract_schema",
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
  notes:
    "本节点只建立公开合同与实例真值的语义边界，不新增阈值、默认参数或 simulator 字段。",
});

addGlobalLeaf({
  id: "PROPOSED-jd-0.3.7",
  parent: "jd-0.3",
  name: "本实例扰动注入真值",
  definition:
    "Fixture 在当前实例中实际注入的扰动 Profile 引用，包括启用类型、参数和发生窗口；作为 Grader / Hidden GT 使用，不直接提供给 SUT。",
  valueType: "profile_instance_reference",
  domain: [globalTbd("扰动实例引用结构与注入字段映射 TBD")],
  source: ["L-GLOBAL-JD66-V3", "L-A8-V06"],
  configurationSide: "world",
  projectionTargets: ["world_config", "harness"],
  visibility: ["fixture_only", "grader_only", "hidden_gt"],
  observationChannel: ["fixture", "grader", "hidden_gt"],
  variableRole: "hidden_ground_truth",
  evidenceStatus: "inferred_candidate",
  derivationStatus: "proposed",
  notes:
    "SUT 可观测的是扰动对传感器、定位、控制或链路产生的表现，不接收本节点的真实注入标签。",
});

for (const node of globalNodes) {
  if (
    node.canonical_slot !== "jd-0.3" ||
    node.node_kind !== "variable" ||
    node.node_id === "PROPOSED-jd-0.3.7"
  ) {
    continue;
  }
  node.variable_role = "contract_schema";
  node.notes = [
    node.notes,
    "本节点定义扰动维度及其候选域；当前实例的实际注入取值由 PROPOSED-jd-0.3.7 单独保存为 Hidden GT。",
  ]
    .filter(Boolean)
    .join("\n");
}
for (const node of globalNodes) {
  if (
    node.node_kind !== "variable" ||
    !node.node_id.startsWith("PROPOSED-jd-0.3.5.")
  ) {
    continue;
  }
  node.variable_role =
    node.node_id === "PROPOSED-jd-0.3.5.3"
      ? "derived_metric"
      : "hidden_ground_truth";
  node.configuration_side = "world";
  node.projection_targets =
    node.variable_role === "derived_metric"
      ? []
      : ["world_config", "harness"];
  node.visibility = ["fixture_only", "grader_only", "hidden_gt"];
  node.observation_channel = ["fixture", "grader", "hidden_gt"];
  node.notes = [
    node.notes,
    "本节点描述当前实例的实际启用、组合或发生窗口，属于 Fixture / Grader 真值；公开允许范围由 PROPOSED-jd-0.3.6 表达。",
  ]
    .filter(Boolean)
    .join("\n");
}

const migratedNodes = [...migratedInspectionNodes];

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
  "variable_role",
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
  variable_role: [
    "configuration_input",
    "contract_schema",
    "runtime_observation",
    "derived_metric",
    "hidden_ground_truth",
    "structural_group",
    "example_profile",
    "TBD",
  ],
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
    "variable_role 仅标注节点在数据流中的机器语义，不新增业务变量或改写 canonical 定义。",
    "候选值逐值记录 source_refs 与 status；未逐值证明的候选不得由节点来源机械升级为 source_supported。",
    "PROPOSED 子树可以不存在，但所有 related_jd、depends_on 和启用条件引用始终必须指向现存节点。",
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
    {
      decision_id: "schema-variable-role",
      status: "confirmed_by_user",
      decision:
        "增加 variable_role 以区分可配置输入、合同/schema、运行时观察、派生指标、Hidden GT、结构节点与示例 Profile；该字段不是新增 JD 变量。",
    },
    {
      decision_id: "value-level-evidence",
      status: "confirmed_by_user",
      decision:
        "候选值必须独立声明 source_refs 与 status；缺少直接证据时保持 inferred_candidate 或 TBD。",
    },
    {
      decision_id: "strict-proposed-references",
      status: "confirmed_by_user",
      decision:
        "11.4/11.5 可选，但引用完整性不豁免；缺失 proposed 子树时不得保留指向它的悬空引用。",
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
  catalog_version: "version1-a6-a7-a8-a10-2026-07-21",
  scope: ["A6", "A7", "A8", "A10"],
  scenario_scope: [...new Set(oldInspection.scenario_scope || [])],
  sources: uniqueSources([
    ...oldInspection.sources.map(migrateSource),
    oldA8.sources
      .filter((source) => source.source_id === "L-A8-V06")
      .map(migrateSource)[0],
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

const a11Catalog = {
  ...commonMetadata,
  catalog_id: "jd-variable-tree-a11-control-version1-draft",
  catalog_version: "version1-a11-control-2026-07-21",
  scope: ["A11"],
  scenario_scope: [
    "cross_scenario",
    "highway_inspection",
    "campus_inspection",
    "white_wall_narrow_gap",
  ],
  sources: uniqueSources([
    ...oldA8.sources.map(migrateSource),
    ...a11Sources,
    g1Sources.find((source) => source.source_id === "L-RENUMBER-20260719"),
    g1Sources.find((source) => source.source_id === "L-RENUMBER-20260720"),
  ]),
  nodes: a11Nodes,
};

const globalCatalog = {
  ...commonMetadata,
  catalog_id: "jd-variable-tree-global-version1-draft",
  catalog_version: "version1-global-jd-0-1-to-0-10-2026-07-22",
  scope: [],
  global_scope: globalCanonicalIds,
  scenario_scope: globalScenarios,
  sources: uniqueSources([
    ...globalCorrectionSources,
    ...oldA8.sources
      .filter((source) => source.source_id === "L-A8-V06")
      .map(migrateSource),
    ...oldInspection.sources
      .filter((source) =>
        ["W-AIRSIM", "W-CARLA", "W-PX4-EKF"].includes(source.source_id),
      )
      .map(migrateSource),
  ]),
  nodes: globalNodes,
};

const allNodes = [
  ...g1Nodes,
  ...migratedInspectionNodes,
  ...a9Nodes,
  ...a11Nodes,
  ...globalNodes,
];
const allSources = uniqueSources([
  ...g1Catalog.sources,
  ...migratedCatalog.sources,
  ...a9Catalog.sources,
  ...a11Catalog.sources,
  ...globalCatalog.sources,
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
  catalog_version: "review-version1-ability-id-v3-a1-a11-global-2026-07-22",
  included_catalogs: [
    g1Catalog.catalog_id,
    migratedCatalog.catalog_id,
    a9Catalog.catalog_id,
    a11Catalog.catalog_id,
    globalCatalog.catalog_id,
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
  global_scope: globalCanonicalIds,
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
  correction_audit_document:
    "docs/jd-variable-tree/JD业务变量树_version1_本轮更正审计.md",
  detail_expansion_blueprint_document:
    "docs/jd-variable-tree/JD业务变量树_version1_详细度审计与扩展蓝图.md",
};

writeJson("jd_variable_tree_g1_a1_a5_draft.json", g1Catalog);
writeJson("jd_variable_tree_g2_g3_renumbered_draft.json", migratedCatalog);
writeJson("jd_variable_tree_a9_resource_management_draft.json", a9Catalog);
writeJson("jd_variable_tree_a11_control_draft.json", a11Catalog);
writeJson("jd_variable_tree_global_draft.json", globalCatalog);
writeJson("jd_variable_tree_version1.json", combinedCatalog);

console.log(
  [
    "knowledge/jd_variable_tree_g1_a1_a5_draft.json",
    "knowledge/jd_variable_tree_g2_g3_renumbered_draft.json",
    "knowledge/jd_variable_tree_a9_resource_management_draft.json",
    "knowledge/jd_variable_tree_a11_control_draft.json",
    "knowledge/jd_variable_tree_global_draft.json",
    "knowledge/jd_variable_tree_version1.json",
    `${allNodes.length} nodes`,
  ].join("\n"),
);
