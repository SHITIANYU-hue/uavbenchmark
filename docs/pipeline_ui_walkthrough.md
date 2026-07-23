# UAV Benchmark Factory：五步 Pipeline 操作流程

入口：`http://127.0.0.1:8765`（`pipeline.html`）。  
启动：`./scripts/start_agent_demo.sh`，并在 `.env` 配置 API Key。

本页不跑真实 SUT / 仿真 / GT / Grader，只把**任务描述**收成可复现的 **特定任务模版**（具体 JD 取值）。

当前代码采用 `ability-id-v3-2026-07-20`，能力使用连续编号 A1–A17。

## 整体在干什么

```text
自然语言任务
    ↓ STEP 1
任务描述（可加载场景示例）
    ↓ STEP 2
目标 Coverage → 扩充文案 → A×L 分类
    ↓ STEP 3
JD Version2 子树（A×L 限定）→ 人工变量选择清单 → canonical JD 域
    ↓ STEP 4
任务域模版（fixed / enum / range / TBD）
    ↓ STEP 5
特定任务模版（Seed → 一组具体 JD 值）
```

两个模版别混：

| 概念 | 含义 |
| --- | --- |
| **任务域模版**（STEP 4） | 每个 JD 允许怎么取值（固定值 / 枚举 / 区间 / TBD） |
| **特定任务模版**（STEP 5） | 同一域模版 + Seed 抽出的一组具体值；同 Seed 可复现 |

侧栏「本次运行」可看 Provider、进度、Coverage（按 G 分组）等；阶段轨可在已解锁步骤间跳转。

## STEP 1 · 任务域选择

写清任务即可。需要示例时，从下拉选场景（高速 / 油气 / 桥梁 / 园区等），内容会直接填进文本框，可再改。确认后进入 STEP 2。

## STEP 2 · 文案与 A×L

三件事串在一起：

1. **先选目标 Coverage**（由人明确选择；当前没有确认资料时不写死默认等级）
2. **确认 Coverage → 扩充文案**（自动保存）
3. **确认文案 → 只跑 A×L 分类**（按已选 A×L 分批，可看进度）

JD 域提取不在这一步，放到 STEP 3。

**L 等级要点：**

- L3 = 累计覆盖 L1–L3（更高同理）
- 「不覆盖」= **L0**（本次不计分，不是“考到 L0”）
- 不同 L 用颜色区分，方便扫一眼

分类完成后可看到结果 chips，确认 A×L 再进 STEP 3。

## STEP 3 · JD Version2 选变量与域提取

根据 STEP 2 已确认的 A×L，页面只加载相关能力子树和全局变量。它不会让
Agent 自由探索完整 444 节点。

每个细粒度变量会显示：

- V2 原始 node ID 和名称；
- 可追溯的 canonical JD（细粒度节点仍是 `proposed`，不会冒充 canonical）；
- `configuration_side`、`variable_role`、`visibility`、`observation_channel`；
- Hidden GT 标记；
- V2 中缺失的元数据，原样显示为 TBD。

操作顺序：

1. 审阅或调整勾选；
2. 生成 `jd_tree_selection.json`，需要时复制或下载；
3. 在清单范围内运行 Agent 域提取；
4. 查看 canonical JD 域和 TBD，确认后进入 STEP 4。

## STEP 4 · 任务域模版

域编辑器：为每个 JD 选模式并编辑域。

| Mode | 含义 |
| --- | --- |
| `fixed` | 固定值 |
| `enum` | 离散选项 |
| `range` | 数值区间 |
| `TBD` | 未知；可按已知来源复核或人工补充，来源不足时继续保留 |

这里定的是**取值范围**，还不是某一趟任务的具体采样值。

## STEP 5 · 特定任务模版

重点是每个 Seed 下 JD 取到的**具体值**。

- 模式：单个 Seed / 随机一批 / 批量范围 / 全遍历
- 同 Seed 结果可复现；可「换一批」再生成
- 卡片可收起；内含文字说明（任务叙述 + 关键 JD）
- STEP 4 域模版折叠在底部作参考（Domain → Value）

## 保存 / 加载 / 重新开始

- 操作会自动暂存在浏览器；刷新一般不丢进度
- **保存 / 加载**：手动检查点（本机 `saved_pipeline.json`，不进 Git）
- **重新开始**：清空当前页进度；检查点仍可「加载」恢复
- 长任务（分类 / 提取）若中途刷新，服务端已跑完的结果会尽量从 status / `.agent_runs/` 自动接回

## 相关文档

- 操作说明（文字版）：[config_agent_quickstart.md](config_agent_quickstart.md)
- 前端模块结构：[../pipeline/README.md](../pipeline/README.md)
- 代码梳理：[codebase_guide.md](codebase_guide.md)
