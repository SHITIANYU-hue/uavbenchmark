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
JD 变量域（按 A 分组）
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

1. **先选目标 Coverage**（默认预填巡检常用 L2；可改等级、按 Seed 随机、恢复默认）
2. **确认 Coverage → 扩充文案**（自动保存）
3. **确认文案 → 只跑 A×L 分类**（按已选 A×L 分批，可看进度）

JD 域提取不在这一步，放到 STEP 3。

**L 等级要点：**

- L3 = 累计覆盖 L1–L3（更高同理）
- 「不覆盖」= **L0**（本次不计分，不是“考到 L0”）
- 不同 L 用颜色区分，方便扫一眼

分类完成后可看到结果 chips，确认 A×L 再进 STEP 3。

## STEP 3 · JD 域提取

根据 STEP 2 已确认的 A×L，单独跑 JD 变量域提取（分批，避免一次返回过长被截断；失败可重试，不必重跑 STEP 2）。

结果按 **A** 分组展示；琥珀色 TBD 会在 STEP 4 补全。

## STEP 4 · 任务域模版

域编辑器：为每个 JD 选模式并编辑域。

| Mode | 含义 |
| --- | --- |
| `fixed` | 固定值 |
| `enum` | 离散选项 |
| `range` | 数值区间 |
| `TBD` | 未知；可「智能填写 TBD」或手改 |

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
