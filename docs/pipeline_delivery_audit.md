# Pipeline 三类交付物审计

> 审计基线：`main@b240d8d`
>
> 审计日期：2026-07-23
>
> 审计范围：Pipeline 前端、Agent/Instance 后端、知识库、schema、examples、tests、docs、根目录说明
>
> 本文只给出审计结论，不实施第二阶段功能，也不把未确认内容写成默认值。
> 范围澄清：`knowledge/jd_variable_tree_version2.json` 是团队交付的当前 JD 树实物和实现基线；Version1 是历史输入。审计发现的文档/测试差异应由适配层、文档和测试对齐 V2 实物，不能反向用旧预期覆盖 V2。
>
> 2026-07-24 复核补充：旧 STEP 6 曾使用 `jd-0.2 / jd-0.3 / jd-0.4 /
> jd-0.9` 的固定语义分组，属于旧全局合同的兼容路径。当前 Pipeline 已在
> `include_global=false` 的选择清单下停用该分组，只按团队 V2 实物的配置侧、
> 投影目标、可见性与观测通道确定归属；V2 未提供的世界资产/布置/扰动分类保持 TBD。

## 1. 结论摘要

当前 Pipeline 的最终产物不是可直接交给两侧 Config Agent 的交付包，而是：

1. 一份供编辑的轻量 `domain_template`；
2. 基于 seed 从 value domain 采样得到的 `task_instance`，或另一条 HTTP 分支返回的简化 `task`；
3. 页面上的简短“具体任务模板”摘要，以及按硬编码 JD 集合分组的世界侧/用户侧表格。

这些对象没有形成三个独立、可校验、可分别导出的合同。尤其缺少：

- 完整、可审阅的自然语言 Task Template；
- 与自然语言正文一致的机器 Manifest；
- adapter-neutral 的 `world_config`；
- 只含 SUT 可见信息的 `user_config`；
- Hidden GT 污染追踪和序列化后防泄漏校验；
- canonical 66 JD 的强制引用校验；
- 统一 TBD 登记表；
- 自动填充来源、状态和人工修改历史；
- 配置间稳定引用、版本和内容哈希；
- 复制、单独下载和完整包下载。

此外，基线中存在三项必须由 Pipeline 适配和校验层处理的事实性不一致：

1. `knowledge/jd_dictionary.json` 是 66 个 canonical JD，但 `knowledge/agent_reference_catalog.json` 实际含 78 个 JD，尽管它声明自己是 `66JD`。
2. `knowledge/jd_variable_tree_version2.json` 实际为 schema `2.3`、catalog `2.4.0-merged`；说明文档和部分校验脚本期待的是另一种 audited 形态。V2 实物优先，旧说明/测试不能据此要求重写实物。
3. `/api/task-template/generate` 在 `server.py` 中有两个处理分支；前一个分支会截获请求并返回 `task`，使后一个期望返回 `task_template`/`instance` 的确定性生成分支不可达。正常单 seed UI 路径因此无法按前端预期取得产物。

第二阶段不应直接在现有 Step 5 上继续叠加展示逻辑。应先冻结 V2 实物读取合同、生成合同和校验边界，再由同一个交付构建器生成三个投影和一份所选 V2 子树清单。

RoadEye、简诺、DataOS/Avant 均不是本仓库已确认的交付对象或可访问依赖。它们不能进入实现验收，只能在未来作为 adapter-neutral 的下游接入方；未知接口保持 TBD。

## 2. 当前 Pipeline 实际生成了什么

### 2.1 当前五步流

| 步骤 | 当前输入/动作 | 当前状态或产物 | 是否为最终合同 |
|---|---|---|---|
| 1 | 自然语言任务、业务场景 | `sourceTask`、场景选择 | 否，属于输入 |
| 2 | Agent 扩写、A×L 选择 | narrative、coverage、依赖、边界 | 可复用的审阅材料 |
| 3 | Agent 提取 JD | JD candidates、status、source note | 可复用的候选和证据 |
| 4 | 人工编辑 value domain | fixed/enum/range/TBD 的轻量 `domain_template` | 内部编排模型，不是最终交付 |
| 5 | seed、batch、traverse | `task_instance` 或简化 `task`，加页面摘要 | 不是三类可消费合同 |

