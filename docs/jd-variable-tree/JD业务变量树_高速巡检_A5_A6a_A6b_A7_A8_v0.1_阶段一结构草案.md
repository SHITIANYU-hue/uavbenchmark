# JD 业务变量树：高速巡检 A5 / A6a / A6b / A7 / A8

## v0.1 阶段一结构草案

| 元数据 | 值 |
|---|---|
| 文档状态 | `research_draft` |
| 版本 | `v0.1-phase-1` |
| 日期 | `2026-07-19` |
| 本阶段范围 | 现状审计、A8 结构草案、统一节点 schema、来源清单、审阅网页结构、A5—A7 补充计划 |
| 本阶段不做 | 不改正式 66 槽位；不填充完整 A5—A7；不改 GAL/A×L；不生成 benchmark 任务；不设计 simulator API；不接入正式 Pipeline |
| 待确认后再做 | 完整五棵树、机读节点表与 YAML、只读审阅网页、Pipeline 中立数据合同 |

> 本文中的 `PROPOSED-*` 均为候选节点，不是正式权威编号。数值范围、阈值、评分规则或接口字段如果没有适用范围完全一致的证据，一律保留 `TBD`。

---

## 0. 权威性排序与冲突处理原则

### 0.1 建议采用的权威性排序

1. 当前任务指令和会议工作基线。
2. 当前受审的 `JD业务变量字典_66槽位_机读版.md` 与 `AxL责任定义字典_17A_68单元_机读版.md`。
3. 与上述 Markdown 内容哈希一致的机读 JSON：
   - `knowledge/jd_dictionary.json`
   - `knowledge/axl_responsibility_catalog.json`
4. 当前项目边界、场景注册表和 Agent 参考目录：
   - `knowledge/business_scenario_registry.json`
   - `knowledge/agent_reference_catalog.json`
   - `knowledge/task_template_backbone.json`
   - GAL Project Brief、交接文档和 G1/G2G3 研究材料。
5. `需求草案-v0.6.md`：只继承变量树设计方法；不自动继承其中的 JD 编号、白墙窄缝变量或数值。
6. 旧案例、归档模板、Dashboard 和旧研究表：用于理解历史设计、发现冲突和提供待核验线索，不作为当前权威定义。
7. 外部公开的一手标准、法规、主管部门文件、正式论文、数据集主页和平台官方文档：用于支撑新增 taxonomy、变量和候选取值域。

### 0.2 冲突处理规则

- 66 个 JD 槽位继续作为当前受审的 canonical slots，不在本轮重编号。
- 新的分组和变量节点使用 `PROPOSED-jd-*`；只有团队评审后才可能转为正式节点。
- 一个旧编号与权威字典含义冲突时，以权威字典为准；旧含义通过 `legacy_aliases` 和迁移表保留，不进行静默覆盖。
- 跨能力或全局变量优先引用现有 `jd-0.x`；平台参数引用 `jd-2.2`，不得复制到 A8。
- JD 只描述任务、场景、环境及要求如何变化；A×L 只描述 SUT 在给定自主等级下承担什么责任。
- 自主等级 `L` 不进入 JD 值域；场景难度 `D` 作为派生/标注元数据处理，不占用 JD 槽位。
- 数据集标签是“可观测 taxonomy 的证据”，不是法规或养护标准的替代物。
- 桥梁指南、白墙窄缝草案等窄范围材料中的数值只在原适用范围内有效，不外推为高速巡检通用阈值。
- 无法判断时使用 `TBD`、`needs_confirmation` 或 `inferred_candidate`，不得把推断写成已确认事实。

---

## 1. 资料审计和冲突清单

### 1.1 当前 66 槽位中与本轮有关的权威定义

| owner_a | canonical_slot | 当前权威名称 | 本轮判断 |
|---|---|---|---|
| A5 | `jd-5.1` | 业务对象类别表 | 保留；需要建立道路病害、车辆违法/异常、正常对象和干扰对象的层级 taxonomy |
| A5 | `jd-5.2` | 典型场景特征表 | 保留；当前过粗，需要拆出数量、密度、分布、动态性、遮挡、尺度、视角和观测质量 |
| A5 | `jd-5.3` | 感知模态集合 | 保留；需要与 `jd-0.9` 载荷引用关系去重 |
| A5 | `jd-5.4` | 感知策略适用集合 | 保留；需要表达连续检测、身份维护、去重、重观测等策略的适用条件 |
| A6a | `jd-6a.1` | 自定位来源要求 | 保留；需补来源类型、参考系、可用性和多源组合 |
| A6a | `jd-6a.2` | 位姿质量先验 | 保留；需补精度、不确定度、完整性/质量状态、一致性和退化模式 |
| A6a | `jd-6a.3` | 自定位策略适用集合 | 保留；需补融合、切换、重定位和保护动作的触发与适用条件 |
| A6b | `jd-6b.1` | 相对几何先验 | 保留；需补相对道路、车道、车辆、病害和检查面的几何量 |
| A6b | `jd-6b.2` | 相对几何感知机制 | 保留；需补参考对象、模态、先验和估计机制 |
| A6b | `jd-6b.3` | 相对定位策略适用集合 | 保留；需补遮挡、重关联、重观测和恢复条件 |
| A7 | `jd-7.1` | 航路拓扑 | 保留；需补道路—车道—匝道—节点—航段的映射与巡检航段拓扑 |
| A7 | `jd-7.2` | 导航机制 | 保留；需补航路表示、巡检模式和航迹约束 |
| A7 | `jd-7.3` | 重规划判据 | 保留；需补航段偏差、不可行、冲突和资源/环境触发 |
| A7 | `jd-7.4` | 导航处置策略适用集合 | 保留；需补等待、悬停、改高度、改航迹、返航等策略适用条件 |
| A8 | `jd-8.1` | 控制品质先验 | 保留；作为跟踪品质、稳定性和控制余量要求的 canonical slot |
| A8 | `jd-8.2` | 控制工作机制 | 保留；作为控制输入语义、受控通道、控制/飞行模式和执行时序要求的 canonical slot |
| A8 | `jd-8.3` | 控制处置策略适用集合 | 保留；作为异常触发、允许策略、适用条件和处置后验证要求的 canonical slot |

### 1.2 共性结构问题

