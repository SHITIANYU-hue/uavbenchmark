# UAV Benchmark Pipeline

面向 AI 飞手能力评测的任务配置、实例化与证据化评分框架。

本项目研究如何将无人机行业任务描述转化为结构明确、可机器校验、可复现并可扩展的 benchmark artifacts。框架以 GAL（能力与自主等级）描述受测能力边界，以 JD（任务变量）描述场景配置，并显式区分 SUT、Fixture/Harness、外部执行器、Ground Truth 与 Grader 的责任。

当前网页演示按四步完成配置到具体化：

```text
Step 1: 任务域选择         场景 + 简短描述           [保存] [加载]
Step 2: 扩充与提取         Agent 文案+A×L+JD域       [保存] [加载]
Step 3: 任务域模版    域编辑器(每行选模式)      [保存] [加载]
Step 4: 特定任务模版      Seed→具体 JD 值               [保存] [加载]
```

产品命名：Step 3 产出 任务域模版（取值域）；Step 4 用 Seed 从域中抽出具体值，得到特定任务模版。  
Wire 合同里 Step 4 产物仍使用 `task_instance` schema（兼容已有 artifact 合同）。Ground Truth、SUT Trace、Grader 与真实 Fixture/Harness 仍属后续实现。

## 研究目标

本项目关注以下工程与评测问题：

1. 如何把非结构化业务需求转换为可审核的任务模板；
2. 如何用 A×L 能力单元描述 SUT 的正式评分边界；
3. 如何将 SUT 能力与外部执行器、飞控和人工决定接口分离；
4. 如何在不编造阈值、业务规则和 simulator 接口的前提下保留 TBD；
5. 如何通过 schema、版本、seed、provenance、GT 与 Trace 支持可复现评测；
6. 如何让多个行业案例共享同一条 pipeline，而不是为每个案例开发独立程序。

## 设计原则

- **能力边界显式化**：只评价任务模板中明确声明的 GAL A×L；等级责任按 L1 到目标等级累计，不自动升级到更高等级。
- **运行责任分离**：SUT 输出、Fixture 注入、外部执行器动作与 Grader 归因分别记录。
- **变量域受审**：Agent 只提取候选；变量允许域、阈值和业务判据必须来自受审配置。
- **未知项可见**：缺失信息进入 TBD 或 Open Question，不静默补值。
- **证据可追溯**：任务候选引用人工确认稿，场景固定值引用版本化场景来源；人工确定值必须记录确认依据。
- **结果可复现**：artifact schema、版本、模型标识、运行 ID 与后续 seed 共同描述一次评测运行。

## 系统架构

![UAV Benchmark Pipeline 系统架构](docs/assets/uav_benchmark_pipeline_architecture.png)

Config Agent 负责候选生成，不负责批准业务规则。确定性校验与人工复核共同构成模板进入后续运行链之前的质量门。
架构图中的 Config Agent 在当前网页中实现为两次顺序调用：先生成可编辑业务文案，再对人工确认稿进行能力分类与变量提取。

## 实现状态

| 模块 | 状态 | 说明 |
|---|---|---|
| 双调用 Config Agent | 已实现 | DeepSeek：文案扩充 + A×L/JD 域提取（分析阶段可拆成 coverage/extraction 子调用） |
| 业务场景注册表 | 已实现 | Step 1 从高速、油气、桥梁、园区和其他巡检场景中锁定变量域 |
| 任务域模版编辑器 | 已实现 | Step 3 按行选择 fixed/enum/range/TBD |
| 特定任务模版（Seed） | 已实现 | Step 4：任务域模版 + Seed → 具体 JD 值；支持 single/batch/traverse |
| 确定性校验 | 已实现 | Agent 候选校验 + 特定任务模版 schema 校验 |
| YAML Intake Compiler | 已实现 | 将人工填写的案例配置编译为完整 schema 级模板 JSON |
| Artifact Schemas | 已实现 | Template、Instance、GT、Trace、Grader Result |
| Fixture/Harness 与 Mock SUT | 待实现 | 执行阶段机并生成标准 Trace |
| Grader | 待实现 | 基于 GT/Trace 进行能力归因和 task-level gate 判断 |

## 任务模板

当前 Stage 0 业务场景注册表包含高速巡检、油气巡检、桥梁巡检、园区巡检和其他巡检场景族。机读配置见 [business_scenario_registry.json](knowledge/business_scenario_registry.json)。以下案例材料保留为任务设计与验证参考：

- [模版一：城市高楼峡谷违停车辆巡检](templates/模版一_城市高楼峡谷违停车辆巡检.md)
- [模版二：油田管廊缺陷巡检](templates/模版二_油田管廊缺陷巡检.md)

场景注册表描述 Summary、固定边界、可选任务模块、JD 绑定方式和外部依赖，不是预先填好的 A×L 答案。能力等级来自人工任务描述，经 Agent 提议后再由人确认。Config Agent 的通用受审知识目录不包含案例完整答案。

## 快速开始

### 环境要求

- Python 3.11 或更高版本
- 一个可用的 DeepSeek API Key（仅 Config Agent 在线生成需要）
- 支持现代 JavaScript 的浏览器