主要证据：

- `pipeline/js/state.js` 只保存 Agent 结果、domain edits、metrics、instances 等工作状态，没有 delivery bundle、统一 TBD、变更历史或三类产物。
- `pipeline/js/steps.js` 的 `buildDomainTemplate()` 生成 title、narrative、coverage、dependencies、`jd_slots` 等轻量对象，但会把每个 JD 的 `visibility` 固定写为 `sut_visible`。
- `pipeline/js/steps.js` 的 `buildSpecificTemplateDescription()` 只形成概述文本；没有完整任务目标、能力边界、完成条件、异常流程、外部依赖、TBD 和与正文一一对应的 Manifest。
- 页面没有三个独立产物的 copy/download/package export，也没有可阻断导出的确定性校验。
- `pipeline/js/constants.js` 的 `WORLD_SIDE_JD` 和 `pipeline/js/jd.js` 的 `jdSide()` 通过硬编码 JD 集合区分两侧，没有使用 Version2 的角色、投影、可见性和观察通道。

### 2.2 单任务生成存在返回合同冲突

`src/uav_benchmark/agent/server.py` 对 `/api/task-template/generate` 有两个 POST 分支：

- 前置专用分支读取 `ability`、`seed`、`template`，返回 `{"task": ...}`；
- 后置通用分支预期读取 `domain_template`，调用确定性 instance generator，并返回 `task_template`/`instance`。

前置分支总会先匹配，后置分支对该路径不可达。普通 UI 的 `genTaskTemplate()` 发送 `domain_template`，但读取 `d.task_template || d.instance`，与实际前置返回不一致。批量/遍历走其他路径，所以不能用它们的成功掩盖单任务合同问题。

这也是当前“最终到底生成什么”不清晰的直接原因之一：同名路由表达了两个不同概念。

### 2.3 为什么不能直接交给世界侧和用户侧 Config Agent

| 缺口 | 对世界侧的影响 | 对用户侧/SUT 的影响 |
|---|---|---|
| 没有正式 `world_config` | 资产、场景、扰动、事件、时间线、Hidden GT 无稳定字段 | 无法建立可观察视图与世界真值之间的隔离关系 |
| 没有正式 `user_config` | 无法明确世界应公开哪些观察合同 | SUT 输入、任务要求、允许动作、输出合同和 Executor 依赖混在描述中 |
| 硬编码两侧归属 | 无法表达 shared 和 sanitized view | 可能把仅 grader/fixture 可见项错误投影给 SUT |
| 所有 JD 标为 `sut_visible` | Hidden GT 无法安全保存 | 形成直接泄漏风险 |
| 没有统一 TBD | 未知 simulator adapter、阈值和规则无法显式阻断 | Agent 可能把猜测当成可执行输入 |
| 没有来源/状态/历史合同 | 无法判断自动生成值是否可执行 | 人工修改无法审计和回滚 |
| 没有 canonical 校验 | proposed tree ID 可能冒充 canonical JD | SUT 配置和模板之间无法稳定对齐 |
| 没有内容哈希和共享绑定 | 世界与用户侧可能各自修改同一事实 | 两侧虽“看起来一致”但运行时语义漂移 |

## 3. 五类现有概念的职责关系

### 3.1 当前职责

| 概念 | 当前实现职责 | 当前问题 |
|---|---|---|
| Task Template | schema/离线 compiler 中是较完整的任务合同；UI 中又被用来称呼 seed 产物或简短摘要 | 同名对象语义不一致 |
| Domain Template | 表示 canonical/候选 JD 的 fixed/enum/range/TBD 值域 | 适合内部 authoring，不具备两侧隔离合同 |
| Task Instance | 按 seed 解析 domain、生成 slot bindings、schedule、fixture refs | 是运行实例，不是面向人的完整 Task Template |
| metric set | 每个能力的候选质量指标、协议或参数 | 当前数值缺少明确 authority/review/default 元数据，不能直接生效 |
| tree slice API | 返回能力相关 Version2 子树和 metric set | V2 应成为当前 JD 提取主数据；当前前端尚未实际消费，也没有稳定的所选子树交付物 |

