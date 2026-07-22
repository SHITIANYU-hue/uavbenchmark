import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const knowledgeDir = path.join(projectRoot, "knowledge");
const catalogPath = path.join(knowledgeDir, "jd_variable_tree_version1.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const jdDictionary = JSON.parse(
  fs.readFileSync(path.join(knowledgeDir, "jd_dictionary.json"), "utf8"),
);
const axlCatalog = JSON.parse(
  fs.readFileSync(
    path.join(knowledgeDir, "axl_responsibility_catalog.json"),
    "utf8",
  ),
);

const catalogRootId = "PROPOSED-jd-tree-version1";
const generatedAt = "2026-07-22";
const crossScenario = ["cross_scenario"];

const extensionSources = [
  {
    source_id: "L-FULL-JD66-V3",
    title: "JD业务变量字典_66槽位_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator: "ability-id-v3-2026-07-20：56 个 local JD 与 10 个 global JD 的稳定定义",
    url: null,
    evidence_grade: "authoritative_local",
  },
  {
    source_id: "L-FULL-AXL68-V3",
    title: "AxL责任定义字典_17A_68单元_机读版.md",
    issuer: "UAV Benchmark team",
    source_type: "reviewed_team_dictionary",
    locator: "ability-id-v3-2026-07-20：A1–A17 的 L1–L4 责任与 JD 引用",
    url: null,
    evidence_grade: "authoritative_local",
  },
  {
    source_id: "W-MAVLINK-COMMAND",
    title: "MAVLink Command Protocol",
    issuer: "MAVLink",
    source_type: "official_protocol_documentation",
    locator: "命令寻址、参数、ACK、进行中状态、取消与重发",
    url: "https://mavlink.io/en/services/command.html",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-MAVLINK-PAYLOAD",
    title: "MAVLink Payload Protocols",
    issuer: "MAVLink",
    source_type: "official_protocol_documentation",
    locator: "相机、云台、绞盘、夹爪和通用载荷动作分类",
    url: "https://mavlink.io/en/services/payload.html",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-MAVLINK-GIMBAL-V2",
    title: "MAVLink Gimbal Protocol v2",
    issuer: "MAVLink",
    source_type: "official_protocol_documentation",
    locator: "云台设备、管理器、控制权、姿态、状态与能力",
    url: "https://mavlink.io/en/services/gimbal_v2.html",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-MAVLINK-MICROSERVICES",
    title: "MAVLink Microservices",
    issuer: "MAVLink",
    source_type: "official_protocol_documentation",
    locator: "Heartbeat、Mission、Camera、Battery、FTP、Time Sync、Open Drone ID 等协议边界",
    url: "https://mavlink.io/en/services/index.html",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-MAVLINK-ROUTING",
    title: "MAVLink Routing",
    issuer: "MAVLink",
    source_type: "official_protocol_documentation",
    locator: "系统、组件、广播和定向寻址的网络拓扑",
    url: "https://mavlink.io/en/guide/routing.html",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-MAVLINK-TRAFFIC",
    title: "MAVLink Traffic Management and Avoidance (UTM/ADSB)",
    issuer: "MAVLink",
    source_type: "official_protocol_documentation",
    locator: "UTM_GLOBAL_POSITION、ADSB_VEHICLE 与交通冲突信息",
    url: "https://mavlink.io/en/services/traffic_management.html",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-PX4-SAFETY",
    title: "PX4 Safety (Failsafe) Configuration",
    issuer: "PX4",
    source_type: "official_platform_documentation",
    locator: "告警、Hold、Return、Land、Disarm、Termination 及多类 failsafe 触发",
    url: "https://docs.px4.io/main/en/config/safety",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-PX4-GEOFENCE",
    title: "PX4 Geofence",
    issuer: "PX4",
    source_type: "official_platform_documentation",
    locator: "圆形、polygon、inclusion、exclusion 与 breach action",
    url: "https://docs.px4.io/main/en/flying/geofence",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-CAAC-UAS-RULE-761",
    title: "无人驾驶航空器飞行管理暂行条例",
    issuer: "中国民用航空局",
    source_type: "official_regulation",
    locator: "国令第761号；无人驾驶航空器分类、运行与飞行活动管理",
    url: "https://www.caac.gov.cn/XXGK/XXGK/FLFG/202401/t20240115_222642.html",
    evidence_grade: "authoritative_external_scoped",
  },
  {
    source_id: "W-W3C-PROV-DM",
    title: "PROV-DM: The PROV Data Model",
    issuer: "W3C",
    source_type: "official_standard",
    locator: "Entity、Activity、Agent、derivation、bundle 与 provenance 交换模型",
    url: "https://www.w3.org/TR/prov-dm/",
    evidence_grade: "source_supported",
  },
  {
    source_id: "W-OGC-GEOJSON",
    title: "OGC GeoJSON Standard",
    issuer: "Open Geospatial Consortium",
    source_type: "official_standard",
    locator: "地理空间成果的几何、属性与坐标参考表达",
    url: "https://www.ogc.org/standards/geojson/",
    evidence_grade: "source_supported",
  },
];

