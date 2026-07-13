# 代码梳理

## 1. 当前实现范围

当前版本实现 benchmark pipeline 的配置生成段：

```text
业务描述
  → Config Agent 查询受审 GAL/JD 目录
  → 结构化候选
  → 确定性校验
  → 人工确认能力边界
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
knowledge/                    Config Agent 可读取的受审 GAL/JD 子集和模板骨架
schemas/                      五类 benchmark artifact 的 JSON Schema
examples/                     合同样例、案例 intake 与编译结果
templates/                    面向人的两份自然语言任务模板
tests/                        schema、compiler 和 Agent 合同检查
docs/                         启动说明、代码梳理与必要工程文档
```

## 3. 浏览器与本地服务

`pipeline.html` 是单页演示界面，负责：

1. 接收业务描述和模型选择；
2. 调用本地 `/api/config-agent/analyze`；
3. 展示 GAL coverage、Runtime Dependencies、JD 和自然语言模板；
4. 把页面状态保存在浏览器 localStorage；
5. 提供 TBD、外部依赖和模板的人工审核工作台；
6. 调用 `/api/config-agent/revise` 保存不消耗 Gemini 配额的人工修订。

`src/uav_benchmark/agent/server.py` 提供静态页面和三个主要接口：

| 接口 | 作用 |
|---|---|
| `GET /api/health` | 返回本地 Agent 和模型配置状态 |
| `POST /api/config-agent/analyze` | 启动一次 Config Agent 生成 |
| `GET /api/config-agent/status` | 按 Run ID 恢复运行状态 |
| `POST /api/config-agent/revise` | 保存人工修订并重新执行确定性校验 |

API Key 只由本地 Python 进程读取，不发送给 `pipeline.html`，也不写入运行记录。

## 4. Config Agent

`src/uav_benchmark/agent/service.py` 负责：

- 读取 `knowledge/agent_reference_catalog.json`；
- 读取 `knowledge/task_template_backbone.json`；
- 组织单次 Gemini Structured Output 请求；
- 把模型响应转换为 Pydantic 合同；
- 执行确定性后校验。

Agent 不能使用案例完整答案作为检索模板。当前知识目录只包含受审 GAL/JD 子集、字段说明和模板完整性骨架。

确定性校验主要检查：

- coverage 与 JD 是否位于受审目录；
- Agent 的证据是否为业务描述原文片段；
- 人工填写的确定值是否带确认依据；
- Runtime Dependency 是否错误计入 SUT 评分；
- 所选 A×L 要求的 JD 是否齐全；
- 自然语言模板是否包含必需 JD 标注、能力编号和完整段落结构。

## 5. 人工修订

人工审核工作台分为三页：

- 统一补录 TBD：只补有依据的值；未知字段继续保持 TBD；
- 外部依赖：添加执行器、外部系统或外部决定接口，固定 `scored=false`；
- 模板编辑：修改 JD 标注、责任归因和自然语言表达。

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