### 3.2 推荐职责

```text
自然语言需求 + 已确认 A×L/JD
        │
        ▼
Task Template（人类正文 + 机器 Manifest，交付主合同）
        │
        ├── Domain Template（内部编辑和值域模型）
        │          │
        │          ▼
        │     Task Instance（seed 后的确定性运行绑定）
        │
        ├── world_config（世界/Fixture/Harness 投影）
        └── user_config（SUT/用户侧接口投影）

metric set：为 Manifest 提供“候选指标定义”，不提供未经确认的生效阈值
tree slice：从当前 V2 实物中提取已选能力/节点的受限子树、角色、状态和来源
```

具体约束：

- Task Template 是交付语义的唯一主入口；正文与 Manifest 必须互相引用、同步校验。
- Domain Template 保留为内部 authoring model，不直接暴露为世界侧或用户侧合同。
- Task Instance 保留为一次具体运行的解析结果，可作为 bundle 内部 `run_plan`，不能替代 Task Template。
- metric set 只提供指标候选、类型、协议候选和来源。阈值只有在 `status=verified` 且具有明确来源时才可进入生效条件；否则必须保持 `TBD`/`null`。
- tree slice API 只服务于已确认的能力和 V2 节点选择。不得默认把完整 444 节点交给 Agent；输出必须保留 V2 node ID、parent path、tree version、review/evidence status，以及可用时的 canonical 66 追溯。

## 4. 可直接复用与需要重构的内容

### 4.1 可直接复用

| 来源 | 可复用内容 | 复用方式 |
|---|---|---|
| `schemas/task_template.schema.json` | coverage、责任边界、runtime dependencies、phases、disturbances、interfaces、metrics、provenance | 作为新 Manifest 的结构基础 |
| `schemas/task_instance.schema.json` | slot bindings、timebase、schedules、fixture refs | 作为可选 `run_plan`/instance artifact |
| `schemas/ground_truth.schema.json` | grader-only GT 边界 | 作为 `world_config.hidden_ground_truth` 的外部运行时引用合同 |
| Config Agent models | candidate status、source note、evidence quote、open questions、warnings、run/provider/model provenance | 统一到 config item provenance 和 TBD register |
| `knowledge/jd_dictionary.json` | 66 个 canonical JD ID、名称、scope、能力归属 | 唯一 canonical JD 集合 |
| `knowledge/task_template_backbone.json` | 七段完整性骨架、TBD/不编造规则 | 生成人类正文和完整性校验 |
| `knowledge/business_scenario_registry.json` | 场景上下文、模块和依赖候选 | 仅作为带来源的上下文 seed，不作为业务规则权威 |
| instance generator | seed 确定性、值域解析、slot binding | 在所有输入确认后生成 run plan |
| 当前人工修订 UI | A×L、JD、domain 的人工确认入口 | 升级为可追踪的修改操作 |

### 4.2 必须重构

| 当前内容 | 必须重构的原因 |
|---|---|
| `WORLD_SIDE_JD`/`jdSide()` | 硬编码无法表达角色、共享绑定、可见视图和 Hidden GT |
| `buildDomainTemplate()` 的统一 `sut_visible` | 违反信息隔离；必须由经审计元数据确定 |
| `/api/task-template/generate` 双分支 | 同一路由返回两种合同；必须拆分或统一 |
| `fillTbdDomains()` 和“优先推断、不留 TBD”的 prompt | 与“不编造、未知保持 TBD”冲突 |
| `generateFullTaskTemplate()` 的默认 A11 和默认 SR/CR/SPL | 能力与评分条件均不得在未确认时默认生效 |
| `/api/jd-tree/domains` 的 leaf ID 直接索引 | Version2 局部细节点普遍没有 canonical 映射，不能靠字符串前缀猜测 |
| `/api/jd-tree/slice` 的宽返回 | 需要限定已确认能力/canonical IDs、字段和节点数量，并标注 proposed/authority |
| instance 的弱 validation audit | 需要 canonical、泄漏、TBD、共享一致性和 provenance 验证 |
| examples 中非 canonical `jd_slots` | custom profile 必须移出 canonical JD 字段，或显式映射到有效 66 ID |
| metric set 数值直接进入 quality/protocol | 缺少审核元数据，不得作为默认条件或安全阈值 |

