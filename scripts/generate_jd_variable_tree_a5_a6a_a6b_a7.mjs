#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const outputJson = path.join(
  rootDir,
  "knowledge",
  "jd_variable_tree_a5_a6a_a6b_a7.json",
);
const outputYaml = path.join(
  rootDir,
  "knowledge",
  "jd_variable_tree_a5_a6a_a6b_a7.yaml",
);
const outputMarkdown = path.join(
  rootDir,
  "docs",
  "jd-variable-tree",
  "JD业务变量树_A5_A6a_A6b_A7_高速与园区巡检_机读版.md",
);

const BOTH = ["highway_inspection", "campus_inspection"];
const HIGHWAY = ["highway_inspection"];
const CAMPUS = ["campus_inspection"];

const sources = [
  {
    source_id: "L-JD66",
    title: "JD业务变量字典_66槽位_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator: "A5, A6a, A6b, A7 canonical slots",
    url: null,
    evidence_grade: "authoritative_local",
  },
  {
    source_id: "L-AXL68",
    title: "AxL责任定义字典_17A_68单元_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator: "A5, A6a, A6b, A7 L1-L4",
    url: null,
    evidence_grade: "authoritative_local",
  },
  {
    source_id: "L-SCENARIO",
    title: "business_scenario_registry.json",
    issuer: "UAV Benchmark team",
    source_type: "team_scenario_registry",
    locator: "highway_inspection; campus_inspection",
    url: null,
    evidence_grade: "authoritative_local",
  },
  {
    source_id: "L-INSPECTION-IMAGE",
    title: "巡检作业类需求截图",
    issuer: "team material",
    source_type: "team_material",
    locator: "高速巡检、园区巡检功能清单",
    url: null,
    evidence_grade: "team_material_only",
  },
  {
    source_id: "W-TRAFFIC-LAW",
    title: "中华人民共和国道路交通安全法",
    issuer: "全国人民代表大会常务委员会",
    source_type: "law",
    locator: "第五十六条；第一百一十九条",
    url: "https://www.npc.gov.cn/npc/c1773/c1849/c6680/c31694/c31700/201905/t20190521_260616.html",
    evidence_grade: "authoritative_external",
  },
  {
    source_id: "W-TRAFFIC-REG",
    title: "中华人民共和国道路交通安全法实施条例",
    issuer: "国务院",
    source_type: "administrative_regulation",
    locator: "第六十三条；第八十二条",
    url: "https://www.samr.gov.cn/zljds/zcfg/art/2023/art_5c212e15369443b3b2bea4e17a1c565b.html",
    evidence_grade: "authoritative_external",
  },
  {
    source_id: "W-FIRE-LAW",
    title: "中华人民共和国消防法",
    issuer: "全国人民代表大会常务委员会",
    source_type: "law",
    locator: "第二十八条",
    url: "https://www.miit.gov.cn/jgsj/qyj/zcfg/art/2020/art_b16ed856d4544dc28499e85ebed43efe.html",
    evidence_grade: "authoritative_external",
  },
  {
    source_id: "W-GB5768",
    title: "GB 5768 道路交通标志和标线系列",
    issuer: "国家市场监督管理总局、国家标准化管理委员会",
    source_type: "national_standard",
    locator: "GB 5768.2-2022; GB 5768.3-2025",
    url: "https://openstd.samr.gov.cn/bzgk/std/std_list?p.p1=0&p.p2=GB5768&p.p90=circulation_date&p.p91=desc",
    evidence_grade: "authoritative_external",
  },
  {
    source_id: "W-UAV-POLICE-HB",
    title: "关于在全市高速公路启用警用无人机交通技术监控设备的通告",
    issuer: "淮北市公安局交通警察支队",
    source_type: "official_notice",
    locator: "高速公路无人机抓拍对象",
    url: "https://gaj.huaibei.gov.cn/jwzx/tzgg/57921821.html",
    evidence_grade: "authoritative_external_scoped",
  },
  {
    source_id: "W-UAV-PARKING-SZ",
    title: "严管路面违停行为！深圳交警“无人机集群”开展交通文明治理",
    issuer: "深圳市公安局交通管理局",
    source_type: "official_practice",
    locator: "无人机违停巡飞、喊话驱离和抓拍取证",
    url: "https://www.sz.gov.cn/cn/xxgk/zfxxgj/bmdt/content/post_12699739.html",
    evidence_grade: "authoritative_external_scoped",
  },
  {
    source_id: "W-JTG5210",
    title: "JTG 5210—2018 公路技术状况评定标准",
    issuer: "交通运输部",
    source_type: "industry_standard",
    locator: "路面损坏类别及计量",
    url: "https://xxgk.mot.gov.cn/jigou/glj/202204/P020220425579066545831.pdf",
    evidence_grade: "authoritative_external",
  },
  {
    source_id: "W-MOT-UAV-BRIDGE",
    title: "低空无人机应用公路桥梁巡检技术指南（试行）",
    issuer: "交通运输部",
    source_type: "official_guideline",
    locator: "交办公路〔2026〕8号",
    url: "https://xxgk.mot.gov.cn/jigou/glj/202602/P020260228435553861410.pdf",
    evidence_grade: "authoritative_external_scoped",
  },
  {
    source_id: "W-MOT-LOWALT-CASES",
    title: "低空交通运输应用场景典型案例",
    issuer: "交通运输部",
    source_type: "official_case_collection",
    locator: "贵州精细化低空高速公路路网巡检",
    url: "https://xxgk.mot.gov.cn/jigou/ysfws/202511/P020251118558935046297.pdf",
    evidence_grade: "authoritative_external_scoped",
  },
  {
    source_id: "W-RDD2022",
    title: "RDD2022: A multi-national image dataset for automatic Road Damage Detection",
    issuer: "dataset authors",
    source_type: "dataset_paper",
    locator: "road damage labels",
    url: "https://arxiv.org/abs/2209.08538",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-VISDRONE",
    title: "VisDrone Dataset",
    issuer: "天津大学 AISKYEYE team",
    source_type: "official_dataset",
    locator: "object classes, visibility, occlusion, density, detection and tracking",
    url: "https://github.com/VisDrone/VisDrone-Dataset",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-BDD100K",
    title: "BDD100K",
    issuer: "UC Berkeley",
    source_type: "official_dataset",
    locator: "vehicles, lanes, drivable area, detection and tracking",
    url: "https://bdd-data.berkeley.edu/download.html",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-OPENDRIVE",
    title: "ASAM OpenDRIVE 1.8.1",
    issuer: "ASAM",
    source_type: "standard",
    locator: "coordinate systems, roads, lanes, junctions, parking spaces and objects",
    url: "https://publications.pages.asam.net/standards/ASAM_OpenDRIVE/ASAM_OpenDRIVE_Specification/v1.8.1/specification/index.html",
    evidence_grade: "authoritative_external",
  },
  {
    source_id: "W-OGC-WKT",
    title: "OGC WKT-CRS",
    issuer: "Open Geospatial Consortium",
    source_type: "standard",
    locator: "coordinate reference system representation",
    url: "https://www.ogc.org/standards/wkt-crs/",
    evidence_grade: "authoritative_external",
  },
  {
    source_id: "W-ROS-REP105",
    title: "ROS REP-105 Coordinate Frames for Mobile Platforms",
    issuer: "Open Robotics",
    source_type: "official_convention",
    locator: "map, odom, base_link",
    url: "https://reps.openrobotics.org/rep-0105/",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-GPS-SPS",
    title: "GPS Standard Positioning Service Performance Standard, 5th Edition",
    issuer: "United States Government",
    source_type: "official_standard",
    locator: "GPS service performance and availability terms",
    url: "https://www.gps.gov/technical/ps/2020-SPS-performance-standard.pdf",
    evidence_grade: "authoritative_external",
  },
  {
    source_id: "W-PX4-EKF",
    title: "PX4 EKF2 Documentation",
    issuer: "PX4",
    source_type: "official_platform_documentation",
    locator: "sources, innovations, resets, GNSS checks, multi-EKF consistency",
    url: "https://docs.px4.io/main/en/advanced_config/tuning_the_ecl_ekf",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-MAVLINK-MISSION",
    title: "MAVLink Mission Protocol",
    issuer: "MAVLink",
    source_type: "official_protocol",
    locator: "mission items, frames, sequence, NAV/DO/CONDITION commands",
    url: "https://mavlink.io/en/services/mission.html",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-PX4-MISSION",
    title: "PX4 Mission Mode",
    issuer: "PX4",
    source_type: "official_platform_documentation",
    locator: "predefined mission execution and position prerequisites",
    url: "https://docs.px4.io/main/en/flight_modes_mc/mission",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-AIRSIM",
    title: "AirSim Settings and APIs",
    issuer: "Microsoft AirSim",
    source_type: "official_simulator_documentation",
    locator: "origin, NED, camera, wind, weather and world variables",
    url: "https://microsoft.github.io/AirSim/settings/",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-CARLA",
    title: "CARLA World and Weather",
    issuer: "CARLA",
    source_type: "official_simulator_documentation",
    locator: "world-side weather, actors and snapshots",
    url: "https://carla.readthedocs.io/en/latest/core_world/",
    evidence_grade: "source_supported",
  },
];

const nodes = [];

function normalizeDomain(domain) {
  if (domain === null || domain === undefined) return null;
  if (Array.isArray(domain)) {
    return domain.map((item) =>
      typeof item === "string"
        ? {
            value: item,
            label_zh: item,
            source_refs: [],
            status: "inferred_candidate",
            applicable_scenarios: BOTH,
          }
        : item,
    );
  }
  return domain;
}

function baseNode({
  node_id,
  parent_id,
  canonical_slot = null,
  owner_a,
  name,
  definition,
  node_kind,
  value_type = "none",
  value_domain = null,
  unit = null,
  activation_condition = null,
  multiplicity = "one",
  difficulty_direction = "TBD",
  configuration_side = "shared",
  visibility = ["sut_visible"],
  applicable_scenarios = BOTH,
  related_global_jd = [],
  related_jd = [],
  used_by_axl = [],
  source = [],
  evidence_status = "inferred_candidate",
  review_status = "proposed",
  notes = null,
  depends_on = [],
  mutual_exclusion_group = null,
  constraints = [],
  legacy_aliases = [],
}) {
  nodes.push({
    schema_version: "jd-tree/0.2.1",
    node_id,
    parent_id,
    canonical_slot,
    owner_a,
    name,
    definition,
    node_kind,
    value_type,
    value_domain: normalizeDomain(value_domain),
    unit,
    activation_condition,
    multiplicity,
    difficulty_direction,
    configuration_side,
    visibility,
    applicable_scenarios,
    related_global_jd,
    related_jd,
    used_by_axl: used_by_axl.map((cell) => cell.replace(".", "×")),
    depends_on,
    mutual_exclusion_group,
    constraints,
    source,
    evidence_status,
    review_status,
    legacy_aliases,
    notes,
  });
}

function domain(
  value,
  label_zh,
  source_refs,
  applicable_scenarios = BOTH,
  status = "source_supported",
) {
  return { value, label_zh, source_refs, status, applicable_scenarios };
}

function root(owner_a, name, definition) {
  baseNode({
    node_id: `PROPOSED-jd-tree-${owner_a}`,
    parent_id: "PROPOSED-jd-tree-inspection",
    owner_a,
    name,
    definition,
    node_kind: "capability_root",
    source: ["L-JD66", "L-AXL68"],
    evidence_status: "authoritative_existing",
  });
}

function canonical(id, owner_a, name, definition) {
  baseNode({
    node_id: id,
    parent_id: `PROPOSED-jd-tree-${owner_a}`,
    canonical_slot: id,
    owner_a,
    name,
    definition,
    node_kind: "group",
    source: ["L-JD66"],
    evidence_status: "authoritative_existing",
    review_status: "reviewed",
  });
}

function group(id, parent_id, canonical_slot, owner_a, name, definition, options = {}) {
  baseNode({
    node_id: id,
    parent_id,
    canonical_slot,
    owner_a,
    name,
    definition,
    node_kind: "group",
    source: options.source ?? ["L-JD66", "L-AXL68"],
    evidence_status: options.evidence_status ?? "inferred_candidate",
    applicable_scenarios: options.applicable_scenarios ?? BOTH,
    related_global_jd: options.related_global_jd ?? [],
    related_jd: options.related_jd ?? [],
    notes: options.notes ?? null,
  });
}

function variable(
  id,
  parent_id,
  canonical_slot,
  owner_a,
  name,
  definition,
  value_type,
  value_domain,
  options = {},
) {
  baseNode({
    node_id: id,
    parent_id,
    canonical_slot,
    owner_a,
    name,
    definition,
    node_kind: "variable",
    value_type,
    value_domain,
    unit: options.unit ?? null,
    activation_condition: options.activation_condition ?? null,
    multiplicity: options.multiplicity ?? "one",
    difficulty_direction: options.difficulty_direction ?? "TBD",
    configuration_side: options.configuration_side ?? "shared",
    visibility: options.visibility ?? ["sut_visible"],
    applicable_scenarios: options.applicable_scenarios ?? BOTH,
    related_global_jd: options.related_global_jd ?? [],
    related_jd: options.related_jd ?? [],
    used_by_axl: options.used_by_axl ?? [],
    depends_on: options.depends_on ?? [],
    mutual_exclusion_group: options.mutual_exclusion_group ?? null,
    constraints: options.constraints ?? [],
    source: options.source ?? [],
    evidence_status: options.evidence_status ?? "source_supported",
    review_status: options.review_status ?? "proposed",
    notes: options.notes ?? null,
  });
}

baseNode({
  node_id: "PROPOSED-jd-tree-inspection",
  parent_id: null,
  owner_a: "MULTI",
  name: "高速与园区巡检共享业务变量树",
  definition:
    "以车辆停止/停放事件为共享主线，并保留高速道路病害的可选扩展；A5、A6a、A6b、A7 可被同一任务同时引用。",
  node_kind: "scenario_root",
  source: ["L-SCENARIO", "L-INSPECTION-IMAGE"],
  evidence_status: "team_material_only",
  notes:
    "停车/停止是可观测事件；是否违法必须结合道路适用性、区域规则、时间条件和合法例外后判定。",
});

root("A5", "环境感知 / 态势感知", "描述业务对象、场景观测条件、模态与感知策略适用性。");
root("A6a", "自定位 / 姿态航向估计", "描述绝对位姿来源、参考系、质量退化与定位策略适用性。");
root("A6b", "相对定位 / 方位关系估计", "描述相对道路、区域、车辆和检查对象的几何及恢复条件。");
root("A7", "导航 / 航迹 / 轨迹管理", "描述道路/园区拓扑、巡检航路、重规划判据与航迹处置。");

