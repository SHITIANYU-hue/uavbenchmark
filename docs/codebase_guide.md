# 代码梳理

## 1. 当前实现范围

当前网页按六步走通配置到交付：

```text
STEP 1  任务域选择      任务描述 + 可选场景
STEP 2  文案与 A×L      Coverage → 文案 → 分类
STEP 3  JD业务变量树    A×L 子树 → 选择清单 → 受限域提取
STEP 4  任务域模版      fixed / enum / range / TBD
STEP 5  Task Template   案例数量 → 具体 JD 值 → 自然语言正文
STEP 6  配置与交付       world_config / user_config → 校验 → 导出
```

| 产品名 | 含义 | Wire / 代码 |
|---|---|---|
| 任务域模版 | STEP 4 取值域 | `normalize_domain_template` |
| Task Template | STEP 5/6 的完整任务正文和 Manifest | `artifact_type: task_template` |
| 世界侧配置 | Fixture/Harness 使用，包含 Hidden GT | `artifact_type: world_config` |
| 用户侧配置 | SUT 可见任务合同，不含 Hidden GT | `artifact_type: user_config` |

真实 Fixture/Harness、SUT、GT/Trace、Grader 未接页面；当前交付为 adapter-neutral 配置合同。
操作见 [config_agent_quickstart.md](config_agent_quickstart.md)。

## 2. 目录结构

```text
pipeline.html                 入口薄壳
pipeline/                     UI：css + js 模块（见 pipeline/README.md）
scripts/start_agent_demo.sh   本地启动
src/uav_benchmark/agent/      Config Agent、providers、HTTP 服务
src/uav_benchmark/instance/   域模版 → Seed 具体化
src/uav_benchmark/compiler/   离线 YAML intake
knowledge/                    A×L / JD 机读目录
schemas/                      artifact JSON Schema
JD业务变量树_version1.html    JD 变量树可分享单文件
jd-variable-tree/             变量树构建所需的页面逻辑与样式
templates/                    自然语言任务模板
docs/                         使用、设计与工程文档
```

文档导航见 [README.md](README.md)，JD 变量树的源码、数据与构建关系见
[jd-variable-tree/README.md](jd-variable-tree/README.md)。

## 3. 浏览器与本地服务

| 接口 | 作用 |
|---|---|
| `GET /api/health` | Provider / Key / 模型状态 |
| `GET /api/catalog` | A×L、JD、`level_policy` |
| `GET /api/scenarios` | 场景注册表 |
| `POST /api/config-agent/expand` | 文案扩充（可带 `target_coverage`） |
| `POST /api/config-agent/analyze` | A×L + JD 提取（可带 `preferred_coverage`） |
| `POST /api/config-agent/fill-tbd` | 按确认来源复核 TBD；来源不足时保持 TBD |
| `GET /api/jd-tree/slice` | 按 A×L 能力加载有界 JD业务变量树子树 |
| `POST /api/jd-tree/selection/build` | 生成并校验 `jd_tree_selection` |
| `POST /api/delivery/batch` | 按案例数量生成 Task Template、世界侧、用户侧与校验结果 |
| `POST /api/task-template/generate` | 旧版单 Seed 具体化接口（保留兼容） |
| `POST /api/task-template/batch` | 批量 Seed |
| `POST /api/task-template/traverse` | 域遍历 |
| `POST /api/pipeline/save` · `GET /api/pipeline/load` | 手动检查点 |

兼容旧路径 `/api/instance/*`。API Key 只在本地 Python 进程读取。

## 4. Config Agent

`src/uav_benchmark/agent/service.py` 负责：

- 读取 `knowledge/agent_reference_catalog.json`；
- 读取 `knowledge/business_scenario_registry.json` 中本次选定的业务场景；
- 读取 `knowledge/task_template_backbone.json`；
- 通过 `providers.py` 选择 Gemini 或 DeepSeek，并复用同一套文案、coverage 与 extraction 合同；
- 把模型响应转换为 Pydantic 合同；
- 执行确定性后校验。

第一阶段由 `NarrativeAgent` 执行，只输出业务文案。第二阶段由 `ConfigAgent` 分类和提取，其中 coverage 与 JD/dependency extraction 是两个独立的结构化请求；服务端用人工确认稿作为正式正文。

STEP 2 由人选择目标 A×L；没有确认资料时不写死默认等级。STEP 3 先让人确认
JD业务变量树变量选择，再把 canonical 允许范围交给 Agent。未知 JD 保持 TBD，
可在 STEP 4 按来源复核或人工补充。