## 5. 知识库一致性审计

### 5.1 canonical 66 与运行时 78 的冲突

`knowledge/jd_dictionary.json` 当前确有 66 个 canonical 槽位：10 个全局槽位、56 个能力局部槽位。尾部编号符合本轮约束：

- A15：审计日志；
- A16：合规申报；
- A17：安全包络。

但 `knowledge/agent_reference_catalog.json`：

- 声明 scope/catalog 为 `66JD`；
- `counts.jd_fields` 和实际 `jd_fields` 长度却是 78；
- 包含 17 个能力各 4 个槽位的 proposed tree 风格条目；
- 相比 canonical dictionary 多出一批 `.4`/局部槽位，同时缺少 canonical `jd-4.5`、`jd-16.5`。

`knowledge/catalog_build_report.json` 又报告 66 且通过，说明运行时 catalog 与构建报告/源文件不是同一生成状态。Agent validator 当前按这个 78 槽位 catalog 校验，所以“通过 Agent 校验”不等于“是有效 canonical 66 JD”。

> 第三批实施更新：运行时 loader 现保留 Agent catalog 中的 17A/68 A×L，
> 但将其中不一致的 78 行 `jd_fields` 替换为
> `knowledge/jd_dictionary.json` 的 canonical 66 槽。STEP 3 追溯、Agent
> 校验、三类交付校验和页面计数因此使用同一个 canonical 集合；团队交付的
> JD 业务变量树实物不被重写。

更深一层的不一致是：`scripts/build_knowledge_catalog.py` 声明两个根 Markdown 为构建源，但这两个 Markdown 的机读 YAML 和人类表格仍采用旧尾部语义（A15 合规、A16 安全、A17 审计）；当前三个 knowledge JSON 则采用本轮确认的新语义（A15 审计、A16 合规、A17 安全）。builder 目前校验 ID 顺序和 group，却没有校验能力名称/语义，所以源、报告和运行时 JSON 可以各自“看似有效”而互相矛盾。

结论：JD 提取必须以 Version2 实物中的 node ID 和层级关系为主；`knowledge/jd_dictionary.json` 的 66 槽位保留为 legacy/canonical trace 目录。存在明确映射时必须验证映射有效；没有映射时标记 `mapping_status=TBD`，不能通过字符串截断猜测，也不能使用 Agent catalog 的 78 条伪造映射。

### 5.2 JD Version2 的实际状态

实际 `knowledge/jd_variable_tree_version2.json`：

- `schema_version = 2.3`；
- `catalog_version = 2.4.0-merged`；
- 444 个节点，其中 317 个 variable leaf；
- `sources = []`，无 counts、audit metadata；
- 仅少量全局 `PROPOSED-jd-0.*` 细节点具有显式 canonical anchor；
- 大多数能力局部细节点没有 `canonical_slot`/`canonical_jd_refs`，也缺少用于确定性投影的角色元数据。

而合并说明、merge script、validator 和 `tests/test_jd_tree_domains.py` 期待的是另一种 audited 2.4 形态。根据最新范围澄清，这些差异说明说明文档、adapter 和测试已经落后于团队交付实物，不表示应当把 V2 改回旧预期。

因此：

