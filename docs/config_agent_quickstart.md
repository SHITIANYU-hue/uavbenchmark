# Config Agent Pipeline 操作说明

本文是当前 `pipeline.html` 的正式操作文档。网页按四步完成：

```text
Step 1: 任务域选择         简短描述 + 可选场景示例    [保存] [加载]
Step 2: 扩充与提取         Agent 文案+A×L+JD域       [保存] [加载]
Step 3: 任务域模版    域编辑器(每行选模式)      [保存] [加载]
Step 4: 特定任务模版      Seed→具体 JD 值               [保存] [加载]
```

- **任务域模版（Domain Template）**：每个 JD 的取值域（fixed / enum / range / TBD）
- **特定任务模版**：任务域模版 + Seed 后的具体 JD 赋值（产品名；wire 合同仍为 `task_instance` schema）

当前网页还不运行真实 SUT、simulator、GT/Trace 或 Grader。

## 页面进度、保存与重新开始

- 页面操作会自动暂存在当前浏览器中，普通刷新不会丢失当前进度；
- **保存**：把当前四步状态写入一个本地手动检查点，后一次保存会覆盖前一次；
- **加载**：恢复最近一次手动保存的检查点，并回到保存时所在的 Step；
- **重新开始**：清空当前浏览器任务，但保留手动检查点，之后仍可点击“加载”恢复；
- 如需替换旧检查点，可“重新开始”后再点击“保存”。

手动检查点保存在本机 `saved_pipeline.json`，不会提交到 GitHub。

## 1. 启动页面

在项目根目录执行：

```bash
cd uavbenchmark
./scripts/start_agent_demo.sh
```

在本地 `.env` 中配置 `GEMINI_API_KEY`、`DEEPSEEK_API_KEY`，或同时配置两者。Key 只保存在本地服务进程中；页面只选择 Provider，不读取 Key。

看到地址后，在浏览器打开：

```text
http://127.0.0.1:8765
```

不要直接双击 `pipeline.html`，否则页面无法调用本地 Agent API。

代码或场景配置更新后，应在旧终端按 `Control + C`，重新运行启动脚本，再刷新浏览器。

## 2. Step 1：任务域选择

1. 用 1–3 句话描述本次任务（不要手写 A×L/JD 编号）；
2. 如需业务语境，可从下拉框加载高速、油气、桥梁、园区等可选示例；
3. 点击确认进入 Step 2。

随时可用顶部 **保存 / 加载**。

变量绑定方式含义：

| 绑定方式 | 含义 |
|---|---|
| 固定值 | 场景已给出，Agent 只能引用 |
| 固定取值域 | 场景规定允许范围；具体值在后续任务域模版 / 特定任务模版确定 |
| 由任务提取 | 从人工任务描述中提取；没有证据时保持 TBD |

## 3. Step 2：扩充与提取

1. 在左侧选择 Gemini 或 DeepSeek，以及本机配置的模型档位；
2. 运行文案扩充，得到可编辑完整业务文案；
3. 人工修改并确认文案；
4. 运行分类与提取，得到 A×L、JD 变量域和 Runtime Dependency 候选；
5. 对每个候选能力复核 L1–L4。若人工改级，填写确认依据；
6. 按需移除或补充外部执行器、外部系统、人工决定接口。新增项固定为不评分，并填写确认依据；
7. 确认人工复核后进入 Step 3。

黄色 `needs_review` 表示确定性校验有待处理项，不等于模型调用失败。

## 4. Step 3：任务域模版

域编辑器中为每一行 JD 选择模式：

| 模式 | 含义 |
|---|---|
| fixed | 固定具体值 |
| enum | 离散选项（逗号分隔） |
| range | 数值区间 [min, max] |
| TBD | 未知，Step 4 仍可能得到 null |

确认任务域模版后进入 Step 4。

## 5. Step 4：特定任务模版

1. 选择模式：单个 Seed / 批量范围 / 全遍历；
2. 点击 **生成特定任务模版**；
3. 同一 Seed 对同一任务域模版 始终得到相同结果。

API：`POST /api/task-template/generate`（兼容旧路径 `/api/instance/generate`）。

## 6. 常见问题

| 现象 | 处理 |
|---|---|
| 页面打不开 API | 用 `http://127.0.0.1:8765` 打开，不要用 file:// |
| `missing_api_key` | 设置所选 Provider 的 `GEMINI_API_KEY` 或 `DEEPSEEK_API_KEY` 后重启服务 |
| Step 4 报 schema 错误 | 检查任务域模版的 enum/range 是否填完整；查看服务终端日志 |
| 中文任务标题 | 服务端会把 template id 规范成 ASCII，不影响展示标题 |

更完整的模块说明见 [代码梳理](codebase_guide.md)。
