# Pipeline 三类交付物设计与实施计划

> 设计输入：`docs/pipeline_delivery_audit.md`
>
> 状态：总体方向已确认；第一批 V2 foundation 已实现，其余阶段待分批实施
> 约束：以 `knowledge/jd_variable_tree_version2.json` 实物为当前 JD 主数据；canonical 66 仅作追溯/兼容索引；未知为 TBD；不编造阈值、规则、默认数值、安全判据和 simulator API；不让 Agent 自由探索完整 444 节点。

## 1. 目标形态

一次经过人工确认的 Pipeline run 生成一个 delivery package：

```text
delivery/
├── task_template.json
├── task_template.md
├── jd_tree_selection.json
├── world_config.json
├── user_config.json
├── validation_report.json
├── tbd_register.json
└── package_manifest.json
```

`task_template.md` 面向人审阅；`task_template.json` 是同一语义的机器 Manifest。`world_config.json` 与 `user_config.json` 是从已确认 Manifest 确定性投影出来的两个合同，不由两个 Agent 各自重新解释自然语言。

三个主产物和所选 JD 子树共享：

- `delivery_id`、`task_id`、artifact revision；
- catalog refs 和内容哈希；
- V2 node IDs、tree version/hash，以及可用时的 canonical 66 trace；
- sources、status、edit history；
- 统一 `tbd_register` 引用；
- validation report 引用。

## 2. 通用数据模型

### 2.1 状态枚举

推荐仅使用以下语义：

| 状态 | 含义 | 是否可直接执行 |
|---|---|---|
| `given` | 用户输入中明确给出，且保留原始证据 | 是，但仍需 schema/安全校验 |
| `proposed` | Agent、场景 registry、metric set 或 tree detail 提议 | 否，需人工确认 |
| `verified` | 已由人工或明确权威来源确认 | 是 |
| `TBD` | 缺失、冲突或未确认 | 否 |

不得把“自动生成成功”当作 `verified`。

### 2.2 `config_item`

建议三类 schema 复用 `$defs.config_item`：

```json
{
  "item_id": "binding-weather-001",
  "label": "项目显示名",
  "jd_ref": {
    "node_id": "jd-0.2.1",
    "tree_ref": "knowledge/jd_variable_tree_version2.json",
    "tree_version": "recorded-from-source",
    "tree_hash": "recorded-at-build-time",
    "node_path": ["PROPOSED-jd-tree-global", "jd-0.2", "jd-0.2.1"],
    "review_status": "recorded-from-source"
  },
  "canonical_66_trace": {
    "slot_id": "jd-0.2",
    "dictionary_ref": "knowledge/jd_dictionary.json",
    "mapping_status": "verified"
  },
  "configuration_side": "world",
  "projection_targets": ["world_config", "harness"],
  "visibility": ["sut_visible", "grader_visible"],
  "observation_channel": ["sut_input", "grader"],
  "value_spec": {
    "mode": "TBD",
    "value": null,
    "unit": null
  },
  "status": "TBD",
  "sources": [
    {
      "source_type": "user|agent|catalog|tree|scenario_registry|metric_set|human",
      "source_ref": "stable-locator",
      "evidence": "optional-exact-user-excerpt",
      "run_ref": "optional-agent-run-id"
    }
  ],
  "edit_history": [],
  "tbd_ref": "tbd-..."
}
```

约束：

- `jd_ref.node_id` 必须存在于当前 V2 实物。
- `canonical_66_trace.slot_id` 非空时只接受 66 目录中的 ID；缺少显式映射时为 `null + TBD`。
- status 为 `TBD` 时，value 必须为 `null`；未确认字段应省略或为 `null`，不能填占位默认值。
- `shared` item 的值只存一次，world/user 通过 `binding_ref` 使用。
- source 和 edit history 对所有自动填充项为必填。

### 2.3 `tbd_register`

统一 TBD 是 package 级对象，不是散落的字符串：

```json
{
  "tbd_id": "tbd-...",
  "artifact_refs": ["task_template#...", "world_config#..."],
  "question": "需要确认的具体问题",
  "reason": "missing_source|conflict|unreviewed_proposal|missing_mapping",
  "blocking": true,
  "owner": "TBD",
  "allowed_resolution_type": "value|reference|mapping|decision",
  "status": "open",
  "resolution": null,
  "sources": [],
  "edit_history": []
}
```