- Version2 是当前 JD 树的主数据和节点身份来源；
- Pipeline 应原样读取其 schema/version/node metadata，不在加载时改写实物；
- 66 槽位只作为追溯/兼容索引，不覆盖 V2 的节点名称和层级；
- 没有显式 canonical anchor 的节点仍可被选择和导出为 V2 节点，但 canonical mapping 必须显示为 TBD；
- 缺少 `variable_role`、`projection_targets`、`visibility` 等元数据时，允许进入“所选 V2 子树”，但不能被静默投影为 world/user 配置值；
- 这些节点必须进入待确认清单，由人工补充配置归属/可见性，或由团队提供后续 V2 元数据；
- Agent 仍只接收与已确认 A×L/节点相关的受限 slice，不自由探索完整 444 节点。

### 5.3 A×L 与 JD 的边界

A×L 表示 Agent 责任和等级，只能进入：

- `coverage`；
- `responsibility_boundaries`；
- 能力相关的候选 JD/metric 查询范围。

A×L 不得：

- 作为 JD 的值域；
- 生成 fixed/enum/range；
- 决定 Hidden GT 的具体值；
- 作为 simulator 参数；
- 替代 V2 node ID 或 canonical trace。

### 5.4 metric set 的权威性

17 个 metric set 文件都存在，但当前数值条目没有统一的：

- `authority_status`;
- `review_status`;
- `applies_by_default`;
- `threshold_authority`.

其中包含具体数值范围或阈值候选。它们可以作为候选指标资料，但在缺少审核状态时：

- 不得自动成为完成条件；
- 不得自动成为安全判据；
- 不得作为默认评分开关；
- 不得从 metric value 反向写入 JD 值域；
- 必须以 `proposed`/`TBD` 状态进入人工确认。

## 6. 推荐的三类 schema

详细字段和实现顺序见 `docs/pipeline_delivery_plan.md`。核心形态如下。

### 6.1 `task_template`

同时包含：

- `human_readable`：任务目标、上下文、能力边界、任务过程、完成条件、异常流程、外部依赖、运行约束、TBD；
- `manifest`：coverage、canonical JD bindings、责任边界、phases/events、接口、metric refs、依赖、provenance；
- `tbd_refs`：指向统一 TBD register；
- `change_history`：自动生成和人工修改记录。

它是面向人审阅的主合同，不是 Agent 分析过程，也不是 seed 后的 instance。

### 6.2 `world_config`

adapter-neutral，至少包含：

- world assets；
- scene layout；
- environment/disturbances；
- event injections；
- timeline；
- world-side tunable variables；
- fixture/harness contracts；
- Hidden GT definitions/references；
- simulator adapter 状态；未确认时为 `TBD` 且 API 引用为 `null`。

### 6.3 `user_config`

只包含 SUT/用户侧可消费内容：

- SUT-visible inputs 和观察合同；
- task requirements；
- allowed actions；
- output contract；
- external Executor dependencies；
- run constraints；
- 可公开的 world observation references。

禁止出现真实故障标签、真实对象身份、标准答案、真实事件窗口、真值位姿等 Hidden GT。

### 6.4 统一配置项

三类产物中的每个机器配置项应使用同一个审计外壳：

```json
{
  "item_id": "stable-id",
  "jd_ref": {
    "tree_version": "version-recorded-from-v2",
    "node_id": "jd-x.y.z",
    "node_path": [],
    "review_status": "recorded-from-v2"
  },
  "canonical_66_trace": {
    "slot_id": null,
    "mapping_status": "TBD"
  },
  "configuration_side": "world|user|shared",
  "projection_targets": [],
  "visibility": [],
  "observation_channel": [],
  "value_spec": {
    "mode": "fixed|enum|range|reference|TBD",
    "value": null
  },
  "status": "given|proposed|verified|TBD",
  "sources": [],
  "edit_history": []
}
```

这只是字段形态，不是实例默认值。若 `status=TBD`，`value` 必须是 `null`，且不能存在隐式 default、min/max 或 fallback。

## 7. Version2 元数据到两侧配置的确定性映射

映射必须是“V2 节点有效性 → canonical trace → role → targets → side → visibility/channel 交叉校验”的顺序，而不是把任意一个字段单独当作真相。

