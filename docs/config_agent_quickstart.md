# Config Agent 演示启动说明

## 本轮能展示什么

当前页面只覆盖第一段 pipeline：

1. 输入任意无人机业务描述；
2. Gemini Config Agent 查询受审 GAL 与 JD 候选目录；
3. 人工确认评分能力与外部运行依赖；
4. 查看 JD 提取、TBD 与原文证据；
5. 查看并确认自然语言 Task Template。

两个现有案例只是示例输入。Agent 的系统提示和知识目录不包含这两个案例的完整模板，API 不可用时页面也不会回退到预置答案。

## 第一次启动

首次克隆后，在项目根目录创建 Python 环境并安装依赖：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[agent,test]'
```

然后运行：

```bash
./scripts/start_agent_demo.sh
```

如果终端中尚未设置 `GEMINI_API_KEY`，脚本会提示输入。输入过程不可见，按回车即可。Key 只存在于该本地服务进程的环境变量中，不会写入 HTML、运行记录或项目文件。

看到下面的地址后，用浏览器打开：

```text
http://127.0.0.1:8765
```

不要直接双击 `pipeline.html`；直接打开静态文件时无法访问本地 Agent API。

## 页面操作

1. 选择“新任务 · 自由输入”，或载入案例一/案例二作为示例输入；
2. 修改业务描述；
3. 首次演示选择 Gemini 3.5 Flash；
4. 点击“运行 Config Agent”；
5. 在能力确认页区分 Scored Coverage 与 Runtime Dependencies；
6. 查看 JD 字段的原文证据、候选值与 TBD；
7. 查看自然语言 Task Template 和确定性校验问题；
8. 点击“人工补充外部依赖”或“统一补录 TBD / 缺失 JD”，打开人工审核工作台；
9. 在同一工作台中补充 TBD、外部依赖，或修订自然语言模板；
10. 填写修改说明，保存为新版本并重新校验；校验通过后完成本轮。

人工审核工作台不会再次调用 Gemini，也不会覆盖 Agent 原始结果。每次保存都会在 `.agent_runs/` 中生成一个带父 Run ID 的修订记录。人工填写确定值时必须同时填写确认依据；无法确认的字段可以继续保持 TBD。缺失的模板骨架字段可一键补成 TBD，但页面不会替业务方生成阈值、规则或接口定义。

页面会把当前输入、Run ID、步骤和成功结果保存在浏览器本地。运行期间刷新页面后，会通过同一 Run ID 查询本地服务并恢复阶段状态；因此刷新不会再次提交 Gemini 请求。点击“重新开始”会清空当前页面进度并建立新运行。

Gemini Pro 适合对重要候选做第二次复核，不建议每次输入都默认调用。

如果 Gemini 3.5 Flash 返回临时高负载 `503 UNAVAILABLE`，输入和 Run ID 会保留。可稍后重试，或在页面中手动选择稳定模型 `gemini-3.1-flash-lite` 作为演示备用；页面不会自动切换模型或暗中追加请求。

## 运行记录

每次成功调用会保存到本地忽略目录 `.agent_runs/`，内容包括原始任务、结构化候选、工具事件、校验问题和模型用量，不包含 API Key。它可以逐步积累成人工修订与未来评估的数据集。

逐阶段事件同时追加到 `.agent_runs/agent-events.jsonl`，并实时显示在启动终端。正常顺序为：`request_received`、两个目录工具的 `called/completed`、`model_request_started`、`model_response_received`、`candidate_validated` 和 `run_saved`。模型请求使用 90 秒超时且不自动重试，避免低 RPM 配额下长时间无反馈。

## 常见问题

- 页面显示“等待本地服务”：确认地址是 `http://127.0.0.1:8765`，并保持启动终端运行。
- 页面显示 Key 缺失：停止服务后重新运行启动脚本并输入 Key。
- 模型不可用：通过 `GEMINI_FLASH_MODEL` 或 `GEMINI_PRO_MODEL` 环境变量覆盖模型 ID。
- 结果显示 `needs_review`：不是运行失败；表示工具调用、字段、证据或模板注释中存在需要人工复核的问题。
