# UAV Benchmark Pipeline

本仓库正在把研究资料转成“业务描述 → Task Template → Task Instances → Runtime → GT/Trace → Grader”的可复现 benchmark pipeline。

当前会议演示版本已打通第一段链路：自然语言业务描述 → Gemini Config Agent → GAL/JD 候选 → 人工能力确认 → TBD/外部依赖补录 → 自然语言 Task Template → 确定性复核。

两份面向人的任务模板：

- `templates/模版一_城市高楼峡谷违停车辆巡检.md`
- `templates/模版二_油田管廊缺陷巡检.md`

## 浏览器演示

首次克隆后，在项目根目录创建环境并安装演示依赖：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[agent,test]'
```

然后运行：

```bash
./scripts/start_agent_demo.sh
```

首次运行会在终端中安全读取 `GEMINI_API_KEY`。Key 不会写入 HTML、运行记录或仓库文件。服务启动后打开：

```text
http://127.0.0.1:8765
```

页面内置“城市高楼峡谷违停车辆巡检”和“油田管廊缺陷巡检”作为示例输入，也支持粘贴新的无人机业务描述。人工修订不会再次调用 Gemini；每次修订形成独立本地版本，并保留未知阈值、业务规则和接口为 TBD。

详细演示步骤见 `docs/config_agent_quickstart.md`，代码结构见 `docs/codebase_guide.md`。

## 离线案例编译器

把人填写的案例 YAML 转成符合 schema 的 Task Template：

```bash
PYTHONPATH=src python3 -m uav_benchmark.compiler \
  --input examples/intake/case2_oilfield_intake.yaml \
  --output examples/case2_oilfield_corridor/task_template.generated.json
```

只检查、不生成文件：

```bash
PYTHONPATH=src python3 -m uav_benchmark.compiler \
  --input examples/intake/case2_oilfield_intake.yaml \
  --check
```

### 从哪里开始

1. 复制 `examples/intake/case_intake_template.yaml`；
2. 填写场景、正式 A×L、外部依赖、变量允许域、阶段和接口；
3. 运行上面的 compiler；
4. 得到符合 `schemas/task_template.schema.json` 的 JSON；
5. 后续实例生成器按 seed 遍历或采样变量，生成 `task_instance`。

详细说明见 `docs/how_to_create_case_template.md`，展示页面为 `pipeline.html`。

在 VSCode 中也可以打开命令面板，选择 `Tasks: Run Task`，然后运行：

- `UAV: 校验案例二 Intake`
- `UAV: 生成案例二 Task Template`

## 验证

```bash
python3 -m pytest -q
PYTHONPATH=src .venv/bin/python tests/agent_contract_checks.py
```

当前阶段不会自行生成业务阈值、评分规则或 simulator 接口；未确认内容统一保留为 TBD 或开放问题。

## 仓库内容

公开仓库只包含可运行代码、schema、测试、示例、受审知识目录和必要工程说明。研究原始资料、项目总表、交接文件及 DOCX 模板不属于运行依赖，不纳入代码仓库。