`question` 只能描述待确认问题，不应暗示一个默认答案。

## 3. `task_template` schema

建议在兼容现有 `schemas/task_template.schema.json` 有效概念的前提下升级为新的明确 artifact，而不是继续让 UI 构造非 schema 子集。

### 3.1 顶层字段

```text
schema_version
artifact_type = task_template
task_id / delivery_id / revision
title
human_readable
manifest
tbd_refs
provenance
change_history
```

### 3.2 `human_readable`

固定章节，内容可为 Markdown：

1. `objective`：用户想完成什么；
2. `context`：任务环境和输入背景；
3. `capability_boundary`：已确认 A×L、职责内和职责外；
4. `task_flow`：阶段、触发、允许动作和期望输出；
5. `completion_conditions`：只包含已确认条件；未知阈值明确写 TBD；
6. `exception_flows`：定位异常、感知不确定、通信/Executor 失败等已确认分支；
7. `external_dependencies`：Simulator/Fixture/Harness/Executor/人工决策依赖；
8. `run_constraints`：用户给出的运行约束；
9. `open_tbd`：统一 TBD 的人类可读视图。

章节完整性由 `task_template_backbone.json` 驱动，但 backbone 不提供业务默认值。

### 3.3 `manifest`

```text
source_request
scenario_context
coverage[]                    # A×L，仅责任和等级
responsibility_boundaries
jd_v2_bindings[]              # config_item 或 binding_ref
canonical_66_traces[]         # 兼容/追溯，不覆盖 V2 身份
phases[]
events[]
disturbances[]
interfaces
  sut_inputs[]
  sut_outputs[]
  external_executor[]
  external_decisions[]
  hidden_ground_truth_refs[]  # 只指向 world/GT，不含 payload
completion_conditions[]
exception_flows[]
metrics[]
runtime_dependencies[]
projection_manifest
```

`metrics[]` 应区分：

- metric definition ref；
- candidate threshold；
- active condition；
- authority/review status。

只有已确认 threshold 才能出现在 active completion/safety condition；其他项的 active value 为 `null` 并进入 TBD。

## 4. `world_config` schema

### 4.1 顶层字段

```text
schema_version
artifact_type = world_config
task_ref / delivery_id / revision
adapter_contract
world_assets[]
scene_layout[]
environment[]
disturbances[]
event_injections[]
timeline[]
tunable_variables[]
fixture_contract
harness_contract
hidden_ground_truth
shared_binding_refs[]
tbd_refs[]
provenance
change_history
```

### 4.2 adapter-neutral 原则

`adapter_contract` 只表达能力需求，不编造 API：

```json
{
  "adapter_type": "TBD",
  "api_ref": null,
  "required_capabilities": [],
  "status": "TBD",
  "tbd_ref": "tbd-simulator-adapter"
}
```

如果后续确认具体 Simulator adapter，使用明确来源和版本更新；schema 不内置厂商接口、topic、endpoint 或默认参数。

### 4.3 世界侧分区

- `world_assets`：地图、道路/区域、对象、传感器环境资产引用；
- `scene_layout`：空间布置和约束；
- `environment`：天气、照明、可观测环境条件；
- `disturbances`：对世界或传感链的扰动定义；
- `event_injections`：故障、遮挡、对象事件等注入计划；
- `timeline`：阶段与事件相对关系；未确认绝对时间保持 TBD；
- `tunable_variables`：世界侧可调 canonical JD bindings；
- `fixture_contract`/`harness_contract`：需要提供的能力、输入输出和引用；
- `hidden_ground_truth`：真实对象身份、真实标签、真值状态、真实故障窗口、标准答案等，只供 fixture/grader。

Hidden GT 可存内联 payload，也可用 `ground_truth_ref` 指向独立 artifact；无论哪种方式都不得出现在 user artifact。

## 5. `user_config` schema

### 5.1 顶层字段

