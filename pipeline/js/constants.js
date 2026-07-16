/* pipeline/js/constants.js */
const STAGES = [
  ["STEP 1", "任务域选择",   "场景 + 简短描述"],
  ["STEP 2", "文案与 A×L",  "Coverage · 文案 · 分类"],
  ["STEP 3", "JD 域提取",   "变量域按 A 分组"],
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

const STORAGE_KEY = "uav_pipeline_v7";
const SCENARIO_NONE = "";
const SCENARIO_FALLBACK_ID = "other_inspection";
// 巡检常用默认：L2 受令自主；进入 Step 2 后可改等级或改成「不覆盖」
const DEFAULT_TARGET_LEVELS = {
  A1: "L2", A2: "L2", A3: "L2", A4: "L2", A5: "L2",
  A6a: "L2", A7: "L2", A9a: "L2", A9b: "L2", A12: "L2", A14: "L2", A15: "L2",
};

function defaultTargetLevels() { return Object.assign({}, DEFAULT_TARGET_LEVELS); }

const WORLD_SIDE_JD = new Set([
  "jd-0.2", "jd-0.3", "jd-0.4", "jd-0.8", "jd-0.9",
  "jd-2.2",
  "jd-5.1", "jd-5.2", "jd-5.3",
  "jd-6a.1", "jd-6a.2", "jd-6b.1", "jd-6b.2",
  "jd-7.2", "jd-8.1", "jd-8.2",
  "jd-10.1", "jd-10.2", "jd-11.1",
  "jd-13.1", "jd-13.2", "jd-13.3",
  "jd-15.1",
]);
