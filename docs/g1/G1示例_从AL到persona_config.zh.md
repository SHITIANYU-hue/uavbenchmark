# G1 一道题：从 A×L template 到可跑 config（execution_anchors + persona）

> 本文 = [`用户情境_设计原则.zh.md`](用户情境_设计原则.zh.md) §7–§13 的一道**完整走查实例**。
> 链路：`A×L template(jd 变量) → mock_user_constructor(三源 JOIN) → config = execution_anchors ⊕ persona → 可跑 test`。
> 域：D-001 无人机 / 油田巡检。任务原型："复查上次有问题那口井"。
>
> **术语（三分）**：**用户模**（`user_model` = `execution_anchors ⊕ persona`；旧称"用户情境"）/ **交互膜**（A1/A14 对话面）/ **events**（collapse 出的轮次）→ judge 投影 anchors → GT。

---

## 0. 一眼看全（config 两半 = PPol 的 `s_base ⊕ P_π`）

| 半 | = | 装什么 | 跨 persona |
|---|---|---|---|
| **execution_anchors** | s_base | **这轮必须办成/说清的任务内容**（目标井/须问出/须回显/须执行/兜底/达成谓词）——invariant | **固定** |
| **persona** | P_π | 怎么交互（几轮/多模糊/披露顺序/情绪） | **变** |

`config = execution_anchors ⊕ persona`。execution_anchors 由 A×L 格经 §8 逐维塑形推出；persona 从 persona 库取。**只变 HOW（persona），不变 what（anchors）** → 同一道题跑 N 个 persona，要办成的事一致。

**⚠ 这里还不涉及 GT。** config 只是一个"可能对话"的**分布**（anchors 定，但有无数种说法）。GT 只在三段的最后出现：

```
① spec(跑前)   : user_sim = execution_anchors ⊕ persona          —— 无 GT，是分布
② collapse+run : materializer 塌成一条具体对话(几轮/多模糊由 persona 定) → 跑 SUT → trace
③ judge(跑后)  : 把 execution_anchors 投影到 trace → 命中/未命中 = GT  —— GT 在此才有
```

**同一份内容、两个相位**：跑前叫 `execution_anchors`（可声明的规格），跑后投影到塌下来那条 trace 才叫 GT（判决）。合仓里"先不翻，judge 时才对"。

---

## 1. template（只有 A×L + jd 变量）

### 1.1 A×L 向量（= 题的身份，固定，不当变量扫）

```jsonc
axl_cells: [
  { A:"A1",  L:"L3", role:"primary",    desc:"[用户→harness · 入 · 用户下达] L3:欠定含历史指代" },
  { A:"A3",  L:"L3", role:"supporting", desc:"[harness⇄SUT · loop · 意图推理] L3:消解'有问题那口'" },
  { A:"A2",  L:"L2", role:"supporting", desc:"[操作接口→SUT · 入 · 约束进SUT] L2:窄边界(高度/禁飞)" },
  { A:"A4",  L:"L2", role:"primary",    desc:"[SUT→操作接口 · 出 · 编排下发] L2:闭环片段" },
  { A:"A14", L:"L3", role:"primary",    desc:"[harness→用户 · 出 · 交接] L3:回显确认(双向)" },
]
```

### 1.2 jd 变量登记表（可 generalize 的轴 = 格内泛化）

| 变量 | jd 锚（挂哪条边/子句） | 池 | generalize? | 本样本取值 |
|---|---|---|---|---|
| V1 场景 | 环境（world） | `worlds.库` | ✅ | `禁飞区演练` |
| V2 目标井 | 任务对象（A1/A4） | `world.井池` | ✅ | `W-05` |
| V3 欠定形式 | 意图入口（A1×L3） | `{历史指代, 模糊描述, 泛指}` | ✅ | `历史指代` |
| V4 persona | 交互对手（A1/A14） | `persona库` | ✅ | `picky_new_supervisor` |
| V5 noise 档 | realism（正交轴） | `{低, 中, 高}` | ✅ | `中` |
| （A×L 向量） | 考什么 | — | ❌ **固定=题身份** | 见 1.1 |

