# Config Agent Pipeline 操作说明

完整的五步说明见 [Pipeline UI 操作流程](pipeline_ui_walkthrough.md)。

当前页面入口：`pipeline.html`（样式/脚本在 `pipeline/`）。五步流程：

当前目录采用 `ability-id-v3-2026-07-20`，能力使用连续编号 A1–A17。旧编号检查点不会自动迁移，以免同一 A/JD ID 被解释成新能力；需要在新版本中重新运行任务。

```text
STEP 1  任务域选择      任务描述 + 可选场景示例
STEP 2  文案与 A×L      Coverage → 文案扩充 → A×L 分类
STEP 3  JD V2 选变量    加载子树 → 勾选 → 生成清单 → 提取
STEP 4  任务域模版      fixed / enum / range / TBD
STEP 5  特定任务模版    Seed → 具体 JD 值
```

- **任务域模版**：每个 JD 的取值范围  
- **特定任务模版**：同一域模版 + Seed 抽出的一组具体值（可复现）

页面不跑真实 SUT / simulator / GT / Grader。

## 保存与重新开始

- 操作会自动暂存在浏览器；刷新一般不丢进度  
- **保存 / 加载**：手动检查点（本机 `saved_pipeline.json`，不进 Git）  
- **重新开始**：清空当前页进度；检查点仍可「加载」恢复  

已到达的步骤可在阶段轨自由跳转。

## 启动

```bash
./scripts/start_agent_demo.sh
```

`.env` 里配置 `DEEPSEEK_API_KEY` 和/或 `GEMINI_API_KEY`，然后打开：

```text
http://127.0.0.1:8765
```

不要用 `file://` 打开 HTML。改代码或 Key 后请重启服务再刷新。

侧栏可选 Provider（DeepSeek / Gemini）和模型档位。

## 五步怎么用

### STEP 1 · 任务域选择

写清任务；需要时用下拉加载场景示例（会写入文本框）。确认 → STEP 2。

### STEP 2 · 文案与 A×L

1. 手动选择目标 Coverage，或输入 Seed 后点“按 Seed 随机草案”
2. 随机结果可以逐项修改；“换一组”生成新 Seed，“全部清空”回到 L0
3. 没有确认资料时页面不会替你写死默认等级，随机结果也不会自动获批
4. **确认 Coverage → 运行文案扩充**
5. 改文案后 **确认文案 → 跑分类**
6. 看结果里的 A×L，确认 → STEP 3

自然语言文案是后续模版的来源，STEP 3/5 也可折叠查看。

### STEP 3 · JD Version2 选变量与域提取

1. 页面按 STEP 2 的 A×L 加载对应能力子树和全局变量，不展开完整 444 节点
2. 检查每个变量的 canonical JD、配置侧、role、visibility、Hidden GT 和 TBD
3. 调整勾选；“恢复 A×L 建议”只恢复建议范围，不代表业务批准
4. **确认选择并生成清单**；可复制或下载 `jd_tree_selection.json`
5. **运行 JD 域提取**；Agent 只能使用清单内映射出的 canonical JD

### STEP 4 · 任务域模版

为每个 JD 选模式：

| 模式 | 含义 |
|---|---|
| fixed | 固定值 |
| enum | 离散选项（逗号分隔） |
| range | 数值区间 |
| TBD | 未知；可“按来源复核”，但来源不足时必须继续保持 TBD |

确认 → STEP 5。

### STEP 5 · 特定任务模版

1. 选生成方式：单个 Seed / 随机一批 / 批量范围 / 全遍历  
2. **生成特定任务模版**  
3. 卡片说明域模版与本实例的关系；JD 分**用户侧 / 世界侧**，并对照「取值域 → 具体值」  

同一 Seed + 同一域模版结果可复现。

> 当前 STEP 5 的两侧卡片仍是过渡展示，不是最终三类交付包。`task_template`、
> `world_config`、`user_config` 的独立 schema、隔离校验和整包导出属于下一批实现。

## 常见问题

| 现象 | 处理 |
|---|---|
| Connection checking / no key | 确认 `.env` 有 Key，并重启 `start_agent_demo.sh`，再硬刷新页面 |
| API 调不通 | 用 `http://127.0.0.1:8765`，不要用 file:// |
| STEP 5 schema 错误 | 检查 STEP 4 的 enum/range 是否填全 |

UI 文件结构见 [pipeline/README.md](../pipeline/README.md)。
