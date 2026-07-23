# 文档与重复产物清理提案

> 状态：仅提案，等待确认。
>
> 本轮不会批量删除、迁移或重命名任何现有文件。
> 原则：权威资料唯一、现行操作入口清晰、历史记录可追溯、生成产物可再生、研究草案不冒充现行合同。

## 1. 分类标准

| 分类 | 定义 | 处理原则 |
|---|---|---|
| 权威资料 | 决定 A×L、canonical JD 或强制合同规则的唯一来源 | 保留稳定路径；修复内部自相矛盾；禁止平行真相 |
| 现行工程说明 | 描述当前可操作系统、API、测试、Pipeline | 保留并随实现更新 |
| 历史资料 | 已执行迁移、旧编号、旧版本审计 | 移入 `docs/archive/`，默认目录不展示 |
| 研究/提案 | 未确认设计、场景探索、外部架构设想 | 移入 `docs/research/`，显著标注 non-authoritative |
| 生成产物 | 可由脚本重建的 HTML、catalog、report、case output | 归档到 `docs/generated/`/`examples/generated/` 或停止跟踪 |
| 重复内容 | 同一说明或同一页面的副本 | 保留唯一入口，确认后删除副本 |

## 2. 拟保留在现有位置

### 2.1 权威与机器目录

| 文件 | 处理 | 理由 |
|---|---|---|
| `AxL责任定义字典_17A_68单元_机读版.md` | 保留并整体修复 | 它是 catalog builder 当前声明的人类可审阅 source，但机读块和人类表格的尾部能力仍为旧语义，当前不能原样视为新编号 authority |
| `JD业务变量字典_66槽位_机读版.md` | 保留并整体修复 | 它是 catalog builder 当前声明的 JD source，但机读块和人类表格仍把尾部槽位分配给旧 A15/A16/A17，必须与当前 canonical 66 JSON 收敛 |
| `knowledge/jd_dictionary.json` | 保留并降为追溯/兼容目录 | 当前 JD 主数据改以团队交付的 Version2 实物为准；66 目录用于验证已有 legacy/canonical trace |
| `knowledge/axl_responsibility_catalog.json` | 保留并规范排序/校验 | 机器 A×L 目录，语义已是 A15 审计、A16 合规、A17 安全 |
| `knowledge/task_template_backbone.json` | 保留 | 完整 Task Template 的结构和不编造/TBD 规则 |
| `knowledge/business_scenario_registry.json` | 保留并标明“上下文候选” | 可作场景 seed，但不是规则或阈值 authority |
| `knowledge/jd_variable_tree_version2.json` | 原样保留 | 团队交付的当前 JD 树实物和 Pipeline 读取基线；不因旧说明/测试差异而重写 |

### 2.2 现行工程说明

| 文件 | 处理 | 理由 |
|---|---|---|
| `README.md` | 保留，第二阶段更新 | 根入口；需改为三类交付物和新验收流 |
| `docs/README.md` | 保留并重建索引 | 应只链接权威、现行操作、研究和 archive 分类入口 |
| `docs/codebase_guide.md` | 保留并更新 | 工程结构仍有价值；当前 final deliverable、路由和 66/78 状态描述需修正 |
| `docs/pipeline_ui_walkthrough.md` | 保留为唯一 Pipeline 操作说明 | 与 quickstart 合并后承载端到端操作 |
| `docs/how_to_create_case_template.md` | 保留并更新术语 | 离线 compiler 流程仍有用，但须区分 Task Template、Domain Template、Task Instance |
| `pipeline/README.md` | 保留并更新 | Pipeline 局部运行说明 |
| `docs/pipeline_delivery_audit.md` | 保留 | 本轮事实审计 |
| `docs/pipeline_delivery_plan.md` | 保留 | 待确认设计和实施计划 |
| `docs/document_cleanup_proposal.md` | 保留 | 清理决策记录 |

### 2.3 schema 与合同示例