### 1.3 sampling

```jsonc
sampling: { grid_over: ["V1","V2","V3","V4","V5"] }   // 笛卡尔子集 = 覆盖账本;本文物化其中一个点
```

---

## 2. 三源（constructor 的输入）

- **world**（`worlds.库["禁飞区演练"]`）：井 `W-03/W-05/W-07`、隐藏 `W-09/W-11`、机巢 `家/巢-B`、禁飞区 `Z-2`、限高 120m。
- **业务知识**（巡检 SOP）：默认高度 60m / 速度 5m/s；"复查渗漏"=悬停对准+看渗漏项+拍证据；完成=渗漏判定 + 证据帧；单点任务预算 ~6 轮。
- **persona 库**（§13.5，轴 = tau-trait ∪ PPol seed ∪ 域轴）：取 `picky_new_supervisor`。

---

## 3. 物化一个样本（填 V1–V5 → constructor 跑 §8 逐维塑形）

`(禁飞区演练, W-05, 历史指代, picky_new_supervisor, noise=中)` → 逐格塑形：

- A1×L3 → 欠定下达（历史指代）+ 私有知识藏 `{那口井=W-05, 依据}` + 预置 `历史[run#K]`
- A3×L3 → 深解释（须消解"有问题那口"）
- A2×L2 → `bound_constraints=[高度60m, 禁入Z-2]`
- A4×L2 → `required_actions=闭环片段`
- A14×L3 → `required_confirmations=[回显+等确认]`；反应式策略

---

## 4. 输出 config

### 4.1 execution_anchors（= s_base，跑前的 invariant 任务内容；judge 时才投影成 GT）

```yaml
execution_anchors:   # 这轮"必须办成/说清"的事，persona 无关、固定；judge 时逐条投影到 trace → GT
  world: 禁飞区演练
  target: W-05                                     # ← A1/A4 任务对象
  required_disclosures:                            # ← A1×L3 欠定 → 用户必须(以某种方式)传达
    - {slot: 那口井, value: W-05}
    - {slot: 依据,   value: "run#K 渗漏读数超标"}
  required_confirmations:                          # ← A14×L3 用户期待被回显确认
    - {回显: "复查 W-05 渗漏", 需等确认: true}
  required_actions:                                # ← A4×L2 一条正确运行须闭环执行
    - [航线飞 W-05, 悬停, 看 渗漏, 拍 证据]
  bound_constraints:                               # ← A2×L2 边界(不得违反)
    - "高度 60m"
    - "禁入 Z-2"
  internalize_fallback: []                         # ← 本题无 L4 维 → 空（对照 L4 题此处列全）
  goal_predicate: "复查结论已回报(渗漏判定 + 证据帧)" # ← 想要的结果
  history:
    - {ref: "run#K", 摘要: "W-05 渗漏超标(疑似), W-03/W-07 正常"}
```

> 注：`required_disclosures` 是"用户**必须传达**的内容"，但**用几轮、清楚还是含糊，全由 persona 定**——W-05 可以 turn0 直接说、也可以说"上次那口"逼 agent 问。anchors 定"要传达什么"，persona 定"怎么传达"。

### 4.2 persona（= P_π，来自 persona 库，PPol schema）

```json
{
  "persona_id": "picky_new_supervisor",
  "description": "老陈,刚接手A区运维主管三个月。技术出身但对这套无人机agent还没完全放心,凡事想听个说法。月底要交巡检报告,有点紧。",
  "axis_placement": { "terse": false, "skeptical": true, "frustrated": false,
                      "ambiguous": false, "incremental_disclosure": true,
                      "detail_obsession": true, "expertise": "high", "trust": "low" },
  "reasoning": "新主管为立威+自保,多疑+较真+边说边补,情绪尚稳。",
  "noise_level": "中",
  "expanded_instruction":
    "你是老陈,刚接手A区运维主管三个月。技术底子有,但对这套无人机agent还没完全放心,想听它把道理讲清。这个月要交巡检报告,心里有点紧。说话不啰嗦也不惜字,爱边说边想起细节往上补('对了,还有…');交代任务不会一次给全参数,agent问了或你想起来才补。你信不过'我做好了'——它说完你会追一句'具体哪几口?依据什么?'。它回显确认时你会仔细核对,哪怕一个井号错了也立刻纠正,语气不重但较真。它做得对、说得清,你就认可放行。你不带情绪,但被反复问同一件事会淡淡说'这个我刚说过'。绝不提'模拟''benchmark''AI'。"
}
```

