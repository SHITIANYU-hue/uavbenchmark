# Config Agent Pipeline 操作说明

完整的六步说明见 [Pipeline UI 操作流程](pipeline_ui_walkthrough.md)。

当前页面入口：`pipeline.html`（样式/脚本在 `pipeline/`）。六步流程：

当前目录采用 `ability-id-v3-2026-07-20`，能力使用连续编号 A1–A17。旧编号检查点不会自动迁移，以免同一 A/JD ID 被解释成新能力；需要在新版本中重新运行任务。

```text
STEP 1  任务域选择      任务描述 + 可选场景示例
STEP 2  文案与 A×L      Coverage → 文案扩充 → A×L 分类
STEP 3  JD业务变量树    加载子树 → 勾选 → 生成清单 → 提取
STEP 4  任务域模版      fixed / enum / range / TBD
STEP 5  Task Template   输入案例数量 → 生成完整自然语言案例
STEP 6  配置与交付       world_config / user_config → 校验 → 导出
```

- **任务域模版**：每个 JD 的取值范围  
- **Task Template**：把一组具体 JD 值写入顺畅、可审阅的任务正文，同时保留机器 Manifest
- **配置交付**：同一案例对应的世界侧配置和用户侧配置；Hidden GT 只允许在世界侧

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

Pipeline 标题旁的“JD业务变量树”会在当前标签页打开完整变量树；点击变量树
顶部“返回 Pipeline”可回到原来的步骤和页面位置。

侧栏可选 Provider（DeepSeek / Gemini）和模型。Gemini 默认使用
`Gemini 3.6 Flash`，也可切换到 `Gemini 3.5 Flash` 或
`Gemini 3.5 Flash Lite`；页面显示的用量与限额仍以当前 API 账号为准。
若 Gemini 的结构化提取因输出上限被截断，服务会保留原始响应，并只重试
当前失败批次一次；已经确认的 A×L 与 JD 选择不会丢失。

## 六步怎么用

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

### STEP 3 · JD业务变量树选变量与域提取

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

### STEP 5 · Task Template

1. 在“生成数量”中填写案例数；默认是 10，也可以填写 8、9 或其他正整数
2. 点 **生成 Task Template**
3. 用案例标签切换查看；重点审阅两段文字：
   - **审阅正文**：使用 `【canonical JD＝本案例实际取值】` 标注变量，并按场景、
     对象、平台、执行、安全和交付语义写入相应段落
   - **SUT 可见正文**：去掉 Hidden GT 和世界侧私有信息，可直接交给任务接口
4. 展开“任务域 → 本案例具体值”，核对 STEP 4 取值域和本案例实际取值
5. 查看“不同 JD 配置”提示；若 10 个 Seed 只能形成少量配置，需要先回 STEP 4
   确认更多可选值，Pipeline 不会自行补造
6. 需要复现时再展开“高级选项”查看批次 Seed；“换一批案例”会使用新 Seed
7. 确认这一批案例后进入 STEP 6

### STEP 6 · 配置与交付

1. 左侧查看 `world_config`：场景资产、布置、扰动、事件、时间线、世界变量和 Hidden GT
2. 右侧查看 `user_config`：SUT 可见输入、任务要求、允许动作、输出合同、外部 Executor 和运行约束
3. 查看确定性校验：Hidden GT 不泄漏、共享引用一致、canonical JD 有效、TBD 未被填成默认值
4. 在统一 TBD 区补充已确认值；必须同时填写来源，修改会写入 provenance 和 edit history
5. 分别复制或下载三类 JSON，也可以下载完整批次 JSON

没有确认的阈值、业务规则、允许动作和 simulator API 会继续显示为 TBD，不会自动编造。

页面会为每项 TBD 标明责任方：

- **业务 / 任务负责人**：任务完成条件等业务取值；只有拿到明确来源时才填写
- **JD 变量树维护方**：`variable_role`、投影、可见性等元数据缺口
- **任务接口 / 安全负责人**：允许动作和权限边界
- **Simulator / Fixture 适配方**：适配器和平台 API

不知道的内容直接保留 TBD，即可下载草案交付包；在对应的真实接入或 benchmark
运行前，再由责任方确认。不要凭经验猜数值。

## 常见问题

| 现象 | 处理 |
|---|---|
| Connection checking / no key | 确认 `.env` 有 Key，并重启 `start_agent_demo.sh`，再硬刷新页面 |
| API 调不通 | 用 `http://127.0.0.1:8765`，不要用 file:// |
| STEP 5 生成失败 | 检查 STEP 4 的 enum/range 是否填全，并确认本地服务仍在运行 |
| STEP 6 显示 needs_review | 查看 TBD 与“配置归属元数据”项；这是待确认，不等于系统擅自报错 |
| 顶部已选 STEP 6、正文仍是 STEP 5 | 按 `Command + Shift + R` 强制刷新；页面资源带版本标识，刷新不会清空浏览器草稿 |

UI 文件结构见 [pipeline/README.md](../pipeline/README.md)。