| 问题 | 证据 | 风险 | 建议 |
|---|---|---|---|
| 当前 JD Catalog 是扁平槽位 | `jd_dictionary.json` 只有 66 条顶层记录 | Config Agent 无法按分支检索，Seed 不能只采样启用叶子 | 在不改变 canonical slots 的前提下增加树节点 Catalog |
| `definition` 过粗 | A5—A8 多数槽位只给出“类别表/先验/策略集合” | 一个单元格将混入多个变量，难以配置和审计 | 每个叶子只表示一个变量；枚举项放在 `value_domain` |
| 缺少激活和依赖 | 当前 JD 没有父子、依赖、互斥字段 | 无关叶子也会被传入模型或采样 | 增加 `activation_condition`、`depends_on`、`mutual_exclusion_group` |
| 侧别与可见性混淆 | 当前 Pipeline 主要依赖硬编码 `WORLD_SIDE_JD`，并默认写入 `sut_visible` | 世界/用户投影和 Hidden GT 边界失真 | 将 `configuration_side` 与 `visibility` 作为独立字段 |
| L 与 D 容易混入 JD | v0.6 曾提出 `jd-9.1=D`、`jd-9.2=L` | 破坏 JD/GAL 分工，也与现有 A9a/A9b 冲突 | 两者不建立 JD 编号；L 来自 A×L，D 为派生/标注元数据 |
| 来源粒度不足 | 当前槽位记录来源但无法指向具体取值域 | 变量存在证据不代表每个枚举值或阈值有证据 | `source` 使用结构化列表，并声明其支撑的字段/候选值 |
| “合理推断”可能被写成事实 | 当前 Pipeline 的部分抽取提示允许根据 UAV 常识补具体域 | 与本轮“无依据不发明”相冲突 | 新树的生成和编辑必须校验 `evidence_status` |
| 旧材料使用不同 L 体系 | Dashboard 中可见历史 L1—L6 结构 | 容易污染当前 L1—L4 受审 AxL | 旧表只作为资料线索；映射必须回到当前 68 单元 |

### 1.3 A8 编号冲突审计

| 编号 | 当前 66 槽位权威含义 | v0.6 含义 | 结论 | 建议迁移 |
|---|---|---|---|---|
| `jd-8.1` | 控制品质先验 | 控制接口/指令类型 | 直接冲突 | v0.6 的接口/指令类型迁为 `PROPOSED-jd-8.2.1.*` |
| `jd-8.2` | 控制工作机制 | 控制约束 | 直接冲突 | 跟踪品质约束迁入 `PROPOSED-jd-8.1.*`；平台硬限制引用 `jd-2.2`；安全边界引用 `jd-0.10` |
| `jd-8.3` | 控制处置策略适用集合 | 执行包络 | 直接冲突 | 执行包络主体迁回 `jd-2.2` / `jd-0.10`；控制余量要求可进入 `PROPOSED-jd-8.1.3.*` |
| `jd-8.5` | 当前 66 槽位不存在 | 障碍物/窄缝相关树 | 无权威空槽可继承 | 不建议创建 canonical `jd-8.5`；障碍/空间引用 `jd-0.2`，扰动引用 `jd-0.3`，安全包络引用 `jd-0.10` |
| `jd-9.1` | 不存在；现有 A9 分为 A9a/A9b | 难度 D | 编号和概念均冲突 | 删除候选编号；D 放任务元数据 |
| `jd-9.2` | 不存在；现有 A9 分为 A9a/A9b | 自主等级 L | 编号和概念均冲突 | 删除候选编号；L 由 A×L Coverage 给出 |

### 1.4 A8 白墙窄缝草案中可复用与不可复用的部分

可复用：

- 先定义维度视图，再构造父子树。
- 树一般止于 3—4 层。
- 叶子定义值类型和候选取值域，取值本身不继续变成节点。
- 使用激活条件、互斥关系和列表/数量配对。
- Seed 只对启用叶子采样。
- 任务可见输入与 Hidden GT 分开。
- 自主等级与场景难度分开。

不可直接复用：

- `jd-8.1/8.2/8.3/8.5/9.1/9.2` 的 v0.6 编号语义。
- 白墙、窄缝、障碍物数量、间隙比例等特定场景变量。
- 草案中的机体尺寸、速度、频率、误差和距离数值。
- 将障碍物/空间、平台包络或安全边界全部归入 A8 的做法。
- 任何尚未由高速巡检材料证明适用的 simulator 字段。

### 1.5 建议保留、扩展、迁移和废弃

| 动作 | 项目 |
|---|---|
| 建议保留 | 17 个相关 canonical slots；A8 的“品质—机制—处置”三段式；A×L 当前 68 单元 |
| 建议扩展 | 17 个 canonical slots 下的 `PROPOSED` 分组/变量；结构化来源；激活/依赖；侧别与可见性；场景适用范围 |
| 建议迁移 | v0.6 的接口语义 → `jd-8.2` 子树；品质/余量要求 → `jd-8.1` 子树；平台与安全包络 → `jd-2.2` / `jd-0.10` 引用 |
| 建议废弃 | 把 v0.6 的 `jd-8.1/8.2/8.3` 直接写回权威字典；新增 canonical `jd-8.5`；`jd-9.1=D`、`jd-9.2=L` |
| 待人工裁剪 | A8 是否暴露平台特定飞行模式名；哪些数值在桥梁子场景可采用；业务对象 taxonomy 的第一版覆盖面 |

### 1.6 当前必须由团队确认的问题

1. 是否确认上述权威性排序。
2. 是否确认 66 槽位在本轮不重编号，所有新增节点先使用 `PROPOSED`。
3. 是否确认不建立 canonical `jd-8.5`，而用全局/平台引用处理空间、扰动和执行包络。
4. 对历史案例中的冲突 ID，是保留 `legacy_aliases` 兼容读取，还是一次性迁移旧数据。
5. `configuration_side` 是否允许 `shared`；若允许，导出时采用“双侧复制并标注来源”还是“公共段 + 双侧引用”。
6. `visibility` 是否允许多值，例如一个需求同时 `sut_visible` 和 `grader_visible`。
7. 是否把“桥梁巡检”纳入本轮高速巡检首版，还是只作为可复用来源、后续建立子场景。
8. 是否同意排除具体控制器算法家族（PID/MPC 等）作为一般 JD 变量；除非任务明确约束可观察的控制机制。
9. 是否同意难度方向允许 `context_dependent` / `non_monotonic` / `TBD`，不强行给每个变量单调方向。

---

## 2. 统一变量树节点 schema

### 2.1 节点模型

| 字段 | 类型 | 用途 |
|---|---|---|
| `schema_version` | string | 节点合同版本，支持后续迁移 |
| `node_id` | string | 节点唯一 ID；新增节点使用 `PROPOSED-*` |
| `parent_id` | string/null | 父节点 ID；支持树结构 |
| `canonical_slot` | string | 所属的当前 66 槽位，如 `jd-8.1` |
| `owner_a` | enum | `A5`、`A6a`、`A6b`、`A7`、`A8` |
| `name` | string | 节点规范名称 |
| `definition` | string | 只定义一个分组或变量，不混入多个独立槽位 |
| `node_kind` | enum | `scenario_root` / `capability_root` / `group` / `variable` |
| `value_type` | enum | `none` / `enum` / `multi_enum` / `boolean` / `integer` / `number` / `string` / `object` / `array` / `TBD` |
| `value_domain` | array/object/null | 枚举值或结构化范围；数值范围允许 `min/max: null` |
| `unit` | string/null | SI 单位或明确的标准单位；未知为 `null` |
| `activation_condition` | object/null | 叶子何时启用；使用中立表达式，不绑定 simulator |
| `multiplicity` | enum/object | `one` / `zero_or_one` / `one_or_more` / `zero_or_more`，必要时附数量变量引用 |
| `difficulty_direction` | object/string | `increasing` / `decreasing` / `non_monotonic` / `context_dependent` / `neutral` / `TBD`，并可附理由 |
| `configuration_side` | enum | `user` / `world` / `shared` |
| `visibility` | array | `sut_visible` / `fixture_only` / `grader_visible` / `grader_only` / `hidden_gt` |
| `applicable_scenarios` | array | 场景标签，如 `highway_inspection`、`bridge_inspection` |
| `related_global_jd` | array | 对 `jd-0.x` 的引用，避免复制全局变量 |
| `related_jd` | array | 对非全局 JD 的跨槽位引用，如 `jd-2.2`、`jd-7.2` |
| `used_by_axl` | array | 使用该变量的 A×L 单元 ID；只建立映射，不改变责任定义 |
| `depends_on` | array | 结构化依赖关系 |
| `mutual_exclusion_group` | string/null | 互斥组 ID |
| `constraints` | array | 跨字段约束；只写有证据或团队确认的规则 |
| `source` | array | 结构化来源对象 |
| `evidence_status` | enum | 证据确定性状态 |
| `review_status` | enum | 人工评审状态 |
| `legacy_aliases` | array | 旧编号/旧名称，用于兼容和迁移审计 |
| `notes` | string/null | 不进入配置的补充说明 |