### 4.3 config = 拼接

```
用户侧 system prompt = s_base(由 execution_anchors 渲染:目标/私有知识/历史/成功判据)
                       ⊕ persona.expanded_instruction
materializer = policy+llm (R2)   // 反应性由策略承载,LLM 只按 persona 措辞
```

---

## 5. 跑一遍预览（GT 锚不变 × persona 有纹理）

R2 materializer 跑 `s_base ⊕ P_π`，一条种子 → 涌现多轮；右侧标命中的 anchor：

```
turn0  A1←用户 : "老陈这边。上次那轮里有问题那口,你再去复查下,重点看渗漏。"   种子·欠定(V3=历史指代)
turn1  A14→agent: "上次有问题具体哪口?run#K 里 W-05、W-03 都有记录。"          agent 澄清
turn2  A1←用户 : "W-05。上周它渗漏读数超标了。"     策略:遇澄清→披露; persona:边说边补依据
                                                    ✔ required_disclosures[那口井=W-05, 依据]
turn3  A14→agent: "明白,复查 W-05 渗漏,60 米高、避开 Z-2,对吧?"               agent 回显
turn4  A1←用户 : "对。你打算怎么判定渗漏?先说说。"  persona:多疑→追依据(D3 skeptical)
                                                    ✔ required_confirmations[回显 W-05 渗漏]
turn5  ...agent 执行 航线飞 W-05→悬停→看渗漏→拍证据...  ✔ required_actions · ✔ bound_constraints(未进 Z-2)
turn6  A14→agent: "W-05 复查完:渗漏确认,已拍两张证据。"                        汇报
turn7  A1←用户 : "行,报告里把证据附上。"           persona:较真  ✔ goal_predicate → 终止
```

换一个 persona（如 `老把式`：话少·信任·急）跑同一 `s_base`：turn4 的"追依据"没了、可能不回显直接放行 → **轨迹更短、纹理不同，但要命中的 anchor 一模一样**（消解 W-05 + 执行 + 回报）。**persona 改路径，execution_anchors 定终点。**

---

## 6. 为什么它是一道 test（而非"跑着看"）

1. **execution_anchors = 可声明的规格**：`required_disclosures/confirmations/actions/goal_predicate/bound_constraints` 每条都是一个 checklist 点；**跑前是规格，judge 时投影到 collapse 出的 trace → 命中/未命中 = GT**（对接 §5 交互点 + config 三分 `invariants[]`）。
2. **persona 变、anchors 不变**：V4/V5 扫 persona 库 × noise → 同题多纹理，测鲁棒；要办成的事不动（PPol goal-invariance）。
3. **grid = 覆盖账本**：V1–V5 的 `grid_over` 就是这道题在 (场景×井×欠定形式×persona×noise) 上的覆盖；A×L 向量固定 = 它始终考这五格。
4. **固化成回归**：跑出（collapse）的好轨迹（如 §5）→ 冻结成 R4 bundle（§13 双件套），进 test 套件；**判分后的 GT/轨迹不回流 agent corpus**（§13.3 防火墙）。

---

## 附：这道题用到的先例锚点

- `s_base ⊕ P_π`、persona schema、四行为维度、goal-invariance ← **PPol / Beyond Cooperative Simulators**（arxiv 2605.12894）
- persona 轴（skeptical/impatient/…）← **tau-trait**（collinear-ai）+ **Impatient Users Confuse AI Agents**（2510.04491）
- 隐藏 persona+goal / GT=终态 / 独立 LLM 用户 ← **τ-bench / τ²-bench**
- jd 变量登记 + generalize + grid_over ← 内部前期资料《无人机案例到可执行 config 规范》+ G1/A4 README