当前知识目录：17 个 A、68 个 A×L、66 个 JD。

人读/机读源字典位于项目根目录：

- `AxL责任定义字典_17A_68单元_机读版.md`
- `JD业务变量字典_66槽位_机读版.md`

运行 `.venv/bin/python scripts/build_knowledge_catalog.py` 会提取两份 Markdown 中的 YAML，检查数量、唯一性、累计等级责任和 JD 引用，再生成 `knowledge/agent_reference_catalog.json` 等运行文件。Config Agent 不在运行时解析图片或 Excel。

确定性校验主要检查：

- coverage 与 JD 是否位于受审目录；
- Agent 的任务证据是否来自人工确认后的完整文案，示例中的固定变量证据是否来自所选场景版本；
- 人工填写的确定值是否带确认依据；
- Runtime Dependency 是否错误计入 SUT 评分；
- 所选 A×L 要求的 JD 是否齐全；
- L2/L3/L4 是否使用目录提供的累计责任与累计 JD；
- JD ID 与当前版本中的规范名称是否一致；
- 自然语言模板是否具有完整段落结构，并且没有把 A×L、GAL 或 JD 内部编号暴露在业务正文中。

## 5. 任务域模版 → 三类交付

`src/uav_benchmark/instance/domain_template.py` 把 Agent 候选与 Step 3 编辑归一成任务域模版。  
`src/uav_benchmark/instance/generator.py` 用内部 Seed 确定性生成具体绑定（兼容 wire：
`task_instance`）。`src/uav_benchmark/instance/delivery.py` 再按 JD业务变量树元数据确定性
投影为 `task_template`、`world_config` 与 `user_config`，并执行隔离校验。

本地 Agent 运行记录写入 `.agent_runs/`（已忽略）。Pipeline 进度写入 `saved_pipeline.json`。

## 6. 数据合同

`schemas/` 使用 JSON Schema Draft 2020-12 定义交付与运行 artifact：

| Schema 文件 | Wire `artifact_type` | 产品对应 |
|---|---|---|
| `task_template.schema.json` | `task_template` | 完整能力边界模板（离线 compiler）；网页任务域模版是其精简输入形态 |
| `task_template_output.schema.json` | `task_template` | STEP 5/6 可审阅正文与机器 Manifest |
| `world_config.schema.json` | `world_config` | 世界资产、扰动、Hidden GT 与 adapter-neutral 合同 |
| `user_config.schema.json` | `user_config` | SUT 可见任务接口，不允许 Hidden GT |
| `delivery_batch.schema.json` | `benchmark_delivery_batch` | 一个或多个三件套案例和校验 |
| `task_instance.schema.json` | `task_instance` | 内部兼容运行计划（Seed 具体 JD 值） |
| `ground_truth.schema.json` | `ground_truth` | Fixture/Grader 可见真值 |
| `sut_trace.schema.json` | `sut_trace` | SUT 运行事件 |
| `grader_result.schema.json` | `grader_result` | 能力归因与 task gate |

未知 threshold、业务判据或 simulator 接口不得写成正式规则，应保持 `null`、TBD 或开放问题。

## 7. 离线案例编译器

`src/uav_benchmark/compiler/` 把人工填写的 YAML intake 转成符合 Task Template schema 的 JSON。

```bash
PYTHONPATH=src python3 -m uav_benchmark.compiler \
  --input examples/intake/case2_oilfield_intake.yaml \
  --output examples/case2_oilfield_corridor/task_template.generated.json
```

这个入口适合不调用大模型的确定性配置生产和 CI 校验。

## 8. 测试

```bash
python3 -m pytest -q
PYTHONPATH=src .venv/bin/python tests/agent_contract_checks.py
```

第一组检查交付与运行 JSON Schema、离线 compiler 和 Pipeline 合同；第二组检查
Config Agent 结构化响应、证据、模板骨架、人工来源和外部依赖规则。

## 9. 当前工程边界与下一步

当前版本适合展示：业务描述 → A×L/JD → 任务域模版 → Task Template 批次 →
世界侧/用户侧配置 → 校验与导出。后续运行侧工作包括：

1. Mock Fixture/Harness 阶段机；
2. Mock SUT 与标准 Trace；
3. GT/Trace 对齐；
4. 按 A×L 归因和安全终态 Gate 输出 Grader Result；
5. simulator API 确认后实现 adapter。

这些阶段不得在接口、阈值和业务规则尚未确认时静默补值。