```text
schema_version
artifact_type = user_config
task_ref / delivery_id / revision
sut_visible_inputs[]
task_requirements[]
allowed_actions[]
output_contract[]
external_executor_dependencies[]
external_decision_contracts[]
run_constraints[]
observable_world_refs[]
shared_binding_refs[]
tbd_refs[]
provenance
change_history
```

### 5.2 用户侧边界

- `sut_visible_inputs` 描述 SUT 实际可获得的 observation，不描述世界内部真值。
- `observable_world_refs` 只允许指向经过净化的 observation view，并记录对应 world binding 的公开 hash，不含源 payload。
- `allowed_actions` 是接口允许动作，不是 Agent 自行扩张的权限。
- `output_contract` 复用现有 SUT trace/output schema 概念。
- `external_executor_dependencies` 明确“Agent 提议/请求”和“Executor 实际执行”的边界。
- `run_constraints` 只记录用户或权威合同给出的约束；未知安全判据为 TBD。

## 6. 所选 V2 子树、package manifest 和导出

`jd_tree_selection.json` 是 Pipeline 对 JD Version2 的直接交付，至少包含：

```text
source_tree {path, schema_version, catalog_version, sha256}
selection_basis {confirmed_axl, user_confirmations}
selected_nodes[] {
  node_id, parent_id, node_path, owner_a, name, node_kind,
  value_type, value_domain, unit,
  configuration_side, variable_role, projection_targets,
  visibility, observation_channel,
  review_status, evidence_status, derivation_status,
  canonical_66_trace, status, sources, edit_history
}
unresolved_metadata[]
```

字段按 V2 实物原样保留；不存在的字段使用缺失/TBD 状态，不给 V2 回填虚构值。

虽然用户要求三类主产物，仍建议增加轻量 `package_manifest.json`：

```text
package_version
delivery_id
artifacts[] {type, path, revision, sha256}
catalog_refs[] {type, version, path, sha256}
shared_bindings[] {binding_id, owner_artifact, exposed_view_ref, hash}
tbd_register_ref
validation_report_ref
created_at
provenance
```

导出规则：

- 三类主产物可分别复制和下载；
- “完整交付包”下载上述文件；
- 下载前对最终序列化内容重新校验；
- validation 有 error 或 blocking TBD 时，允许下载“草案包”但必须显著标记 `not_executable`；不得伪装为可运行包；
- 是否允许带 blocking TBD 的草案包进入后续 Config Agent，应由显式策略决定，初始建议只允许审阅、不允许执行。

## 7. 确定性投影算法

### 7.1 输入

- 原始自然语言需求；
- 人工确认的 A×L；
- 人工确认的 V2 节点或 V2 受限子树；
- 可用时的 canonical 66 trace；
- 已确认/待确认 value domain；
- 受限 tree slice 中显式锚定的细节点元数据；
- metric set 候选；
- scenario registry 上下文；
- 所有来源和编辑历史。

### 7.2 算法

```text
1. 用冻结的 Version2 实物验证每个 node ID、owner 和 parent path。
2. 保留节点的 V2 原始元数据和审核状态。
3. 若存在 canonical 66 映射则验证；不存在则登记 mapping TBD，不猜测。
4. 根据 variable_role 分类：配置、合同、GT、指标、结构、未知。
5. 使用 projection_targets 建立目标白名单。
6. targets 缺失时，才使用已审核 configuration_side。
7. 用 visibility 和 observation_channel 做安全交叉校验。
8. shared 值写入 shared binding；两侧只引用。
9. world-only 和 hidden 项写入 world/GT 分区。
10. user 项只写入 SUT 可见合同；来自世界的可见内容使用 sanitized view。
11. 所有缺失、冲突、未审阅映射写入统一 TBD。
12. 生成正文、所选 V2 子树和 Manifest，并验证语义引用完整性。
13. 对序列化 artifacts 做全量校验和内容哈希。
```

### 7.3 冲突策略

| 冲突 | 处理 |
|---|---|
| hidden role 但 target 包含 user | error；不投影 user；建立阻断 TBD |
| side=user 但无 `sut_visible` | error；不投影 |
| target 和 side 不一致 | error；不猜测优先级 |
| V2 node 无 canonical anchor | 保留在 `jd_tree_selection`；canonical trace 和自动配置投影进入 TBD |
| 一个 leaf 映射多个 canonical JD | error；等待人工拆分/确认 |
| metric 有数值但无 authority/review | 保留 proposed；active value 为 null |
| shared 两侧值/hash 不一致 | error；阻断导出为 executable |