| 路径 | 处理 | 理由 |
|---|---|---|
| `schemas/` | 保留并演进 | 现有任务/实例/GT/trace/grader 合同可复用 |
| `examples/contracts/` | 保留 | 作为 schema 正反例；需补三类产物和隔离用例 |
| `examples/intake/` | 保留并标注输入性质 | 人工输入/提案 fixture，不是生成结果或业务默认 |

## 3. 拟迁移并保留

以下迁移只在确认后执行，并同步修复链接。

### 3.1 历史迁移记录

| 当前文件 | 建议位置 | 理由 |
|---|---|---|
| `docs/migration/ability_renumbering.md` | `docs/archive/migrations/ability_renumbering.md` | 已完成的尾部能力编号迁移，不应占用现行操作入口 |
| `docs/update_notice_ga_renumbering.md` | `docs/archive/migrations/update_notice_ga_renumbering.md` | draft/plan 性通知已执行；保留审计即可 |

### 3.2 JD Version1 审计资料

建议把 `docs/jd-variable-tree/` 下 Version1 或 Version2 合并前的审计资料迁移到：

```text
docs/archive/jd-tree/version1/
```

| 当前文件 | 建议子目录 | 理由 |
|---|---|---|
| `docs/jd-variable-tree/JD业务变量树_version1_待确认问题与暂定方案.md` | `docs/archive/jd-tree/version1/` | Version1 待确认记录 |
| `docs/jd-variable-tree/JD业务变量树_version1_本轮更正审计.md` | `docs/archive/jd-tree/version1/` | Version1 更正审计 |
| `docs/jd-variable-tree/JD业务变量树_version1_详细度审计与扩展蓝图.md` | `docs/archive/jd-tree/version1/` | Version1 详细度和扩展蓝图 |
| `docs/jd-variable-tree/JD业务变量树_A1-A17_逐能力层级修订审计与待确认.md` | `docs/archive/jd-tree/pre-version2/` | Version2 合并前的逐能力修订记录，不是现行操作合同 |

理由：这些文件有 provenance 价值，但不应与当前 Version2 实物操作说明并列。

### 3.3 研究和 proposed tree 设计

| 当前文件/目录 | 建议位置 | 理由 |
|---|---|---|
| `docs/jd_4layer_pattern.md` | `docs/research/jd-tree/jd_4layer_pattern.md` | 描述 17×4/78 proposed tree，不是 canonical 66；尾部编号也有旧语义 |
| `docs/jd_variable_catalog_v2.md` | `docs/research/jd-tree/jd_variable_catalog_v2.md` | proposed 4-layer 目录，不应称作 canonical |
| `docs/variable_tree_case_task.md` | `docs/research/jd-tree/variable_tree_case_task.md` | 旧三层概念和 seed“Task Template”术语与新交付定义冲突，且含示例数值 |
| `docs/g1/` | `docs/research/g1/` | 独立的用户模拟/架构研究，引用仓库外实现，不属于当前操作说明 |
| `metric.md` | `docs/research/metrics/metric_proposal.md` | metric 设计提案，不是阈值 authority |
| `docs/jd-variable-tree/JD业务变量树_高速巡检_legacy_v0.1_阶段一结构草案.md` | `docs/archive/cases/high_speed_inspection/` | legacy 场景草案 |
| `docs/jd-variable-tree/JD业务变量树_legacy_inspection_source_机读版.md` | `docs/archive/cases/high_speed_inspection/` | legacy 机读输入 |
| `docs/jd-variable-tree/需求草案-v0.6.md` | `docs/research/cases/white_wall_v0_6.md` 或在去重后归档 | 与根 `白墙.md` 大量重复 |
| `白墙.md` | `docs/research/cases/white_wall_v0_6.md` 或保留为唯一源 | 两份白墙草案应只保留一个规范副本 |