### 2.2 建议的受控状态

`evidence_status`：

- `authoritative_existing`：当前受审 JD/A×L 已有定义。
- `authoritative_external`：法规、标准或主管部门正式文件直接定义。
- `source_supported`：论文、数据集主页或官方平台文档直接支持。
- `inferred_candidate`：多个来源合理归纳，但来源没有给出同名规范变量。
- `team_material_only`：仅团队草案或旧案例支持。
- `TBD`：当前没有足够证据。

`review_status`：

- `reviewed`
- `proposed`
- `needs_confirmation`
- `merge_candidate`
- `deprecate_candidate`
- `rejected`

### 2.3 结构化值域示例

```yaml
value_type: number
value_domain:
  min: null
  max: null
  bounds: closed
  candidates: []
  tbd_reason: "高速巡检通用阈值尚无适用范围一致的证据"
unit: m/s
```

```yaml
value_type: enum
value_domain:
  - value: position_setpoint
    label_zh: 位置设定值
    source_refs: [W-PX4-CTRL]
    status: source_supported
  - value: velocity_setpoint
    label_zh: 速度设定值
    source_refs: [W-PX4-CTRL]
    status: source_supported
```

### 2.4 结构化来源示例

```yaml
source:
  - source_id: W-PX4-CTRL
    title: PX4 Controller Diagrams
    issuer: PX4
    year: 2026
    url: https://docs.px4.io/main/en/flight_stack/controller_diagrams
    locator: "Multicopter Position Controller; Fixed-Wing Attitude Controller"
    supports:
      - value_domain
      - related_jd
    claim_type: official_platform_documentation
    evidence_grade: primary
```

### 2.5 三类消费者的字段投影

| 字段组 | Config Agent | Seed 实例化 | 审计/评审 |
|---|---:|---:|---:|
| ID、父子、canonical slot、能力、名称、定义 | 必需 | 必需 | 必需 |
| 场景、激活条件、依赖、互斥 | 必需 | 必需 | 必需 |
| 值类型、值域、单位、multiplicity | 查询时需要 | 必需 | 必需 |
| configuration side、visibility | 必需 | 必需 | 必需 |
| A×L、关联 JD | 必需 | 可选校验 | 必需 |
| 来源和证据状态 | 必需，避免无证据推断 | 只需状态门禁 | 必需 |
| review status | 必需，默认不选未审节点 | 作为采样门禁 | 必需 |
| legacy aliases、notes | 通常不传 | 不传 | 必需 |

### 2.6 schema 级强制校验

1. 一个节点只能有一个 `node_id`、一个 `parent_id` 和一个 `canonical_slot`。
2. 非 canonical 新节点的 `node_id` 必须以 `PROPOSED-` 开头。
3. `group` 节点的 `value_type` 必须是 `none`；`variable` 节点必须声明值类型。
4. 数值变量必须声明单位；没有可靠范围时 `min/max` 保持 `null`。
5. `configuration_side` 不得由 `visibility` 推导，反之亦然。
6. `hidden_gt` 变量不得出现在 SUT 输入投影中。
7. `review_status != reviewed` 的节点不得默认进入正式 Seed。
8. `evidence_status in [inferred_candidate, team_material_only, TBD]` 时必须保留醒目标识。
9. 子节点的 `canonical_slot` 必须与祖先 canonical slot 一致，除非该节点仅为非采样引用。
10. `used_by_axl` 只能引用当前 68 单元，不得自造 L。
11. 全局同义变量必须通过 `related_global_jd` 引用，不能在能力树下重复定义。
12. 只有 `activation_condition` 为真且所有依赖满足的叶子才能被 Seed 采样。

---

## 3. A8 高速巡检变量树草案

### 3.1 A8 与相邻能力的责任边界

| 范围 | 归属 |
|---|---|
| 生成航路、航段目标和重规划 | A7 |
| 估计自身位姿及质量状态 | A6a |
| 估计相对道路/车道/对象的几何 | A6b |
| 跟踪速度、高度、姿态、航向等参考量并执行控制 | A8 |
| 风、阵风、湍流、天气和电磁扰动 | 引用 `jd-0.3` |
| 载荷种类和载荷能力 | 引用 `jd-0.9` |
| 飞行平台与执行器物理参数 | 引用 `jd-2.2` |
| 安全距离、禁入区域和平台安全包络 | 引用 `jd-0.10` |
| 失联、低电量等系统级安全处置 | 通常属于 A12；A8 只描述被要求执行的控制动作 |

### 3.2 人类可读树

```text
高速巡检
└── A8 飞行控制/执行机构
    ├── jd-8.1 控制品质先验                         [当前 canonical slot]
    │   ├── PROPOSED-jd-8.1.1 参考量跟踪品质
    │   │   ├── PROPOSED-jd-8.1.1.1 速度跟踪容差
    │   │   ├── PROPOSED-jd-8.1.1.2 高度跟踪容差
    │   │   ├── PROPOSED-jd-8.1.1.3 姿态跟踪容差
    │   │   └── PROPOSED-jd-8.1.1.4 航向跟踪容差
    │   ├── PROPOSED-jd-8.1.2 瞬态与稳定品质
    │   │   ├── PROPOSED-jd-8.1.2.1 允许超调
    │   │   ├── PROPOSED-jd-8.1.2.2 稳定/调节时间要求
    │   │   └── PROPOSED-jd-8.1.2.3 允许振荡特征
    │   └── PROPOSED-jd-8.1.3 控制执行余量
    │       ├── PROPOSED-jd-8.1.3.1 饱和余量要求
    │       └── PROPOSED-jd-8.1.3.2 控制权/执行余量要求
    ├── jd-8.2 控制工作机制                         [当前 canonical slot]
    │   ├── PROPOSED-jd-8.2.1 控制指令/参考输入
    │   │   ├── PROPOSED-jd-8.2.1.1 参考输入类型
    │   │   ├── PROPOSED-jd-8.2.1.2 参考输入更新方式
    │   │   └── PROPOSED-jd-8.2.1.3 参考输入更新频率
    │   ├── PROPOSED-jd-8.2.2 受控通道
    │   │   └── PROPOSED-jd-8.2.2.1 启用通道集合
    │   ├── PROPOSED-jd-8.2.3 控制/飞行模式要求
    │   │   ├── PROPOSED-jd-8.2.3.1 模式语义
    │   │   └── PROPOSED-jd-8.2.3.2 模式进入前提
    │   └── PROPOSED-jd-8.2.4 执行时序
    │       ├── PROPOSED-jd-8.2.4.1 指令到执行时延要求
    │       └── PROPOSED-jd-8.2.4.2 时间同步要求
    └── jd-8.3 控制处置策略适用集合                 [当前 canonical slot]
        ├── PROPOSED-jd-8.3.1 处置触发
        │   └── PROPOSED-jd-8.3.1.1 可适用触发集合
        ├── PROPOSED-jd-8.3.2 允许处置
        │   └── PROPOSED-jd-8.3.2.1 允许控制处置集合
        ├── PROPOSED-jd-8.3.3 策略适用规则
        │   └── PROPOSED-jd-8.3.3.1 策略—条件映射
        └── PROPOSED-jd-8.3.4 处置后验证
            ├── PROPOSED-jd-8.3.4.1 是否要求验证
            └── PROPOSED-jd-8.3.4.2 稳定恢复判据
```

