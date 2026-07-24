# UAV Benchmark Factory：六步 Pipeline 操作流程

入口：`http://127.0.0.1:8765`（`pipeline.html`）。  
启动：`./scripts/start_agent_demo.sh`，并在 `.env` 配置 API Key。

本页不跑真实 SUT / 仿真 / GT / Grader，而是把**任务描述**收成可审阅、可复现、
可分别交给世界侧与用户侧的配置交付包。

当前代码采用 `ability-id-v3-2026-07-20`，能力使用连续编号 A1–A17。

## 整体在干什么

```text
自然语言任务
    ↓ STEP 1
任务描述（可加载场景示例）
    ↓ STEP 2
目标 Coverage → 扩充文案 → A×L 分类
    ↓ STEP 3
JD业务变量树子树（A×L 限定）→ 人工变量选择清单 → canonical JD 域
    ↓ STEP 4
任务域模版（fixed / enum / range / TBD）
    ↓ STEP 5
Task Template 批次（案例数量 → 具体 JD 值 → 完整自然语言正文）
    ↓ STEP 6
world_config + user_config + 隔离校验 + 导出
```

两个模版别混：

| 概念 | 含义 |
| --- | --- |
| **任务域模版**（STEP 4） | 每个 JD 允许怎么取值（固定值 / 枚举 / 区间 / TBD） |
| **Task Template**（STEP 5） | 同一域模版生成的一组具体案例；正文用 canonical JD 和实际取值作审阅标注 |
| **配置交付**（STEP 6） | 每个案例的 `task_template`、`world_config`、`user_config` 和校验结果 |

侧栏「本次运行」可看 Provider、进度、Coverage（按 G 分组）等；阶段轨可在已解锁步骤间跳转。
顶部“JD业务变量树”用于整页查看完整变量树；树页面的“返回 Pipeline”会恢复
离开前的步骤和页面位置。

## STEP 1 · 任务域选择

写清任务即可。需要示例时，从下拉选场景（高速 / 油气 / 桥梁 / 园区等），内容会直接填进文本框，可再改。确认后进入 STEP 2。

## STEP 2 · 文案与 A×L

三件事串在一起：

1. **先定目标 Coverage**：可手动选择，也可按 Seed 生成一组随机草案后再修改
2. **确认 Coverage → 扩充文案**（自动保存）
3. **确认文案 → 只跑 A×L 分类**（按已选 A×L 分批，可看进度）

JD 域提取不在这一步，放到 STEP 3。

**L 等级要点：**

- L3 = 累计覆盖 L1–L3（更高同理）
- 「不覆盖」= **L0**（本次不计分，不是“考到 L0”）
- 同一 Seed 会得到同一组 A×L 草案；“换一组”会生成新 Seed
- 随机只用于减少逐项选择工作，结果仍需人工确认
- 不同 L 用颜色区分，方便扫一眼

分类完成后可看到结果 chips，确认 A×L 再进 STEP 3。

## STEP 3 · JD业务变量树选变量与域提取

根据 STEP 2 已确认的 A×L，页面只加载相关能力变量，不显示也不选择全局变量。
默认勾选遵循累计等级：L2 取 L1–L2，L3 取 L1–L3，L4 取 L1–L4。它不会让
Agent 自由探索完整 444 节点。

每个细粒度变量会显示：

- 变量树原始 node ID 和名称；
- 可追溯的 canonical JD（细粒度节点仍是 `proposed`，不会冒充 canonical）；
- `configuration_side`、`variable_role`、`visibility`、`observation_channel`；
- Hidden GT 标记；
- 变量树中缺失的元数据，原样显示为 TBD。

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

## STEP 5 · Task Template

输入要生成的案例数量，默认 10。页面不再要求先选择“单个 / 随机 / 遍历”等模式。
Seed 被收进高级选项，仅用于复现；同一任务域模版和同一批次 Seed 会得到同一批案例。

每个案例同时显示：

- **审阅正文**：以 STEP 2 确认的七段文案为骨架。已在原文出现的实际值会直接在
  原句位置标注，其他 JD 按场景、执行、观测、职责、异常、输出、完成条件分别补入
  对应段落，例如 `【jd-0.2 工作空间结构＝城市高楼峡谷】`；最终仍保持七段，
  不在第七段后追加变量清单；
- **本案例具体化明细**：默认展开，保留原有 STEP 5 的 Seed 具体化说明、A×L、
  每个 JD 的“任务域取值域 → 本案例值”对照和运行计划；配置项按用户侧、世界侧、
  双侧共享、Hidden GT、归属待确认分组；
- **SUT 可见正文**：不含 Hidden GT 和世界侧私有数据；
- **机器 Manifest**：任务目标、A×L 能力边界、完成条件、异常流程、外部依赖、JD 绑定与 TBD。

页面同时统计这一批实际包含多少种不同 JD 配置。如果取值域只能产生少量组合，
页面会标明重复案例和真正发生变化的 JD；增加不同案例必须先在 STEP 4 确认更多取值，
系统不会为了凑数量编造任务事实。

## STEP 6 · 配置与交付

每个案例均有三类可独立下载的产物：

| 产物 | 谁使用 | 主要内容 |
| --- | --- | --- |
| `task_template` | 人工评审、编排系统 | 完整正文、SUT 正文和机器 Manifest |
| `world_config` | Simulator / Fixture / Harness / 世界侧 Config Agent | 世界资产、布置、扰动、事件、时间线、可调变量和 Hidden GT |
| `user_config` | SUT / 用户侧 Config Agent / 任务接口 | 可见输入、任务要求、允许动作、输出合同、Executor 依赖和运行约束 |

页面会确定性检查 Hidden GT 隔离、共享引用、canonical JD、TBD 默认值和未确认阈值。
统一 TBD 区只接受“具体值 + 来源”；没有来源的内容继续保留 TBD。可分别复制/下载
三个 JSON，或下载包含全部案例的完整批次。

如果在 STEP 2–4 修改过复核结果，STEP 6 会提示交付物已过期。点击顶部
“按复核结果重新生成”，三类产物和校验结果会一起刷新。

TBD 按责任方流转：业务取值交给业务/任务负责人，变量角色与投影缺口交给 JD
变量树维护方，允许动作交给接口/安全负责人，Simulator API 交给适配方。草案允许
保留 TBD；只有进入相应接入或正式运行前才必须闭环。

## 保存 / 加载 / 重新开始

- 操作会自动暂存在浏览器；刷新一般不丢进度
- **保存 / 加载**：手动检查点（本机 `saved_pipeline.json`，不进 Git）
- **重新开始**：清空当前页进度；检查点仍可「加载」恢复
- 长任务（分类 / 提取）若中途刷新，服务端已跑完的结果会尽量从 status / `.agent_runs/` 自动接回

## 相关文档

- 操作说明（文字版）：[config_agent_quickstart.md](config_agent_quickstart.md)
- 前端模块结构：[../pipeline/README.md](../pipeline/README.md)
- 代码梳理：[codebase_guide.md](codebase_guide.md)
