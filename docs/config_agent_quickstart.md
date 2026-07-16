# Config Agent Pipeline 操作说明

本文是当前 `pipeline.html` 的正式操作文档。网页按四步完成：

```text
Step 1: 任务域选择         场景 + 简短描述           [保存] [加载]
Step 2: 扩充与提取         Agent 文案+A×L+JD域       [保存] [加载]
Step 3: 任务域模版    域编辑器(每行选模式)      [保存] [加载]
Step 4: 特定任务模版      Seed→具体 JD 值               [保存] [加载]
```

- **任务域模版（Domain Template）**：每个 JD 的取值域（fixed / enum / range / TBD）
- **特定任务模版**：任务域模版 + Seed 后的具体 JD 赋值（产品名；wire 合同仍为 `task_instance` schema）

当前网页还不运行真实 SUT、simulator、GT/Trace 或 Grader。

## 1. 启动页面

在项目根目录执行：

```bash
cd uavbenchmark
./scripts/start_agent_demo.sh
```

如果终端要求输入 `DEEPSEEK_API_KEY`，粘贴后按回车。也可预先写入本地 `.env`。Key 只保存在本地服务进程中。

看到地址后，在浏览器打开：

```text
http://127.0.0.1:8765
```

不要直接双击 `pipeline.html`，否则页面无法调用本地 Agent API。

代码或场景配置更新后，应在旧终端按 `Control + C`，重新运行启动脚本，再刷新浏览器。

## 2. Step 1：任务域选择

1. 在“业务场景”下拉框中选择场景；
2. 查看该场景已锁定的变量绑定；
3. 用 1–3 句话描述本次任务（不要手写 A×L/JD 编号）；
4. 点击确认进入 Step 2。

随时可用顶部 **保存 / 加载**。

变量绑定方式含义：

| 绑定方式 | 含义 |
|---|---|
| 固定值 | 场景已给出，Agent 只能引用 |
| 固定取值域 | 场景规定允许范围；具体值在后续任务域模版 / 特定任务模版确定 |
| 由任务提取 | 从人工任务描述中提取；没有证据时保持 TBD |

## 3. Step 2：扩充与提取

1. 运行文案扩充（DeepSeek），得到可编辑完整业务文案；
2. 人工修改并确认文案；
3. 再运行分类与提取，得到 A×L 覆盖与 JD 变量域候选；
4. 确认后进入 Step 3。

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
| `missing_api_key` | 设置 `DEEPSEEK_API_KEY` 后重启 `./scripts/start_agent_demo.sh` |
| Step 4 报 schema 错误 | 检查任务域模版的 enum/range 是否填完整；查看服务终端日志 |
| 中文任务标题 | 服务端会把 template id 规范成 ASCII，不影响展示标题 |

更完整的模块说明见 [代码梳理](codebase_guide.md)。