> 以上树的深度为 canonical slot → 分组 → 变量，候选取值不继续作为节点。

### 3.3 A8 叶子草案

下表中的枚举项是“来源支持的候选语义”，不是已确认的跨平台统一枚举。所有数值边界继续为 `TBD`。

| node_id | 定义 | 类型与候选域 | 启用/依赖 | 难度方向 | 侧别 / 可见性 | A×L | 状态 / 主要来源 |
|---|---|---|---|---|---|---|---|
| `PROPOSED-jd-8.1.1.1` | 任务对速度参考量跟踪误差的允许范围 | number/object；范围 `TBD`，单位 `m/s` | 启用速度通道时 | 容差更窄通常更难；需结合扰动与平台 | user / sut_visible | A8.L1–L4 | proposed；L-JD66、L-AXL68、W-PX4-CTRL |
| `PROPOSED-jd-8.1.1.2` | 任务对高度参考量跟踪误差的允许范围 | number/object；范围 `TBD`，单位 `m` | 启用高度通道时；参考系来自 A6a | 容差更窄通常更难 | user / sut_visible | A8.L1–L4 | proposed；L-AXL68、W-PX4-CTRL |
| `PROPOSED-jd-8.1.1.3` | 任务对姿态参考量跟踪误差的允许范围 | object；roll/pitch/yaw 或 quaternion 语义待确认；阈值 `TBD` | 启用姿态通道时 | 容差更窄通常更难 | user / sut_visible | A8.L1–L4 | needs_confirmation；W-PX4-CTRL |
| `PROPOSED-jd-8.1.1.4` | 任务对航向参考量跟踪误差的允许范围 | number/object；阈值 `TBD`，单位 `deg` 或 `rad` 待统一 | 启用航向通道时；依赖 A6a 航向质量 | 容差更窄通常更难 | user / sut_visible | A8.L1–L4 | proposed；L-AXL68、W-PX4-CTRL |
| `PROPOSED-jd-8.1.2.1` | 参考量变化或扰动后允许的最大超调要求 | object；通道 + 阈值，阈值 `TBD` | 存在阶跃/轨迹变化或扰动事件时 | 更小通常更难；可能与响应时间权衡 | user / sut_visible | A8.L2–L4 | inferred_candidate；W-PX4-CTRL |
| `PROPOSED-jd-8.1.2.2` | 进入并保持稳定状态所要求的时间条件 | object；持续时长/稳定窗 `TBD` | 要求处置后恢复或稳定观测时 | 更短通常更难 | user / sut_visible | A8.L2–L4 | inferred_candidate；L-AXL68 |
| `PROPOSED-jd-8.1.2.3` | 任务允许的振荡状态或振荡上限 | enum/object；`not_allowed` / `bounded` / `TBD` | 动态跟踪或扰动恢复时 | 非单调；需结合幅值、频率、持续时间 | user / sut_visible | A8.L3–L4 | proposed；L-AXL68、W-PX4-CTRL |
| `PROPOSED-jd-8.1.3.1` | 任务要求保留的执行器/控制量饱和余量 | number/object；范围与单位 `TBD` | 平台暴露可解释余量或 grader 可计算时 | 更大余量要求通常更难 | shared / sut_visible, grader_visible | A8.L3–L4 | needs_confirmation；L-AXL68、W-PX4-CTRL |
| `PROPOSED-jd-8.1.3.2` | 任务要求保留的总体控制权或执行余量 | object；定义与阈值 `TBD`；平台上限引用 `jd-2.2` | 受扰或接近包络时 | 更大余量要求通常更难 | shared / sut_visible, grader_visible | A8.L3–L4 | needs_confirmation；L-AXL68 |
| `PROPOSED-jd-8.2.1.1` | A8 接收并跟踪的参考输入语义 | enum；候选 `position_setpoint`、`velocity_setpoint`、`acceleration_setpoint`、`attitude_setpoint`、`rate_setpoint`、`thrust_setpoint`、`platform_specific` | 由 A7/上游输出和平台能力共同约束 | 无单调方向 | shared / sut_visible | A8.L1–L2 | source_supported candidate；W-PX4-CTRL；由 v0.6 `jd-8.1` 迁入 |
| `PROPOSED-jd-8.2.1.2` | 参考输入是一次性、分段还是连续流式更新 | enum；候选 `single`、`segment_based`、`streaming`、`platform_specific` | 参考输入类型已启用 | context_dependent | shared / sut_visible | A8.L1–L2 | inferred_candidate；W-MAVLINK-MISSION、W-PX4-MISSION |
| `PROPOSED-jd-8.2.1.3` | 上游参考输入的更新频率要求 | number；范围 `TBD`，单位 `Hz` | `streaming` 或周期更新时 | 更高不必然更难，受时延和资源影响 | user / sut_visible | A8.L1–L2 | TBD；不得沿用白墙草案数值 |
| `PROPOSED-jd-8.2.2.1` | 本任务要求 A8 激活和执行的控制通道集合 | multi_enum；候选 `speed`、`altitude`、`attitude`、`heading`，其他通道待平台映射 | 至少一个；与参考输入类型相容 | 非单调 | user / sut_visible | A8.L1–L2 | authoritative_existing + proposed refinement；L-AXL68 |
| `PROPOSED-jd-8.2.3.1` | 任务所要求的可观察控制/飞行模式语义 | enum；候选 `mission_track`、`position_hold`、`altitude_hold`、`attitude_control`、`rate_control`、`offboard_track`、`platform_specific` | 平台支持且进入前提满足 | context_dependent | shared / sut_visible | A8.L1–L4 | needs_confirmation；W-PX4-MODES、W-ARDUPILOT-MODES |
| `PROPOSED-jd-8.2.3.2` | 进入或保持指定模式所需的任务侧前提 | object；候选条件引用定位质量、位置可用性、外部指令链路、平台状态；阈值 `TBD` | 指定模式时 | 条件越严格不等于场景越难 | shared / sut_visible | A8.L1–L4 | source_supported candidate；W-PX4-MODES、W-PX4-EKF；引用 A6a |
| `PROPOSED-jd-8.2.4.1` | 从上游指令到执行生效的允许时延要求 | number；范围 `TBD`，单位 `ms` 或 `s` 待统一 | 任务对闭环时序有要求时 | 更小通常更难 | user / sut_visible, grader_visible | A8.L2 | TBD |
| `PROPOSED-jd-8.2.4.2` | 指令、状态估计和观测之间的时间同步要求 | enum/object；`required` / `not_required` / `TBD` + 误差阈值 `TBD` | 多源或时序评分启用时 | 更严格通常更难 | shared / sut_visible, grader_visible | A8.L2–L3 | inferred_candidate；W-PX4-EKF |
| `PROPOSED-jd-8.3.1.1` | 允许触发控制处置的异常/退化条件集合 | multi_enum；候选 `persistent_tracking_error`、`oscillation`、`actuator_saturation`、`low_control_margin`、`wind_disturbance`、`mode_unavailable`、`estimator_quality_degraded` | A8.L3/L4 场景启用处置责任时 | 触发组合使难度上升但非单调 | user / sut_visible；事件真值可另为 hidden_gt | A8.L3–L4 | authoritative_existing candidate values；L-AXL68；风引用 `jd-0.3`，估计质量引用 A6a |
| `PROPOSED-jd-8.3.2.1` | 任务允许或要求 SUT 从中选择的控制处置集合 | multi_enum；`slow_down`、`increase_margin`、`switch_control_mode`、`wait_for_stability`、`request_check`；是否纳入 `hover`/`return` 待边界确认 | 至少一个触发已启用 | 无单调方向 | user / sut_visible | A8.L4 | authoritative_existing；L-AXL68 |
| `PROPOSED-jd-8.3.3.1` | 每种处置在何种阶段、平台、扰动和质量状态下适用 | array<object>；strategy + conditions；规则内容 `TBD` | 有两个以上候选处置或受条件限制时 | context_dependent | user / sut_visible | A8.L4 | proposed；规则须逐条有来源或团队确认 |
| `PROPOSED-jd-8.3.4.1` | 执行处置后是否必须检查效果和状态恢复 | boolean | 启用任何 A8 处置时建议为 true；是否强制待确认 | 通常增加任务要求 | user / sut_visible | A8.L4 | authoritative_existing；L-AXL68 |
| `PROPOSED-jd-8.3.4.2` | 判定控制品质已恢复并可继续任务的条件 | object；品质指标 + 稳定窗；阈值 `TBD` | `post_action_verification_required=true` | 条件更严格通常更难 | user / sut_visible, grader_visible | A8.L4 | proposed；L-AXL68 |