// A5
canonical(
  "jd-5.1",
  "A5",
  "业务对象类目",
  "所有可感知业务对象及类别标签，包括目标、相似干扰对象、风险对象及其业务状态。",
);
group(
  "PROPOSED-jd-5.1.1",
  "jd-5.1",
  "jd-5.1",
  "A5",
  "巡检目标与事件",
  "定义任务要求关注的对象家族、实体类别和停止/停放事件状态。",
);
variable(
  "PROPOSED-jd-5.1.1.1",
  "PROPOSED-jd-5.1.1",
  "jd-5.1",
  "A5",
  "业务目标家族",
  "本次巡检所针对的业务对象家族；车辆停止/停放为双场景共享主线，道路病害为高速可选分支。",
  "multi_enum",
  [
    domain("vehicle_stop_or_parking_event", "车辆停止或停放事件", ["W-TRAFFIC-LAW", "L-SCENARIO"]),
    domain("road_surface_distress", "道路表面病害", ["W-JTG5210", "W-RDD2022"], HIGHWAY),
  ],
  {
    configuration_side: "user",
    used_by_axl: ["A5.L1", "A5.L2", "A5.L3", "A5.L4"],
    source: ["L-JD66", "L-SCENARIO", "W-TRAFFIC-LAW", "W-JTG5210"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-5.1.1.2",
  "PROPOSED-jd-5.1.1",
  "jd-5.1",
  "A5",
  "车辆实体类别",
  "场景中目标车辆的实体类别。",
  "enum",
  [
    domain("car", "小客车", ["W-VISDRONE", "W-BDD100K"]),
    domain("van", "面包车/厢式车", ["W-VISDRONE"]),
    domain("truck", "货车", ["W-VISDRONE", "W-BDD100K"]),
    domain("bus", "客车/公交车", ["W-VISDRONE", "W-BDD100K"]),
    domain("motorcycle", "摩托车", ["W-VISDRONE", "W-BDD100K"]),
    domain("special_vehicle", "特种/作业车辆", [], BOTH, "inferred_candidate"),
    domain("other_or_unknown", "其他或未知", ["W-VISDRONE"]),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-5.1.1.1",
      contains: "vehicle_stop_or_parking_event",
    },
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L1", "A5.L2", "A5.L3"],
    source: ["W-VISDRONE", "W-BDD100K"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-5.1.1.3",
  "PROPOSED-jd-5.1.1",
  "jd-5.1",
  "A5",
  "车辆停止/停放状态",
  "车辆在观测时段内的运动与停放状态；该状态本身不等同于违法结论。",
  "enum",
  [
    domain("moving", "行驶中", ["W-BDD100K"]),
    domain("slowing_or_queueing", "减速或排队", [], BOTH, "inferred_candidate"),
    domain("temporary_stop", "临时停止", ["W-TRAFFIC-LAW"]),
    domain("parked", "停放", ["W-TRAFFIC-LAW"]),
    domain("broken_down", "故障停车", ["W-TRAFFIC-REG"], HIGHWAY),
    domain("accident_related_stop", "事故相关停车", ["W-TRAFFIC-REG"], HIGHWAY),
    domain("departing", "正在驶离", ["W-UAV-PARKING-SZ"]),
    domain("unknown", "无法判定", [], BOTH, "inferred_candidate"),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-5.1.1.1",
      contains: "vehicle_stop_or_parking_event",
    },
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L1", "A5.L2", "A5.L3"],
    source: ["W-TRAFFIC-LAW", "W-TRAFFIC-REG", "W-BDD100K"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-5.1.1.4",
  "PROPOSED-jd-5.1.1",
  "jd-5.1",
  "A5",
  "道路病害类别",
  "高速道路表面病害类别；正式 taxonomy 以 JTG 5210 为基线，数据集标签只作为可观测性补充。",
  "enum",
  [
    domain("alligator_cracking", "龟裂", ["W-JTG5210", "W-RDD2022"], HIGHWAY),
    domain("block_cracking", "块状裂缝", ["W-JTG5210"], HIGHWAY),
    domain("longitudinal_cracking", "纵向裂缝", ["W-JTG5210", "W-RDD2022"], HIGHWAY),
    domain("transverse_cracking", "横向裂缝", ["W-JTG5210", "W-RDD2022"], HIGHWAY),
    domain("depression", "沉陷", ["W-JTG5210"], HIGHWAY),
    domain("rutting", "车辙", ["W-JTG5210"], HIGHWAY),
    domain("shoving", "波浪拥包", ["W-JTG5210"], HIGHWAY),
    domain("pothole", "坑槽", ["W-JTG5210", "W-RDD2022"], HIGHWAY),
    domain("raveling", "松散", ["W-JTG5210"], HIGHWAY),
    domain("bleeding", "泛油", ["W-JTG5210"], HIGHWAY),
    domain("patching", "修补", ["W-JTG5210"], HIGHWAY),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-5.1.1.1",
      contains: "road_surface_distress",
    },
    applicable_scenarios: HIGHWAY,
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L1", "A5.L2", "A5.L3"],
    source: ["W-JTG5210", "W-RDD2022"],
    difficulty_direction: "context_dependent",
    notes: "严重度阈值不得从车载数据集或常识外推为无人机可检测阈值。",
  },
);

group(
  "PROPOSED-jd-5.1.2",
  "jd-5.1",
  "jd-5.1",
  "A5",
  "区域规则与业务判定上下文",
  "把可观测停车事件与道路/园区规则、例外条件和判定状态分开。",
  {
    related_global_jd: ["jd-0.6"],
    source: ["W-TRAFFIC-LAW", "W-TRAFFIC-REG", "W-FIRE-LAW", "W-GB5768"],
  },
);
variable(
  "PROPOSED-jd-5.1.2.1",
  "PROPOSED-jd-5.1.2",
  "jd-5.1",
  "A5",
  "规则来源类型",
  "用于评价停车/停止事件的规则来源。",
  "multi_enum",
  [
    domain("national_law_or_regulation", "国家法律或行政法规", ["W-TRAFFIC-LAW", "W-TRAFFIC-REG", "W-FIRE-LAW"]),
    domain("traffic_sign_or_marking", "交通标志或标线", ["W-GB5768"]),
    domain("site_management_rule", "园区管理规则", ["L-SCENARIO"], CAMPUS, "team_material_only"),
    domain("temporary_task_rule", "临时任务规则", ["L-SCENARIO"], BOTH, "team_material_only"),
  ],
  {
    configuration_side: "user",
    related_global_jd: ["jd-0.6"],
    used_by_axl: ["A5.L1", "A5.L3", "A5.L4"],
    source: ["W-TRAFFIC-LAW", "W-TRAFFIC-REG", "W-FIRE-LAW", "W-GB5768", "L-SCENARIO"],
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-5.1.2.2",
  "PROPOSED-jd-5.1.2",
  "jd-5.1",
  "A5",
  "停车区域业务语义",
  "车辆所在区域在业务规则中的语义；几何位置本身由 A6b 描述。",
  "enum",
  [
    domain("travel_lane", "行车道", ["W-TRAFFIC-REG"], HIGHWAY),
    domain("emergency_lane", "应急车道", ["W-TRAFFIC-REG", "W-UAV-POLICE-HB"], HIGHWAY),
    domain("ramp_or_diverge_area", "匝道或导流区域", ["W-TRAFFIC-REG", "W-GB5768"], HIGHWAY),
    domain("road_shoulder", "路肩", ["W-TRAFFIC-REG"], HIGHWAY),
    domain("marked_parking_space", "施划停车位", ["W-TRAFFIC-LAW", "W-GB5768"]),
    domain("no_parking_zone", "禁停区域", ["W-GB5768"]),
    domain("fire_access_lane", "消防车通道", ["W-FIRE-LAW"], CAMPUS),
    domain("loading_or_service_zone", "装卸/作业区", [], CAMPUS, "inferred_candidate"),
    domain("pedestrian_or_access_area", "人行或出入口区域", ["W-TRAFFIC-LAW"], CAMPUS),
    domain("authorized_reserved_zone", "授权/专用区域", ["L-SCENARIO"], CAMPUS, "team_material_only"),
    domain("unknown_zone", "区域语义未知", [], BOTH, "inferred_candidate"),
  ],
  {
    configuration_side: "shared",
    visibility: ["sut_visible", "grader_visible"],
    related_jd: ["jd-6b.1"],
    used_by_axl: ["A5.L1", "A5.L3", "A6b.L1", "A6b.L2"],
    source: ["W-TRAFFIC-LAW", "W-TRAFFIC-REG", "W-FIRE-LAW", "W-GB5768", "L-SCENARIO"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-5.1.2.3",
  "PROPOSED-jd-5.1.2",
  "jd-5.1",
  "A5",
  "合法例外/授权上下文",
  "停车事件是否存在故障、事故、紧急、作业或园区授权等例外背景。",
  "multi_enum",
  [
    domain("none_known", "无已知例外", ["W-TRAFFIC-LAW"]),
    domain("vehicle_breakdown", "车辆故障", ["W-TRAFFIC-REG"], HIGHWAY),
    domain("traffic_accident", "交通事故", ["W-TRAFFIC-REG"], HIGHWAY),
    domain("emergency_response", "应急处置", ["W-TRAFFIC-REG", "W-FIRE-LAW"]),
    domain("authorized_operation", "经授权作业", ["L-SCENARIO"], CAMPUS, "team_material_only"),
    domain("temporary_loading_or_service", "临时装卸或服务", [], CAMPUS, "inferred_candidate"),
    domain("unknown", "例外条件未知", [], BOTH, "inferred_candidate"),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-5.1.1.1",
      contains: "vehicle_stop_or_parking_event",
    },
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L3", "A5.L4"],
    source: ["W-TRAFFIC-LAW", "W-TRAFFIC-REG", "W-FIRE-LAW", "L-SCENARIO"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-5.1.2.4",
  "PROPOSED-jd-5.1.2",
  "jd-5.1",
  "A5",
  "规则判定真值",
  "由停车状态、所在区域、适用规则和合法例外共同派生的 grader 真值；不是单纯视觉类别。",
  "enum",
  [
    domain("compliant_or_authorized", "合规或已授权", ["W-TRAFFIC-LAW", "L-SCENARIO"]),
    domain("violation", "违反适用规则", ["W-TRAFFIC-LAW", "W-TRAFFIC-REG", "W-FIRE-LAW"]),
    domain("exception_possible", "可能存在合法例外", ["W-TRAFFIC-REG"]),
    domain("insufficient_context", "上下文不足，无法判定", [], BOTH, "inferred_candidate"),
  ],
  {
    activation_condition: {
      all: [
        { node: "PROPOSED-jd-5.1.1.1", contains: "vehicle_stop_or_parking_event" },
        { node: "PROPOSED-jd-5.1.2.1", operator: "non_empty" },
      ],
    },
    configuration_side: "shared",
    visibility: ["grader_only", "hidden_gt"],
    used_by_axl: ["A5.L1", "A5.L3", "A5.L4"],
    depends_on: [
      "PROPOSED-jd-5.1.1.3",
      "PROPOSED-jd-5.1.2.1",
      "PROPOSED-jd-5.1.2.2",
      "PROPOSED-jd-5.1.2.3",
    ],
    source: ["W-TRAFFIC-LAW", "W-TRAFFIC-REG", "W-FIRE-LAW"],
    evidence_status: "inferred_candidate",
    difficulty_direction: "neutral",
    notes: "具体判定规则必须由法规、标志标线或团队园区规则提供，缺少规则时不得生成 violation。",
  },
);

group(
  "PROPOSED-jd-5.1.3",
  "jd-5.1",
  "jd-5.1",
  "A5",
  "对象身份与可核验属性",
  "支持连续检测、身份维护和证据核验的对象属性。",
  { source: ["W-VISDRONE", "W-UAV-PARKING-SZ"] },
);
variable(
  "PROPOSED-jd-5.1.3.1",
  "PROPOSED-jd-5.1.3",
  "jd-5.1",
  "A5",
  "车牌存在性",
  "目标车辆是否具有可观测车牌区域。",
  "enum",
  [
    domain("present", "存在", ["W-UAV-PARKING-SZ"]),
    domain("not_visible", "存在但当前不可见", ["W-VISDRONE"]),
    domain("absent_or_not_applicable", "缺失或不适用", [], BOTH, "inferred_candidate"),
    domain("unknown", "未知", [], BOTH, "inferred_candidate"),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-5.1.1.1",
      contains: "vehicle_stop_or_parking_event",
    },
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L1", "A5.L2"],
    source: ["W-UAV-PARKING-SZ", "W-VISDRONE"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-5.1.3.2",
  "PROPOSED-jd-5.1.3",
  "jd-5.1",
  "A5",
  "车牌可读性状态",
  "在当前观测条件下车牌是否达到任务要求的可读状态；分辨率阈值保持 TBD。",
  "enum",
  [
    domain("readable", "可读", ["W-UAV-PARKING-SZ"]),
    domain("partially_readable", "部分可读", [], BOTH, "inferred_candidate"),
    domain("unreadable", "不可读", ["W-VISDRONE"]),
    domain("not_observed", "未观测到", ["W-VISDRONE"]),
  ],
  {
    activation_condition: { node: "PROPOSED-jd-5.1.3.1", equals: "present" },
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L1", "A5.L2", "A5.L3", "A5.L4"],
    source: ["W-UAV-PARKING-SZ", "W-VISDRONE"],
    difficulty_direction: "context_dependent",
    notes: "不在本节点规定像素、字符高度或识别率阈值。",
  },
);
variable(
  "PROPOSED-jd-5.1.3.3",
  "PROPOSED-jd-5.1.3",
  "jd-5.1",
  "A5",
  "实例身份真值",
  "用于连续帧、重观测和跨航段去重的对象实例标识；只供 Fixture/Grader。",
  "string",
  null,
  {
    activation_condition: {
      node: "PROPOSED-jd-5.1.1.1",
      contains: "vehicle_stop_or_parking_event",
    },
    multiplicity: "one_per_target",
    configuration_side: "world",
    visibility: ["fixture_only", "hidden_gt"],
    used_by_axl: ["A5.L2", "A5.L4"],
    source: ["W-VISDRONE"],
    difficulty_direction: "neutral",
  },
);

canonical(
  "jd-5.2",
  "A5",
  "典型场景特征",
  "目标数量、密度、分布、动态性、遮挡、尺度、视角和观测质量等场景特征。",
);
group(
  "PROPOSED-jd-5.2.1",
  "jd-5.2",
  "jd-5.2",
  "A5",
  "数量、分布与动态性",
  "描述目标实例的数量、空间组织和时间变化。",
  { source: ["W-VISDRONE", "W-BDD100K"] },
);
variable(
  "PROPOSED-jd-5.2.1.1",
  "PROPOSED-jd-5.2.1",
  "jd-5.2",
  "A5",
  "目标实例数量",
  "本次启用检查范围内的业务目标实例数量。",
  "integer",
  { min: 0, max: null, tbd_reason: "场景规模上限待任务或平台确认" },
  {
    unit: "count",
    multiplicity: "one",
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L1", "A5.L2"],
    source: ["L-JD66", "W-VISDRONE"],
    difficulty_direction: "increasing",
  },
);
variable(
  "PROPOSED-jd-5.2.1.2",
  "PROPOSED-jd-5.2.1",
  "jd-5.2",
  "A5",
  "目标密度等级",
  "相对于启用路段或园区检查区的目标密度档位；档位阈值保持 TBD。",
  "enum",
  [
    domain("sparse", "稀疏", ["W-VISDRONE"]),
    domain("moderate", "中等", ["W-VISDRONE"]),
    domain("dense", "密集", ["W-VISDRONE"]),
    domain("TBD", "档位阈值待定", [], BOTH, "TBD"),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible", "grader_visible"],
    used_by_axl: ["A5.L1", "A5.L2"],
    source: ["W-VISDRONE"],
    difficulty_direction: "increasing",
  },
);
variable(
  "PROPOSED-jd-5.2.1.3",
  "PROPOSED-jd-5.2.1",
  "jd-5.2",
  "A5",
  "目标空间分布模式",
  "目标在道路或园区检查区内的空间分布模式。",
  "enum",
  [
    domain("isolated", "孤立", ["W-VISDRONE"]),
    domain("clustered", "聚集", ["W-VISDRONE"]),
    domain("linear_along_corridor", "沿道路/走廊线性分布", ["L-SCENARIO"]),
    domain("near_boundary", "靠近区域边界", ["W-GB5768"]),
    domain("mixed", "混合分布", [], BOTH, "inferred_candidate"),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible", "grader_visible"],
    used_by_axl: ["A5.L1", "A5.L2", "A5.L3"],
    source: ["W-VISDRONE", "L-SCENARIO", "W-GB5768"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-5.2.1.4",
  "PROPOSED-jd-5.2.1",
  "jd-5.2",
  "A5",
  "目标运动阶段",
  "观测区间内目标的运动阶段，用于区分停车、排队、短暂停留和驶离。",
  "enum",
  [
    domain("stationary_full_window", "全观测窗静止", ["W-VISDRONE"]),
    domain("moving_to_stop", "由运动转为停止", ["W-BDD100K"]),
    domain("stopped_to_moving", "由停止转为驶离", ["W-UAV-PARKING-SZ"]),
    domain("intermittent_motion", "间歇运动", [], BOTH, "inferred_candidate"),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-5.1.1.1",
      contains: "vehicle_stop_or_parking_event",
    },
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L1", "A5.L2", "A5.L3"],
    source: ["W-VISDRONE", "W-BDD100K", "W-UAV-PARKING-SZ"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-5.2.1.5",
  "PROPOSED-jd-5.2.1",
  "jd-5.2",
  "A5",
  "停止持续时间",
  "目标连续停止或停放的真实持续时间。",
  "number",
  { min: 0, max: null, tbd_reason: "判定阈值由法规或园区规则提供" },
  {
    unit: "s",
    activation_condition: {
      node: "PROPOSED-jd-5.1.1.3",
      in: ["temporary_stop", "parked", "broken_down", "accident_related_stop"],
    },
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L2", "A5.L3"],
    source: ["W-TRAFFIC-LAW", "L-SCENARIO"],
    evidence_status: "inferred_candidate",
    difficulty_direction: "context_dependent",
  },
);

group(
  "PROPOSED-jd-5.2.2",
  "jd-5.2",
  "jd-5.2",
  "A5",
  "观测可见性与质量",
  "描述遮挡、目标尺度、视角及数据质量退化。",
  {
    related_global_jd: ["jd-0.3", "jd-0.9"],
    source: ["W-VISDRONE", "W-MOT-UAV-BRIDGE", "W-AIRSIM", "W-CARLA"],
  },
);
variable(
  "PROPOSED-jd-5.2.2.1",
  "PROPOSED-jd-5.2.2",
  "jd-5.2",
  "A5",
  "遮挡等级",
  "业务目标被其他对象或结构遮挡的程度；不使用无来源的数值分界。",
  "enum",
  [
    domain("none", "无遮挡", ["W-VISDRONE"]),
    domain("partial", "部分遮挡", ["W-VISDRONE"]),
    domain("heavy", "重度遮挡", ["W-VISDRONE"]),
    domain("fully_unobserved", "完全不可见", ["W-VISDRONE"]),
  ],
  {
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L2", "A5.L3", "A5.L4"],
    source: ["W-VISDRONE"],
    difficulty_direction: "increasing",
  },
);
variable(
  "PROPOSED-jd-5.2.2.2",
  "PROPOSED-jd-5.2.2",
  "jd-5.2",
  "A5",
  "目标表观尺度等级",
  "目标在感知数据中的表观尺度档位；像素或 GSD 分界保持 TBD。",
  "enum",
  [
    domain("small", "小目标", ["W-VISDRONE"]),
    domain("medium", "中等目标", ["W-VISDRONE"]),
    domain("large", "大目标", ["W-VISDRONE"]),
    domain("TBD", "尺度分界待定", [], BOTH, "TBD"),
  ],
  {
    configuration_side: "world",
    visibility: ["grader_visible"],
    used_by_axl: ["A5.L1", "A5.L3", "A5.L4"],
    source: ["W-VISDRONE"],
    difficulty_direction: "decreasing",
  },
);
variable(
  "PROPOSED-jd-5.2.2.3",
  "PROPOSED-jd-5.2.2",
  "jd-5.2",
  "A5",
  "观测视角类别",
  "传感器对目标/道路的主要观测视角。",
  "enum",
  [
    domain("nadir", "近垂直俯视", ["W-MOT-UAV-BRIDGE"]),
    domain("oblique", "斜视", ["W-MOT-UAV-BRIDGE"]),
    domain("side_or_low_oblique", "侧视或低斜视", ["W-MOT-UAV-BRIDGE"]),
    domain("mixed_multi_view", "多视角组合", ["W-MOT-UAV-BRIDGE"]),
  ],
  {
    configuration_side: "user",
    visibility: ["sut_visible"],
    used_by_axl: ["A5.L1", "A5.L4", "A6b.L1"],
    related_jd: ["jd-6b.1", "jd-7.2"],
    source: ["W-MOT-UAV-BRIDGE"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-5.2.2.4",
  "PROPOSED-jd-5.2.2",
  "jd-5.2",
  "A5",
  "图像/观测质量退化类型",
  "影响检测与身份维护的观测质量退化类型。",
  "multi_enum",
  [
    domain("motion_blur", "运动模糊", ["W-VISDRONE"]),
    domain("defocus_blur", "失焦", [], BOTH, "inferred_candidate"),
    domain("under_exposure", "欠曝", ["W-VISDRONE"]),
    domain("over_exposure_or_glare", "过曝或眩光", ["W-VISDRONE"]),
    domain("compression_artifact", "压缩伪影", [], BOTH, "inferred_candidate"),
    domain("rain_fog_or_haze", "雨雾霾", ["W-VISDRONE", "W-CARLA"]),
    domain("low_contrast", "低对比度", ["W-VISDRONE"]),
    domain("none", "无显著退化", ["W-VISDRONE"]),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible", "grader_visible"],
    related_global_jd: ["jd-0.3"],
    used_by_axl: ["A5.L1", "A5.L2", "A5.L3", "A5.L4"],
    source: ["W-VISDRONE", "W-CARLA"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-5.2.2.5",
  "PROPOSED-jd-5.2.2",
  "jd-5.2",
  "A5",
  "相似干扰对象集合",
  "可能与目标业务状态混淆的正常对象或相似事件。",
  "multi_enum",
  [
    domain("legal_parking", "合法停车", ["W-TRAFFIC-LAW"]),
    domain("short_stop", "短暂停留", ["W-TRAFFIC-LAW"]),
    domain("traffic_queue", "交通排队", [], HIGHWAY, "inferred_candidate"),
    domain("breakdown_or_accident", "故障或事故停车", ["W-TRAFFIC-REG"], HIGHWAY),
    domain("authorized_service_vehicle", "授权作业车辆", ["L-SCENARIO"], CAMPUS, "team_material_only"),
    domain("adjacent_lane_or_zone_vehicle", "相邻车道/区域车辆", ["W-OPENDRIVE"]),
    domain("vehicle_like_structure", "类车辆结构或遮挡物", ["W-VISDRONE"]),
  ],
  {
    configuration_side: "world",
    visibility: ["hidden_gt"],
    used_by_axl: ["A5.L1", "A5.L2", "A5.L3", "A5.L4"],
    source: ["W-TRAFFIC-LAW", "W-TRAFFIC-REG", "L-SCENARIO", "W-VISDRONE", "W-OPENDRIVE"],
    difficulty_direction: "increasing",
  },
);

canonical(
  "jd-5.3",
  "A5",
  "感知模态集",
  "任务使用的感知模态、观测产品和多模态组合；载荷物理能力引用 jd-0.9。",
);
group(
  "PROPOSED-jd-5.3.1",
  "jd-5.3",
  "jd-5.3",
  "A5",
  "模态与观测产品",
  "定义业务要求使用的传感模态及数据产品。",
  { related_global_jd: ["jd-0.9"] },
);
variable(
  "PROPOSED-jd-5.3.1.1",
  "PROPOSED-jd-5.3.1",
  "jd-5.3",
  "A5",
  "感知模态集合",
  "本次业务对象检测允许或要求使用的模态集合。",
  "multi_enum",
  [
    domain("visible_rgb", "可见光 RGB", ["W-MOT-UAV-BRIDGE", "W-VISDRONE"]),
    domain("thermal_infrared", "热红外", ["W-MOT-UAV-BRIDGE"]),
    domain("lidar", "激光雷达", ["W-MOT-UAV-BRIDGE"]),
    domain("multispectral", "多光谱", ["W-MOT-UAV-BRIDGE"]),
    domain("platform_specific", "平台特定模态", [], BOTH, "inferred_candidate"),
  ],
  {
    configuration_side: "shared",
    related_global_jd: ["jd-0.9"],
    used_by_axl: ["A5.L1", "A5.L2", "A5.L4"],
    source: ["W-MOT-UAV-BRIDGE", "W-VISDRONE"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-5.3.1.2",
  "PROPOSED-jd-5.3.1",
  "jd-5.3",
  "A5",
  "观测产品类型",
  "用于检测、跟踪或复核的观测产品。",
  "multi_enum",
  [
    domain("still_image", "静态图像", ["W-MOT-UAV-BRIDGE"]),
    domain("video", "视频", ["W-VISDRONE"]),
    domain("point_cloud", "点云", ["W-MOT-UAV-BRIDGE"]),
    domain("georeferenced_mosaic_or_model", "正射/实景模型", ["W-MOT-LOWALT-CASES"]),
  ],
  {
    configuration_side: "user",
    related_global_jd: ["jd-0.9"],
    used_by_axl: ["A5.L1", "A5.L2"],
    source: ["W-MOT-UAV-BRIDGE", "W-VISDRONE", "W-MOT-LOWALT-CASES"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-5.3.1.3",
  "PROPOSED-jd-5.3.1",
  "jd-5.3",
  "A5",
  "检测时序模式",
  "检测发生在飞行过程中还是数据回收后。",
  "enum",
  [
    domain("online_during_flight", "边飞边检", ["L-INSPECTION-IMAGE"], BOTH, "team_material_only"),
    domain("offline_after_flight", "先飞后检", ["L-INSPECTION-IMAGE"], BOTH, "team_material_only"),
    domain("hybrid", "在线初筛 + 离线复核", [], BOTH, "inferred_candidate"),
  ],
  {
    configuration_side: "user",
    related_jd: ["jd-9b.1"],
    used_by_axl: ["A5.L1", "A5.L2", "A5.L4"],
    source: ["L-INSPECTION-IMAGE"],
    evidence_status: "team_material_only",
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-5.3.1.4",
  "PROPOSED-jd-5.3.1",
  "jd-5.3",
  "A5",
  "模态组合方式",
  "多个模态是单独使用、并行互补还是用于确认性复核。",
  "enum",
  [
    domain("single_modality", "单模态", ["W-MOT-UAV-BRIDGE"]),
    domain("parallel_multimodal", "并行多模态", ["W-MOT-UAV-BRIDGE"]),
    domain("primary_plus_confirmation", "主模态 + 确认模态", [], BOTH, "inferred_candidate"),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-5.3.1.1",
      operator: "count_gte",
      value: 1,
    },
    configuration_side: "user",
    used_by_axl: ["A5.L1", "A5.L4"],
    source: ["W-MOT-UAV-BRIDGE"],
    difficulty_direction: "context_dependent",
  },
);

canonical(
  "jd-5.4",
  "A5",
  "感知策略适用集",
  "连续检测、身份维护、去重、重观测和复核等策略的允许集合及启用条件。",
);
group(
  "PROPOSED-jd-5.4.1",
  "jd-5.4",
  "jd-5.4",
  "A5",
  "连续观测与身份维护",
  "定义检测结果是否需要跨帧、跨航段或跨架次维持身份。",
);
variable(
  "PROPOSED-jd-5.4.1.1",
  "PROPOSED-jd-5.4.1",
  "jd-5.4",
  "A5",
  "连续检测要求",
  "是否要求在一个时间窗内连续报告目标存在和状态。",
  "boolean",
  [true, false],
  {
    configuration_side: "user",
    used_by_axl: ["A5.L2", "A5.L3", "A5.L4"],
    source: ["L-AXL68", "W-VISDRONE"],
    difficulty_direction: "increasing",
  },
);
variable(
  "PROPOSED-jd-5.4.1.2",
  "PROPOSED-jd-5.4.1",
  "jd-5.4",
  "A5",
  "实例身份维护要求",
  "是否要求在遮挡、短时丢失或重观测后维持同一对象身份。",
  "boolean",
  [true, false],
  {
    configuration_side: "user",
    used_by_axl: ["A5.L2", "A5.L3", "A5.L4"],
    source: ["L-AXL68", "W-VISDRONE"],
    difficulty_direction: "increasing",
  },
);
variable(
  "PROPOSED-jd-5.4.1.3",
  "PROPOSED-jd-5.4.1",
  "jd-5.4",
  "A5",
  "去重范围",
  "对同一对象重复观测进行去重的时间/任务范围。",
  "enum",
  [
    domain("none", "不要求去重", [], BOTH, "inferred_candidate"),
    domain("within_segment", "航段内", ["W-VISDRONE"]),
    domain("within_sortie", "单架次内", ["W-VISDRONE"]),
    domain("across_sorties", "跨架次", [], BOTH, "inferred_candidate"),
    domain("across_periodic_tasks", "跨周期任务", [], BOTH, "inferred_candidate"),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-5.4.1.2",
      equals: true,
    },
    configuration_side: "user",
    used_by_axl: ["A5.L2", "A5.L4"],
    source: ["W-VISDRONE", "L-SCENARIO"],
    evidence_status: "inferred_candidate",
    difficulty_direction: "increasing",
  },
);

group(
  "PROPOSED-jd-5.4.2",
  "jd-5.4",
  "jd-5.4",
  "A5",
  "退化处置与重观测",
  "定义感知退化时可请求的重观测和确认策略。",
  { related_global_jd: ["jd-0.5"] },
);
variable(
  "PROPOSED-jd-5.4.2.1",
  "PROPOSED-jd-5.4.2",
  "jd-5.4",
  "A5",
  "重观测触发集合",
  "允许触发重观测或复核的感知状态。",
  "multi_enum",
  [
    domain("low_confidence", "低置信/质量不足", ["L-AXL68"]),
    domain("occlusion", "遮挡", ["L-AXL68", "W-VISDRONE"]),
    domain("track_loss", "身份轨迹丢失", ["L-AXL68", "W-VISDRONE"]),
    domain("class_conflict", "类别冲突", ["L-AXL68"]),
    domain("rule_context_missing", "规则上下文缺失", [], BOTH, "inferred_candidate"),
    domain("plate_unreadable", "车牌不可读", ["W-UAV-PARKING-SZ"]),
  ],
  {
    configuration_side: "user",
    used_by_axl: ["A5.L3", "A5.L4"],
    source: ["L-AXL68", "W-VISDRONE", "W-UAV-PARKING-SZ"],
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-5.4.2.2",
  "PROPOSED-jd-5.4.2",
  "jd-5.4",
  "A5",
  "允许感知恢复策略集合",
  "A5 可请求或选择的感知恢复策略；改变航迹由 A7 执行。",
  "multi_enum",
  [
    domain("change_viewpoint_request", "请求改变视角", ["L-AXL68"]),
    domain("reobserve_same_target", "重观测同一目标", ["L-AXL68"]),
    domain("expand_search", "扩大搜索", ["L-AXL68"]),
    domain("switch_modality", "切换模态", ["L-AXL68"]),
    domain("wait_then_reobserve", "等待后重观测", ["L-AXL68"]),
    domain("request_human_confirmation", "请求人工确认", ["L-AXL68"]),
  ],
  {
    configuration_side: "user",
    related_global_jd: ["jd-0.5"],
    related_jd: ["jd-7.4"],
    used_by_axl: ["A5.L4"],
    source: ["L-AXL68"],
    evidence_status: "authoritative_existing",
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-5.4.2.3",
  "PROPOSED-jd-5.4.2",
  "jd-5.4",
  "A5",
  "重观测后验证要求",
  "执行感知恢复策略后是否必须验证类别、身份和规则上下文已恢复到可用状态。",
  "boolean",
  [true, false],
  {
    activation_condition: {
      node: "PROPOSED-jd-5.4.2.2",
      operator: "non_empty",
    },
    configuration_side: "user",
    used_by_axl: ["A5.L4"],
    source: ["L-AXL68"],
    evidence_status: "authoritative_existing",
    difficulty_direction: "increasing",
  },
);

// A6a
canonical(
  "jd-6a.1",
  "A6a",
  "定位源需求",
  "绝对定位、姿态和航向估计所允许或要求的来源、参考系及可用性。",
);
group(
  "PROPOSED-jd-6a.1.1",
  "jd-6a.1",
  "jd-6a.1",
  "A6a",
  "坐标系与基准",
  "定义全局、局部和机体参考系以及高度基准。",
  { source: ["W-OGC-WKT", "W-ROS-REP105", "W-PX4-EKF"] },
);
variable(
  "PROPOSED-jd-6a.1.1.1",
  "PROPOSED-jd-6a.1.1",
  "jd-6a.1",
  "A6a",
  "绝对坐标参考系",
  "任务位置数据采用的绝对或地理坐标参考系。",
  "enum",
  [
    domain("wgs84_geodetic", "WGS84 地理坐标", ["W-PX4-EKF", "W-OGC-WKT"]),
    domain("projected_crs", "投影坐标系", ["W-OGC-WKT"]),
    domain("site_georeferenced_frame", "园区地理配准坐标系", ["W-OGC-WKT"], CAMPUS),
    domain("TBD", "待任务声明", [], BOTH, "TBD"),
  ],
  {
    configuration_side: "shared",
    used_by_axl: ["A6a.L1", "A6a.L2"],
    source: ["W-OGC-WKT", "W-PX4-EKF"],
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-6a.1.1.2",
  "PROPOSED-jd-6a.1.1",
  "jd-6a.1",
  "A6a",
  "局部导航坐标系语义",
  "任务内部局部连续坐标的语义。",
  "enum",
  [
    domain("local_ned", "局部 NED", ["W-PX4-EKF", "W-AIRSIM"]),
    domain("local_enu", "局部 ENU", ["W-ROS-REP105"]),
    domain("map_odom_base_link", "map/odom/base_link 语义", ["W-ROS-REP105"]),
    domain("platform_specific", "平台特定局部系", [], BOTH, "inferred_candidate"),
  ],
  {
    configuration_side: "shared",
    used_by_axl: ["A6a.L1", "A6a.L2", "A6a.L3"],
    source: ["W-PX4-EKF", "W-AIRSIM", "W-ROS-REP105"],
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-6a.1.1.3",
  "PROPOSED-jd-6a.1.1",
  "jd-6a.1",
  "A6a",
  "高度参考基准",
  "高度或垂向位置使用的参考基准。",
  "enum",
  [
    domain("ellipsoid_height", "椭球高", ["W-OGC-WKT", "W-PX4-EKF"]),
    domain("mean_sea_level_or_geoid", "海拔/大地水准面高", ["W-OGC-WKT"]),
    domain("home_relative", "相对起飞点", ["W-PX4-MISSION"]),
    domain("terrain_relative", "相对地形", ["W-PX4-EKF"]),
    domain("site_floor_or_local_datum", "园区楼层/局部基准", [], CAMPUS, "inferred_candidate"),
    domain("TBD", "待任务声明", [], BOTH, "TBD"),
  ],
  {
    configuration_side: "shared",
    used_by_axl: ["A6a.L1", "A6a.L2"],
    source: ["W-OGC-WKT", "W-PX4-EKF", "W-PX4-MISSION"],
    difficulty_direction: "neutral",
  },
);

group(
  "PROPOSED-jd-6a.1.2",
  "jd-6a.1",
  "jd-6a.1",
  "A6a",
  "定位来源与组合",
  "定义可用的绝对位姿、航向和高度来源及其组合要求。",
  { related_global_jd: ["jd-0.3"] },
);
variable(
  "PROPOSED-jd-6a.1.2.1",
  "PROPOSED-jd-6a.1.2",
  "jd-6a.1",
  "A6a",
  "绝对定位来源集合",
  "可用于位置估计的来源集合。",
  "multi_enum",
  [
    domain("gnss", "GNSS", ["W-GPS-SPS", "W-PX4-EKF"]),
    domain("rtk_gnss", "RTK GNSS", ["L-JD66"], BOTH, "team_material_only"),
    domain("visual_odometry_or_slam", "视觉里程计/SLAM", ["W-PX4-EKF"]),
    domain("lidar_odometry_or_slam", "激光里程计/SLAM", ["L-JD66"], BOTH, "team_material_only"),
    domain("external_vision", "外部视觉定位", ["W-PX4-EKF"]),
    domain("uwb_or_beacon", "UWB/信标", ["L-JD66"], CAMPUS, "team_material_only"),
    domain("map_matching", "地图匹配", ["W-OPENDRIVE"]),
    domain("platform_specific", "平台特定来源", [], BOTH, "inferred_candidate"),
  ],
  {
    configuration_side: "shared",
    related_global_jd: ["jd-0.3"],
    used_by_axl: ["A6a.L1", "A6a.L2", "A6a.L3", "A6a.L4"],
    source: ["W-GPS-SPS", "W-PX4-EKF", "L-JD66", "W-OPENDRIVE"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-6a.1.2.2",
  "PROPOSED-jd-6a.1.2",
  "jd-6a.1",
  "A6a",
  "高度来源集合",
  "可用于垂向位置估计的来源集合。",
  "multi_enum",
  [
    domain("gnss_height", "GNSS 高度", ["W-PX4-EKF"]),
    domain("barometer", "气压计", ["W-PX4-EKF"]),
    domain("rangefinder", "测距仪", ["W-PX4-EKF"]),
    domain("external_vision_height", "外部视觉高度", ["W-PX4-EKF"]),
    domain("terrain_or_map", "地形/地图高度", ["W-PX4-EKF"]),
  ],
  {
    configuration_side: "shared",
    used_by_axl: ["A6a.L1", "A6a.L2", "A6a.L3", "A6a.L4"],
    source: ["W-PX4-EKF"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-6a.1.2.3",
  "PROPOSED-jd-6a.1.2",
  "jd-6a.1",
  "A6a",
  "航向来源集合",
  "可用于航向估计和约束的来源集合。",
  "multi_enum",
  [
    domain("magnetometer", "磁罗盘", ["W-PX4-EKF"]),
    domain("gnss_heading", "GNSS 航向", ["W-PX4-EKF"]),
    domain("motion_derived_heading", "由运动估计航向", ["W-PX4-EKF"]),
    domain("external_vision_heading", "外部视觉航向", ["W-PX4-EKF"]),
    domain("map_or_lane_heading", "地图/车道方向先验", ["W-OPENDRIVE"]),
  ],
  {
    configuration_side: "shared",
    used_by_axl: ["A6a.L1", "A6a.L2", "A6a.L3", "A6a.L4"],
    source: ["W-PX4-EKF", "W-OPENDRIVE"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-6a.1.2.4",
  "PROPOSED-jd-6a.1.2",
  "jd-6a.1",
  "A6a",
  "定位来源组合方式",
  "定位来源是单源、主备、融合还是多实例一致性选择。",
  "enum",
  [
    domain("single_source", "单源", ["W-PX4-EKF"]),
    domain("primary_backup", "主备", ["W-PX4-EKF"]),
    domain("multi_source_fusion", "多源融合", ["W-PX4-EKF"]),
    domain("multi_instance_consistency_selection", "多实例一致性选择", ["W-PX4-EKF"]),
  ],
  {
    configuration_side: "user",
    used_by_axl: ["A6a.L2", "A6a.L3", "A6a.L4"],
    source: ["W-PX4-EKF"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-6a.1.2.5",
  "PROPOSED-jd-6a.1.2",
  "jd-6a.1",
  "A6a",
  "定位来源可用性时序",
  "来源在任务过程中的可用、间歇、退化和失锁时序。",
  "enum",
  [
    domain("available_continuously", "持续可用", ["W-PX4-EKF"]),
    domain("intermittent", "间歇可用", ["W-PX4-EKF"]),
    domain("degraded_then_recovered", "退化后恢复", ["W-PX4-EKF"]),
    domain("lost_then_recovered", "失锁后恢复", ["W-PX4-EKF"]),
    domain("unavailable", "不可用", ["W-PX4-EKF"]),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible", "hidden_gt"],
    related_global_jd: ["jd-0.3"],
    used_by_axl: ["A6a.L2", "A6a.L3", "A6a.L4"],
    source: ["W-PX4-EKF"],
    difficulty_direction: "context_dependent",
  },
);

canonical(
  "jd-6a.2",
  "A6a",
  "位姿质量先验",
  "任务对位置、高度、姿态、航向、不确定度、连续性和来源一致性的质量先验。",
);
group(
  "PROPOSED-jd-6a.2.1",
  "jd-6a.2",
  "jd-6a.2",
  "A6a",
  "精度与不确定度要求",
  "定义位姿分量的质量要求和不确定度表达。",
  { source: ["W-GPS-SPS", "W-PX4-EKF"] },
);
for (const spec of [
  ["1", "水平位置不确定度要求", "水平位置误差或不确定度的允许范围。", "m"],
  ["2", "垂向位置不确定度要求", "高度误差或不确定度的允许范围。", "m"],
  ["3", "姿态不确定度要求", "滚转/俯仰姿态误差或不确定度的允许范围。", "deg"],
  ["4", "航向不确定度要求", "航向误差或不确定度的允许范围。", "deg"],
]) {
  variable(
    `PROPOSED-jd-6a.2.1.${spec[0]}`,
    "PROPOSED-jd-6a.2.1",
    "jd-6a.2",
    "A6a",
    spec[1],
    spec[2],
    "number",
    { min: null, max: null, tbd_reason: "双场景通用阈值无适用范围一致证据" },
    {
      unit: spec[3],
      configuration_side: "user",
      visibility: ["sut_visible", "grader_visible"],
      used_by_axl: ["A6a.L1", "A6a.L2", "A6a.L3", "A6a.L4"],
      source: ["L-JD66", "W-GPS-SPS", "W-PX4-EKF"],
      evidence_status: "TBD",
      difficulty_direction: "decreasing",
    },
  );
}
variable(
  "PROPOSED-jd-6a.2.1.5",
  "PROPOSED-jd-6a.2.1",
  "jd-6a.2",
  "A6a",
  "不确定度表达形式",
  "SUT 或 Fixture 使用的位姿不确定度表达。",
  "enum",
  [
    domain("scalar_bound", "标量上界", ["W-PX4-EKF"]),
    domain("per_axis_bound", "分轴上界", ["W-PX4-EKF"]),
    domain("covariance", "协方差", ["W-PX4-EKF"]),
    domain("quality_enum", "质量档位", ["W-PX4-EKF"]),
    domain("platform_specific", "平台特定", [], BOTH, "inferred_candidate"),
  ],
  {
    configuration_side: "shared",
    used_by_axl: ["A6a.L1", "A6a.L2", "A6a.L3"],
    source: ["W-PX4-EKF"],
    difficulty_direction: "neutral",
  },
);

group(
  "PROPOSED-jd-6a.2.2",
  "jd-6a.2",
  "jd-6a.2",
  "A6a",
  "质量状态与退化",
  "定义定位质量、跳变、漂移、多源冲突和时序问题。",
  { related_global_jd: ["jd-0.3"], source: ["W-PX4-EKF", "W-GPS-SPS"] },
);
variable(
  "PROPOSED-jd-6a.2.2.1",
  "PROPOSED-jd-6a.2.2",
  "jd-6a.2",
  "A6a",
  "定位质量状态",
  "对外暴露的定位质量状态；具体阈值由平台或任务确认。",
  "enum",
  [
    domain("nominal", "正常", ["W-PX4-EKF"]),
    domain("degraded", "退化", ["W-PX4-EKF"]),
    domain("invalid", "无效", ["W-PX4-EKF"]),
    domain("recovering", "恢复中", ["W-PX4-EKF"]),
    domain("unknown", "未知", ["W-PX4-EKF"]),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible", "grader_visible"],
    used_by_axl: ["A6a.L1", "A6a.L2", "A6a.L3", "A6a.L4"],
    source: ["W-PX4-EKF"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-6a.2.2.2",
  "PROPOSED-jd-6a.2.2",
  "jd-6a.2",
  "A6a",
  "定位退化类型",
  "绝对定位来源或融合状态的退化类型。",
  "multi_enum",
  [
    domain("gnss_multipath", "GNSS 多路径", ["W-PX4-EKF"]),
    domain("gnss_interference_or_spoofing_candidate", "GNSS 干扰/欺骗候选", ["W-PX4-EKF"]),
    domain("source_loss", "来源失锁/丢失", ["W-PX4-EKF"]),
    domain("position_jump", "位置跳变", ["W-PX4-EKF"]),
    domain("heading_drift", "航向漂移", ["L-AXL68", "W-PX4-EKF"]),
    domain("innovation_rejection", "观测创新拒绝", ["W-PX4-EKF"]),
    domain("sensor_bias_or_stuck", "传感器偏置突变/卡死", ["W-PX4-EKF"]),
    domain("stale_or_delayed_data", "陈旧或延迟数据", ["W-PX4-EKF"]),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible", "hidden_gt"],
    related_global_jd: ["jd-0.3"],
    used_by_axl: ["A6a.L2", "A6a.L3", "A6a.L4"],
    source: ["W-PX4-EKF", "L-AXL68"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-6a.2.2.3",
  "PROPOSED-jd-6a.2.2",
  "jd-6a.2",
  "A6a",
  "位姿连续性状态",
  "局部位姿输出是否连续，或发生 reset/jump。",
  "enum",
  [
    domain("continuous", "连续", ["W-ROS-REP105", "W-PX4-EKF"]),
    domain("reset_with_declared_delta", "发生 reset 且提供修正量", ["W-PX4-EKF"]),
    domain("undeclared_jump", "未声明跳变", ["W-PX4-EKF"]),
    domain("output_gap", "输出中断", ["W-PX4-EKF"]),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible", "grader_visible"],
    used_by_axl: ["A6a.L2", "A6a.L3", "A6a.L4"],
    source: ["W-ROS-REP105", "W-PX4-EKF"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-6a.2.2.4",
  "PROPOSED-jd-6a.2.2",
  "jd-6a.2",
  "A6a",
  "多源一致性状态",
  "多个定位/姿态来源之间的一致性状态。",
  "enum",
  [
    domain("consistent", "一致", ["W-PX4-EKF"]),
    domain("minor_disagreement", "轻微不一致", ["W-PX4-EKF"]),
    domain("conflict", "冲突", ["W-PX4-EKF"]),
    domain("insufficient_comparison", "无法比较", ["W-PX4-EKF"]),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-6a.1.2.1",
      operator: "count_gte",
      value: 2,
    },
    configuration_side: "world",
    visibility: ["sut_visible", "grader_visible"],
    used_by_axl: ["A6a.L2", "A6a.L3", "A6a.L4"],
    source: ["W-PX4-EKF"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-6a.2.2.5",
  "PROPOSED-jd-6a.2.2",
  "jd-6a.2",
  "A6a",
  "定位状态时延要求",
  "位姿与质量状态从测量到可用输出的允许时延。",
  "number",
  { min: 0, max: null, tbd_reason: "任务时序和平台接口尚未确认" },
  {
    unit: "ms",
    configuration_side: "user",
    visibility: ["sut_visible", "grader_visible"],
    used_by_axl: ["A6a.L1", "A6a.L2", "A6a.L3"],
    source: ["W-PX4-EKF"],
    evidence_status: "TBD",
    difficulty_direction: "decreasing",
  },
);

canonical(
  "jd-6a.3",
  "A6a",
  "定位策略适用集",
  "融合、切换、拒绝、重定位、保护动作与恢复验证的适用条件。",
);
group(
  "PROPOSED-jd-6a.3.1",
  "jd-6a.3",
  "jd-6a.3",
  "A6a",
  "策略触发与允许动作",
  "定义定位退化时可用的策略集合和触发条件。",
);
variable(
  "PROPOSED-jd-6a.3.1.1",
  "PROPOSED-jd-6a.3.1",
  "jd-6a.3",
  "A6a",
  "定位策略触发集合",
  "允许触发融合调整、来源切换或重定位的质量状态。",
  "multi_enum",
  [
    domain("source_loss", "来源丢失", ["L-AXL68", "W-PX4-EKF"]),
    domain("innovation_conflict", "创新/来源冲突", ["W-PX4-EKF"]),
    domain("position_jump", "位置跳变", ["L-AXL68", "W-PX4-EKF"]),
    domain("heading_drift", "航向漂移", ["L-AXL68"]),
    domain("quality_below_requirement", "质量低于任务要求", ["L-AXL68"]),
    domain("manual_or_external_request", "人工/外部请求", ["L-AXL68"]),
  ],
  {
    configuration_side: "user",
    used_by_axl: ["A6a.L3", "A6a.L4"],
    source: ["L-AXL68", "W-PX4-EKF"],
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-6a.3.1.2",
  "PROPOSED-jd-6a.3.1",
  "jd-6a.3",
  "A6a",
  "允许定位策略集合",
  "任务允许的定位恢复与保护策略。",
  "multi_enum",
  [
    domain("continue_fusion", "继续多源融合", ["W-PX4-EKF"]),
    domain("reject_faulty_source", "拒绝异常来源", ["W-PX4-EKF"]),
    domain("switch_primary_source", "切换主定位来源", ["L-AXL68", "W-PX4-EKF"]),
    domain("state_reset", "状态 reset", ["W-PX4-EKF"]),
    domain("relocalize", "重定位", ["L-AXL68"]),
    domain("landmark_observation", "地标观测", ["L-AXL68"]),
    domain("wait_for_convergence", "等待收敛", ["L-AXL68"]),
    domain("request_external_aid", "请求外部辅助", ["L-AXL68"]),
    domain("request_navigation_protection", "请求导航保护动作", ["L-AXL68"]),
  ],
  {
    configuration_side: "user",
    related_jd: ["jd-7.4", "jd-12.2"],
    used_by_axl: ["A6a.L4"],
    source: ["L-AXL68", "W-PX4-EKF"],
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-6a.3.1.3",
  "PROPOSED-jd-6a.3.1",
  "jd-6a.3",
  "A6a",
  "定位策略适用规则",
  "策略与来源状态、飞行阶段和可用备份之间的条件映射。",
  "array",
  {
    item_schema: {
      strategy: "enum_ref:PROPOSED-jd-6a.3.1.2",
      conditions: "expression",
    },
    values: [],
    tbd_reason: "具体规则逐条等待平台与团队确认",
  },
  {
    activation_condition: {
      node: "PROPOSED-jd-6a.3.1.2",
      operator: "non_empty",
    },
    multiplicity: "zero_or_more",
    configuration_side: "user",
    used_by_axl: ["A6a.L4"],
    source: ["L-AXL68", "W-PX4-EKF"],
    evidence_status: "TBD",
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-6a.3.1.4",
  "PROPOSED-jd-6a.3.1",
  "jd-6a.3",
  "A6a",
  "定位恢复验证要求",
  "策略执行后是否必须验证位姿质量和连续性已恢复。",
  "boolean",
  [true, false],
  {
    activation_condition: {
      node: "PROPOSED-jd-6a.3.1.2",
      operator: "non_empty",
    },
    configuration_side: "user",
    used_by_axl: ["A6a.L4"],
    source: ["L-AXL68"],
    evidence_status: "authoritative_existing",
    difficulty_direction: "increasing",
  },
);

// A6b
canonical(
  "jd-6b.1",
  "A6b",
  "相对几何先验",
  "无人机相对道路、车道、停车区域、车辆、病害或检查面的几何量与先验。",
);
group(
  "PROPOSED-jd-6b.1.1",
  "jd-6b.1",
  "jd-6b.1",
  "A6b",
  "参考对象与先验可用性",
  "定义相对定位依附的参考对象，以及该参考对象先验的可用程度。",
  { source: ["W-OPENDRIVE", "W-MOT-UAV-BRIDGE", "L-SCENARIO"] },
);
variable(
  "PROPOSED-jd-6b.1.1.1",
  "PROPOSED-jd-6b.1.1",
  "jd-6b.1",
  "A6b",
  "相对几何参考对象",
  "相对位置/方位估计所依附的业务参考对象。",
  "multi_enum",
  [
    domain("road_reference_line", "道路参考线", ["W-OPENDRIVE"], HIGHWAY),
    domain("lane_center_or_boundary", "车道中心/边界", ["W-OPENDRIVE", "W-BDD100K"]),
    domain("emergency_lane_or_shoulder", "应急车道/路肩", ["W-TRAFFIC-REG"], HIGHWAY),
    domain("parking_space_or_zone", "停车位/停车区域", ["W-OPENDRIVE", "W-GB5768"], CAMPUS),
    domain("fire_access_lane", "消防车通道", ["W-FIRE-LAW"], CAMPUS),
    domain("building_or_site_boundary", "建筑/园区边界", ["L-SCENARIO"], CAMPUS, "team_material_only"),
    domain("target_vehicle", "目标车辆", ["W-VISDRONE"]),
    domain("road_distress", "道路病害", ["W-JTG5210"], HIGHWAY),
    domain("inspection_surface", "检查面", ["W-MOT-UAV-BRIDGE"]),
  ],
  {
    multiplicity: "one_or_more",
    configuration_side: "user",
    related_global_jd: ["jd-0.2"],
    used_by_axl: ["A6b.L1", "A6b.L2", "A6b.L3", "A6b.L4"],
    source: ["W-OPENDRIVE", "W-BDD100K", "W-TRAFFIC-REG", "W-FIRE-LAW", "W-VISDRONE", "W-JTG5210", "W-MOT-UAV-BRIDGE"],
    difficulty_direction: "non_monotonic",
  },
);
group(
  "PROPOSED-jd-6b.1.2",
  "jd-6b.1",
  "jd-6b.1",
  "A6b",
  "几何表示与约束量",
  "定义相对几何的表达形式、任务要求的几何分量和取值范围先验。",
  { source: ["L-JD66", "W-OPENDRIVE", "W-MOT-UAV-BRIDGE"] },
);
variable(
  "PROPOSED-jd-6b.1.2.1",
  "PROPOSED-jd-6b.1.2",
  "jd-6b.1",
  "A6b",
  "相对几何表示",
  "相对位置、方位与区域关系的表达方式。",
  "multi_enum",
  [
    domain("cartesian_relative_xyz", "相对笛卡尔 xyz", ["W-ROS-REP105"]),
    domain("polar_range_bearing_elevation", "距离/方位/仰角", ["L-JD66"]),
    domain("road_stz", "道路 s/t/z", ["W-OPENDRIVE"], HIGHWAY),
    domain("lane_relative", "车道相对坐标", ["W-OPENDRIVE"]),
    domain("zone_relative_or_containment", "区域相对/包含关系", ["W-OPENDRIVE", "W-GB5768"]),
    domain("image_plane_or_bbox", "图像平面/框", ["W-VISDRONE"]),
  ],
  {
    configuration_side: "shared",
    used_by_axl: ["A6b.L1", "A6b.L2"],
    source: ["W-ROS-REP105", "W-OPENDRIVE", "W-VISDRONE", "W-GB5768"],
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-6b.1.2.2",
  "PROPOSED-jd-6b.1.2",
  "jd-6b.1",
  "A6b",
  "必需相对几何量集合",
  "任务要求 A6b 提供的相对几何分量。",
  "multi_enum",
  [
    domain("distance", "距离", ["L-JD66"]),
    domain("bearing", "方位", ["L-JD66"]),
    domain("lateral_offset", "横向偏差", ["W-OPENDRIVE"]),
    domain("vertical_offset", "垂向偏差", ["W-MOT-UAV-BRIDGE"]),
    domain("longitudinal_offset_or_s", "纵向位置/s", ["W-OPENDRIVE"]),
    domain("relative_orientation", "相对朝向", ["L-JD66"]),
    domain("view_angle", "观测角", ["W-MOT-UAV-BRIDGE"]),
    domain("zone_containment", "区域包含/越界状态", ["W-OPENDRIVE", "W-GB5768"]),
  ],
  {
    configuration_side: "user",
    used_by_axl: ["A6b.L1", "A6b.L2", "A6b.L3"],
    source: ["L-JD66", "W-OPENDRIVE", "W-MOT-UAV-BRIDGE", "W-GB5768"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-6b.1.1.2",
  "PROPOSED-jd-6b.1.1",
  "jd-6b.1",
  "A6b",
  "相对几何先验可用性",
  "任务开始时参考对象几何或地图先验的可用程度。",
  "enum",
  [
    domain("exact_reference", "精确先验", ["W-OPENDRIVE"]),
    domain("approximate_reference", "近似先验", ["W-MOT-UAV-BRIDGE"]),
    domain("semantic_only", "仅语义先验", ["W-BDD100K"]),
    domain("none", "无先验", ["L-JD66"]),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible"],
    used_by_axl: ["A6b.L1", "A6b.L2", "A6b.L3", "A6b.L4"],
    source: ["W-OPENDRIVE", "W-MOT-UAV-BRIDGE", "W-BDD100K", "L-JD66"],
    difficulty_direction: "decreasing",
  },
);
variable(
  "PROPOSED-jd-6b.1.2.3",
  "PROPOSED-jd-6b.1.2",
  "jd-6b.1",
  "A6b",
  "相对几何范围先验",
  "距离、偏差、角度等几何量的任务范围。",
  "object",
  {
    fields: {
      quantity: "enum_ref:PROPOSED-jd-6b.1.2.2",
      min: null,
      max: null,
      unit: "per_quantity",
    },
    values: [],
    tbd_reason: "高速与园区通用数值范围尚无一致证据",
  },
  {
    configuration_side: "user",
    used_by_axl: ["A6b.L1", "A6b.L2", "A6b.L3"],
    source: ["L-JD66"],
    evidence_status: "TBD",
    difficulty_direction: "context_dependent",
  },
);

canonical(
  "jd-6b.2",
  "A6b",
  "相对几何感知机制",
  "相对道路、区域和对象几何的估计机制、地图先验、关联线索与更新方式。",
);
group(
  "PROPOSED-jd-6b.2.1",
  "jd-6b.2",
  "jd-6b.2",
  "A6b",
  "估计输入与机制",
  "定义相对几何估计所用的观测机制、语义地图和可见边界。",
);
variable(
  "PROPOSED-jd-6b.2.1.1",
  "PROPOSED-jd-6b.2.1",
  "jd-6b.2",
  "A6b",
  "相对几何估计机制集合",
  "允许或要求使用的相对几何估计机制。",
  "multi_enum",
  [
    domain("monocular_vision", "单目视觉", ["L-JD66"]),
    domain("stereo_or_depth_camera", "双目/深度相机", ["L-JD66"]),
    domain("lidar", "LiDAR", ["L-JD66", "W-MOT-UAV-BRIDGE"]),
    domain("radar", "Radar", ["L-JD66"]),
    domain("gnss_plus_map_projection", "GNSS + 地图投影", ["W-OPENDRIVE", "W-PX4-EKF"]),
    domain("semantic_map_matching", "语义地图匹配", ["W-OPENDRIVE"]),
    domain("multi_source_fusion", "多源融合", ["L-JD66"]),
  ],
  {
    configuration_side: "shared",
    related_global_jd: ["jd-0.9"],
    used_by_axl: ["A6b.L1", "A6b.L2", "A6b.L3", "A6b.L4"],
    source: ["L-JD66", "W-MOT-UAV-BRIDGE", "W-OPENDRIVE", "W-PX4-EKF"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-6b.2.1.2",
  "PROPOSED-jd-6b.2.1",
  "jd-6b.2",
  "A6b",
  "语义地图可用性",
  "道路、车道、停车区、消防通道或园区边界的语义地图是否可用。",
  "enum",
  [
    domain("available_and_georeferenced", "可用且已配准", ["W-OPENDRIVE", "W-OGC-WKT"]),
    domain("available_unregistered", "可用但未配准", [], BOTH, "inferred_candidate"),
    domain("partial", "部分可用", ["W-OPENDRIVE"]),
    domain("unavailable", "不可用", ["L-JD66"]),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible"],
    used_by_axl: ["A6b.L1", "A6b.L2", "A6b.L3", "A6b.L4"],
    source: ["W-OPENDRIVE", "W-OGC-WKT", "L-JD66"],
    difficulty_direction: "decreasing",
  },
);
variable(
  "PROPOSED-jd-6b.2.1.3",
  "PROPOSED-jd-6b.2.1",
  "jd-6b.2",
  "A6b",
  "边界/标线可见性",
  "车道线、停车位、禁停标线或消防通道标识的可观测状态。",
  "enum",
  [
    domain("clear", "清晰", ["W-GB5768", "W-BDD100K"]),
    domain("partially_occluded", "部分遮挡", ["W-VISDRONE"]),
    domain("worn_or_faded", "磨损/褪色", ["W-BDD100K"]),
    domain("absent", "无可见边界", ["W-BDD100K"]),
    domain("unknown", "未知", [], BOTH, "inferred_candidate"),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible", "hidden_gt"],
    used_by_axl: ["A6b.L1", "A6b.L2", "A6b.L3", "A6b.L4"],
    source: ["W-GB5768", "W-BDD100K", "W-VISDRONE"],
    difficulty_direction: "decreasing",
  },
);
group(
  "PROPOSED-jd-6b.2.2",
  "jd-6b.2",
  "jd-6b.2",
  "A6b",
  "对象关联与几何更新",
  "定义跨帧或重观测关联线索，以及相对几何的更新时序。",
  { source: ["W-VISDRONE", "L-AXL68", "W-MAVLINK-MISSION"] },
);
variable(
  "PROPOSED-jd-6b.2.2.1",
  "PROPOSED-jd-6b.2.2",
  "jd-6b.2",
  "A6b",
  "对象关联线索集合",
  "跨帧或重观测时可使用的对象关联线索。",
  "multi_enum",
  [
    domain("appearance", "外观", ["W-VISDRONE"]),
    domain("motion", "运动", ["W-VISDRONE"]),
    domain("plate_or_identifier", "车牌/标识", ["W-UAV-PARKING-SZ"]),
    domain("map_location", "地图位置", ["W-OPENDRIVE"]),
    domain("relative_geometry", "相对几何", ["L-AXL68"]),
    domain("multi_cue", "多线索组合", ["W-VISDRONE"]),
  ],
  {
    configuration_side: "user",
    used_by_axl: ["A6b.L2", "A6b.L3", "A6b.L4"],
    source: ["W-VISDRONE", "W-UAV-PARKING-SZ", "W-OPENDRIVE", "L-AXL68"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-6b.2.2.2",
  "PROPOSED-jd-6b.2.2",
  "jd-6b.2",
  "A6b",
  "相对几何更新模式",
  "相对几何是单次、按航段还是连续更新。",
  "enum",
  [
    domain("single_observation", "单次观测", ["L-JD66"]),
    domain("per_segment", "按航段更新", ["W-MAVLINK-MISSION"]),
    domain("continuous", "连续更新", ["L-AXL68"]),
    domain("on_demand_reobservation", "按需重观测", ["L-AXL68"]),
  ],
  {
    configuration_side: "user",
    used_by_axl: ["A6b.L1", "A6b.L2", "A6b.L3", "A6b.L4"],
    source: ["L-JD66", "L-AXL68", "W-MAVLINK-MISSION"],
    difficulty_direction: "context_dependent",
  },
);

canonical(
  "jd-6b.3",
  "A6b",
  "相对定位策略适用集",
  "遮挡、关联丢失、几何冲突和参考对象不可见时的恢复策略及验证。",
);
group(
  "PROPOSED-jd-6b.3.1",
  "jd-6b.3",
  "jd-6b.3",
  "A6b",
  "退化触发与恢复策略",
  "定义相对定位退化条件，以及允许采用的恢复和重观测策略。",
);
variable(
  "PROPOSED-jd-6b.3.1.1",
  "PROPOSED-jd-6b.3.1",
  "jd-6b.3",
  "A6b",
  "相对定位退化触发集合",
  "允许触发恢复策略的相对定位状态。",
  "multi_enum",
  [
    domain("reference_occluded", "参考对象遮挡", ["L-AXL68", "W-VISDRONE"]),
    domain("association_lost", "关联丢失", ["L-AXL68", "W-VISDRONE"]),
    domain("geometry_jump", "相对几何跳变", ["L-AXL68"]),
    domain("map_observation_conflict", "地图与观测冲突", ["L-AXL68", "W-OPENDRIVE"]),
    domain("boundary_not_visible", "区域边界不可见", ["W-BDD100K"]),
    domain("quality_below_requirement", "质量低于要求", ["L-AXL68"]),
  ],
  {
    configuration_side: "user",
    used_by_axl: ["A6b.L3", "A6b.L4"],
    source: ["L-AXL68", "W-VISDRONE", "W-OPENDRIVE", "W-BDD100K"],
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-6b.3.1.2",
  "PROPOSED-jd-6b.3.1",
  "jd-6b.3",
  "A6b",
  "允许相对定位恢复策略",
  "任务允许的相对定位恢复和重关联策略。",
  "multi_enum",
  [
    domain("reassociate", "重新关联", ["L-AXL68"]),
    domain("reobserve", "重观测", ["L-AXL68"]),
    domain("change_viewpoint_request", "请求改变视角", ["L-AXL68"]),
    domain("expand_search", "扩大搜索", ["L-AXL68"]),
    domain("switch_or_fuse_mechanism", "切换/融合估计机制", ["L-AXL68"]),
    domain("request_external_observation", "请求外部/他机补观测", ["L-AXL68"]),
    domain("fall_back_to_map_prior", "退回地图先验", ["W-OPENDRIVE"]),
  ],
  {
    configuration_side: "user",
    related_jd: ["jd-5.4", "jd-7.4"],
    used_by_axl: ["A6b.L4"],
    source: ["L-AXL68", "W-OPENDRIVE"],
    difficulty_direction: "neutral",
  },
);
group(
  "PROPOSED-jd-6b.3.2",
  "jd-6b.3",
  "jd-6b.3",
  "A6b",
  "重关联范围与恢复验证",
  "定义重新关联允许跨越的范围和策略执行后的恢复验证要求。",
  { source: ["W-VISDRONE", "L-AXL68"] },
);
variable(
  "PROPOSED-jd-6b.3.2.1",
  "PROPOSED-jd-6b.3.2",
  "jd-6b.3",
  "A6b",
  "重关联跨越范围",
  "重新关联允许跨越的观测范围。",
  "enum",
  [
    domain("same_frame_or_instant", "同帧/同一时刻", ["W-VISDRONE"]),
    domain("short_occlusion", "短时遮挡", ["W-VISDRONE"]),
    domain("same_sortie_revisit", "同架次重访", ["L-AXL68"]),
    domain("cross_sortie", "跨架次", [], BOTH, "inferred_candidate"),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-6b.3.1.2",
      contains: "reassociate",
    },
    configuration_side: "user",
    used_by_axl: ["A6b.L2", "A6b.L4"],
    source: ["W-VISDRONE", "L-AXL68"],
    difficulty_direction: "increasing",
  },
);
variable(
  "PROPOSED-jd-6b.3.2.2",
  "PROPOSED-jd-6b.3.2",
  "jd-6b.3",
  "A6b",
  "相对定位恢复验证要求",
  "策略执行后是否必须验证参考对象、关联身份和相对几何质量已恢复。",
  "boolean",
  [true, false],
  {
    activation_condition: {
      node: "PROPOSED-jd-6b.3.1.2",
      operator: "non_empty",
    },
    configuration_side: "user",
    used_by_axl: ["A6b.L4"],
    source: ["L-AXL68"],
    evidence_status: "authoritative_existing",
    difficulty_direction: "increasing",
  },
);

// A7
canonical(
  "jd-7.1",
  "A7",
  "航路拓扑",
  "高速道路和园区道路/区域的巡检航路节点、航段、方向和连接关系。",
);
group(
  "PROPOSED-jd-7.1.1",
  "jd-7.1",
  "jd-7.1",
  "A7",
  "拓扑要素与业务语义",
  "定义高速和园区巡检可共用的拓扑场景、节点和航段语义。",
  { related_global_jd: ["jd-0.2"], source: ["W-OPENDRIVE", "L-SCENARIO"] },
);
variable(
  "PROPOSED-jd-7.1.1.1",
  "PROPOSED-jd-7.1.1",
  "jd-7.1",
  "A7",
  "拓扑场景类型",
  "巡检航路依附的业务空间类型。",
  "enum",
  [
    domain("highway_corridor", "高速道路走廊", ["L-SCENARIO", "W-OPENDRIVE"], HIGHWAY),
    domain("managed_park_network", "园区道路与区域网络", ["L-SCENARIO", "W-OPENDRIVE"], CAMPUS),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible"],
    related_global_jd: ["jd-0.2"],
    used_by_axl: ["A7.L1", "A7.L2", "A7.L3", "A7.L4"],
    source: ["L-SCENARIO", "W-OPENDRIVE"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-7.1.1.2",
  "PROPOSED-jd-7.1.1",
  "jd-7.1",
  "A7",
  "拓扑节点类型集合",
  "巡检航路图中的节点语义。",
  "multi_enum",
  [
    domain("start", "起点", ["W-MAVLINK-MISSION"]),
    domain("end", "终点", ["W-MAVLINK-MISSION"]),
    domain("home_or_base", "基地/起降点", ["W-PX4-MISSION"]),
    domain("waypoint", "航点", ["W-MAVLINK-MISSION"]),
    domain("road_junction", "道路节点/互通", ["W-OPENDRIVE"], HIGHWAY),
    domain("ramp_entry_exit", "匝道入口/出口", ["W-OPENDRIVE"], HIGHWAY),
    domain("park_gate", "园区出入口", ["L-SCENARIO"], CAMPUS, "team_material_only"),
    domain("parking_zone", "停车区域", ["W-OPENDRIVE"], CAMPUS),
    domain("inspection_hotspot", "重点巡检点", ["L-SCENARIO"]),
    domain("safe_wait_point", "安全等待点", [], BOTH, "inferred_candidate"),
    domain("alternate_or_rally_point", "备选/集结点", ["W-MAVLINK-MISSION"]),
  ],
  {
    multiplicity: "one_or_more",
    configuration_side: "world",
    visibility: ["sut_visible"],
    related_global_jd: ["jd-0.2", "jd-0.10"],
    used_by_axl: ["A7.L1", "A7.L2", "A7.L3", "A7.L4"],
    source: ["W-MAVLINK-MISSION", "W-PX4-MISSION", "W-OPENDRIVE", "L-SCENARIO"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-7.1.1.3",
  "PROPOSED-jd-7.1.1",
  "jd-7.1",
  "A7",
  "巡检航段类型集合",
  "连接航路节点的业务航段语义。",
  "multi_enum",
  [
    domain("road_following_segment", "沿道路航段", ["W-OPENDRIVE"]),
    domain("lane_or_shoulder_observation_segment", "车道/路肩观察航段", ["W-OPENDRIVE"], HIGHWAY),
    domain("ramp_or_junction_segment", "匝道/节点航段", ["W-OPENDRIVE"], HIGHWAY),
    domain("park_aisle_segment", "园区道路/通道航段", ["W-OPENDRIVE"], CAMPUS),
    domain("zone_coverage_segment", "区域覆盖航段", ["L-SCENARIO"], CAMPUS, "team_material_only"),
    domain("target_approach_segment", "目标接近航段", ["L-SCENARIO"]),
    domain("reobservation_segment", "重观测航段", ["L-AXL68"]),
    domain("return_segment", "返航航段", ["W-MAVLINK-MISSION"]),
  ],
  {
    multiplicity: "one_or_more",
    configuration_side: "world",
    visibility: ["sut_visible"],
    used_by_axl: ["A7.L1", "A7.L2", "A7.L3", "A7.L4"],
    source: ["W-OPENDRIVE", "W-MAVLINK-MISSION", "L-SCENARIO", "L-AXL68"],
    difficulty_direction: "context_dependent",
  },
);
group(
  "PROPOSED-jd-7.1.2",
  "jd-7.1",
  "jd-7.1",
  "A7",
  "拓扑关系与可达性",
  "定义航段方向关系和计划航路的连通状态。",
  {
    related_global_jd: ["jd-0.3", "jd-0.10"],
    source: ["W-OPENDRIVE", "W-MAVLINK-MISSION", "L-SCENARIO"],
  },
);
variable(
  "PROPOSED-jd-7.1.2.1",
  "PROPOSED-jd-7.1.2",
  "jd-7.1",
  "A7",
  "航段方向性",
  "航段允许的通行方向。",
  "enum",
  [
    domain("directed", "单向", ["W-OPENDRIVE"]),
    domain("bidirectional", "双向", ["W-OPENDRIVE"]),
    domain("loop", "闭环", ["W-MAVLINK-MISSION"]),
    domain("conditional", "条件方向", ["W-OPENDRIVE"]),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible"],
    used_by_axl: ["A7.L1", "A7.L2", "A7.L3"],
    source: ["W-OPENDRIVE", "W-MAVLINK-MISSION"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-7.1.2.2",
  "PROPOSED-jd-7.1.2",
  "jd-7.1",
  "A7",
  "航路连通性状态",
  "计划航路在场景中的可连通状态。",
  "enum",
  [
    domain("connected", "连通", ["W-OPENDRIVE"]),
    domain("partially_blocked", "部分阻塞", [], BOTH, "inferred_candidate"),
    domain("disconnected", "不连通", [], BOTH, "inferred_candidate"),
    domain("time_dependent", "时变连通", [], BOTH, "inferred_candidate"),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible", "hidden_gt"],
    related_global_jd: ["jd-0.3", "jd-0.10"],
    used_by_axl: ["A7.L2", "A7.L3", "A7.L4"],
    source: ["W-OPENDRIVE", "L-SCENARIO"],
    evidence_status: "inferred_candidate",
    difficulty_direction: "decreasing",
  },
);

canonical(
  "jd-7.2",
  "A7",
  "导航工作机制",
  "航路表示、巡检模式、生成方式、航段执行与观察动作。",
);
group(
  "PROPOSED-jd-7.2.1",
  "jd-7.2",
  "jd-7.2",
  "A7",
  "航路表示与生成",
  "定义导航系统接收的航路形式和航路生成方式。",
);
variable(
  "PROPOSED-jd-7.2.1.1",
  "PROPOSED-jd-7.2.1",
  "jd-7.2",
  "A7",
  "航路表示类型",
  "任务航路的机器可读表示语义。",
  "multi_enum",
  [
    domain("waypoint_sequence", "航点序列", ["W-MAVLINK-MISSION"]),
    domain("polyline_or_path", "折线/路径", ["W-OPENDRIVE"]),
    domain("corridor_or_segment_graph", "走廊/航段图", ["W-OPENDRIVE"]),
    domain("zone_coverage", "区域覆盖", ["L-SCENARIO"], CAMPUS, "team_material_only"),
    domain("conditional_mission_items", "条件任务项", ["W-MAVLINK-MISSION"]),
  ],
  {
    configuration_side: "shared",
    used_by_axl: ["A7.L1", "A7.L2", "A7.L3", "A7.L4"],
    source: ["W-MAVLINK-MISSION", "W-OPENDRIVE", "L-SCENARIO"],
    difficulty_direction: "non_monotonic",
  },
);
group(
  "PROPOSED-jd-7.2.2",
  "jd-7.2",
  "jd-7.2",
  "A7",
  "巡检执行方式与观察动作",
  "定义巡检运动模式、航段执行顺序和附带观察动作。",
  { source: ["W-MAVLINK-MISSION", "W-MOT-UAV-BRIDGE", "L-SCENARIO"] },
);
variable(
  "PROPOSED-jd-7.2.2.1",
  "PROPOSED-jd-7.2.2",
  "jd-7.2",
  "A7",
  "巡检运动模式",
  "用于覆盖道路、园区或目标的巡检运动模式。",
  "multi_enum",
  [
    domain("linear_one_way", "线性单向", ["W-MOT-LOWALT-CASES"], HIGHWAY),
    domain("out_and_back", "往返", ["W-MOT-LOWALT-CASES"]),
    domain("loop_patrol", "闭环巡逻", ["L-SCENARIO"], CAMPUS, "team_material_only"),
    domain("point_to_point", "点到点", ["W-MAVLINK-MISSION"]),
    domain("zone_sweep", "区域扫描", ["L-SCENARIO"], CAMPUS, "team_material_only"),
    domain("hover_observe", "悬停观察", ["W-MOT-UAV-BRIDGE"]),
    domain("orbit_observe", "环绕观察", ["W-MOT-UAV-BRIDGE"]),
    domain("target_revisit", "目标重访", ["L-AXL68"]),
  ],
  {
    configuration_side: "user",
    related_global_jd: ["jd-0.10"],
    used_by_axl: ["A7.L1", "A7.L2", "A7.L3", "A7.L4"],
    source: ["W-MOT-LOWALT-CASES", "W-MAVLINK-MISSION", "W-MOT-UAV-BRIDGE", "L-SCENARIO", "L-AXL68"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-7.2.1.2",
  "PROPOSED-jd-7.2.1",
  "jd-7.2",
  "A7",
  "航路生成方式",
  "航路是预先给定、动态生成还是两者结合。",
  "enum",
  [
    domain("preplanned", "预先规划", ["W-MAVLINK-MISSION"]),
    domain("dynamic", "动态生成", ["L-AXL68"]),
    domain("hybrid", "预规划 + 局部动态", ["L-AXL68"]),
    domain("human_confirmed", "生成后人工确认", ["L-AXL68"]),
  ],
  {
    configuration_side: "user",
    related_global_jd: ["jd-0.5"],
    used_by_axl: ["A7.L1", "A7.L2", "A7.L3", "A7.L4"],
    source: ["W-MAVLINK-MISSION", "L-AXL68"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-7.2.2.2",
  "PROPOSED-jd-7.2.2",
  "jd-7.2",
  "A7",
  "航段执行顺序",
  "航段执行的顺序约束。",
  "enum",
  [
    domain("fixed_order", "固定顺序", ["W-MAVLINK-MISSION"]),
    domain("priority_order", "按优先级", ["L-SCENARIO"], BOTH, "team_material_only"),
    domain("any_feasible_order", "任意可行顺序", [], BOTH, "inferred_candidate"),
    domain("event_driven_order", "事件驱动顺序", ["L-SCENARIO"], BOTH, "team_material_only"),
  ],
  {
    configuration_side: "user",
    used_by_axl: ["A7.L1", "A7.L2", "A7.L3"],
    source: ["W-MAVLINK-MISSION", "L-SCENARIO"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-7.2.2.3",
  "PROPOSED-jd-7.2.2",
  "jd-7.2",
  "A7",
  "航点/航段观察动作",
  "航点或航段附带的观察动作语义；载荷动作本体引用 A9a。",
  "multi_enum",
  [
    domain("capture_image", "拍照", ["W-MAVLINK-MISSION"]),
    domain("start_or_stop_video", "开始/停止录像", ["W-MAVLINK-MISSION"]),
    domain("set_view_direction", "设定观察方向", ["W-MOT-UAV-BRIDGE"]),
    domain("loiter_or_hover", "盘旋/悬停", ["W-MAVLINK-MISSION", "W-MOT-UAV-BRIDGE"]),
    domain("reobserve_target", "重观测目标", ["L-AXL68"]),
    domain("none", "无附加观察动作", ["W-MAVLINK-MISSION"]),
  ],
  {
    configuration_side: "user",
    related_jd: ["jd-9a.1", "jd-5.4", "jd-6b.3"],
    used_by_axl: ["A7.L1", "A7.L2", "A7.L4"],
    source: ["W-MAVLINK-MISSION", "W-MOT-UAV-BRIDGE", "L-AXL68"],
    difficulty_direction: "non_monotonic",
  },
);

canonical(
  "jd-7.3",
  "A7",
  "轨迹重规划判据",
  "轨迹偏差、不可行、冲突、观测不足和上下游质量退化等轨迹级重规划触发。",
);
group(
  "PROPOSED-jd-7.3.1",
  "jd-7.3",
  "jd-7.3",
  "A7",
  "偏差与触发条件",
  "定义航段偏差维度、持续性判据和重规划触发条件。",
  { related_global_jd: ["jd-0.3", "jd-0.10"] },
);
variable(
  "PROPOSED-jd-7.3.1.1",
  "PROPOSED-jd-7.3.1",
  "jd-7.3",
  "A7",
  "轨迹偏差维度集合",
  "用于判定航迹偏离的维度。",
  "multi_enum",
  [
    domain("lateral", "横向偏差", ["L-AXL68"]),
    domain("vertical", "垂向偏差", ["L-AXL68"]),
    domain("longitudinal_or_progress", "纵向/进度偏差", ["W-OPENDRIVE"]),
    domain("heading", "航向偏差", ["L-AXL68"]),
    domain("time_schedule", "时间进度偏差", ["L-SCENARIO"]),
    domain("observation_geometry", "观测几何偏差", ["W-MOT-UAV-BRIDGE"]),
  ],
  {
    configuration_side: "user",
    used_by_axl: ["A7.L2", "A7.L3", "A7.L4"],
    source: ["L-AXL68", "W-OPENDRIVE", "L-SCENARIO", "W-MOT-UAV-BRIDGE"],
    difficulty_direction: "non_monotonic",
  },
);
variable(
  "PROPOSED-jd-7.3.1.2",
  "PROPOSED-jd-7.3.1",
  "jd-7.3",
  "A7",
  "偏差/持续性阈值包",
  "各偏差维度触发重规划所需的阈值和持续时间。",
  "array",
  {
    item_schema: {
      dimension: "enum_ref:PROPOSED-jd-7.3.1.1",
      threshold: null,
      duration: null,
      unit: "per_dimension",
    },
    values: [],
    tbd_reason: "阈值需要平台、任务和安全资料共同确认",
  },
  {
    multiplicity: "zero_or_more",
    configuration_side: "user",
    visibility: ["sut_visible", "grader_visible"],
    used_by_axl: ["A7.L2", "A7.L3"],
    source: ["L-AXL68"],
    evidence_status: "TBD",
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-7.3.1.3",
  "PROPOSED-jd-7.3.1",
  "jd-7.3",
  "A7",
  "轨迹重规划触发集合",
  "允许触发轨迹级重规划的场景或质量状态。",
  "multi_enum",
  [
    domain("persistent_deviation", "持续航迹偏差", ["L-AXL68"]),
    domain("segment_infeasible", "航段不可行", ["L-AXL68"]),
    domain("route_conflict", "航路冲突", ["L-AXL68"]),
    domain("position_quality_degraded", "定位质量退化", ["L-AXL68", "W-PX4-EKF"]),
    domain("relative_geometry_lost", "相对几何丢失", ["L-AXL68"]),
    domain("target_moved_or_departed", "目标移动或驶离", ["W-UAV-PARKING-SZ"]),
    domain("observation_insufficient", "观测不足", ["W-MOT-UAV-BRIDGE"]),
    domain("weather_or_disturbance", "天气/扰动", ["W-MOT-UAV-BRIDGE"]),
    domain("airspace_or_safety_constraint", "空域/安全约束", ["W-MOT-UAV-BRIDGE"]),
    domain("resource_constraint", "资源约束", ["L-SCENARIO"]),
  ],
  {
    configuration_side: "user",
    related_global_jd: ["jd-0.3", "jd-0.10"],
    related_jd: ["jd-6a.2", "jd-6b.3", "jd-11.2", "jd-12.2"],
    used_by_axl: ["A7.L3", "A7.L4"],
    source: ["L-AXL68", "W-PX4-EKF", "W-UAV-PARKING-SZ", "W-MOT-UAV-BRIDGE", "L-SCENARIO"],
    difficulty_direction: "context_dependent",
  },
);
group(
  "PROPOSED-jd-7.3.2",
  "jd-7.3",
  "jd-7.3",
  "A7",
  "不可行原因与重规划范围",
  "定义航段不可行的原因和触发后允许修改的航路范围。",
  {
    related_global_jd: ["jd-0.10"],
    source: ["L-AXL68", "W-MAVLINK-MISSION", "W-MOT-UAV-BRIDGE"],
  },
);
variable(
  "PROPOSED-jd-7.3.2.1",
  "PROPOSED-jd-7.3.2",
  "jd-7.3",
  "A7",
  "航段不可行原因集合",
  "航段被判定不可行的原因。",
  "multi_enum",
  [
    domain("blocked_corridor", "通道阻塞", [], BOTH, "inferred_candidate"),
    domain("geofence_or_airspace", "地理围栏/空域限制", ["W-MAVLINK-MISSION", "W-MOT-UAV-BRIDGE"]),
    domain("safety_margin_insufficient", "安全裕度不足", ["L-AXL68"]),
    domain("position_prerequisite_missing", "定位前提缺失", ["W-PX4-MISSION"]),
    domain("observation_geometry_unreachable", "观测几何不可达", ["W-MOT-UAV-BRIDGE"]),
    domain("platform_or_resource_limit", "平台/资源限制", ["L-SCENARIO"]),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible", "hidden_gt"],
    related_global_jd: ["jd-0.10"],
    related_jd: ["jd-2.2", "jd-6a.2", "jd-11.2"],
    used_by_axl: ["A7.L3", "A7.L4"],
    source: ["W-MAVLINK-MISSION", "W-MOT-UAV-BRIDGE", "L-AXL68", "W-PX4-MISSION", "L-SCENARIO"],
    difficulty_direction: "context_dependent",
  },
);
variable(
  "PROPOSED-jd-7.3.2.2",
  "PROPOSED-jd-7.3.2",
  "jd-7.3",
  "A7",
  "重规划范围",
  "触发后允许修改的航路范围。",
  "enum",
  [
    domain("local_segment", "局部航段", ["L-AXL68"]),
    domain("remaining_route", "剩余航路", ["W-MAVLINK-MISSION"]),
    domain("full_route", "完整航路", ["L-AXL68"]),
    domain("request_task_level_replan", "请求 A4 任务级重编排", ["L-AXL68"]),
  ],
  {
    configuration_side: "user",
    related_jd: ["jd-4.3", "jd-4.4"],
    used_by_axl: ["A7.L3", "A7.L4"],
    source: ["L-AXL68", "W-MAVLINK-MISSION"],
    difficulty_direction: "context_dependent",
  },
);

canonical(
  "jd-7.4",
  "A7",
  "航迹处置策略适用集",
  "改高度、改航迹、等待、悬停、重访和返航请求等导航策略的适用条件及验证。",
);
group(
  "PROPOSED-jd-7.4.1",
  "jd-7.4",
  "jd-7.4",
  "A7",
  "处置选择与适用规则",
  "定义 A7 可选择的航迹处置、适用规则和安全等待点要求。",
  { related_global_jd: ["jd-0.10"] },
);
variable(
  "PROPOSED-jd-7.4.1.1",
  "PROPOSED-jd-7.4.1",
  "jd-7.4",
  "A7",
  "允许航迹处置策略集合",
  "任务允许 A7 选择的运动层处置策略。",
  "multi_enum",
  [
    domain("wait", "等待", ["L-AXL68"]),
    domain("hover_or_loiter", "悬停/盘旋", ["L-AXL68", "W-MAVLINK-MISSION"]),
    domain("change_altitude", "改变高度", ["L-AXL68"]),
    domain("change_path", "改变航迹", ["L-AXL68"]),
    domain("increase_clearance_or_margin", "增加净空/裕度", ["L-AXL68"]),
    domain("revisit_target", "重访目标", ["L-AXL68"]),
    domain("use_alternate_route", "使用备选航路", ["W-MAVLINK-MISSION"]),
    domain("request_return_or_abort", "请求返航/中止", ["W-PX4-MISSION"]),
    domain("request_task_level_replan", "请求任务级重编排", ["L-AXL68"]),
  ],
  {
    configuration_side: "user",
    related_global_jd: ["jd-0.10"],
    related_jd: ["jd-4.4", "jd-8.2", "jd-12.2"],
    used_by_axl: ["A7.L4"],
    source: ["L-AXL68", "W-MAVLINK-MISSION", "W-PX4-MISSION"],
    difficulty_direction: "neutral",
    notes: "A7 选择航迹/运动目标；A8 执行控制；A12 决定系统级安全返航或中止。",
  },
);
variable(
  "PROPOSED-jd-7.4.1.2",
  "PROPOSED-jd-7.4.1",
  "jd-7.4",
  "A7",
  "航迹策略适用规则",
  "策略与触发、飞行阶段、可用等待点、备选航路和安全约束之间的映射。",
  "array",
  {
    item_schema: {
      strategy: "enum_ref:PROPOSED-jd-7.4.1.1",
      conditions: "expression",
    },
    values: [],
    tbd_reason: "具体业务规则与平台执行前提待团队确认",
  },
  {
    activation_condition: {
      node: "PROPOSED-jd-7.4.1.1",
      operator: "non_empty",
    },
    multiplicity: "zero_or_more",
    configuration_side: "user",
    used_by_axl: ["A7.L4"],
    source: ["L-AXL68"],
    evidence_status: "TBD",
    difficulty_direction: "neutral",
  },
);
variable(
  "PROPOSED-jd-7.4.1.3",
  "PROPOSED-jd-7.4.1",
  "jd-7.4",
  "A7",
  "安全等待点要求",
  "等待或悬停策略是否必须使用已定义的安全等待点。",
  "enum",
  [
    domain("required", "必须使用", ["W-MOT-UAV-BRIDGE"]),
    domain("preferred", "优先使用", [], BOTH, "inferred_candidate"),
    domain("not_required", "不要求", [], BOTH, "inferred_candidate"),
    domain("TBD", "待确认", [], BOTH, "TBD"),
  ],
  {
    activation_condition: {
      node: "PROPOSED-jd-7.4.1.1",
      operator: "intersects",
      value: ["wait", "hover_or_loiter"],
    },
    configuration_side: "user",
    related_global_jd: ["jd-0.10"],
    used_by_axl: ["A7.L4"],
    source: ["W-MOT-UAV-BRIDGE"],
    evidence_status: "inferred_candidate",
    difficulty_direction: "neutral",
  },
);
group(
  "PROPOSED-jd-7.4.2",
  "jd-7.4",
  "jd-7.4",
  "A7",
  "可用资源与处置验证",
  "定义备选航路资源和处置执行后的验证要求。",
  {
    related_global_jd: ["jd-0.10"],
    source: ["W-MAVLINK-MISSION", "L-AXL68"],
  },
);
variable(
  "PROPOSED-jd-7.4.2.1",
  "PROPOSED-jd-7.4.2",
  "jd-7.4",
  "A7",
  "备选航路可用性",
  "任务是否提供可用于改航或返回的备选航路。",
  "enum",
  [
    domain("predefined", "预先定义", ["W-MAVLINK-MISSION"]),
    domain("dynamically_generatable", "可动态生成", ["L-AXL68"]),
    domain("unavailable", "无备选航路", ["W-MAVLINK-MISSION"]),
  ],
  {
    configuration_side: "world",
    visibility: ["sut_visible"],
    used_by_axl: ["A7.L3", "A7.L4"],
    source: ["W-MAVLINK-MISSION", "L-AXL68"],
    difficulty_direction: "decreasing",
  },
);
variable(
  "PROPOSED-jd-7.4.2.2",
  "PROPOSED-jd-7.4.2",
  "jd-7.4",
  "A7",
  "处置后航路验证要求",
  "执行航迹处置后是否必须验证新航路可行、约束满足且目标仍可观测。",
  "boolean",
  [true, false],
  {
    activation_condition: {
      node: "PROPOSED-jd-7.4.1.1",
      operator: "non_empty",
    },
    configuration_side: "user",
    visibility: ["sut_visible", "grader_visible"],
    related_jd: ["jd-6a.2", "jd-6b.1"],
    used_by_axl: ["A7.L4"],
    source: ["L-AXL68"],
    evidence_status: "authoritative_existing",
    difficulty_direction: "increasing",
  },
);

function assertCatalog() {
  const ids = new Set();
  const knownOwners = new Set(["MULTI", "A5", "A6a", "A6b", "A7"]);
  const knownConfigurationSides = new Set(["world", "user", "shared"]);
  const knownDifficultyDirections = new Set([
    "increasing",
    "decreasing",
    "neutral",
    "context_dependent",
    "non_monotonic",
    "TBD",
  ]);
  const knownVisibility = new Set([
    "sut_visible",
    "fixture_only",
    "grader_visible",
    "grader_only",
    "hidden_gt",
  ]);
  const knownScenarios = new Set(BOTH);
  const canonicalSlots = new Set([
    "jd-5.1",
    "jd-5.2",
    "jd-5.3",
    "jd-5.4",
    "jd-6a.1",
    "jd-6a.2",
    "jd-6a.3",
    "jd-6b.1",
    "jd-6b.2",
    "jd-6b.3",
    "jd-7.1",
    "jd-7.2",
    "jd-7.3",
    "jd-7.4",
  ]);
  for (const node of nodes) {
    if (ids.has(node.node_id)) throw new Error(`duplicate node_id: ${node.node_id}`);
    ids.add(node.node_id);
    if (!knownOwners.has(node.owner_a)) throw new Error(`unknown owner_a: ${node.owner_a}`);
    if (!knownConfigurationSides.has(node.configuration_side)) {
      throw new Error(`unknown configuration_side: ${node.node_id}`);
    }
    if (!Array.isArray(node.visibility)) {
      throw new Error(`visibility must be an array: ${node.node_id}`);
    }
    for (const visibility of node.visibility) {
      if (!knownVisibility.has(visibility)) {
        throw new Error(`unknown visibility ${visibility}: ${node.node_id}`);
      }
    }
    if (!knownDifficultyDirections.has(node.difficulty_direction)) {
      throw new Error(
        `unknown difficulty_direction ${node.difficulty_direction}: ${node.node_id}`,
      );
    }
    for (const scenario of node.applicable_scenarios) {
      if (!knownScenarios.has(scenario)) {
        throw new Error(`unknown scenario ${scenario}: ${node.node_id}`);
      }
    }
    for (const cell of node.used_by_axl) {
      if (!/^(A5|A6a|A6b|A7)×L[1-4]$/.test(cell)) {
        throw new Error(`invalid A×L cell ${cell}: ${node.node_id}`);
      }
    }
    if (
      node.canonical_slot !== null &&
      !canonicalSlots.has(node.canonical_slot)
    ) {
      throw new Error(`unknown canonical_slot: ${node.canonical_slot}`);
    }
    if (
      node.node_kind === "variable" &&
      (node.value_type === "none" || node.value_type === null)
    ) {
      throw new Error(`variable without value_type: ${node.node_id}`);
    }
    if (node.node_kind === "group" && node.value_type !== "none") {
      throw new Error(`group has a value_type: ${node.node_id}`);
    }
    if (
      node.node_id.startsWith("PROPOSED-jd-") &&
      node.review_status === "reviewed"
    ) {
      throw new Error(`proposed node cannot be reviewed: ${node.node_id}`);
    }
    if (
      node.node_kind === "variable" &&
      (!Array.isArray(node.source) || node.source.length === 0)
    ) {
      throw new Error(`variable without a source or TBD basis: ${node.node_id}`);
    }
    if (
      !canonicalSlots.has(node.node_id) &&
      !node.node_id.startsWith("PROPOSED-")
    ) {
      throw new Error(`non-canonical node lacks PROPOSED prefix: ${node.node_id}`);
    }
  }
  const reviewedCanonical = nodes.filter(
    (node) =>
      canonicalSlots.has(node.node_id) && node.review_status === "reviewed",
  );
  if (reviewedCanonical.length !== canonicalSlots.size) {
    throw new Error(
      `expected ${canonicalSlots.size} reviewed canonical slots, found ${reviewedCanonical.length}`,
    );
  }
  for (const node of nodes) {
    if (node.parent_id !== null && !ids.has(node.parent_id)) {
      throw new Error(`missing parent ${node.parent_id} for ${node.node_id}`);
    }
    for (const dependency of node.depends_on) {
      if (!ids.has(dependency)) {
        throw new Error(`missing dependency ${dependency} for ${node.node_id}`);
      }
    }
  }
  const sourceIds = new Set(sources.map((source) => source.source_id));
  for (const node of nodes) {
    for (const sourceId of node.source) {
      if (!sourceIds.has(sourceId)) {
        throw new Error(`missing source ${sourceId} for ${node.node_id}`);
      }
    }
    if (Array.isArray(node.value_domain)) {
      for (const item of node.value_domain) {
        if (item && typeof item === "object" && Array.isArray(item.source_refs)) {
          if (typeof item.status !== "string") {
            throw new Error(`domain item without status for ${node.node_id}`);
          }
          for (const sourceId of item.source_refs) {
            if (!sourceIds.has(sourceId)) {
              throw new Error(
                `missing domain source ${sourceId} for ${node.node_id}`,
              );
            }
          }
        }
      }
    } else if (
      node.node_kind === "variable" &&
      node.value_domain &&
      typeof node.value_domain === "object" &&
      node.evidence_status === "TBD" &&
      !node.value_domain.tbd_reason
    ) {
      throw new Error(`TBD domain without tbd_reason for ${node.node_id}`);
    }
  }
}

function summarizeBy(key) {
  return nodes.reduce((acc, node) => {
    const value = node[key] ?? "null";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function formatCell(value) {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 0);
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function buildYamlNodes() {
  return `${nodes
    .map((node) =>
      Object.entries(node)
        .map(
          ([key, value], index) =>
            `${index === 0 ? "- " : "  "}${key}: ${JSON.stringify(value)}`,
        )
        .join("\n"),
    )
    .join("\n")}\n`;
}

function buildTreeLines() {
  const children = new Map();
  for (const node of nodes) {
    if (!children.has(node.parent_id)) children.set(node.parent_id, []);
    children.get(node.parent_id).push(node);
  }
  const lines = [];
  function walk(parentId, prefix = "") {
    const items = children.get(parentId) ?? [];
    items.forEach((node, index) => {
      const last = index === items.length - 1;
      lines.push(
        `${prefix}${last ? "└──" : "├──"} ${node.node_id} ${node.name}`,
      );
      walk(node.node_id, `${prefix}${last ? "    " : "│   "}`);
    });
  }
  walk(null);
  return lines;
}

const schemaFields = [
  ["node_id", "节点唯一标识；正式槽位沿用 jd-*，新增细分使用 PROPOSED-*。", "Config Agent / Seed / 审计"],
  ["parent_id", "父节点标识；根节点为 null。", "Config Agent / 审计"],
  ["canonical_slot", "该节点归属的 66 槽位正式编号。", "Config Agent / 审计"],
  ["owner_a", "所属能力域；不表示自主等级。", "Config Agent / 审计"],
  ["name", "节点规范名称。", "Config Agent / Seed / 审计"],
  ["definition", "变量或分组的业务定义。", "Config Agent / 审计"],
  ["node_kind", "scenario_root、capability_root、group 或 variable。", "Config Agent / Seed"],
  ["value_type", "叶子值类型；分组为 none。", "Seed / 审计"],
  ["value_domain", "候选枚举、范围结构或 TBD 原因；枚举值不是树节点。", "Config Agent / Seed / 审计"],
  ["unit", "数值量的单位；不适用时为 null。", "Seed / 审计"],
  ["activation_condition", "该节点何时启用的机器可读条件。", "Config Agent / Seed"],
  ["multiplicity", "单值、多值或可重复实例约束。", "Config Agent / Seed"],
  ["difficulty_direction", "变量变化与场景难度的候选关系；允许 increasing、decreasing、neutral、context_dependent、non_monotonic 和 TBD，与自主等级 L 分离。", "Config Agent / 审计"],
  ["configuration_side", "world、user 或 shared；shared 是允许的正式值，表示配置归属由双方共享。", "Config Agent / Seed"],
  ["visibility", "数组类型，可组合 SUT、Fixture、Grader 或 Hidden GT 可见性。", "Config Agent / Seed / Grader"],
  ["applicable_scenarios", "节点适用的场景 ID。", "Config Agent"],
  ["related_global_jd", "复用的 jd-0.x 全局变量引用。", "Config Agent / Seed"],
  ["related_jd", "与其他正式 JD 槽位的边界或依赖引用。", "Config Agent / 审计"],
  ["used_by_axl", "消费该变量的 A×L 单元；只建立映射，不把 L 写入 JD 值域。", "Config Agent / 审计"],
  ["depends_on", "显式依赖的其他节点 ID。", "Config Agent / Seed / 校验"],
  ["mutual_exclusion_group", "互斥选择组；没有时为 null。", "Seed / 校验"],
  ["constraints", "跨字段约束表达；没有证据的规则保持空或 TBD。", "Seed / 校验"],
  ["source", "支持节点定义的来源 ID 列表。", "审计"],
  ["evidence_status", "authoritative_existing、source_supported、inferred_candidate、team_material_only 或 TBD。", "Config Agent / 审计"],
  ["review_status", "reviewed 或 proposed。", "Config Agent / 审计"],
  ["legacy_aliases", "旧名或旧展示映射；不改变正式编号。", "迁移 / 审计"],
  ["notes", "边界、风险和待人工确认说明。", "审计"],
];

function buildMarkdown(catalog) {
  const headers = [
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
    "visibility",
    "applicable_scenarios",
    "related_global_jd",
    "related_jd",
    "used_by_axl",
    "depends_on",
    "source",
    "evidence_status",
    "review_status",
    "notes",
  ];
  const sourceRows = sources
    .map(
      (source) =>
        `| ${source.source_id} | ${formatCell(source.title)} | ${formatCell(source.issuer)} | ${formatCell(source.source_type)} | ${formatCell(source.locator)} | ${source.url ? `[链接](${source.url})` : ""} | ${source.evidence_grade} |`,
    )
    .join("\n");
  const nodeRows = nodes
    .map(
      (node) =>
        `| ${headers.map((header) => formatCell(node[header])).join(" | ")} |`,
    )
    .join("\n");
  const schemaRows = schemaFields
    .map(
      ([field, purpose, consumers]) =>
        `| \`${field}\` | ${purpose} | ${consumers} |`,
    )
    .join("\n");

  return `# JD 业务变量树：A5 / A6a / A6b / A7

## 高速巡检与园区巡检机读版

| 元数据 | 值 |
|---|---|
| schema | \`${catalog.schema}\` |
| schema_version | \`${catalog.schema_version}\` |
| catalog_version | \`${catalog.catalog_version}\` |
| 生成日期 | \`${catalog.generated_at}\` |
| 替代范围 | 原 66 槽位机读版中 A5、A6a、A6b、A7 的扁平展示层 |
| 保留基线 | 14 个现有 canonical slots 不重编号 |
| 新节点状态 | 全部以 \`PROPOSED\` 编号，等待人工评审 |
| 场景 | \`highway_inspection\`、\`campus_inspection\` |
| 主要业务主线 | 车辆停止/停放事件；道路病害为高速可选扩展 |

> 本文件与 \`knowledge/jd_variable_tree_a5_a6a_a6b_a7.json\` 由同一生成脚本产生。旧 \`knowledge/jd_dictionary.json\` 继续保存 66 个 canonical slots；新的树状 Catalog 是其 A5/A6a/A6b/A7 细化层，不破坏其他 A。

## 一、关键边界

1. “车辆停止/停放”是可观测事件；只有结合适用道路、区域规则、持续状态和合法例外后，才可形成违停真值。
2. 高速和园区共享同一结构，通过 \`applicable_scenarios\`、\`activation_condition\` 和候选值表达差异。
3. 园区道路若允许社会机动车通行，可能属于道路交通安全法的“道路”；封闭或内部区域还必须引用园区规则，不可自动套用公共道路处罚语义。
4. A5 描述对象/状态与观测条件；A6a 描述自身绝对位姿；A6b 描述相对车道/区域/目标几何；A7 描述航路和运动处置。
5. A7 选择运动目标和航迹；A8 负责低层控制执行；A12 负责系统级安全返航/中止。
6. 所有缺少适用证据的阈值、园区规则和 simulator 字段保持 \`TBD\`。

## 二、统一节点 Schema

| 字段 | 用途 | 主要消费者 |
|---|---|---|
${schemaRows}

Config Agent 主要使用树关系、适用场景、状态和来源裁剪分支；Seed 只实例化满足 \`activation_condition\` 的 \`variable\` 叶子；来源、证据状态、评审状态、旧名和备注主要用于审计。世界侧/用户侧由 \`configuration_side\` 投影，可见性单独由 \`visibility\` 控制，两者不得互相推断。

已确认的 Schema 决策：\`configuration_side\` 允许 \`shared\`；\`visibility\` 必须使用数组；\`difficulty_direction\` 允许 \`context_dependent\`、\`non_monotonic\` 和 \`TBD\`。三项决定已写入 JSON 的 \`controlled_vocabularies\` 与 \`decision_log\`。

## 三、人类可读树

\`\`\`text
${buildTreeLines().join("\n")}
\`\`\`

## 四、来源目录

| source_id | 标题 | 发布/维护方 | 类型 | 定位 | URL | 证据等级 |
|---|---|---|---|---|---|---|
${sourceRows}

## 五、完整节点表

每行只表示一个节点。枚举值保存在 \`value_domain\`，不作为额外树节点。

| ${headers.join(" | ")} |
| ${headers.map(() => "---").join(" | ")} |
${nodeRows}

## 六、机器文件

- \`knowledge/jd_variable_tree_a5_a6a_a6b_a7.json\`
- \`knowledge/jd_variable_tree_a5_a6a_a6b_a7.yaml\`
- 生成器：\`scripts/generate_jd_variable_tree_a5_a6a_a6b_a7.mjs\`

## 七、当前待团队确认

- 园区内部管理规则、授权车辆和临时装卸规则的正式来源。
- 高速与园区停车事件的时间判据和取证阈值。
- 车牌可读性、目标尺度、遮挡和图像质量的档位阈值。
- A6a 精度、时延和质量状态的跨平台统一值域。
- A6b 相对距离、偏差和观测角的范围。
- A7 航迹偏差、持续时间、等待点和备选航路规则。
- \`shared\` 配置节点在世界侧/用户侧导出时采用复制还是公共引用。
- Grader 真值与 SUT 可见上下文的最终边界。
`;
}

assertCatalog();

const catalog = {
  catalog_id: "jd-variable-tree-a5-a6a-a6b-a7-inspection",
  schema: "uav-benchmark-jd-variable-tree",
  schema_version: "0.2.1",
  catalog_version: "a5-a6a-a6b-a7-highway-campus-2026-07-19-r2",
  generated_at: "2026-07-19",
  generated_by: "scripts/generate_jd_variable_tree_a5_a6a_a6b_a7.mjs",
  supersedes_for_scope: {
    source: "knowledge/jd_dictionary.json",
    scope: ["A5", "A6a", "A6b", "A7"],
    mode: "hierarchical_extension",
    canonical_slots_preserved: true,
  },
  scenario_scope: BOTH,
  primary_business_thread: "vehicle_stop_or_parking_event",
  optional_extensions: ["road_surface_distress@highway_inspection"],
  authority_rules: [
    "现有 66 槽位和 68 个 AxL 单元优先于新增节点",
    "新增节点使用 PROPOSED 编号",
    "法律/标准定义业务语义，数据集只补充可观测 taxonomy",
    "无来源阈值、规则和 simulator 字段保持 TBD",
    "configuration_side 与 visibility 分开",
    "自主等级 L 不进入 JD 值域",
  ],
  controlled_vocabularies: {
    configuration_side: ["world", "user", "shared"],
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
    difficulty_direction: [
      "increasing",
      "decreasing",
      "neutral",
      "context_dependent",
      "non_monotonic",
      "TBD",
    ],
  },
  decision_log: [
    {
      decision_id: "schema-4-configuration-side",
      status: "confirmed_by_user",
      decision: "configuration_side 允许 shared",
      confirmed_at: "2026-07-19",
    },
    {
      decision_id: "schema-5-visibility",
      status: "confirmed_by_user",
      decision: "visibility 使用数组",
      confirmed_at: "2026-07-19",
    },
    {
      decision_id: "schema-7-difficulty-direction",
      status: "confirmed_by_user",
      decision:
        "difficulty_direction 允许 context_dependent、non_monotonic 和 TBD",
      confirmed_at: "2026-07-19",
    },
  ],
  source_count: sources.length,
  node_count: nodes.length,
  leaf_count: nodes.filter((node) => node.node_kind === "variable").length,
  counts_by_owner: summarizeBy("owner_a"),
  counts_by_kind: summarizeBy("node_kind"),
  schema_fields: schemaFields.map(([field, purpose, consumers]) => ({
    field,
    purpose,
    consumers,
  })),
  sources,
  nodes,
};

fs.writeFileSync(outputJson, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
fs.writeFileSync(outputYaml, buildYamlNodes(), "utf8");
fs.writeFileSync(outputMarkdown, buildMarkdown(catalog), "utf8");

console.log(
  JSON.stringify(
    {
      outputJson,
      outputYaml,
      outputMarkdown,
      node_count: catalog.node_count,
      leaf_count: catalog.leaf_count,
      source_count: catalog.source_count,
      counts_by_owner: catalog.counts_by_owner,
      counts_by_kind: catalog.counts_by_kind,
    },
    null,
    2,
  ),
);