### 安装

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[agent,test]'
```

### 启动 Config Agent 演示

```bash
./scripts/start_agent_demo.sh
```

启动脚本会在终端中读取 `DEEPSEEK_API_KEY`（也可写在本地 `.env`）。输入不会写入 HTML、运行记录或仓库文件。服务启动后访问：

```text
http://127.0.0.1:8765
```

请通过本地 HTTP 服务打开页面；直接双击 `pipeline.html` 无法访问 Config Agent API。

## 演示流程

1. **Step 1 任务域选择**：选场景，输入 1–3 句任务描述，保存/加载可随时用；
2. **Step 2 扩充与提取**：DeepSeek 扩充可编辑文案，再提取 A×L 与 JD 域；
3. **Step 3 任务域模版**：在域编辑器中为每个 JD 选 fixed/enum/range/TBD；
4. **Step 4 特定任务模版**：输入 Seed（或 batch/traverse），生成带具体 JD 值的特定任务模版。

每一步都有 [保存] / [加载]。Agent 阶段的黄色 `needs_review` 表示确定性校验有待处理项，不等于模型调用失败。

## 离线任务配置

除 Config Agent 外，项目提供确定性的 YAML Intake Compiler。它适用于人工编写案例配置、CI 校验以及不调用大模型的模板生成。

生成案例二 Task Template：

```bash
PYTHONPATH=src python3 -m uav_benchmark.compiler \
  --input examples/intake/case2_oilfield_intake.yaml \
  --output examples/case2_oilfield_corridor/task_template.generated.json
```

只执行校验：

```bash
PYTHONPATH=src python3 -m uav_benchmark.compiler \
  --input examples/intake/case2_oilfield_intake.yaml \
  --check
```

案例配置方法见 [案例模板编写说明](docs/how_to_create_case_template.md)。

## Artifact Contracts

项目采用 JSON Schema Draft 2020-12 定义跨组件数据合同。

| Artifact / 产品名 | Schema | 作用 |
|---|---|---|
| Domain / 完整模板 | `schemas/task_template.schema.json` | 能力边界、JD 域、依赖与阶段（离线 compiler 完整形态） |
| 特定任务模版（Step 4） | `schemas/task_instance.schema.json` | Seed 具体化后的 JD 槽位绑定（wire：`task_instance`） |
| Ground Truth | `schemas/ground_truth.schema.json` | 仅 Fixture/Grader 可见的世界真值 |
| SUT Trace | `schemas/sut_trace.schema.json` | SUT 运行期间的结构化事件与输出 |
| Grader Result | `schemas/grader_result.schema.json` | 能力归因、reason code、指标状态和 task-level gate |

合法最小样例位于 `examples/contracts/`。

## 项目结构

```text
pipeline.html                 浏览器演示与人工复核界面
scripts/start_agent_demo.sh   本地服务启动入口
src/uav_benchmark/agent/      Config Agent、校验器与 HTTP 服务
src/uav_benchmark/compiler/   YAML Intake Compiler
knowledge/                    全量 A×L/JD 机读目录、构建报告与模板骨架
schemas/                      五类 benchmark artifact schema
examples/                     合同样例、案例 intake 与编译结果
templates/                    自然语言任务模板
tests/                        schema、compiler 与 Agent 合同检查
docs/                         使用说明与代码文档
```

代码模块说明见 [代码梳理](docs/codebase_guide.md)，演示操作见 [Config Agent 演示说明](docs/config_agent_quickstart.md)。

## 验证与复现

运行 schema 与 compiler 测试：

```bash
python -m pytest -q
```

运行 Config Agent 合同检查：

```bash
PYTHONPATH=src .venv/bin/python tests/agent_contract_checks.py
```

正式实验记录应至少保存以下信息：

- Git commit；
- artifact schema 与模板版本；
- Config Agent 模型标识和 Run ID；
- 人工修订版本与确认依据；
- 特定任务模版（Step 4）的 seed 和 JD 变量绑定；
- Fixture、SUT、GT、Trace 与 Grader 版本。

本地 Agent 运行记录保存在 `.agent_runs/`，默认不纳入 Git。

受审知识目录可从两份人读/机读 Markdown 字典确定性重建：

```bash
.venv/bin/python scripts/build_knowledge_catalog.py
```

构建过程校验 17 个 A、68 个 A×L、66 个 JD、累计继承关系、ID 唯一性和全部 JD 交叉引用，并保存源文件 SHA-256。运行产物同时记录 A×L 与 JD 字典的 `schema_version`。

## 当前局限

- 当前网页只执行到特定任务模版阶段，尚未运行真实 SUT 或 simulator；
- 五类场景目前来自需求级 Summary 和变量域，还需要业务负责人逐项确认对象 taxonomy、接口、阈值和完成规则；
- 当前目录完整覆盖本版 PNG 定义的 17 个 A×L1–L4 和 66 个 JD，但不包含 L5/L6 的逐 A 责任定义；
- 新字典与早期示例中的 `jd-8.1/8.2/8.3` 含义存在版本迁移，构建报告会显式列出冲突；
- Agent 输出仍需确定性校验和人工确认，不能作为自动批准的业务规则；
- threshold、metric 参数、业务完成判据和 simulator 接口尚未统一标定；
- 当前示例不能替代真实平台、传感器和场景数据上的有效性验证。

## 后续工作

1. 把任务域模版提升为完整 `task_template.schema.json`（含正式 coverage/interfaces）；
2. 建立案例一的 Mock Fixture/Harness 与 Mock SUT；
3. 生成可复现的 Ground Truth 与 SUT Trace；
4. 实现按 A×L 归因的 Grader 与安全终态 Gate；
5. 使用五类场景的真实任务输入验证跨场景复用性；
6. 在规则确认后增加真实 simulator 或飞控适配层。