## 8. 校验器设计

建议将校验分为七组，每组输出 stable code、severity、artifact path、item ref、证据和修复建议：

1. `SCHEMA_*`：三个 schema 和 package schema；
2. `JD_REF_*`：V2 node/path/hash，以及非空 canonical 66 trace；
3. `VISIBILITY_*`：Hidden GT taint、SUT 可见性、观察 view；
4. `PROJECTION_*`：targets/side/role/channel 一致性；
5. `TBD_*`：null、无默认、统一登记、blocking 状态；
6. `PROVENANCE_*`：source/status/edit history；
7. `PACKAGE_*`：shared binding、交叉引用、revision/hash、序列化后复检。

最低阻断条件：

- user artifact 发现任何 Hidden GT 污染；
- V2 node/path 非法，或非空 canonical 66 trace 非法；
- TBD 具有有效值/默认；
- shared binding 不一致；
- artifact 交叉引用或哈希不一致；
- simulator API/安全判据来自无权威推断；
- 必填配置存在冲突且未登记 TBD。

## 9. UI 设计

保留当前前四步的分析和人工修订能力，但把最终步骤改成“交付工作台”：

### 9.1 顶部状态

- 已确认用户需求摘要；
- A×L、canonical JD、catalog 版本；
- validation：error/warning/pass 数量；
- open/blocking TBD 数量；
- delivery revision。

### 9.2 主视图

三个页签或三栏：

1. Task Template：先显示完整自然语言正文，再显示 Manifest；
2. World Config：按资产、场景、扰动、事件、GT、时间线、adapter 分组；
3. User Config：按输入、要求、动作、输出、Executor、约束分组。

每个 item 显示：

- V2 node ID、名称和 parent path；
- canonical 66 trace（可为 TBD）；
- 配置归属；
- visibility/channel；
- source；
- status；
- edit history；
- TBD link。

### 9.3 统一 TBD 面板

支持：

- 按 artifact、owner、blocking、reason 过滤；
- 填写值、来源和修改理由；
- 解决后重新投影并运行全量校验；
- 不提供“Agent 自动补全所有 TBD”；
- Agent 可以提出候选，但候选保持 proposed，人工确认前不生效。

### 9.4 导出

每个主产物提供：

- Copy JSON；
- Download JSON；
- Task Template 额外 Download Markdown；
- 完整 delivery package 下载。

validation 面板必须在导出按钮附近，而不是藏在 Agent 分析日志中。

## 10. 实施顺序

### P0：收敛基线事实

- 冻结 Version2 实物的 path、schema/catalog version 和 hash，不重写团队交付文件；
- 实现与 V2 实物一致的 loader、slice 和非侵入式 projection sidecar；
- 更新旧说明和测试，使它们验证当前 V2 实物，而不是要求 V2 迁就旧 audited 预期；
- 把 `agent_reference_catalog`/canonical 66 降为追溯兼容层并修复错误映射；
- 补齐 `build_jd_tree_domains`/`load_jd_tree_domains`，恢复全量 pytest；
- 拆分或统一 `/api/task-template/generate` 合同；
- 移除默认 A11、默认 SR/CR/SPL 和自动推断 TBD 的生效行为；
- 把 metric set 明确标记为候选、非默认、threshold authority TBD。

第一批已完成其中的 V2 loader、受限 domain/slice API、health/source identity、单任务路由合同统一和对应 HTTP 回归；Agent 提取合同整体迁移到 V2、旧 standalone contract checks 和 metric set 元数据仍留在后续批次。

### P1：schema 与 validator

- 新增/升级 `task_template`；
- 新增 `world_config`、`user_config`；
- 新增 package manifest、validation report、TBD register；
- 实现 V2 reference、canonical trace、taint、TBD、projection、shared binding、provenance 校验；
- 为每类错误建立固定 code 和 fixture。

### P2：单一 delivery builder