### 7.1 V2 节点和 canonical trace gate

1. 所选 `jd_ref.node_id` 必须真实存在于当前 Version2 文件，并记录从 capability root 到节点的 parent path。
2. `canonical_slot` 或 `canonical_jd_refs` 若存在，必须精确命中 `jd_dictionary.json` 的 66 个 ID。
3. 一个 leaf 若没有显式 canonical anchor，不能通过 `jd-6.1.1 → jd-6.1` 之类字符串截断来猜测；`canonical_66_trace.slot_id=null`，状态为 TBD。
4. 多个 canonical refs 可作为结构组的追溯范围；配置 leaf 若需要唯一 legacy 映射但当前没有，只能登记 mapping TBD。
5. `PROPOSED-*` 是合法的 V2 node ID 时可以作为 V2 节点导出，但不得伪装成 canonical 66 slot。

### 7.2 角色和投影

| `variable_role` | 确定性处理 |
|---|---|
| `hidden_ground_truth` | 仅投影到 `world_config.hidden_ground_truth` 或外部 GT 引用；禁止进入 user/SUT |
| `configuration_input` | 按 `projection_targets` 和 `configuration_side` 投影，再做 visibility/channel 校验 |
| `contract_schema` | 投影为接口/合同结构，不当作具体运行值 |
| `derived_metric` | 进入 metric/grader 定义，不当作 world/user 配置默认值 |
| `structural_group` | 只组织节点，不生成配置值 |
| 缺失/未知 | 不投影，登记 mapping TBD |

`projection_targets` 是明确的目标白名单：

- `world_config`、`harness`：允许世界侧；
- `user_config`、`sut_input`：只有在 SUT 可见性成立时才允许用户侧；
- targets 缺失时才允许使用已审核的 `configuration_side` 作为 fallback；
- targets 与 side 冲突时失败关闭，不自动修复。

`configuration_side` 的含义：

- `world`：仅世界侧；
- `user`：仅用户侧，但仍须通过 visibility/channel；
- `shared`：创建一个稳定 shared binding。两侧引用同一 binding/version/hash，不能复制成两个可独立编辑的值。

### 7.3 可见性和观察通道

- 包含 `hidden_gt`、`fixture_only`、`grader_only` 且不含 `sut_visible` 的项，禁止进入 `user_config`。
- `grader_visible` 本身不等于 SUT 可见。
- `sut_visible` 是用户侧投影的必要条件，但不是充分条件；仍需 role 和 channel 允许。
- `observation_channel` 为 `sut_input` 时，可在 user 侧表达“可观察视图”；若源值属于 world/GT，user 侧只能引用经过净化的 observation contract，不能复制源 payload。
- `harness`、`fixture`、`grader`、`hidden_gt` 通道只允许世界/评测侧。
- 任意冲突都产生阻断性 validation issue 和统一 TBD，不得把敏感项降级为普通 user item。

### 7.4 当前 Version2 的限制

上述规则是目标确定性规则，但当前 Version2 只有一部分节点具备所需五类元数据和 canonical anchor。第二阶段应为 V2 实物增加非侵入式 projection sidecar/runtime index；在此之前：

- 所有选择都以真实 V2 node ID 导出；
- 只对元数据充分且通过校验的节点执行 world/user 自动投影；
- 其余细节点保留在所选 V2 子树，并进入归属/可见性 TBD；
- API 只返回用户已确认能力/canonical JD 的受限 slice；
- 不开放 Agent 自由遍历 444 节点。

## 8. 必须实现的确定性校验

### 8.1 Hidden GT 防泄漏

- 从源节点开始建立 sensitivity/lineage 标记，派生项继承最严格标记。
- 对结构化对象和最终序列化 JSON 都做校验；不能只检查字段名。
- `user_config` 中禁止出现 Hidden GT 的 item ID、payload、真实标签、真实对象 ID、答案、真值时间窗、真值位置或可逆别名。
- 合法公开必须通过独立 sanitized observation item；该 item 只引用观察合同，不引用 Hidden GT 容器。