对于 `白墙.md` 与 `docs/jd-variable-tree/需求草案-v0.6.md`，迁移前先做内容归并：保留信息更完整的一份，另一份进入删除清单，并在 archive 留下来源说明。

### 3.4 模板/案例参考

| 当前路径 | 建议位置 | 理由 |
|---|---|---|
| `templates/模版一_城市高楼峡谷违停车辆巡检.md` | `examples/reference/task_templates/` | 案例/评审参考，不是系统 authority |
| `templates/模版二_油田管廊缺陷巡检.md` | `examples/reference/task_templates/` | 案例/评审参考；其章节可为新自然语言模板提供结构参考 |
| case2 等 compiler 输出 | `examples/generated/` | 明确区分输入、手写合同和生成产物 |

## 4. 拟作为生成产物管理

| 当前文件 | 建议 | 理由 |
|---|---|---|
| `JD业务变量树_version1.html` | 移到 `docs/generated/jd-tree/` 或不再跟踪 | 可由脚本生成的旧版 HTML |
| `JD业务变量树_version2.html` | 移到 `docs/generated/jd-tree/` | 可再生可视化，不是源数据 |
| `knowledge/catalog_build_report.json` | 保留为 CI artifact 或移到 generated | 它是构建报告；当前与运行时 catalog 不一致，不能当 authority |
| draft/legacy tree JSON | 移到 `examples/generated/` 或 `docs/archive/jd-tree/` | 避免与 current Version2 并列 |
| `docs/assets/` 中仅服务历史文档的图 | 随对应历史/研究文档迁移 | 保证引用完整，同时减少现行目录噪声 |

生成产物是否继续跟踪取决于发布需要。若继续跟踪，CI 应重建并对 git diff 为零；否则把构建命令写入现行 README。

## 5. 拟删除的重复内容

删除必须在迁移、链接修复和用户确认后执行。

| 文件/目录 | 拟删除理由 | 删除前检查 |
|---|---|---|
| `pipeline-v2.html` | 当前 `pipeline.html` 的过期副本，未发现现行入口引用 | 确认没有外部部署仍指向该文件 |
| `pipeline-v2/` | 与 `pipeline/` 大量重复，且当前功能落后 | 对差异做最终清单，确认没有独有有效功能 |
| `docs/config_agent_quickstart.md` | 与 `docs/pipeline_ui_walkthrough.md` 重复 | 把独有命令/提示合并到唯一操作说明 |
| 两份白墙草案中的重复副本 | 内容大量重复 | 先完成规范副本和来源记录 |
| 迁移后确认无发布用途的旧 HTML | 可重建且造成版本混淆 | 验证构建脚本和发布流程 |

当前不建议直接删除任何 Version1 审计、迁移记录或研究文档；它们应先归档，再根据仓库体积和合规要求决定保留周期。

## 6. 需要修正而非删除的冲突

### 6.1 权威 Markdown 的双重真相

两个根 Markdown 目前并不是“机读块正确、附录错误”这么简单：它们的机读 YAML 和人类可读表格都仍使用旧尾部语义；与此同时，当前 `knowledge/jd_dictionary.json`、`knowledge/axl_responsibility_catalog.json` 和 `knowledge/agent_reference_catalog.json` 已使用 A15=审计日志、A16=合规申报、A17=安全包络。建议：

1. 先以本轮确认的尾部语义和 Version2 实物为当前目标，修正两个 Markdown 的定位；66 内容仅保留为追溯/兼容目录；
2. 修正 builder 中的 group/语义校验，避免只校验 ID 顺序却不校验能力含义；
3. 人类附录改由同一机读块生成；
4. 重建所有 catalog/report，并由 CI 比较生成内容，禁止手工漂移；
5. README 明确：
   - A15 = 审计日志；
   - A16 = 合规申报；
   - A17 = 安全包络。

### 6.2 Version2 合并说明与实际 JSON