### 3.4 A8 关键依赖与互斥

1. `8.1.1.*` 仅在对应 `8.2.2.1` 通道启用时出现。
2. `8.2.1.3` 仅在参考输入需要周期/流式更新时出现。
3. 模式枚举必须与平台 `jd-2.2` 的能力兼容；树本身不复制平台模式实现。
4. 位置/高度相关模式的可用性引用 A6a 的定位来源与质量状态。
5. 风扰、阵风、湍流等场景注入统一引用 `jd-0.3`；A8 只定义品质要求与可适用处置。
6. `hover`、`change_altitude`、`change_path`、`return` 如果表达导航策略，归 A7/A12；A8 仅执行其控制参考。是否在 `8.3.2.1` 中保留为“可执行动作别名”待团队确认。
7. `post_action_verification_required=false` 时不启用 `8.3.4.2`。
8. 具体控制器算法家族默认不作为 JD 值；若任务只约束外部可观察的模式或接口语义，才进入 `8.2`。

### 3.5 A8 节点 YAML 示例

```yaml
- schema_version: jd-tree/0.1
  node_id: PROPOSED-jd-8.2.1.1
  parent_id: PROPOSED-jd-8.2.1
  canonical_slot: jd-8.2
  owner_a: A8
  name: 参考输入类型
  definition: A8 接收并跟踪的参考输入语义。
  node_kind: variable
  value_type: enum
  value_domain:
    - value: position_setpoint
      status: source_supported
      source_refs: [W-PX4-CTRL]
    - value: velocity_setpoint
      status: source_supported
      source_refs: [W-PX4-CTRL]
    - value: attitude_setpoint
      status: source_supported
      source_refs: [W-PX4-CTRL]
    - value: rate_setpoint
      status: source_supported
      source_refs: [W-PX4-CTRL]
    - value: platform_specific
      status: inferred_candidate
      source_refs: []
  unit: null
  activation_condition: null
  multiplicity: one
  difficulty_direction:
    type: non_monotonic
    rationale: 不同参考层级改变责任接口，不能简单排序难度。
  configuration_side: shared
  visibility: [sut_visible]
  applicable_scenarios: [highway_inspection]
  related_global_jd: []
  related_jd: [jd-7.2, jd-2.2]
  used_by_axl: [A8.L1, A8.L2]
  depends_on: []
  mutual_exclusion_group: a8_reference_input_type
  constraints: []
  source:
    - source_id: L-JD66
      supports: [canonical_slot]
    - source_id: W-PX4-CTRL
      supports: [value_domain]
  evidence_status: source_supported
  review_status: proposed
  legacy_aliases:
    - source: 需求草案-v0.6
      old_id: jd-8.1
  notes: 不把 PX4 名称直接视为跨平台正式枚举。
```

---

## 4. 高速巡检联网研究来源清单

### 4.1 来源使用原则

- `法规/标准/主管部门文件`：定义业务对象、合法/违法条件、检查流程、安全边界和正式术语。
- `正式数据集/论文`：补充可观测类别、视角、尺度、遮挡、密度、连续检测和跟踪变量。
- `官方平台文档`：补充坐标、航路、控制输入、模式依赖、质量状态和仿真变量组织方法。
- 同一来源只支撑其明确覆盖的范围；例如桥梁指南的阈值不能直接成为全部高速巡检的阈值。

### 4.2 第一轮核心来源矩阵

