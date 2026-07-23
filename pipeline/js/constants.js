/* pipeline/js/constants.js */
const STAGES = [
  ["STEP 1", "任务域选择",   "场景 + 简短描述"],
  ["STEP 2", "文案与 A×L",  "Coverage · 文案 · 分类"],
  ["STEP 3", "JD V2 选变量", "确认子树后再提取变量域"],
  ["STEP 4", "任务域模版",   "域编辑器(每行选模式)"],
  ["STEP 5", "特定任务模版", "Seed→具体 JD 值"],
];

const SCENARIO_TASK_EXAMPLES = {
  highway_inspection: "例如：让无人机巡查指定高速路段，持续识别和记录违法停车车辆。同一辆车短时遮挡后再次出现时不要重复上报；遇到定位异常先安全保持并通知调度人员。",
  oil_gas_inspection: "例如：让无人机沿油气管道巡检并持续记录发现的异常。电量不足以安全完成任务时，由它自己决定缩短巡检、返航还是去安全点。",
  bridge_inspection: "例如：让无人机检查桥底和指定结构件，把发现的病害标在桥梁三维模型上并持续更新。",
  campus_inspection: "例如：让无人机巡查园区道路和设施，发现异常后持续更新告警。需要近距离查看时通知机器狗去复核。",
  other_inspection: "例如：让无人机沿指定河段持续查找异常漂浮物，发现后记录位置和图片并发出告警。",
};

// ability-id-v3 changes every renamed A/JD identifier; do not silently restore
// browser drafts produced under the legacy numbering scheme.
const STORAGE_KEY = "uav_pipeline_v10";
const ABILITY_ID_SCHEME = "ability-id-v3-2026-07-20";
const SCENARIO_NONE = "";
const SCENARIO_FALLBACK_ID = "other_inspection";
// 没有经场景资料确认的“主测能力”时不预填等级。A×L 由人在 STEP 2 定靶。
const DEFAULT_TARGET_LEVELS = {};

function defaultTargetLevels() { return Object.assign({}, DEFAULT_TARGET_LEVELS); }

// 校验码 → 中文标题/说明。后端多数消息已是中文（issueMessage 会直接用），
// 这里主要为标题以及少量英文回退提供词典。
const ISSUE_ZH = {
  CATALOG_VERSION_MISMATCH: { title: "目录版本不一致", msg: "候选结果使用的目录版本与当前审定字典不一致。" },
  DUPLICATE_GAL_CELL: { title: "重复 A×L", msg: "Coverage 中出现了重复的 A×L 单元。" },
  UNKNOWN_GAL_CELL: { title: "未知 A×L", msg: "该 A×L 不在当前审定目录中。" },
  INCOMPLETE_CUMULATIVE_RESPONSIBILITY: { title: "累计责任不完整", msg: "需为每个继承等级各写一条责任（如 L3 含 L1–L3）。" },
  EVIDENCE_NOT_VERBATIM: { title: "证据非原文", msg: "证据摘录需是任务/场景文案中的原文；若为推断请改用 proposed。" },
  HUMAN_VALUE_MISSING_SOURCE: { title: "缺少来源说明", msg: "人工新增或修改的值需要填写来源说明。" },
  UNKNOWN_JD_SLOT: { title: "未知 JD", msg: "该 JD 槽位不在当前审定目录中。" },
  JD_NAME_MISMATCH: { title: "JD 名称不符", msg: "JD 名称与规范名称不一致。" },
  DUPLICATE_JD_SLOT: { title: "重复 JD", msg: "JD 候选中出现了重复的 slot ID。" },
  RUNTIME_DEPENDENCY_MARKED_SCORED: { title: "依赖被计分", msg: "运行时依赖必须保持不计分。" },
  MISSING_REQUIRED_JD_SLOT: { title: "缺少必填 JD", msg: "缺少必填 JD 槽位；未知时应以 TBD 输出。" },
  INTERNAL_LABEL_IN_NARRATIVE: { title: "文案含内部标识", msg: "文案/模版不得出现 A×L、GAL、JD 标识。" },
  INCOMPLETE_TEMPLATE_STRUCTURE: { title: "结构不完整", msg: "文案/模版段落结构不完整。" },
};

const WORLD_SIDE_JD = new Set([
  "jd-0.2", "jd-0.3", "jd-0.4", "jd-0.8", "jd-0.9",
  "jd-2.2",
  "jd-6.1", "jd-6.2", "jd-6.3",
  "jd-7.1", "jd-7.2", "jd-8.1", "jd-8.2",
  "jd-10.2", "jd-11.1", "jd-11.2",
  "jd-14.1", "jd-14.2", "jd-9.1",
  "jd-15.1", "jd-15.2", "jd-15.3",
  "jd-17.1",
]);