`docs/jd-variable-tree/JD业务变量树_version2_合并说明.md` 描述的 audited merge 形态与团队实际交付 JSON 不一致，文档中还有 A15/A16 group 归属错误。由于 V2 实物是当前基线，建议：

- 将不符合实物的内容标为历史合并设计，不用于反向修改 V2；
- 根据实际 schema `2.3`、catalog `2.4.0-merged` 和真实节点字段重写现行读取说明；
- loader 和测试以实物 hash/schema 为基线，新增 sidecar 时单独版本化；
- 不把它列为 canonical authority。

### 6.3 `docs/jd-variable-tree/README.md`

当前主要描述 Version1，建议重写为：

- Version2 主数据与 canonical 66 追溯目录的边界；
- current source、generated artifacts、audit scripts；
- compact slice 使用限制；
- proposed node 不得冒充 canonical；
- Version1 链接移到 archive。

## 7. 建议的最终文档树

```text
README.md
docs/
├── README.md
├── pipeline_ui_walkthrough.md
├── codebase_guide.md
├── how_to_create_case_template.md
├── pipeline_delivery_audit.md
├── pipeline_delivery_plan.md
├── document_cleanup_proposal.md
├── jd-variable-tree/
│   ├── README.md
│   └── JD业务变量树_version2_合并说明.md
├── research/
│   ├── jd-tree/
│   ├── metrics/
│   ├── cases/
│   └── g1/
├── archive/
│   ├── migrations/
│   ├── jd-tree/version1/
│   └── cases/high_speed_inspection/
└── generated/
    └── jd-tree/
```

## 8. 执行顺序

确认后建议分三个小批次执行，避免大范围失链：

1. 修正文档内部事实：A15/A16/A17、66/78、Version2 状态和 authority 标签；
2. 迁移 history/research/generated，并用链接检查器修复引用；
3. 合并重复说明，确认无引用和无独有内容后再删除 `pipeline-v2*`、quickstart 和重复草案。

每一批次都应：

- 先生成文件映射清单；
- 更新 `docs/README.md`；
- 执行仓库内 Markdown link 检查；
- 检查网站/部署入口；
- 单独提交，便于审阅和回退。

本轮不执行上述迁移或删除。

## 9. 当前文档文件逐项处置索引

以下索引用于保证清理范围可审阅；“删除”仍须在内容合并、引用检查和用户确认后执行。