| source_id | 来源 | 类型/权威性 | 可支撑内容 | 使用限制 |
|---|---|---|---|---|
| L-JD66 | `JD业务变量字典_66槽位_机读版.md` | 当前受审本地权威字典 | 66 个 canonical slots、A5—A8 槽位名称与定义 | 不包含本轮新增子节点 |
| L-AXL68 | `AxL责任定义字典_17A_68单元_机读版.md` | 当前受审本地权威字典 | A5/A6a/A6b/A7/A8 的 L1—L4 责任边界与递进关系 | 只用于 `used_by_axl` 映射，不作为 JD 值域 |
| W-MOT-UAV-BRIDGE | [《低空无人机应用公路桥梁巡检技术指南（试行）》，交办公路〔2026〕8号](https://xxgk.mot.gov.cn/jigou/glj/202602/t20260226_4200995.html)；[PDF](https://xxgk.mot.gov.cn/jigou/glj/202602/P020260228435553861410.pdf) | 交通运输部正式指南 | 计划—采集—处理—成果流程；自动航线为主、人工补充；可见光、LiDAR、红外、声学；航线规划、环境核查、飞行监控、数据质量、补飞和成果包 | 直接适用于公路桥梁；具体数值不得外推到一般道路/交通巡检 |
| W-JTG5210 | [《公路技术状况评定标准》JTG 5210—2018 公告](https://xxgk.mot.gov.cn/jigou/glj/202006/t20200623_3313114.html)；[交通运输部英文版 PDF](https://xxgk.mot.gov.cn/jigou/glj/202204/P020220425579066545831.pdf) | 公路工程行业标准 | 沥青/水泥路面损坏 taxonomy、严重度、计量方式、检测单元和技术状况指标 | taxonomy 权威；阈值需按路面类型和标准原文适用，不等于无人机可观测阈值 |
| W-JTG-PREVENTIVE | [《公路沥青路面预防养护技术规范》JTG/T 5142-01—2021](https://www.gov.cn/zhengce/zhengceku/2021-08/27/5633656/files/bfd9f7c60df0455781d3e3fa12e69720.pdf) | 行业推荐性标准 | 裂缝、车辙、坑槽和水损坏等病害机制与养护语义 | 用于病害属性和因果背景，不直接变成 benchmark 阈值 |
| W-MOT-LOWALT-CASES | [《低空交通运输应用场景典型案例》](https://xxgk.mot.gov.cn/jigou/ysfws/202511/P020251118558935046297.pdf) | 交通运输部典型案例 | 贵州高速：设计航线、周期性全路段、多维巡查、高清相机、LiDAR、三维/点云、病害—构件—位置关联 | 案例证据，不是统一技术标准 |
| W-UAV-REG | [《无人驾驶航空器飞行管理暂行条例》](https://www.miit.gov.cn/jgsj/zfs/xzfg/art/2023/art_ece2749074fd4c53a915b964d2264fd8.html) | 国务院、中央军委行政法规 | 飞行活动、分类管理、空域和安全约束的上位边界 | 法律要求进入安全/约束引用，不用于自造任务评分 |
| W-CCAR92 | [《民用无人驾驶航空器运行安全管理规则》CCAR-92](https://www.caac.gov.cn/PHONE/XXGK_17/XXGK/MHGZ/202401/t20240103_222566.html) | 有效民航规章 | 运行安全、运行控制、人员/运营要求 | 只提取与场景配置相关的中立约束，不复制监管流程为 JD |
| W-TRAFFIC-REG | [《道路交通安全法实施条例》](https://www.samr.gov.cn/zljds/zcfg/art/2023/art_5c212e15369443b3b2bea4e17a1c565b.html) | 行政法规 | 高速公路倒车、逆行、穿越中央分隔带掉头、行车道停车、匝道超车、骑轧分界线、非紧急占用应急车道等禁止行为 | 违法判定必须带条件，不能只凭“车在某区域”判定 |
| W-TRAFFIC-LAW | [《中华人民共和国道路交通安全法》](https://www.npc.gov.cn/npc/c1773/c1849/c6680/c31694/c31700/201905/t20190521_260616.html) | 全国人大法律 | 故障、事故等合法停车/处置背景 | 与违法 taxonomy 联合使用，建立合法例外和上下文变量 |
| W-UAV-POLICE-HB | [淮北公安：高速公路警用无人机交通技术监控通告](https://gaj.huaibei.gov.cn/jwzx/tzgg/57921821.html) | 地方公安主管部门公开通告 | 应急车道行驶/停车、骑轧分界线、行车道违法停车、手持电话等实际无人机取证对象 | 仅表示当地已公开采用的抓拍范围，不是全国完整 taxonomy |
| W-HIGHWAY-PRACTICE | [重庆交通：无人机公路巡检实践](https://jtj.cq.gov.cn/sy_240/bmdt/202304/t20230407_11857460.html) | 地方交通主管部门 | 预设航线、红外/变焦、三维建模、道路与车辆状态、边坡/滑坡等对象 | 实践案例，不提供通用阈值 |
| W-RDD2022 | [RDD2022 数据论文](https://arxiv.org/abs/2209.08538) | 原始论文/公开数据集 | 纵向裂缝、横向裂缝、龟裂、坑槽四类跨国道路损坏标签 | 车载/手机视角；taxonomy 不完整，不代表 JTG 全量病害 |
| W-HIGHRPD | [HighRPD 无人机视角路面病害数据集](https://data.mendeley.com/datasets/sywswj7djj/1) | 公开数据集主页 | 无人机视角的线状、块状、坑状损坏及尺度/视角证据 | 数据集自定义三类，不能替代正式病害标准 |
| W-VISDRONE | [VisDrone 官方数据仓库](https://github.com/VisDrone/VisDrone-Dataset)；[原始论文](https://arxiv.org/abs/2001.06303) | 高校官方数据集/论文 | UAV 视角车辆和人员类别；不同城市、天气、光照、密度；遮挡、可见性；图像/视频检测和多目标跟踪 | 城市/乡村混合，不专属于高速；用于 A5 观测变量，不用于违法定义 |
| W-BDD100K | [BDD100K 官方数据主页](https://bdd-data.berkeley.edu/download.html) | 高校公开数据集 | 道路、车道、可行驶区域、检测与跟踪标签的组织方式 | 车载视角；仅作为道路结构和正常对象补充 |
| W-OPENDRIVE | [ASAM OpenDRIVE 1.8.1](https://publications.pages.asam.net/standards/ASAM_OpenDRIVE/ASAM_OpenDRIVE_Specification/v1.8.1/specification/index.html) | 标准组织官方规范 | road reference line、s/t 坐标、lane、road、junction、link 和拓扑关系 | 是道路网络交换模型，不是中国道路业务 taxonomy |
| W-OGC-WKT | [OGC WKT-CRS](https://www.ogc.org/standards/wkt-crs/) | OGC/ISO 标准入口 | 坐标参考系的机器可读表达 | 只定义 CRS 表达，不定义 UAV 质量阈值 |
| W-ROS-REP105 | [ROS REP-105：移动平台坐标系](https://reps.openrobotics.org/rep-0105/) | Open Robotics 官方约定 | `map`、`odom`、`base_link`；连续但漂移与全局但可能跳变的参考系差异 | ROS 生态约定；作为结构参考，不强制所有系统采用 |
| W-GPS-SPS | [GPS Standard Positioning Service Performance Standard, 5th edition](https://archive.gps.gov/technical/ps/)；[PDF](https://www.gps.gov/technical/ps/2020-SPS-performance-standard.pdf) | 美国政府官方规范 | GPS 服务、性能和可用性术语 | 不等于本地多路径环境下的实飞误差保证 |
| W-PX4-EKF | [PX4 EKF2 官方文档](https://docs.px4.io/main/en/advanced_config/tuning_the_ecl_ekf) | 开源飞控官方文档 | GNSS/气压计/测距/视觉等来源；innovation、拒绝、reset、质量状态；多 EKF 一致性与切换 | 平台实现证据；抽象成候选机制，不直接成为唯一规范 |
| W-MAVLINK-MISSION | [MAVLink Mission Protocol](https://mavlink.io/en/services/mission.html) | 官方协议规范 | waypoint、NAV/DO/CONDITION 项、序列、坐标 frame、mission/fence/rally 的结构 | 只用于中立航路表示参考；不在本轮发明 simulator API |
| W-PX4-MISSION | [PX4 Multicopter Mission Mode](https://docs.px4.io/main/en/flight_modes_mc/mission) | PX4 官方文档 | 预定义任务、航点顺序、全局 3D 位姿前提和任务执行行为 | 平台特定 |
| W-PX4-CTRL | [PX4 Controller Diagrams](https://docs.px4.io/main/en/flight_stack/controller_diagrams) | PX4 官方文档 | 位置—速度—加速度—姿态—角速度—执行量级联；饱和、抗积分饱和和 setpoint/estimate 边界 | 只支撑 A8 机制候选，不规定高速巡检阈值 |
| W-PX4-MODES | [PX4 Flight Modes 基本概念](https://docs.px4.io/main/en/getting_started/flight_modes)；[开发者模式要求](https://docs.px4.io/main/en/concept/flight_modes) | PX4 官方文档 | 模式语义、定位/姿态/链路前提、模式切换和自动/辅助差异 | 模式名平台特定，需抽象或保留 `platform_specific` |
| W-ARDUPILOT-MODES | [ArduPilot Copter Flight Modes](https://ardupilot.org/copter/docs/flight-modes.html) | ArduPilot 官方文档 | 另一飞控生态中的位置、高度、姿态辅助与自动模式组织方式 | 仅用于检查候选语义能否跨平台；不把 ArduPilot 模式名定为统一枚举 |
| W-AIRSIM | [AirSim Settings](https://microsoft.github.io/AirSim/settings/)；[Core APIs](https://microsoft.github.io/AirSim/apis/) | 官方仿真平台文档 | 原点/NED、相机、时间、风、天气和世界变量的组织示例 | 仅作变量组织参考；不直接映射 API |
| W-CARLA | [CARLA World and Weather](https://carla.readthedocs.io/en/latest/core_world/) | 官方仿真平台文档 | 云量、降水、风、雾、太阳和道路湿润等世界侧变量组织 | 车辆仿真平台，且天气参数不等于物理真实值 |

### 4.3 当前来源缺口

以下问题虽已有候选来源，但仍需继续检索或等待团队资料：

- 高速公路无人机巡检的全国统一道路/交通综合技术规范。
- 面向无人机视角、同时覆盖道路病害和车辆违法上下文的公开数据集。
- 高速巡检通用飞行高度、速度、重叠度、观测角、控制频率和误差阈值。
- 不同公路设施、路面类型和业务对象在“可见光/红外/LiDAR”等模态下的可检测性边界。
- 车辆违法证据链所需的最小连续帧、时长、视角和车牌/标线可见性要求。
- 可跨平台使用的“控制余量”和“模式语义”统一定义。

上述内容在第二阶段仍应保持 `TBD`，除非得到适用范围一致的一手资料或团队确认。

---

## 5. JD 思维导图审阅网页的页面结构

### 5.1 实现边界

- 独立页面：`JD业务变量树_version1.html`。
- 不覆盖、不导入、不修改 `pipeline.html` 的正式数据。
- 第一版只读，不写回 JD Catalog。
- 使用独立服务 `http://127.0.0.1:8766`。
- 不停止、不修改、不占用 Pipeline 的 `8765`。
- 不调用 Gemini、DeepSeek 或其他模型 API。
- 数据来源是版本化的树 JSON，而不是页面内硬编码。

### 5.2 建议文件结构

```text
JD业务变量树_version1.html
jd-variable-tree/
├── css/
│   └── app.css
├── js/
│   ├── app.js
│   ├── tree-store.js
│   ├── tree-renderer.js
│   ├── filters.js
│   ├── node-inspector.js
│   └── export.js
└── data/
    ├── highway-jd-tree.v0.1.json
    └── source-catalog.v0.1.json
scripts/
└── serve-jd-tree.sh
```

### 5.3 页面布局

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 标题 / 数据版本 / 场景 / 展开全部 / 收起全部 / 导出当前视图 JSON       │
├───────────────┬───────────────────────────────────┬─────────────────────┤
│ 能力与筛选栏  │ 可展开的左→右树状主视图             │ 节点详情面板        │
│               │                                   │                     │
│ A5 A6a A6b    │ 高速巡检                           │ ID / canonical slot │
│ A7 A8         │ └ A8                              │ 定义 / 值域 / 单位  │
│               │   ├ jd-8.1 ...                    │ 激活 / 依赖 / 互斥  │
│ 搜索          │   ├ jd-8.2 ...                    │ 侧别 / 可见性       │
│ JD 编号       │   └ jd-8.3 ...                    │ A×L / 来源 / 状态   │
│ 来源          │                                   │ legacy / notes      │
│ 证据状态      │                                   │                     │
│ 评审状态      │                                   │                     │
└───────────────┴───────────────────────────────────┴─────────────────────┘
│ 图例：已有定义 / 外部权威 / 研究补充 / 推断候选 / 待确认 / TBD          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.4 核心交互

1. A5、A6a、A6b、A7、A8 单选/多选切换。
2. 点击分组展开/折叠；保留父分支上下文。
3. 按节点名称、定义、JD 编号、来源标题全文搜索。
4. 按 `canonical_slot`、能力、来源、证据状态、评审状态、场景筛选。
5. 右侧详情面板展示结构化值域和每条来源具体支撑什么。
6. 用颜色和文字双重编码状态，不能只依赖颜色。
7. 支持展开全部、收起全部和“只展开命中路径”。
8. 导出当前筛选结果 JSON；导出保留祖先节点和来源引用。
9. URL 查询参数保存能力、筛选器和选中节点，方便团队共享审阅位置。
10. 键盘可操作，节点有 `aria-expanded`，长树支持虚拟化或按需渲染。

### 5.5 页面数据门禁

- 页面只加载通过 schema 校验的 JSON。
- `authoritative_existing` 与 `authoritative_external` 分开展示。
- `inferred_candidate`、`team_material_only` 和 `TBD` 必须显示警示徽标。
- 任一候选值都能追溯到 `source_refs`；没有来源时显示“无证据—不可进入正式值域”。
- `configuration_side` 和 `visibility` 使用两组独立标签。
- canonical slot 与 `PROPOSED` 节点使用不同视觉层级。
- 导出功能只导出审阅副本，不生成正式 Pipeline 数据。

---

## 6. A5、A6a、A6b、A7 补充计划

### 6.1 统一工作方法

每棵树按同一顺序推进：

1. 从 canonical slot 建分组骨架。
2. 建“来源—变量—候选值—适用范围”证据矩阵。
3. 把法规/标准 taxonomy 与数据集可观测 taxonomy 分层，不直接合并。
4. 每个叶子只定义一个变量，新增 ID 使用 `PROPOSED`。
5. 补 `activation_condition`、依赖、互斥、侧别、可见性和 A×L 映射。
6. 未经证实的范围和规则保持 `TBD`。
7. 先生成候选全集，再标记保留、合并、删除、待确认，供人工裁剪。

### 6.2 A5 计划

| 工作包 | 主要内容 | 主要证据 |
|---|---|---|
| 业务对象总根 | `道路/路面病害`、`车辆违法/异常事件`、`正常道路参与者与设施`、`相似干扰对象` | JTG 5210、交通法规、主管部门 UAV 实践 |
| 病害 taxonomy | 区分沥青、水泥路面；病害类别、严重度、空间尺度/计量语义 | JTG 5210 为权威；RDD2022/HighRPD 只补可观测标签 |
| 违法 taxonomy | 行为类别 + 适用道路区域 + 时序条件 + 合法例外 + 证据需求 | 道路交通安全法及实施条例、公安通告 |
| 对象属性 | 类别、状态、数量、密度、空间分布、运动状态、持续时间 | 主管部门案例、VisDrone 等 |
| 观测条件 | 模态、遮挡、尺度、视角、光照、清晰度、雨雾和背景相似度 | VisDrone、桥梁 UAV 指南、仿真平台文档 |
| 时序与身份 | 连续检测、track 生命周期、重关联、去重、重观测 | A5.L2–L4、VisDrone MOT |
| 输出/证据 | 对象—位置—时间—证据片段关联；不在此阶段定义评分阈值 | 主管部门取证实践、项目输出合同 |

特别门禁：

- “车辆停在应急车道”不是自动等于违法，必须同时表达非紧急条件和合法例外。
- 数据集没有的 JTG 病害不能因此删除；数据集有的自定义类别不能自动升级为权威业务类别。
- 识别算法、模型结构和置信度校准方法不是 JD 变量；任务要求和可见观测条件才是。

### 6.3 A6a 计划

| 工作包 | 主要内容 | 主要证据 |
|---|---|---|
| 定位来源 | GNSS/RTK、IMU、磁罗盘、气压计、视觉、LiDAR、测距、地图/外部定位等候选 | PX4 EKF2、GPS SPS、团队材料 |
| 坐标与参考系 | 全球 CRS、局部导航系、机体系、map/odom 类语义、高度基准 | OGC WKT、ROS REP-105、PX4 |
| 可用性 | 未初始化、可用、部分可用、失锁、恢复；具体状态枚举待平台中立化 | PX4 EKF2 |
| 质量和不确定度 | 位置/速度/姿态/航向质量、协方差/误差估计、innovation、完整性状态 | PX4 EKF2、GPS SPS |
| 多源一致性 | 来源组合、时间同步、创新一致性、冲突和选择 | PX4 multi-EKF |
| GNSS 退化 | 多路径、跳变、失锁、干扰/欺骗候选；逐项寻找一手证据 | GPS/PX4/监管资料 |
| 策略适用 | 融合、切换、拒绝、reset、重定位、等待、外援、保护动作条件 | A6a.L3–L4、PX4 |

边界：

- 来源“是否存在/是否退化”是场景变量；具体滤波器内部参数通常不是 JD。
- A6a 给 A7/A8 提供位姿与质量状态；A7/A8 不重复定义定位质量。

### 6.4 A6b 计划

| 工作包 | 主要内容 | 主要证据 |
|---|---|---|
| 参考对象 | 道路参考线、车道/应急车道、匝道、车辆、病害、检查面/构件 | OpenDRIVE、JTG、桥梁指南 |
| 相对几何量 | 距离、方位、道路 s/t、横向/垂向偏差、相对朝向、观测角、尺度 | OpenDRIVE、项目需求 |
| 先验 | 对象尺寸/形状/地图位置/道路拓扑先验，全部记录来源和适用范围 | 标准、数据集、地图规范 |
| 估计机制 | 视觉、LiDAR、测距、地图匹配、多模态融合候选 | 桥梁指南、平台文档 |
| 退化 | 遮挡、截断、低纹理、小目标、重观测间隔、参考对象消失 | VisDrone、数据集、A6b.L2–L4 |
| 恢复 | 重关联、重观测、改变视角、搜索和质量验证的适用条件 | A6b.L3–L4 |

边界：

- A6b 输出相对几何和置信状态；A5 决定对象语义，A7 决定如何改变航迹。
- 道路 s/t 是一种候选表示，不强制所有 simulator 使用 OpenDRIVE API。

### 6.5 A7 计划

| 工作包 | 主要内容 | 主要证据 |
|---|---|---|
| 道路/航段拓扑 | road、lane、shoulder、ramp、junction、segment、entry/exit、link | OpenDRIVE、交通主管部门材料 |
| 航路表示 | waypoint 序列、航段/走廊、条件动作、围栏/返航点引用 | MAVLink Mission、PX4 Mission |
| 巡检模式 | 沿线、定点、悬停、低速、绕行/环绕、补飞；分清平台适用性 | 交通运输部指南和地方实践 |
| 航迹约束 | 覆盖区域、观测方向、速度/高度要求、安全包络引用 | 桥梁指南、`jd-0.10`、A8 |
| 偏差与可行性 | 航段横向/垂向偏差、持续偏差、不可行、道路/空域冲突 | A7.L2–L3、A6a/A6b |
| 重规划触发 | 定位退化、观测不足、交通/障碍、天气、通信、资源、安全条件 | A7.L3–L4；全局 JD 引用 |
| 处置适用 | 等待、悬停、改高度、改航迹、补飞、返航；逐项定义前提和验证 | A7.L4、主管部门指南 |

边界：

- A7 产生/选择运动目标和航路；A8 执行并报告控制跟踪品质。
- 低电量、失联等触发可以引用全局/资源节点；系统级保护责任仍按 A12 处理。

### 6.6 第二阶段建议交付节奏

1. 先完成 A5 业务对象 taxonomy 对照表并请团队裁剪。
2. 同时完成 A6a/A6b 坐标、质量和相对几何骨架。
3. 再完成 A7 拓扑、航路与策略适用树。
4. 回看 A8 与 A6a/A7 的重复项，进行第二次边界审计。
5. 生成完整 Markdown 节点表和 YAML。
6. 通过 schema 校验后实现只读网页。
7. 人工确认后，才提出正式 Catalog/Pipeline 的迁移方案。

---

## 7. 本阶段结论与确认门

### 7.1 当前结论

- 当前 66 槽位可作为树的 canonical roots，不需要先重编号。
- v0.6 的核心价值是树设计方法，不是 A8 编号或高速巡检值域。
- `jd-8.1/8.2/8.3` 必须服从现有“品质—机制—处置”语义。
- 不建议新增 canonical `jd-8.5`；白墙障碍/空间变量应迁入全局引用。
- A8 第一版可以在不引入 simulator API 的前提下形成 22 个候选叶子。
- 当前 Pipeline 的扁平 JD、硬编码侧别、默认可见性和无启用叶采样机制，无法直接承载目标树；但本阶段不修改它。
- 高速巡检 taxonomy 必须采用“正式业务定义 + 可观测数据集标签”的双层证据结构。

### 7.2 等待确认的结构决策

- [ ] 权威性排序和冲突处理原则。
- [ ] 66 槽位保留、所有新增节点使用 `PROPOSED`。
- [ ] 不建立 canonical `jd-8.5`。
- [ ] 采用本文 schema，并增加 `related_jd`、`depends_on`、`mutual_exclusion_group`、`legacy_aliases`。
- [ ] 允许 `configuration_side=shared`，并继续讨论其导出投影。
- [ ] `visibility` 使用数组，以表达 SUT、Fixture、Grader/Hidden GT 的独立可见性。
- [ ] A8 控制模式只保留平台中立语义，平台特定名称作为候选别名。
- [ ] 本轮业务首版是否包含桥梁子场景。
- [ ] 难度方向允许非单调、上下文相关或 `TBD`。
- [ ] 确认后按 A5 → A6a/A6b → A7 → A8 边界复核 → 网页的顺序进入第二阶段。
