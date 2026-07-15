# 代码梳理

## 1. 当前实现范围

当前版本实现 benchmark pipeline 的配置生成段：

```text
固定业务场景与变量域
  → 人工简短任务描述
  → 第一次 Gemini 调用扩充完整业务文案
  → 人工编辑并确认文案
  → 第二次 Gemini 调用查询受审 GAL/JD 目录
  → 结构化候选
  → 确定性校验
  → 人工确认或修改 L1–L4
  → 统一补录 TBD / 外部依赖 / 模板修订
  → 保存 Human Revision
  → 自然语言 Task Template
```

Task Instance、真实 Fixture/Harness、SUT、GT/Trace 和 Grader 的 schema 已建立，但当前网页暂不执行这些运行阶段。

## 2. 目录结构

```text
pipeline.html                 浏览器演示与人工审核界面
scripts/start_agent_demo.sh   本地启动入口
src/uav_benchmark/agent/      Gemini Config Agent 与本地 HTTP 服务
src/uav_benchmark/compiler/   YAML 案例 intake 的离线编译器
knowledge/                    Config Agent 可读取的全量 A×L/JD 目录、构建报告和模板骨架
schemas/                      五类 benchmark artifact 的 JSON Schema
examples/                     合同样例、案例 intake 与编译结果
templates/                    面向人的两份自然语言任务模板
tests/                        schema、compiler 和 Agent 合同检查
docs/                         启动说明、代码梳理与必要工程文档
```

## 3. 浏览器与本地服务

`pipeline.html` 是单页演示界面，负责：

1. 从 `/api/scenarios` 展示五类业务场景，并在 Stage 0 锁定一个场景和变量绑定方式；
2. 接收不含 A×L/JD 的简短人工任务和模型选择；
3. 调用 `/api/config-agent/expand` 生成可编辑的完整任务文案；
4. 让人工修改并确认完整任务文案；
5. 调用 `/api/config-agent/analyze` 对确认稿进行 A×L 分类和 JD 提取；
6. 展示 GAL coverage，并允许人工修改每项候选的 L1–L4；
7. 展示 Runtime Dependencies、JD 和与人工确认稿一致的自然语言模板；
8. 把页面状态保存在浏览器 localStorage；
9. 提供 TBD、外部依赖和模板的人工审核工作台；
10. 调用 `/api/config-agent/revise` 保存不消耗 Gemini 配额的人工修订。

`src/uav_benchmark/agent/server.py` 提供静态页面和主要接口：

| 接口 | 作用 |
|---|---|
| `GET /api/health` | 返回本地 Agent 和模型配置状态 |
| `GET /api/catalog` | 返回当前目录版本、数量、A×L 索引和 JD 名称索引 |
| `GET /api/scenarios` | 返回高速、油气、桥梁、园区和其他巡检场景注册表 |
| `GET /api/scenario?scenario_id=...` | 返回一个指定业务场景及变量绑定方式 |
| `POST /api/config-agent/expand` | 第一次调用：简短任务扩充为可编辑完整文案 |
| `POST /api/config-agent/analyze` | 第二次调用：对人工确认稿进行 A×L 分类、JD 与外部依赖提取 |
| `GET /api/config-agent/status` | 按 Run ID 恢复运行状态 |
| `POST /api/config-agent/revise` | 保存人工修订并重新执行确定性校验 |

API Key 只由本地 Python 进程读取，不发送给 `pipeline.html`，也不写入运行记录。

## 4. Config Agent

`src/uav_benchmark/agent/service.py` 负责：

- 读取 `knowledge/agent_reference_catalog.json`；
- 读取 `knowledge/business_scenario_registry.json` 中本次选定的业务场景；
- 读取 `knowledge/task_template_backbone.json`；
- 组织两个相互分离的 Gemini Structured Output 请求；
- 把模型响应转换为 Pydantic 合同；
- 执行确定性后校验。

第一次请求由 `GeminiNarrativeAgent` 执行，只输出业务文案和开放问题，不允许输出 A×L、GAL 或 JD 标识。第二次请求由 `GeminiConfigAgent` 执行，只分类和提取；服务端会用人工确认稿覆盖模型响应中的正文，因此第二次调用无法改写已确认任务。

Agent 不能使用案例完整答案作为检索模板。当前知识目录包含本版受审的 17 个 A、68 个 A×L、66 个 JD、字段说明和模板完整性骨架。

人读/机读源字典位于项目根目录：

- `AxL责任定义字典_17A_68单元_机读版.md`
- `JD业务变量字典_66槽位_机读版.md`

运行 `.venv/bin/python scripts/build_knowledge_catalog.py` 会提取两份 Markdown 中的 YAML，检查数量、唯一性、累计等级责任和 JD 引用，再生成 `knowledge/agent_reference_catalog.json` 等运行文件。Config Agent 不在运行时解析图片或 Excel。

确定性校验主要检查：

- coverage 与 JD 是否位于受审目录；
- Agent 的任务证据是否来自人工确认后的完整文案，固定变量证据是否来自 Stage 0 场景；
- 人工填写的确定值是否带确认依据；
- Runtime Dependency 是否错误计入 SUT 评分；
- 所选 A×L 要求的 JD 是否齐全；
- L2/L3/L4 是否使用目录提供的累计责任与累计 JD；
- JD ID 与当前版本中的规范名称是否一致；
- 自然语言模板是否具有完整段落结构，并且没有把 A×L、GAL 或 JD 内部编号暴露在业务正文中。

## 5. 人工修订

人工审核工作台分为三页：

- 统一补录 TBD：只补有依据的值；未知字段继续保持 TBD；
- 外部依赖：添加执行器、外部系统或外部决定接口，固定 `scored=false`；
- 模板编辑：修改责任归因和自然语言表达；内部编号仍保留在结构化结果中。

每次保存形成新的 Human Revision，原始 Agent 结果不被覆盖。人工修订不调用 Gemini。

本地运行记录默认写入 `.agent_runs/`，该目录已被 Git 忽略。

## 6. 数据合同

`schemas/` 使用 JSON Schema Draft 2020-12 定义五类 artifact：

| Artifact | 文件 | 作用 |
|---|---|---|
| Task Template | `task_template.schema.json` | 描述能力边界、JD 插槽、依赖和变量域 |
| Task Instance | `task_instance.schema.json` | 固定 seed 和变量绑定后的可执行实例 |
| Ground Truth | `ground_truth.schema.json` | 仅 Fixture/Grader 可见的世界真值 |
| SUT Trace | `sut_trace.schema.json` | SUT 在运行期间产生的事件与输出 |
| Grader Result | `grader_result.schema.json` | 按能力归因、reason code 和 task gate 输出结果 |

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

当前版本适合展示“业务描述如何被整理成可审核 Task Template”。下一阶段可以在不修改现有配置合同的前提下增加：

1. Task Instance 的 seed 化遍历与采样；
2. Mock Fixture/Harness 阶段机；
3. Mock SUT 与标准 Trace；
4. GT/Trace 对齐；
5. 按 A×L 归因和安全终态 Gate 输出 Grader Result。

这些阶段不得在接口、阈值和业务规则尚未确认时静默补值。
