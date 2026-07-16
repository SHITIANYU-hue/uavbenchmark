# 代码梳理

## 1. 当前实现范围

当前网页按产品四步走通配置到具体化：

```text
Step 1: 任务域选择         简短描述 + 可选场景示例    [保存] [加载]
Step 2: 扩充与提取         Agent 文案+A×L+JD域       [保存] [加载]
Step 3: 任务域模版    域编辑器(每行选模式)      [保存] [加载]
Step 4: 特定任务模版      Seed→具体 JD 值               [保存] [加载]
```

命名约定：

| 产品名 | 含义 | Wire / 代码 |
|---|---|---|
| 任务域模版（Domain Template） | Step 3 取值域 | 送入 seed 引擎的最小模板（`normalize_domain_template`） |
| 特定任务模版 | Step 4 具体 JD 值 | `artifact_type: task_instance`（兼容 `task_instance.schema.json`） |

真实 Fixture/Harness、SUT、GT/Trace 和 Grader 仍属后续阶段。

## 2. 目录结构

```text
pipeline.html                 浏览器四步演示界面
scripts/start_agent_demo.sh   本地启动入口
src/uav_benchmark/agent/      Gemini/DeepSeek Config Agent、Provider 适配器与本地 HTTP 服务
src/uav_benchmark/compiler/   YAML 案例 intake 的离线编译器
src/uav_benchmark/instance/   任务域模版 → 特定任务模版（Seed）引擎
knowledge/                    Config Agent 可读取的全量 A×L/JD 目录、构建报告和模板骨架
schemas/                      五类 benchmark artifact 的 JSON Schema
examples/                     合同样例、案例 intake 与编译结果
templates/                    面向人的两份自然语言任务模板
tests/                        schema、compiler、任务域/特定任务模版与 Agent 合同检查
docs/                         启动说明、代码梳理与必要工程文档
```

## 3. 浏览器与本地服务

`pipeline.html` 实现 Step 1–4，每步提供保存/加载。

| 接口 | 作用 |
|---|---|
| `GET /api/health` | 本地 Agent、Gemini/DeepSeek Key 与模型配置状态 |
| `GET /api/catalog` | 目录版本与 A×L / JD 索引 |
| `GET /api/scenarios` | 五类业务场景注册表 |
| `POST /api/config-agent/expand` | Step 2：文案扩充 |
| `POST /api/config-agent/analyze` | Step 2：A×L + JD 域提取 |
| `POST /api/config-agent/revise` | Step 2：保存人工改级与 Runtime Dependency 修订 |
| `POST /api/domain-template/build` | 组装任务域模版 |
| `POST /api/task-template/generate` | Step 4：Seed → 特定任务模版 |
| `POST /api/task-template/batch` | 批量 Seed |
| `POST /api/task-template/traverse` | 域遍历 |
| `POST /api/pipeline/save` | 保存四步进度 |
| `GET /api/pipeline/load` | 加载进度 |

兼容旧路径 `/api/instance/*`。API Key 只在本地 Python 进程中读取。

## 4. Config Agent

`src/uav_benchmark/agent/service.py` 负责：

- 读取 `knowledge/agent_reference_catalog.json`；
- 读取 `knowledge/business_scenario_registry.json` 中本次选定的业务场景；
- 读取 `knowledge/task_template_backbone.json`；
- 通过 `providers.py` 选择 Gemini 或 DeepSeek，并复用同一套文案、coverage 与 extraction 合同；
- 把模型响应转换为 Pydantic 合同；
- 执行确定性后校验。

第一阶段由 `NarrativeAgent` 执行，只输出业务文案。第二阶段由 `ConfigAgent` 分类和提取，其中 coverage 与 JD/dependency extraction 是两个独立的结构化请求；服务端用人工确认稿作为正式正文。

Step 2 的人工复核可以在同一能力 A 下修改 L1–L4。改级后页面只从受审目录同步累计责任和必需 JD，未知取值仍为 TBD。人工补充的 Runtime Dependency 必须写明来源，且 `scored=false`。

Agent 不能使用案例完整答案作为检索模板。当前知识目录包含本版受审的 17 个 A、68 个 A×L、66 个 JD、字段说明和模板完整性骨架。

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

## 5. 任务域模版 → 特定任务模版

`src/uav_benchmark/instance/domain_template.py` 把 Agent 候选与 Step 3 编辑归一成任务域模版。  
`src/uav_benchmark/instance/generator.py` 用 Seed 确定性生成特定任务模版（wire：`task_instance`）。

本地 Agent 运行记录写入 `.agent_runs/`（已忽略）。Pipeline 进度写入 `saved_pipeline.json`。

## 6. 数据合同

`schemas/` 使用 JSON Schema Draft 2020-12 定义五类 artifact：

| Schema 文件 | Wire `artifact_type` | 产品对应 |
|---|---|---|
| `task_template.schema.json` | `task_template` | 完整能力边界模板（离线 compiler）；网页任务域模版是其精简输入形态 |
| `task_instance.schema.json` | `task_instance` | **产品 Step 4「特定任务模版」**（Seed 具体 JD 值） |
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

第一组检查五类 JSON Schema 和离线 compiler；第二组检查 Config Agent 结构化响应、证据、模板骨架、人工来源和外部依赖规则。

## 9. 当前工程边界与下一步

当前版本适合展示：业务描述 → 任务域模版 →（Seed）特定任务模版。下一阶段：

1. 任务域模版对齐完整 `task_template.schema.json`；
2. Mock Fixture/Harness 阶段机；
3. Mock SUT 与标准 Trace；
4. GT/Trace 对齐；
5. 按 A×L 归因和安全终态 Gate 输出 Grader Result。

这些阶段不得在接口、阈值和业务规则尚未确认时静默补值。