- 输入只接受“已确认”的 Pipeline state 和明确 proposed/TBD；
- 先构建统一 binding graph；
- 从 graph 确定性生成三类 artifact；
- instance generator 只在需要具体 run 时解析 domain；
- 不让 world/user Config Agent 重新理解原始自然语言来决定信息边界。

### P3：Pipeline 交付工作台

- 完整自然语言模板；
- 三类 artifact 分栏；
- V2 JD/canonical trace/source/status/side/edit history；
- 统一 TBD；
- validation；
- 分别复制/下载和 package 导出；
- 精简版本迁移、流程展示性说明。

### P4：fixture、回归和文档

- 新增高速巡检验收 fixture；
- API、schema、projection、安全和导出回归；
- 更新根 README、Pipeline 操作说明和 codebase guide；
- 按确认后的 cleanup proposal 迁移/删除重复历史资料。

## 11. 高速巡检端到端验收设计

验收 fixture 应固定一份“已人工确认输入”，而不是在测试中依赖 LLM 每次重新判断。fixture 至少记录：

- 用户原始需求；
- 经过人工确认的 A×L；
- 经过人工确认的 V2 JD 节点；
- 可用或 TBD 的 canonical 66 trace；
- 用户明确给出的值；
- 未给出的阈值、规则、时间和 adapter，保持 TBD；
- 每个确认动作的 source/edit record。

演示输出必须能逐项解释：

| 类别 | 高速巡检示例中的表达原则 |
|---|---|
| 用户需求 | 巡检目标、期望报告、允许动作、异常时需做什么，以原始文本证据为准 |
| 世界侧条件 | 道路/区域资产、场景对象、遮挡或故障事件、时间线、Fixture/Harness 需求 |
| SUT 可见 | 传感/任务输入、可公开事件或状态、任务要求、输出合同 |
| Hidden GT | 真实对象身份、真实标签、真实故障窗口、真值位置/轨迹、标准答案 |
| TBD | 未给出的数值阈值、完成判据、具体 simulator adapter/API、未知业务规则 |

消费方式：

- World-side Config Agent 读取 `world_config`，在选定 adapter 后生成 simulator-specific 配置；未确认 adapter 时只能停在 adapter-neutral/TBD。
- 用户侧 Config Agent 读取 `user_config`，配置 SUT 可见输入、任务接口、动作和输出。
- SUT 不读取 `world_config.hidden_ground_truth`。
- Fixture/Harness/Grader 使用 world/GT 引用和 validation report。
- 人工审阅者以 `task_template.md` 为主，必要时查看 Manifest、TBD 和 provenance。

验收断言：

1. 三个主产物均通过 schema；
2. 所有主 JD node ID 和 parent path 均存在于冻结的 Version2 实物；非空 canonical 66 trace 均有效；
3. user artifact 的 Hidden GT taint 数为 0；
4. shared bindings 的 revision/hash 一致；
5. 所有 TBD 值为 null 且存在统一登记；
6. 未确认 threshold 不处于 active 状态；
7. 三类文件可分别下载，完整包清单和哈希有效；
8. 同一已确认输入和 seed 产生相同 machine artifacts；
9. 修改一个 TBD 后，edit history、revision、受影响投影和 validation 可追踪更新。

## 12. 需要本轮确认的设计决策

进入实现前建议确认：

1. 新 `task_template` 是原 schema 原位升级，还是新增 v2 schema 并保留旧 schema 兼容期；
2. blocking TBD 的 delivery package 是否允许作为 `draft/not_executable` 下载；
3. Hidden GT 默认内联在 world_config，还是一律存独立 `ground_truth.json` 并只保留引用；
4. 文档和 `pipeline-v2` 的迁移/删除范围采用 cleanup proposal 的哪一档。

## 13. 明确不在当前交付范围

- 简诺平台创建 benchmark；
- RoadEye 模型接入或运行；
- DataOS/Avant 数据采集；
- 任意具体 simulator、模型服务或企业平台 API；
- 下游 Grader/Runner 的平台化部署。

当前交付到 adapter-neutral 的 Pipeline、V2 JD 提取、三类合同、校验和导出为止。外部平台信息若未来提供，再作为独立 adapter 项目接入。