const abilityDefaults = {
  A12: { side: "shared", global: ["jd-0.9", "jd-0.5"] },
  A13: { side: "shared", global: ["jd-0.7", "jd-0.9"] },
  A14: { side: "world", global: ["jd-0.8", "jd-0.5"] },
  A15: { side: "shared", global: ["jd-0.6", "jd-0.5"] },
  A16: { side: "shared", global: ["jd-0.6", "jd-0.5"] },
  A17: { side: "shared", global: ["jd-0.10", "jd-0.5"] },
};

const childDefinitions = {
  "jd-12.1": [
    { name: "动作类型集", type: "multi_enum", values: [["photo", "拍照"], ["broadcast", "喊话"], ["delivery", "投送"], ["sampling", "采样"], ["gimbal_positioning", "云台调位"]], sources: ["L-FULL-JD66-V3", "W-MAVLINK-PAYLOAD"] },
    { name: "载荷实例与寻址", type: "reference_set", sources: ["W-MAVLINK-COMMAND", "W-MAVLINK-GIMBAL-V2"] },
    { name: "动作参数结构", type: "schema_ref", sources: ["W-MAVLINK-COMMAND", "W-MAVLINK-PAYLOAD"] },
    { name: "动作响应状态", type: "enum", values: [["accepted", "已接受"], ["in_progress", "执行中"], ["completed", "已完成"], ["failed", "失败"], ["cancelled", "已取消"]], sources: ["W-MAVLINK-COMMAND"] },
    { name: "载荷能力与可用状态", type: "object", sources: ["W-MAVLINK-PAYLOAD", "W-MAVLINK-GIMBAL-V2"] },
  ],
  "jd-12.2": [
    { name: "动作顺序关系", type: "dependency_graph", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "动作前置条件", type: "condition_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "动作完成判定", type: "condition_set", sources: ["W-MAVLINK-COMMAND", "L-FULL-AXL68-V3"] },
    { name: "并发与互斥关系", type: "constraint_set", sources: ["L-FULL-JD66-V3", "W-MAVLINK-GIMBAL-V2"] },
    { name: "时序异常类型", type: "multi_enum", values: [["omission", "漏执行"], ["duplicate", "重复"], ["order_mismatch", "时序错位"], ["payload_fault", "载荷异常"]], sources: ["L-FULL-AXL68-V3"] },
  ],
  "jd-12.3": [
    { name: "处置触发条件", type: "condition_set", sources: ["L-FULL-AXL68-V3"] },
    { name: "允许处置动作", type: "multi_enum", values: [["retry", "重试"], ["change_viewpoint", "换角度"], ["adjust_parameters", "调参数"], ["switch_mode", "切模式"], ["pause", "暂停"], ["request_inspection", "请求检查"]], sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "处置适用前提", type: "condition_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "人工确认要求", type: "protocol_ref", sources: ["L-FULL-AXL68-V3"] },
    { name: "处置后状态验证", type: "condition_set", sources: ["L-FULL-AXL68-V3", "W-MAVLINK-COMMAND"] },
  ],
  "jd-13.1": [
    { name: "成果产物类型", type: "multi_enum", values: [["structured_report", "结构化报告"], ["image_sequence", "图序"], ["video_stream", "视频流"], ["sampling_record", "采样记录"], ["heatmap", "热图"]], sources: ["L-FULL-JD66-V3"] },
    { name: "成果数据结构与版本", type: "schema_ref", sources: ["L-FULL-JD66-V3", "W-W3C-PROV-DM"] },
    { name: "空间表达格式", type: "enum", values: [
      { value: "geojson", label: "GeoJSON", source_refs: ["W-OGC-GEOJSON"], status: "source_supported" },
      { value: "TBD", label: "其他空间表达格式待确认", source_refs: [], status: "TBD" },
    ], sources: ["W-OGC-GEOJSON", "L-FULL-JD66-V3"], notes: "“非地理空间成果”不是空间格式，已从同层枚举移除；空间表达不适用时由上层成果合同表达，不在本节点伪造格式值。" },
    { name: "成果与任务对象关联", type: "reference_set", sources: ["L-FULL-AXL68-V3", "W-W3C-PROV-DM"] },
    { name: "成果状态与质量标记", type: "object", sources: ["L-FULL-AXL68-V3"] },
  ],
  "jd-13.2": [
    { name: "覆盖对象范围", type: "reference_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "覆盖单元定义", type: "schema_ref", sources: ["L-FULL-JD66-V3"] },
    { name: "完整度判定逻辑", type: "condition_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"], notes: "这里只保存任务成果合同中的完成谓词，不保存评分阈值、Reason Code 或 Grader 实现。" },
    { name: "质量有效性条件", type: "condition_set", sources: ["L-FULL-AXL68-V3"], notes: "这里只保存成果可接受条件的合同引用；具体评分门限和实现不属于 JD 值域。" },
    { name: "覆盖缺口表示", type: "object", sources: ["L-FULL-AXL68-V3"], notes: "生产者待确认：可能是 SUT 成果的一部分，也可能由 Grader 根据覆盖合同派生；本版不强行指定。" },
  ],
  "jd-13.3": [
    { name: "成果异常类型", type: "multi_enum", values: [["insufficient_coverage", "覆盖不足"], ["quality_degradation", "质量下降"], ["missing_output", "成果缺失"], ["low_confidence", "低置信"], ["report_omission", "报告缺项"]], sources: ["L-FULL-AXL68-V3"] },
    { name: "允许处置动作", type: "multi_enum", values: [["recapture", "重拍"], ["supplementary_scan", "补扫"], ["change_viewpoint", "换角度"], ["regenerate_report", "重生成报告"], ["switch_format", "切换成果格式"], ["repeat_delivery", "重投"], ["repeat_sampling", "重采"]], sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "处置适用条件", type: "condition_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "人工复核要求", type: "protocol_ref", sources: ["L-FULL-AXL68-V3"] },
    { name: "新成果验证", type: "condition_set", sources: ["L-FULL-AXL68-V3"] },
  ],
  "jd-14.1": [
    { name: "链路质量指标集", type: "multi_enum", values: [["latency", "延迟"], ["packet_loss", "丢包"], ["bandwidth", "带宽"], ["telemetry_continuity", "遥测连续性"], ["c2_availability", "C2 可用性"]], sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "典型质量区间", type: "range_set", sources: ["L-FULL-JD66-V3"], tbd: "具体区间及单位待按链路类型和场景资料确认。" },
    { name: "链路质量状态标签集", type: "enum", values: [["nominal", "正常"], ["degraded", "退化"], ["interrupted", "中断"], ["unavailable", "不可用"]], sources: ["L-FULL-AXL68-V3"] },
    { name: "实例链路异常注入真值", type: "object", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"], tbd: "真实故障类型、实际链路参数、异常发生窗口和恢复状态的 Fixture 记录结构 TBD。" },
    { name: "质量观测来源", type: "source_set", sources: ["L-FULL-AXL68-V3", "W-MAVLINK-MICROSERVICES"] },
  ],
  "jd-14.2": [
    { name: "地面站节点类型", type: "multi_enum", values: [["primary", "主站"], ["backup", "备份站"], ["relay", "接力站"]], sources: ["L-FULL-JD66-V3"] },
    { name: "节点实例与寻址", type: "reference_set", sources: ["W-MAVLINK-ROUTING"] },
    { name: "节点连接关系", type: "graph", sources: ["L-FULL-JD66-V3", "W-MAVLINK-ROUTING"] },
    { name: "主备与接力关系", type: "relation_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "地面站状态", type: "object", sources: ["L-FULL-AXL68-V3"] },
  ],
  "jd-14.3": [
    { name: "处置触发条件", type: "condition_set", sources: ["L-FULL-AXL68-V3"] },
    { name: "允许处置动作", type: "multi_enum", values: [["switch_link", "切换链路"], ["switch_ground_station", "切备用站"], ["reduce_telemetry_rate", "降低遥测频率"], ["buffer_data", "缓存数据"]], sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"], notes: "已合并语义重复的 switch_link / perform_handover；如后续资料能区分目标选择与切换协议，再由团队决定是否拆分。" },
    { name: "处置适用条件", type: "condition_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "人工确认要求", type: "protocol_ref", sources: ["L-FULL-AXL68-V3"] },
    { name: "切换后链路验证要求", type: "condition_set", sources: ["L-FULL-AXL68-V3"] },
  ],
  "jd-16.1": [
    { name: "空域类别标识", type: "enum", values: [], sources: ["L-FULL-JD66-V3", "W-CAAC-UAS-RULE-761"], tbd: "权威字典举例含 ICAO A–G 类；中国运行场景的正式可选集需按适用法规另行确认。" },
    { name: "空域类别来源", type: "source_ref", sources: ["W-CAAC-UAS-RULE-761"] },
    { name: "适用空间范围", type: "geometry_ref", sources: ["L-FULL-AXL68-V3", "W-CAAC-UAS-RULE-761"] },
    { name: "适用时间范围", type: "time_window_set", sources: ["W-CAAC-UAS-RULE-761"] },
    { name: "运行约束引用", type: "constraint_ref", sources: ["W-CAAC-UAS-RULE-761"] },
  ],
  "jd-16.2": [
    { name: "围栏几何类型", type: "multi_enum", values: [
      { value: "circle", label: "圆形", source_refs: ["W-PX4-GEOFENCE"], status: "source_supported" },
      { value: "polygon", label: "多边形", source_refs: ["W-PX4-GEOFENCE"], status: "source_supported" },
      { value: "altitude_band", label: "高度带", source_refs: [], status: "inferred_candidate" },
    ], sources: ["W-PX4-GEOFENCE"], notes: "高度带作为候选保留，但当前来源不足以将其标为直接支持；待获得明确规范后再升级证据状态。" },
    { name: "包含与排除属性", type: "enum", values: [["inclusion", "包含区"], ["exclusion", "排除区"]], sources: ["W-PX4-GEOFENCE"] },
    { name: "围栏边界集合", type: "geometry_set", sources: ["L-FULL-JD66-V3", "W-PX4-GEOFENCE"] },
    { name: "围栏来源与版本", type: "source_ref", sources: ["L-FULL-AXL68-V3", "W-CAAC-UAS-RULE-761"] },
    { name: "围栏生效窗口", type: "time_window_set", sources: ["L-FULL-AXL68-V3"] },
  ],
  "jd-16.3": [
    { name: "交通信息源类型", type: "multi_enum", values: [["utm", "UTM"], ["u_space", "U-space"], ["ads_b", "ADS-B"]], sources: ["L-FULL-JD66-V3", "W-MAVLINK-TRAFFIC"] },
    { name: "信息源实例与端点", type: "reference_set", sources: ["L-FULL-JD66-V3"] },
    { name: "所需交通信息类别", type: "schema_ref", sources: ["W-MAVLINK-TRAFFIC"] },
    { name: "信息新鲜度与可用状态", type: "object", sources: ["L-FULL-AXL68-V3"] },
    { name: "多源一致性状态", type: "enum", values: [["consistent", "一致"], ["inconsistent", "不一致"], ["unknown", "未知"]], sources: ["L-FULL-AXL68-V3"], notes: "生产者待确认：可能由 SUT 自报，也可能由 Harness / Grader 对多源观测计算；本版不强行指定。" },
  ],
  "jd-16.4": [
    { name: "授权类型", type: "enum", values: [["long_term", "长期"], ["temporary", "临时"], ["instant", "即时"]], sources: ["L-FULL-JD66-V3"] },
    { name: "授权标识与签发来源", type: "source_ref", sources: ["W-CAAC-UAS-RULE-761"] },
    { name: "授权有效时间窗", type: "time_window", sources: ["L-FULL-AXL68-V3", "W-CAAC-UAS-RULE-761"] },
    { name: "授权适用空间与任务范围", type: "constraint_set", sources: ["L-FULL-AXL68-V3", "W-CAAC-UAS-RULE-761"] },
    { name: "授权状态", type: "enum", values: [["pending", "待生效"], ["active", "有效"], ["expiring", "临近失效"], ["expired", "已失效"], ["revoked", "已撤销"]], sources: ["L-FULL-AXL68-V3"] },
  ],
  "jd-16.5": [
    { name: "合规异常类型", type: "multi_enum", values: [["authorization_expiry", "授权临近失效"], ["geofence_conflict", "围栏冲突"], ["traffic_service_fault", "交通信息服务异常"]], sources: ["L-FULL-AXL68-V3"] },
    { name: "允许处置动作", type: "multi_enum", values: [["refresh_authorization", "刷新授权"], ["update_geofence", "更新围栏"], ["wait_for_service", "等待服务恢复"], ["review_traffic", "复核交通"], ["retreat", "退避"], ["return", "返航"]], sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "处置适用条件", type: "condition_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "人工合规确认要求", type: "protocol_ref", sources: ["L-FULL-AXL68-V3"] },
    { name: "处置后合规验证", type: "condition_set", sources: ["L-FULL-AXL68-V3"] },
  ],
  "jd-17.1": [
    { name: "任务相位", type: "multi_enum", values: [["takeoff", "起飞"], ["inspection", "巡检"], ["return", "返航"]], sources: ["L-FULL-JD66-V3"] },
    { name: "安全阈值对象", type: "multi_enum", values: [["energy", "电量 / 能源"], ["workspace_boundary", "空间边界"], ["attitude", "姿态"], ["communication", "链路"], ["localization", "定位"]], sources: ["L-FULL-AXL68-V3"] },
    { name: "相位阈值 schedule", type: "schedule", sources: ["L-FULL-JD66-V3"], tbd: "具体阈值与单位必须由场景安全依据给出。" },
    { name: "阈值来源与版本", type: "source_ref", sources: ["L-FULL-JD66-V3"] },
    { name: "阈值状态与接近度", type: "object", sources: ["L-FULL-AXL68-V3"], notes: "生产者待确认：阈值状态可能来自 SUT / 遥测，接近度也可能由 Grader 根据当前状态与阈值派生；确认前不拆分、不强行指定角色。" },
  ],
  "jd-17.2": [
    { name: "安全异常类型", type: "multi_enum", values: [["low_energy", "低电 / 低能源"], ["boundary_breach", "越界"], ["attitude_fault", "姿态异常"], ["link_loss", "链路异常"], ["localization_fault", "定位异常"], ["odd_exit", "ODD 越界"]], sources: ["L-FULL-AXL68-V3"] },
    { name: "允许安全处置动作", type: "multi_enum", values: [["return", "返航"], ["hold", "悬停 / 保持"], ["degrade", "降级"], ["alternate_land", "备降"], ["safe_mode", "安全模式"]], sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3", "W-PX4-SAFETY"] },
    { name: "处置触发条件", type: "condition_set", sources: ["L-FULL-AXL68-V3", "W-PX4-SAFETY"] },
    { name: "处置优先级与冲突", type: "constraint_set", sources: ["W-PX4-SAFETY"], tbd: "跨处置优先级必须由项目安全策略确认。" },
    { name: "人工确认与接管状态", type: "object", sources: ["L-FULL-AXL68-V3"] },
  ],
  "jd-17.3": [
    { name: "可接受安全态类型", type: "multi_enum", values: [["hold", "悬停 / 保持"], ["return_point", "返航点"], ["alternate_landing", "备降点"], ["safe_mode", "安全模式"]], sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "安全态进入条件", type: "condition_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "安全态保持条件", type: "condition_set", sources: ["L-FULL-AXL68-V3"] },
    { name: "安全态验证证据", type: "evidence_set", sources: ["L-FULL-AXL68-V3"] },
    { name: "安全态退出与恢复条件", type: "condition_set", sources: ["L-FULL-AXL68-V3", "W-PX4-SAFETY"] },
  ],
  "jd-15.1": [
    { name: "事件来源能力", type: "reference_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "事件类型", type: "taxonomy_ref", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "事件严重度", type: "enum", values: [], sources: ["L-FULL-AXL68-V3"], tbd: "严重度分级及语义尚无受审定义。" },
    { name: "事件时间与顺序", type: "object", sources: ["L-FULL-AXL68-V3", "W-W3C-PROV-DM"] },
    { name: "事件关联对象与执行片段", type: "reference_set", sources: ["L-FULL-AXL68-V3", "W-W3C-PROV-DM"] },
  ],
  "jd-15.2": [
    { name: "证据对象类型", type: "taxonomy_ref", sources: ["L-FULL-JD66-V3", "W-W3C-PROV-DM"] },
    { name: "证据数据结构与版本", type: "schema_ref", sources: ["L-FULL-JD66-V3", "W-W3C-PROV-DM"] },
    { name: "事件、动作与责任关联", type: "relation_set", sources: ["L-FULL-AXL68-V3", "W-W3C-PROV-DM"] },
    { name: "时间戳与时钟来源", type: "object", sources: ["L-FULL-AXL68-V3", "W-MAVLINK-MICROSERVICES"] },
    { name: "可回放与完整性状态", type: "object", sources: ["L-FULL-AXL68-V3"], notes: "生产者待确认：可能是系统自报状态，也可能是审计工具根据证据链派生；本版不强行指定。" },
  ],
  "jd-15.3": [
    { name: "留存对象范围", type: "reference_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
    { name: "留存期限", type: "duration", sources: ["L-FULL-JD66-V3"], tbd: "期限数值必须由适用法规或项目 SOP 给出。" },
    { name: "存储与归档状态", type: "enum", values: [
      { value: "active", label: "在线留存", source_refs: ["L-FULL-JD66-V3"], status: "inferred_candidate" },
      { value: "archived", label: "已归档", source_refs: ["L-FULL-JD66-V3"], status: "inferred_candidate" },
      { value: "disposed", label: "已处置", source_refs: ["L-FULL-JD66-V3"], status: "inferred_candidate" },
    ], sources: ["L-FULL-JD66-V3"], notes: "三个生命周期状态是对“留存策略”的合理归纳，不是 canonical 原文直接给出的正式枚举；待 SOP 或审计协议支持后再升级。" },
    { name: "访问与审计权限", type: "constraint_set", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"], tbd: "权限角色、访问范围、授权规则和脱敏要求尚无受审依据。" },
    { name: "完整性检查与缺口状态", type: "object", sources: ["L-FULL-AXL68-V3"] },
  ],
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function axlRefs(abilityId, canonicalId) {
  const ability = axlCatalog.abilities.find((item) => item.a_id === abilityId);
  if (!ability) return [];
  return Object.entries(ability.levels)
    .filter(([, level]) => level.jd_refs.includes(canonicalId))
    .map(([levelId]) => `${abilityId}×${levelId}`);
}

function baseNode({
  id,
  parentId,
  canonical,
  owner,
  name,
  definition,
  kind,
  side,
  sources,
  evidence,
  derivation,
  review,
  valueType = "none",
  valueDomain = null,
  relatedGlobal = [],
  usedByAxl = [],
  notes = null,
  variableRole = null,
  projectionTargets = null,
  visibility = ["sut_visible", "grader_visible"],
  observationChannel = ["sut_input", "sut_trace", "grader"],
}) {
  return {
    schema_version: "jd-tree/0.4.0",
    node_id: id,
    parent_id: parentId,
    canonical_slot: canonical,
    owner_a: owner,
    name,
    definition,
    node_kind: kind,
    variable_role:
      variableRole || (kind === "variable" ? "TBD" : "structural_group"),
    value_type: valueType,
    value_domain: valueDomain,
    unit: null,
    activation_condition: null,
    multiplicity: valueType.startsWith("multi_") || valueType.endsWith("_set") ? "many" : "one",
    difficulty_direction: "context_dependent",
    configuration_side: side,
    projection_targets:
      projectionTargets ||
      (side === "world"
        ? ["world_config", "harness"]
        : side === "user"
          ? ["user_config", "sut_input", "harness"]
          : ["world_config", "user_config", "sut_input", "harness"]),
    visibility,
    observation_channel: observationChannel,
    applicable_scenarios: crossScenario,
    related_global_jd: relatedGlobal,
    related_jd: [],
    used_by_axl: usedByAxl,
    depends_on: [],
    mutual_exclusion_group: null,
    constraints: [],
    source: sources,
    evidence_status: evidence,
    derivation_status: derivation,
    review_status: review,
    legacy_aliases: [],
    notes,
  };
}

function valueDomain(definition) {
  if (definition.values?.length) {
    return definition.values.map((candidate) => {
      if (Array.isArray(candidate)) {
        const [value, label] = candidate;
        return {
          value,
          label_zh: label,
          source_refs: [],
          status: "inferred_candidate",
          applicable_scenarios: crossScenario,
        };
      }
      return {
        value: candidate.value,
        label_zh: candidate.label_zh || candidate.label,
        source_refs: candidate.source_refs || [],
        status: candidate.status || "inferred_candidate",
        applicable_scenarios:
          candidate.applicable_scenarios || crossScenario,
      };
    });
  }
  if (definition.tbd) {
    return [{
      value: "TBD",
      label_zh: definition.tbd,
      source_refs: definition.sources,
      status: "TBD",
      applicable_scenarios: crossScenario,
    }];
  }
  return null;
}

function summarizeEvidence(definition, domain) {
  const statuses = (domain || []).map((item) => item?.status).filter(Boolean);
  if (!statuses.length) {
    return definition.tbd
      ? { evidence: "TBD", derivation: "TBD" }
      : { evidence: "source_supported", derivation: "derived" };
  }
  if (statuses.every((status) => status === "TBD")) {
    return { evidence: "TBD", derivation: "TBD" };
  }
  if (
    statuses.some(
      (status) => status === "inferred_candidate" || status === "TBD",
    )
  ) {
    return { evidence: "inferred_candidate", derivation: "proposed" };
  }
  if (statuses.every((status) => status === "team_material_only")) {
    return { evidence: "team_material_only", derivation: "given" };
  }
  if (statuses.every((status) => status === "authoritative_existing")) {
    return { evidence: "authoritative_existing", derivation: "given" };
  }
  return { evidence: "source_supported", derivation: "derived" };
}

const userContract = {
  configurationSide: "user",
  projectionTargets: ["user_config", "sut_input", "harness"],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_input", "grader"],
  variableRole: "contract_schema",
};
const sharedContract = {
  configurationSide: "shared",
  projectionTargets: [
    "world_config",
    "user_config",
    "sut_input",
    "harness",
  ],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_input", "grader"],
  variableRole: "contract_schema",
};
const worldContract = {
  configurationSide: "world",
  projectionTargets: ["world_config", "sut_input", "harness"],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_input", "grader"],
  variableRole: "contract_schema",
};
const worldInput = {
  configurationSide: "world",
  projectionTargets: ["world_config", "sut_input", "harness"],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_input", "grader"],
  variableRole: "configuration_input",
};
const sharedInput = {
  configurationSide: "shared",
  projectionTargets: [
    "world_config",
    "user_config",
    "sut_input",
    "harness",
  ],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_input", "grader"],
  variableRole: "configuration_input",
};
const runtimeObserved = {
  configurationSide: "TBD",
  projectionTargets: [],
  visibility: ["sut_visible", "grader_visible"],
  observationChannel: ["sut_trace", "grader"],
  variableRole: "runtime_observation",
};
const derivedObserved = {
  configurationSide: "TBD",
  projectionTargets: [],
  visibility: ["grader_only"],
  observationChannel: ["grader"],
  variableRole: "derived_metric",
};
const hiddenWorldTruth = {
  configurationSide: "world",
  projectionTargets: ["world_config", "harness"],
  visibility: ["fixture_only", "grader_only", "hidden_gt"],
  observationChannel: ["fixture", "grader", "hidden_gt"],
  variableRole: "hidden_ground_truth",
};
const unresolvedProducer = {
  configurationSide: "TBD",
  projectionTargets: [],
  visibility: ["grader_visible"],
  observationChannel: ["TBD"],
  variableRole: "TBD",
};

// 这里只标注既有叶子在数据流中的机器语义，不新增业务变量。
const dataFlowProfiles = {
  "jd-12.1": [userContract, worldInput, userContract, runtimeObserved, runtimeObserved],
  "jd-12.2": [userContract, userContract, userContract, userContract, runtimeObserved],
  "jd-12.3": [userContract, userContract, userContract, userContract, userContract],
  "jd-13.1": [userContract, userContract, userContract, userContract, runtimeObserved],
  "jd-13.2": [userContract, userContract, userContract, userContract, unresolvedProducer],
  "jd-13.3": [runtimeObserved, userContract, userContract, userContract, userContract],
  "jd-14.1": [worldContract, worldContract, worldContract, hiddenWorldTruth, worldContract],
  "jd-14.2": [worldInput, worldInput, worldInput, worldInput, runtimeObserved],
  "jd-14.3": [worldContract, worldContract, worldContract, sharedContract, worldContract],
  "jd-16.1": [sharedContract, sharedContract, sharedInput, sharedInput, sharedContract],
  "jd-16.2": [worldInput, worldInput, worldInput, worldInput, worldInput],
  "jd-16.3": [sharedContract, sharedInput, sharedContract, runtimeObserved, unresolvedProducer],
  "jd-16.4": [sharedContract, sharedInput, sharedInput, sharedInput, runtimeObserved],
  "jd-16.5": [sharedContract, sharedContract, sharedContract, sharedContract, sharedContract],
  "jd-17.1": [sharedContract, sharedContract, sharedContract, sharedContract, unresolvedProducer],
  "jd-17.2": [sharedContract, sharedContract, sharedContract, sharedContract, runtimeObserved],
  "jd-17.3": [sharedContract, sharedContract, sharedContract, runtimeObserved, sharedContract],
  "jd-15.1": [sharedContract, sharedContract, sharedContract, runtimeObserved, runtimeObserved],
  "jd-15.2": [sharedContract, sharedContract, sharedContract, runtimeObserved, unresolvedProducer],
  "jd-15.3": [sharedContract, sharedContract, runtimeObserved, sharedContract, derivedObserved],
};

for (const source of extensionSources) {
  if (!catalog.sources.some((item) => item.source_id === source.source_id)) {
    catalog.sources.push(source);
  }
}

for (const abilityId of Object.keys(abilityDefaults)) {
  const ability = axlCatalog.abilities.find((item) => item.a_id === abilityId);
  const defaults = abilityDefaults[abilityId];
  const rootId = `PROPOSED-jd-tree-${abilityId}`;
  catalog.nodes.push(baseNode({
    id: rootId,
    parentId: catalogRootId,
    canonical: null,
    owner: abilityId,
    name: ability.ability,
    definition: `汇总 ${abilityId} ${ability.ability}下的 canonical JD 及经来源支持的子维度。`,
    kind: "capability_root",
    side: defaults.side,
    sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"],
    evidence: "authoritative_existing",
    derivation: "given",
    review: "reviewed",
    relatedGlobal: defaults.global,
    usedByAxl: Object.keys(ability.levels).map((level) => `${abilityId}×${level}`),
    notes: "本轮只保留可直接对应 canonical 定义或 A×L 责任原文的子维度；未确认细化项进入待确认文档。",
  }));

  const canonicals = jdDictionary.variables.filter(
    (item) => item.scope === "local" && item.owner_a === abilityId,
  );
  for (const canonical of canonicals) {
    const refs = axlRefs(abilityId, canonical.id);
    catalog.nodes.push(baseNode({
      id: canonical.id,
      parentId: rootId,
      canonical: canonical.id,
      owner: abilityId,
      name: canonical.name,
      definition: canonical.description,
      kind: "group",
      side: defaults.side,
      sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"],
      evidence: "authoritative_existing",
      derivation: "given",
      review: "reviewed",
      relatedGlobal: defaults.global,
      usedByAxl: refs,
      notes: "canonical 名称与定义取自 ability-id-v3 权威机读源；子维度为来源约束下的研究草案。",
    }));

    const children = childDefinitions[canonical.id] || [];
    const flows = dataFlowProfiles[canonical.id] || [];
    if (children.length !== flows.length) {
      throw new Error(
        `${canonical.id} 的子维度与数据流标注数量不一致：${children.length} / ${flows.length}`,
      );
    }
    children.forEach((child, index) => {
      const flow = flows[index];
      const domain = valueDomain(child);
      const evidenceSummary = summarizeEvidence(child, domain);
      catalog.nodes.push(baseNode({
        id: `PROPOSED-${canonical.id}.${index + 1}`,
        parentId: canonical.id,
        canonical: canonical.id,
        owner: abilityId,
        name: child.name,
        definition: `${canonical.name}中的“${child.name}”变量。${child.tbd || "其语义范围由所引资料限定。"}`,
        kind: "variable",
        side: flow.configurationSide,
        sources: unique(child.sources),
        evidence: evidenceSummary.evidence,
        derivation: evidenceSummary.derivation,
        review: "proposed",
        valueType: child.type,
        valueDomain: domain,
        relatedGlobal: defaults.global,
        usedByAxl: refs,
        variableRole: flow.variableRole,
        projectionTargets: flow.projectionTargets,
        visibility: flow.visibility,
        observationChannel: flow.observationChannel,
        notes: [
          child.tbd,
          child.notes,
          flow.variableRole === "hidden_ground_truth"
            ? "本节点保存 Fixture / Grader 使用的实例真值，不投影为 SUT 输入。"
            : null,
          abilityId === "A16"
            ? "A16 只保存适用法规 / SOP、空域、围栏、授权或交通服务的运行绑定与状态，不在变量树内重新创造法规内容。"
            : null,
          abilityId === "A17"
            ? "候选安全动作与状态用于表达合同结构，不构成新的触发阈值、优先级或平台安全规则。"
            : null,
        ]
          .filter(Boolean)
          .join("\n") || null,
      }));
    });
  }
}

catalog.scope = [...new Set([...catalog.scope, ...Object.keys(abilityDefaults)])];
catalog.scope.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
catalog.generated_at = generatedAt;
catalog.generated_by = "scripts/generate_jd_variable_tree_version1.mjs + scripts/expand_jd_variable_tree_version1.mjs";
catalog.catalog_version = "review-version1-ability-id-v3-a1-a17-global-curated-2026-07-22";
catalog.source_count = catalog.sources.length;
catalog.node_count = catalog.nodes.length;
catalog.leaf_count = catalog.nodes.filter((node) => node.node_kind === "variable").length;
catalog.counts_by_owner = Object.fromEntries(
  [...new Set(catalog.nodes.map((node) => node.owner_a))].map((owner) => [
    owner,
    catalog.nodes.filter((node) => node.owner_a === owner).length,
  ]),
);
catalog.counts_by_kind = Object.fromEntries(
  [...new Set(catalog.nodes.map((node) => node.node_kind))].map((kind) => [
    kind,
    catalog.nodes.filter((node) => node.node_kind === kind).length,
  ]),
);
catalog.open_questions_document = "docs/jd-variable-tree/JD业务变量树_version1_待确认问题与暂定方案.md";
catalog.curation_audit_document = "docs/jd-variable-tree/JD业务变量树_A1-A17_逐能力层级修订审计与待确认.md";
catalog.generated_from = [
  "scripts/generate_jd_variable_tree_version1.mjs",
  "scripts/expand_jd_variable_tree_version1.mjs",
];
delete catalog.expansion_policy;
delete catalog.leaf_counts_by_owner;
delete catalog.full_expansion_audit_document;

const exNodes = catalog.nodes.filter((node) => node.node_id.includes(".EX"));
if (exNodes.length) {
  throw new Error(`禁止生成 EX 节点：${exNodes.map((node) => node.node_id).join(", ")}`);
}

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(catalogPath);
console.log(`${catalog.node_count} nodes; ${catalog.leaf_count} variable leaves; 0 EX nodes`);