### 8.2 TBD 不成为默认值

- `status=TBD` 时 `value=null`，且不允许 `default`、非空 enum、min/max、fallback 或启用标记。
- 未审核 metric threshold 保持 `proposed`/`TBD`，不能进入 active completion/safety rule。
- 每个 artifact 的 TBD 必须恰好对应统一 `tbd_register` 中的一项；反向也必须无孤儿。
- simulator API、业务规则和安全判据若无来源，必须保留为 TBD。

### 8.3 V2 JD 和 canonical trace 有效性

- 所有 `jd_ref.node_id` 必须存在于冻结的 Version2 实物，parent path 必须可重建。
- `canonical_66_trace.slot_id` 非空时必须精确属于 `jd_dictionary.json` 的 66 ID 集合。
- 映射缺失时使用 `null + TBD`，禁止通过 ID 前缀自动补齐。
- 禁止把 V2 leaf/proposed ID 写入 canonical 66 字段。
- catalog 版本、内容哈希和生成来源必须随交付包记录。

### 8.4 两侧一致但隔离

- shared item 通过 binding ID 和内容哈希对齐；两侧不能各自保存独立可编辑值。
- world 的 SUT-visible 条件通过 observation view 暴露；Hidden GT 保持在 world/GT 分区。
- 两侧必须引用相同 task/delivery/catalog version。
- export 后重新验证，避免 UI 内存对象安全但下载 JSON 泄漏。

### 8.5 来源、状态和人工修改

- 自动填充项必须含 source、generator run、status 和生成时间。
- Agent 推断只能是 `proposed`，不能伪装为 `given`/`verified`。
- 人工修改追加 immutable edit record：actor、时间、修改前后摘要/哈希、理由和 source note。
- 不能覆盖旧 provenance 来制造“原始输入”的假象。

## 9. 测试现状

在基线执行：

```text
.venv/bin/python -m pytest -q
```

测试在收集阶段失败：`tests/test_jd_tree_domains.py` 从 `src/uav_benchmark/agent/catalog.py` 导入不存在的 `build_jd_tree_domains`、`load_jd_tree_domains`。

排除该文件后：

```text
.venv/bin/python -m pytest -q --ignore=tests/test_jd_tree_domains.py
66 passed
```

这说明现有 schema/compiler/agent 等测试大体稳定，但 JD tree integration 在当前 main 上是不完整的。现有测试还没有覆盖：

- 单任务 HTTP 路由返回合同；
- 三产物 delivery bundle；
- V2 node/path 强校验和 canonical 66 trace 校验；
- Hidden GT 污染传播与序列化泄漏；
- shared binding 一致性；
- TBD register 完整性；
- provenance/edit history；
- 三类导出；
- 高速巡检端到端验收。

> 第一批实施更新：V2 loader、domain/slice API 和单任务路由合同已补齐；新增 HTTP 回归后，分支 `codex/v2-delivery-foundation` 的完整 pytest 结果为 `78 passed`。上述收集失败保留为 `main@b240d8d` 的基线审计事实。另有一个不被 pytest 自动收集的旧版 `tests/agent_contract_checks.py`：32 项中 4 项仍按 Version1/66 名称和数量断言而失败，应在下一批把 Agent 提取合同切换到 V2 时迁移，不能据此反向修改 V2 实物。

## 10. 审计判断

第一阶段设计可以继续，但第二阶段实现应以下列顺序开始：

1. 冻结 Version2 实物为读取基线，修复 loader、sidecar、测试、说明和 HTTP 合同的不一致；
2. 定义三类 schema、共享 item/provenance/TBD 模型和 package manifest；
3. 实现单一 delivery builder 及确定性投影/校验；
4. 再改 Pipeline 最终步骤和导出；
5. 最后以高速巡检 fixture 做端到端回归。

在上述基础事实未收敛前直接改 UI，会把当前的语义冲突固化到新交付格式中。