| 当前路径 | 分类 | 提议 | 核心理由 |
|---|---|---|---|
| `README.md` | 现行工程说明 | 保留并更新 | 根入口 |
| `AxL责任定义字典_17A_68单元_机读版.md` | 拟定权威源但当前冲突 | 保留并修复 | builder source；尾部语义未收敛 |
| `JD业务变量字典_66槽位_机读版.md` | 拟定权威源但当前冲突 | 保留并修复 | builder source；与 current 66 JSON 尾部映射冲突 |
| `pipeline/README.md` | 现行工程说明 | 保留并更新 | 当前 Pipeline 局部入口 |
| `pipeline-v2/README.md` | 重复内容 | 随 `pipeline-v2/` 删除 | 与现行 README 重复 |
| `schemas/README.md` | 现行工程说明 | 保留并更新 | schema 索引 |
| `docs/README.md` | 现行工程说明 | 保留并重建索引 | 文档入口 |
| `docs/codebase_guide.md` | 现行工程说明 | 保留并更新 | 工程导航 |
| `docs/pipeline_ui_walkthrough.md` | 现行操作说明 | 保留并升级为唯一 UI 指南 | 覆盖三类交付新流程 |
| `docs/config_agent_quickstart.md` | 重复内容 | 合并后删除 | 与 UI walkthrough 重复 |
| `docs/how_to_create_case_template.md` | 现行工程说明 | 保留并更新 | 离线流程仍有效 |
| `docs/pipeline_delivery_audit.md` | 现行设计记录 | 保留 | 本轮事实基线 |
| `docs/pipeline_delivery_plan.md` | 现行设计记录 | 保留 | 待确认实施方案 |
| `docs/document_cleanup_proposal.md` | 现行设计记录 | 保留 | 清理决策记录 |
| `docs/jd-variable-tree/README.md` | 现行工程说明但过期 | 保留并重写 | 当前只覆盖 Version1 |
| `docs/jd-variable-tree/JD业务变量树_version2_合并说明.md` | 说明文档但与实物冲突 | 保留并按实物纠正 | V2 实物优先，不用旧说明反向改树 |
| `docs/jd-variable-tree/JD业务变量树_A1-A17_逐能力层级修订审计与待确认.md` | 历史审计 | 迁移到 archive | Version2 合并前记录 |
| `docs/jd-variable-tree/JD业务变量树_version1_待确认问题与暂定方案.md` | 历史审计 | 迁移到 archive | Version1 记录 |
| `docs/jd-variable-tree/JD业务变量树_version1_本轮更正审计.md` | 历史审计 | 迁移到 archive | Version1 记录 |
| `docs/jd-variable-tree/JD业务变量树_version1_详细度审计与扩展蓝图.md` | 历史/研究 | 迁移到 archive | Version1 扩展设计 |
| `docs/jd-variable-tree/JD业务变量树_高速巡检_legacy_v0.1_阶段一结构草案.md` | 历史案例 | 迁移到 archive | legacy 高速巡检 |
| `docs/jd-variable-tree/JD业务变量树_legacy_inspection_source_机读版.md` | 历史案例 | 迁移到 archive | legacy 机读输入 |
| `docs/jd-variable-tree/需求草案-v0.6.md` | 研究/重复 | 与 `白墙.md` 归并后迁移或删除 | 两份白墙草案重复 |
| `docs/jd_4layer_pattern.md` | proposed 研究 | 迁移到 research | 78/tree 设计，不是 canonical 66 |
| `docs/jd_variable_catalog_v2.md` | proposed 研究 | 迁移到 research | 4-layer catalog 提案 |
| `docs/variable_tree_case_task.md` | proposed 研究 | 迁移到 research | 旧交付术语和示例值 |
| `docs/migration/ability_renumbering.md` | 历史迁移 | 迁移到 archive | 已执行迁移 |
| `docs/update_notice_ga_renumbering.md` | 历史迁移 | 迁移到 archive | 已执行的 draft/notice |
| `docs/g1/G1_benchmark_setup.zh.md` | 研究 | 迁移到 `docs/research/g1/` | 独立 G1 架构设想 |
| `docs/g1/G1示例_从AL到persona_config.zh.md` | 研究 | 迁移到 `docs/research/g1/` | persona_config 研究示例 |
| `docs/g1/用户情境_设计原则.zh.md` | 研究 | 迁移到 `docs/research/g1/` | 用户情境研究 |
| `docs/assets/uav_benchmark_pipeline_architecture.png` | 支撑资产 | 保留并在实现后更新 | 当前架构图 |
| `docs/assets/a11_whitewall_tree.png` | 研究案例资产 | 随白墙资料迁移 | 不属于现行操作流 |
| `metric.md` | proposed 研究 | 迁移并标注 non-authoritative | 不是 threshold authority |
| `templates/模版一_城市高楼峡谷违停车辆巡检.md` | 案例参考 | 迁移到 examples/reference | 非权威模板 |
| `templates/模版二_油田管廊缺陷巡检.md` | 案例参考 | 迁移到 examples/reference | 非权威模板 |
| `白墙.md` | 研究/重复 | 与 docs 副本归并后保留唯一版本 | 避免双份维护 |
| `JD业务变量树_version1.html` | 生成产物 | 迁移到 generated 或停止跟踪 | 可重建旧产物 |
| `JD业务变量树_version2.html` | 生成产物 | 迁移到 generated | 可重建 current 可视化 |
| `pipeline-v2.html` | 重复实现入口 | 确认无部署引用后删除 | 过期页面副本 |
