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

const generatedAt = "2026-07-22";
const catalogRootId = "PROPOSED-jd-tree-version1";
const scenarios = [
  "cross_scenario",
  "highway_inspection",
  "campus_inspection",
  "white_wall_narrow_gap",
];

const expansionSources = [
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

const topicMap = {
  "jd-1.1": [
    "对象类型层级", "对象统一标识", "命名空间", "对象实例基数", "对象属性 schema",
    "对象间关系", "对象生命周期状态", "对象集合与成员关系", "跨轮次对象引用", "别名冲突与消解状态",
  ],
  "jd-1.2": [
    "输入通道集合", "显式 ID 指称", "地图与空间指示", "图像视频指示", "自然语言描述",
    "结构化表单指称", "指示性与上下文指称", "关系型指称", "集合与范围指称",
  ],
  "jd-1.3": [
    "规范词项标识规则", "同义词与别名", "缩写与代码", "动作动词", "状态形容词",
    "量词与范围表达", "约束术语", "术语消歧说明", "词表版本与适用域",
  ],
  "jd-2.1": [
    "参数 schema 版本", "参数语义分组映射", "值类型", "单位与量纲", "坐标与参考系",
    "必填与可选状态", "缺省值来源", "参数依赖", "值来源优先级与确认状态",
  ],
  "jd-2.2": [
    "平台档案标识", "机型与构型", "运动学边界", "能源与续航档案", "载荷能力",
    "传感器能力", "计算与存储能力", "环境耐受与 ODD", "平台档案版本",
  ],
  "jd-2.3": [
    "规则标识与版本", "规则启用上下文", "被推断参数映射", "推断证据输入", "规则优先级",
    "规则冲突处理", "确认触发与豁免条件", "推断审计记录",
  ],
  "jd-3.1": [
    "技能标识命名空间与版本", "动作语义", "输入参数 schema", "输出结果 schema", "前置条件表达式",
    "后置条件", "技能依赖", "副作用", "失败状态", "幂等与重复执行语义",
    "暂停取消能力", "资源需求", "适用任务阶段",
  ],
  "jd-3.2": [
    "必需子单元集合", "完成逻辑表达式", "部分完成状态与剩余工作", "失败语义", "中止语义",
    "取消语义", "异常例外", "证据要求", "质量门槛引用", "时间条件",
    "覆盖条件", "验收角色", "完成状态迁移",
  ],
  "jd-4.1": [
    "标准任务相位", "相位依赖图", "顺序约束", "并行关系", "分支条件", "循环与重复结构",
  ],
  "jd-4.2": [
    "交接点位置", "交接触发", "交接角色", "交接信息包", "恢复执行条件",
  ],
  "jd-4.3": [
    "任务目标变化", "世界状态变化", "资源不足", "合规安全冲突", "外部中断",
  ],
  "jd-4.4": [
    "跳过与重试", "回滚与重做", "技能替代", "任务范围降级", "终止返航与恢复",
  ],
  "jd-4.5": [
    "输出抽象层级选择规则", "目标系统与组件寻址", "指令序列化", "接收确认与完成确认", "Trace 关联标识",
  ],
  "jd-5.1": [
    "交接类型组合", "优先级分级规则", "发起者与接收者", "响应状态", "交接通道",
    "消息内容 schema", "延迟预算来源与阶段差异", "重试与升级", "交接后恢复条件",
  ],
  "jd-5.2": [
    "偏好 taxonomy", "偏好来源可信度", "偏好优先级", "偏好冲突", "偏好有效期",
    "偏好粒度", "对齐解释", "偏好确认状态",
  ],
  "jd-5.3": [
    "通知事件 taxonomy", "严重度", "通知接收者", "通知载荷", "通知通道",
    "聚合规则", "去重规则", "通知审计状态",
  ],
  "jd-6.1": [
    "业务对象 taxonomy", "道路病害对象", "车辆违法与异常事件", "正常对象与背景", "相似干扰目标", "障碍与风险对象",
  ],
  "jd-6.2": [
    "对象数量与密度", "空间分布", "动态性", "遮挡模式", "目标尺度与视角", "观测质量状态",
  ],
  "jd-6.3": [
    "可用模态集合", "传感器实例映射", "视场与覆盖", "空间分辨能力", "时间采样与同步", "标定与融合拓扑",
  ],
  "jd-6.4": [
    "感知异常 taxonomy", "可用策略集合", "策略启用条件", "重观测与换视角", "身份维护与去重", "恢复验证与升级",
  ],
  "jd-7.1": [
    "绝对定位源集合", "惯性与航向源", "视觉激光定位源", "外部辅助定位源", "多源组合", "源可用性", "源更新与时延", "源参考系",
  ],
  "jd-7.2": [
    "水平位置质量", "垂向位置质量", "姿态质量", "航向质量", "速度质量", "不确定度与协方差", "完整性状态", "新鲜度与连续性",
  ],
  "jd-7.3": [
    "定位退化 taxonomy", "源切换", "融合重加权", "等待收敛", "重定位", "地标观测", "外部辅助", "恢复验证与保护",
  ],
  "jd-8.1": [
    "相对参考对象", "相对坐标系", "距离", "方位", "横向偏差", "垂向偏差", "相对朝向", "观测角", "相对运动", "几何不确定度",
  ],
  "jd-8.2": [
    "几何估计模态", "深度来源", "地图与结构先验", "时序跟踪", "对象关联", "遮挡状态", "更新频率", "估计时延", "质量状态",
  ],
  "jd-8.3": [
    "相对定位异常 taxonomy", "换视角", "重观测", "扩展搜索", "重新关联", "多假设维护", "他机补观测", "等待可见", "恢复验证",
  ],
  "jd-9.1": [
    "电池能量消耗", "推进系统消耗", "计算资源消耗", "内存占用", "存储占用", "通信带宽消耗", "载荷功耗", "热余量", "返航资源储备", "消耗曲线不确定度",
  ],
  "jd-9.2": [
    "预警等级", "预测时间窗", "返航预留", "任务预留", "预留不确定度", "阈值来源", "分相位 schedule", "趋势触发", "确认要求",
  ],
  "jd-9.3": [
    "资源异常 taxonomy", "可用处置集合", "降载与降速", "降采样", "关闭非关键载荷", "切换链路与计算路径", "等待冷却", "缩短任务", "处置验证与支援升级",
  ],
  "jd-10.1": [
    "路段与园区区域拓扑", "航点与节点", "航段与边", "道路车道与匝道引用", "扫描覆盖模式", "盘旋等待结构", "转场返航备降段", "拓扑版本与有效性",
  ],
  "jd-10.2": [
    "航点跟随", "轨迹跟踪", "走廊与道路跟随", "矢量场制导", "地图匹配", "反应式避障", "混合导航", "航路进度维护",
  ],
  "jd-10.3": [
    "航段偏差", "轨迹不可行", "动态障碍冲突", "地理围栏与合规冲突", "定位质量退化", "天气风扰", "资源与任务变化",
  ],
  "jd-10.4": [
    "可用航迹策略集合", "改高度", "横向偏置", "局部绕行", "等待与悬停", "降速", "增大裕度与返航备选",
  ],
  "jd-12.1": [
    "载荷动作类别", "载荷实例寻址", "动作命令 schema", "动作参数 schema", "目标对象绑定", "结果状态模型",
    "动作可取消性", "动作幂等性", "资源占用", "安全互锁引用", "能力发现", "动作版本",
  ],
  "jd-12.2": [
    "动作依赖图", "动作前置条件", "稳定与等待条件", "触发方式", "时钟与时间基准", "多载荷同步",
    "间隔与驻留", "命令接收确认", "动作完成事件", "互斥关系", "超时重试窗口", "适用任务阶段",
  ],
  "jd-12.3": [
    "载荷异常 taxonomy", "可用处置集合", "处置触发", "处置前置条件", "策略优先级", "重试预算",
    "参数调整边界", "载荷模式切换", "重新标定与复位", "恢复验证", "升级交接",
  ],
  "jd-13.1": [
    "成果类型", "文件与流格式", "成果对象标识", "时间戳", "空间参考", "关联业务对象",
    "质量与置信字段", "来源与生成链", "版本", "分片与集合关系", "访问级别", "成果清单 manifest",
  ],
  "jd-13.2": [
    "对象覆盖", "空间覆盖", "时间覆盖", "观察角覆盖", "模态覆盖", "证据完整度",
    "元数据完整度", "连续性", "重复与去重", "缺口表达", "置信覆盖", "例外记账",
  ],
  "jd-13.3": [
    "成果异常 taxonomy", "可用处置集合", "重采与补扫", "换视角", "报告重生成", "格式转换",
    "重新索引", "合并拆分", "降级交付", "人工复核", "新成果验证",
  ],
  "jd-14.1": [
    "端到端时延", "抖动", "丢包", "吞吐量", "信号质量", "链路余量",
    "可用性", "中断持续时间", "恢复时间", "C2 与遥测分离", "质量状态", "异常窗口",
  ],
  "jd-14.2": [
    "地面站实例", "主备关系", "接力节点", "Mesh 关系", "蜂窝卫星链路", "机间链路",
    "系统组件寻址", "路由路径", "切换关系", "覆盖区域", "控制权归属", "拓扑版本",
  ],
  "jd-14.3": [
    "通信异常 taxonomy", "可用处置集合", "切换链路", "切换地面站", "降低遥测频率", "C2 优先级",
    "本地缓存", "断点续传", "压缩与高时延模式", "丢链等待返航", "链路恢复验证",
  ],
  "jd-15.1": [
    "空域分类体系", "空域边界来源", "垂直范围", "时间有效性", "运行条件", "主管机构", "版本", "类别冲突",
  ],
  "jd-15.2": [
    "围栏几何", "高度带", "包含与排除", "缓冲区", "来源与版本", "激活 schedule", "优先级", "重叠冲突",
  ],
  "jd-15.3": [
    "交通信息源类型", "UTM 与 U-space 接入", "ADS-B 接入", "Remote ID 状态", "航空情报来源", "更新频率", "可用性", "数据质量",
  ],
  "jd-15.4": [
    "授权类型", "申请人与运行人", "授权空间范围", "授权任务范围", "生效时间", "到期时间", "续期撤销", "授权证据",
  ],
  "jd-15.5": [
    "合规异常 taxonomy", "可用处置集合", "刷新授权", "更新围栏", "等待与复核", "退避与改航", "降落返航", "升级与验证",
  ],
  "jd-16.1": [
    "任务相位", "安全量类型", "阈值来源与版本", "单位与参考系", "预警级与动作级", "滞回",
    "持续时间条件", "组合触发", "安全余量", "有效性", "覆盖与替代权限", "阈值不确定度",
  ],
  "jd-16.2": [
    "安全异常 taxonomy", "可用处置集合", "悬停", "返航", "就地降落", "备降",
    "降级运行", "任务中止", "安全模式", "飞行终止", "人工接管", "处置验证",
  ],
  "jd-16.3": [
    "安全态标识", "悬停安全态", "返航安全态", "着陆安全态", "备降点安全态", "降级安全态",
    "控制权归属", "进入条件", "保持条件", "退出条件", "不可达时后备态",
  ],
  "jd-17.1": [
    "意图与交互事件", "规划编排事件", "感知事件", "定位事件", "导航事件", "控制事件",
    "载荷事件", "成果事件", "通信事件", "合规事件", "安全事件", "人工介入事件",
  ],
  "jd-17.2": [
    "事件信封", "时间戳与时间基准", "责任主体", "关联实体", "动作与参数", "动作前状态",
    "动作后状态", "数据来源", "完整性校验", "来源链", "回放关联", "脱敏与访问标记",
  ],
  "jd-17.3": [
    "留存类别", "留存时长", "法定与业务依据", "存储层级", "加密", "访问控制",
    "不可变性", "删除与到期处理", "导出", "备份恢复", "事件保全",
  ],
};

const globalTopicMap = {
  "jd-0.1": ["任务相位时间预算", "截止时间", "允许时间窗口", "schedule 余量"],
  "jd-0.2": ["场景类型", "坐标与参考系", "空间拓扑", "边界与可通行区域"],
  "jd-0.3": ["扰动类型 taxonomy", "扰动强度", "扰动持续与窗口", "扰动组合与相关性"],
  "jd-0.4": ["角色类型", "权限与职责", "空间位置", "在线与可达状态"],
  "jd-0.5": ["确认类型", "发起者与响应者", "确认状态机", "无响应与冲突处置"],
  "jd-0.6": ["适用法域", "规则与标准来源", "适用条件", "规则优先级与冲突"],
  "jd-0.7": ["完成状态集合", "所需证据", "部分完成与例外", "验收责任主体"],
  "jd-0.8": ["链路与网络类型", "覆盖范围", "基础容量", "单点故障与故障域"],
  "jd-0.9": ["载荷类型", "能力声明", "可用状态", "平台与任务兼容性"],
  "jd-0.10": ["安全边界类型", "分相位 schedule", "边界来源", "最低安全储备来源"],
};

const abilityDefaults = {
  A1: { side: "user", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
  A2: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
  A3: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
  A4: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3", "W-MAVLINK-COMMAND"] },
  A5: { side: "user", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
  A6: { side: "world", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
  A7: { side: "world", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
  A8: { side: "world", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
  A9: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3", "W-PX4-SAFETY"] },
  A10: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
  A11: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"] },
  A12: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3", "W-MAVLINK-COMMAND", "W-MAVLINK-PAYLOAD", "W-MAVLINK-GIMBAL-V2"] },
  A13: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3", "W-W3C-PROV-DM", "W-OGC-GEOJSON"] },
  A14: { side: "world", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3", "W-MAVLINK-MICROSERVICES", "W-MAVLINK-ROUTING"] },
  A15: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3", "W-MAVLINK-TRAFFIC", "W-PX4-GEOFENCE", "W-CAAC-UAS-RULE-761"] },
  A16: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3", "W-PX4-SAFETY", "W-PX4-GEOFENCE"] },
  A17: { side: "shared", sources: ["L-FULL-JD66-V3", "L-FULL-AXL68-V3", "W-W3C-PROV-DM"] },
};

const abilityById = new Map(
  axlCatalog.abilities.map((ability) => [ability.a_id, ability]),
);
const localVariables = jdDictionary.variables.filter(
  (variable) => variable.scope === "local",
);
const globalVariables = jdDictionary.variables.filter(
  (variable) => variable.scope === "global",
);

const globalJdByAbility = Object.fromEntries(
  axlCatalog.abilities.map((ability) => [ability.a_id, ability.global_jd || []]),
);

function usedByAxl(canonicalId) {
  const cells = [];
  for (const ability of axlCatalog.abilities) {
    for (const [level, cell] of Object.entries(ability.levels || {})) {
      if ((cell.jd_refs || []).includes(canonicalId)) {
        cells.push(`${ability.a_id}×${level}`);
      }
    }
  }
  return cells;
}

function projectionTargets(side) {
  if (side === "world") return ["world_config", "harness"];
  if (side === "user") return ["user_config", "sut_input"];
  if (side === "shared") {
    return ["world_config", "user_config", "sut_input", "harness"];
  }
  return ["TBD"];
}

function observationChannels(side, hidden = false) {
  const result = new Set(["grader"]);
  if (side === "user" || side === "shared") result.add("sut_input");
  if (side === "shared") result.add("sut_trace");
  if (side === "world") result.add("fixture");
  if (hidden) result.add("hidden_gt");
  return [...result];
}

function visibility(side, hidden = false) {
  const result = new Set(["grader_visible"]);
  if (side === "world") result.add("fixture_only");
  else result.add("sut_visible");
  if (hidden) result.add("hidden_gt");
  return [...result];
}

function baseNode({
  nodeId,
  parentId,
  canonicalSlot,
  owner,
  name,
  definition,
  nodeKind,
  valueType = "none",
  valueDomain = null,
  side,
  sources,
  used = [],
  relatedGlobal = [],
  relatedJd = [],
  dependsOn = [],
  hidden = false,
  evidence = "inferred_candidate",
  derivation = "proposed",
  review = "proposed",
  notes = null,
}) {
  return {
    schema_version: "jd-tree/0.3.0",
    node_id: nodeId,
    parent_id: parentId,
    canonical_slot: canonicalSlot,
    owner_a: owner,
    name,
    definition,
    node_kind: nodeKind,
    value_type: valueType,
    value_domain: valueDomain,
    unit: null,
    activation_condition: null,
    multiplicity: "one",
    difficulty_direction: nodeKind === "variable" ? "context_dependent" : "TBD",
    configuration_side: side,
    projection_targets: projectionTargets(side),
    visibility: visibility(side, hidden),
    observation_channel: observationChannels(side, hidden),
    applicable_scenarios: scenarios,
    related_global_jd: relatedGlobal,
    related_jd: relatedJd,
    used_by_axl: used,
    depends_on: dependsOn,
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

function tbdDomain(sources) {
  return [
    {
      value: "TBD",
      label_zh: "候选取值或范围待依据化",
      source_refs: sources,
      status: "TBD",
      applicable_scenarios: scenarios,
    },
  ];
}

function slotArchetype(name) {
  if (/策略|机制|模态|方式|目录|类目|格式|类别|拓扑|信息源|动作目录/.test(name)) {
    return "set";
  }
  if (/参数|先验|包络|阈值|质量/.test(name)) return "measure";
  return "rule";
}

function primaryValueType(archetype, topic) {
  if (archetype === "set") return /数量|基数|时延|频率|距离|角度|质量|覆盖|尺度/.test(topic) ? "range" : "multi_enum";
  if (archetype === "measure") return /来源|版本|状态|类型|taxonomy|参考系|单位/.test(topic) ? "enum" : "range";
  return /状态|类型|角色|阶段|相位|通道|层级/.test(topic) ? "enum" : "object";
}

function addExpansion(nodes, canonical, topic, topicIndex, sources, side) {
  const archetype = slotArchetype(canonical.name);
  const groupId = `PROPOSED-${canonical.id}.EX${topicIndex}`;
  const valueId = `${groupId}.1`;
  const conditionId = `${groupId}.2`;
  const used = usedByAxl(canonical.id);
  const relatedGlobal = globalJdByAbility[canonical.owner_a] || [];
  nodes.push(
    baseNode({
      nodeId: groupId,
      parentId: canonical.id,
      canonicalSlot: canonical.id,
      owner: canonical.owner_a,
      name: topic,
      definition: `${canonical.name}中的“${topic}”细分维度；该节点只分组，不直接承载枚举值。`,
      nodeKind: "group",
      side,
      sources,
      used,
      relatedGlobal,
      notes: "研究扩展分组；不得把本分组名称直接当作已确认业务取值。",
    }),
    baseNode({
      nodeId: valueId,
      parentId: groupId,
      canonicalSlot: canonical.id,
      owner: canonical.owner_a,
      name: `${topic} · 配置`,
      definition: `记录“${topic}”在具体 JD/Seed 中的独立配置值、集合或范围。来源未给出具体阈值时必须保持 TBD。`,
      nodeKind: "variable",
      valueType: primaryValueType(archetype, topic),
      valueDomain: tbdDomain(sources),
      side,
      sources,
      used,
      relatedGlobal,
      hidden: side === "world",
      notes: "候选取值域尚未逐场景完成证据化裁剪；不得按常识补数值。",
    }),
    baseNode({
      nodeId: conditionId,
      parentId: groupId,
      canonicalSlot: canonical.id,
      owner: canonical.owner_a,
      name: `${topic} · 启用与判定`,
      definition: `记录“${topic}”的 activation condition、依赖/互斥关系、信息来源及可验证状态。`,
      nodeKind: "variable",
      valueType: "condition_set",
      valueDomain: tbdDomain(sources),
      side,
      sources,
      used,
      relatedGlobal,
      dependsOn: [valueId],
      hidden: side === "world",
      notes: "启用条件和判定规则待业务场景资料与团队评审确认。",
    }),
  );
}

const nodeById = new Map(catalog.nodes.map((node) => [node.node_id, node]));
const nodes = [...catalog.nodes];
const catalogRoot = nodeById.get(catalogRootId);
if (catalogRoot) {
  catalogRoot.name = "JD 业务变量树 version1（A1–A17 全量扩展）";
  catalogRoot.definition =
    "按 ability-id-v3-2026-07-20 汇总 A1–A17 全部能力分支，并单列跨能力共享的 JD-global；页面按单项能力或 global 分支切换。";
  catalogRoot.notes =
    "本分支为研究扩展草案；66 个 canonical JD 保持权威名称与定义，新增子节点均为 PROPOSED。";
}

for (const abilityId of abilityById.keys()) {
  const rootId = `PROPOSED-jd-tree-${abilityId}`;
  if (nodeById.has(rootId)) continue;
  const ability = abilityById.get(abilityId);
  const defaults = abilityDefaults[abilityId];
  const root = baseNode({
    nodeId: rootId,
    parentId: catalogRootId,
    canonicalSlot: null,
    owner: abilityId,
    name: ability.ability,
    definition: `描述${ability.ability}对应的 JD 业务变量分支；A×L 只作为责任引用，不作为变量取值。`,
    nodeKind: "capability_root",
    side: defaults.side,
    sources: defaults.sources,
    relatedGlobal: globalJdByAbility[abilityId] || [],
    evidence: "authoritative_existing",
    derivation: "given",
  });
  nodes.push(root);
  nodeById.set(rootId, root);
}

for (const variable of localVariables) {
  if (nodeById.has(variable.id)) continue;
  const defaults = abilityDefaults[variable.owner_a];
  const canonical = baseNode({
    nodeId: variable.id,
    parentId: `PROPOSED-jd-tree-${variable.owner_a}`,
    canonicalSlot: variable.id,
    owner: variable.owner_a,
    name: variable.name,
    definition: variable.description,
    nodeKind: "group",
    side: defaults.side,
    sources: defaults.sources,
    used: usedByAxl(variable.id),
    relatedGlobal: globalJdByAbility[variable.owner_a] || [],
    evidence: "authoritative_existing",
    derivation: "given",
    review: "reviewed",
  });
  nodes.push(canonical);
  nodeById.set(variable.id, canonical);
}

for (const canonical of localVariables) {
  if (canonical.owner_a === "A11") continue;
  const topics = topicMap[canonical.id];
  if (!topics) throw new Error(`缺少 ${canonical.id} 的扩展主题。`);
  const defaults = abilityDefaults[canonical.owner_a];
  topics.forEach((topic, index) => {
    addExpansion(
      nodes,
      canonical,
      topic,
      index + 1,
      defaults.sources,
      defaults.side,
    );
  });
}

for (const canonical of globalVariables) {
  const topics = globalTopicMap[canonical.id];
  if (!topics) throw new Error(`缺少 ${canonical.id} 的 global 扩展主题。`);
  const canonicalNode = nodeById.get(canonical.id);
  const side = canonicalNode?.configuration_side || "shared";
  const sources = ["L-FULL-JD66-V3", "L-FULL-AXL68-V3"];
  topics.forEach((topic, index) => {
    const adapted = { ...canonical, owner_a: "MULTI" };
    const before = nodes.length;
    addExpansion(nodes, adapted, topic, index + 1, sources, side);
    for (const node of nodes.slice(before)) {
      node.related_global_jd = [];
      node.used_by_axl = usedByAxl(canonical.id);
    }
  });
}

const uniqueSources = new Map();
for (const source of [...catalog.sources, ...expansionSources]) {
  uniqueSources.set(source.source_id, source);
}

const countBy = (key) =>
  nodes.reduce((counts, node) => {
    const value = node[key] ?? "null";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});

const leafCountsByOwner = Object.fromEntries(
  [...abilityById.keys(), "MULTI"].map((owner) => [
    owner,
    nodes.filter(
      (node) => node.owner_a === owner && node.node_kind === "variable",
    ).length,
  ]),
);

const expandedCatalog = {
  ...catalog,
  generated_at: generatedAt,
  generated_by: "scripts/expand_jd_variable_tree_version1.mjs",
  generated_from: [
    "scripts/generate_jd_variable_tree_version1.mjs",
    "scripts/expand_jd_variable_tree_version1.mjs",
  ],
  catalog_version:
    "review-version1-ability-id-v3-a1-a17-global-expanded-2026-07-22",
  scope: [...abilityById.keys()],
  scenario_scope: scenarios,
  source_count: uniqueSources.size,
  node_count: nodes.length,
  leaf_count: nodes.filter((node) => node.node_kind === "variable").length,
  counts_by_owner: countBy("owner_a"),
  counts_by_kind: countBy("node_kind"),
  leaf_counts_by_owner: leafCountsByOwner,
  sources: [...uniqueSources.values()],
  nodes,
  expansion_policy: {
    status: "research_draft",
    objective:
      "使每个 A 域达到与 A11 相近的可配置、可实例化、可审计粒度；叶子数量是审计信号，不是权威配额。",
    minimum_local_leaf_target: 60,
    typical_local_leaf_band: [65, 85],
    no_invention:
      "未获得来源支持的枚举、阈值、时限、业务规则和 simulator 字段一律保持 TBD。",
    node_rule:
      "主题节点是变量分组；叶子分别承载配置值与启用/判定条件；枚举值保留在 value_domain，不作为树节点。",
  },
  full_expansion_audit_document:
    "docs/jd-variable-tree/JD业务变量树_A1-A17_全量扩展审计.md",
};

fs.writeFileSync(catalogPath, `${JSON.stringify(expandedCatalog, null, 2)}\n`);
console.log(
  [
    catalogPath,
    `${expandedCatalog.node_count} nodes`,
    `${expandedCatalog.leaf_count} leaves`,
    JSON.stringify(leafCountsByOwner),
  ].join("\n"),
);
