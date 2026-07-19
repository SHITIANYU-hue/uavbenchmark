# G1 用户侧 benchmark setup（怎么搭起来）

> 本文 = **可落地的搭建入口**：把 user-side G1 benchmark 的对象、管线、运行、判分、复用、分阶段一次说清。
> 深读：设计原则见 [`用户情境_设计原则.zh.md`](用户情境_设计原则.zh.md)；一道走查题见 [`G1示例_从AL到persona_config.zh.md`](G1示例_从AL到persona_config.zh.md)。
> 一句话定位：**度量一个 SUT 的人机交互能力（G1）**——它是被测，我们造"用户 + 世界 + 判据"喂它。
>
> **术语（三分，勿混）**：**用户模**（user model / `user_model` = `execution_anchors ⊕ persona`，对用户建模；旧称"用户情境"，替换 `user_membrane`）/ **交互膜**（A1/A14 conversation 面，"膜"只指这个）/ **events**（collapse 出的轮次）。链条：用户模 →(materializer 在)→ 交互膜 →(collapse)→ events →(judge 投影 anchors)→ GT。

---

## 0. 一图看全

```
template(纯 A×L 向量 + jd 变量)
   │  ①选题:考哪几条边的哪个 L
   ▼
mock_user_constructor  ◀─ world config(井/几何/规则) + 业务知识(SOP) + persona库
   │  ②三源 JOIN + 逐维塑形(§8 principles)
   ▼
config = execution_anchors ⊕ persona
   │  execution_anchors = 必须办成/说清的事(invariant)   persona = 怎么说出来(P_π)
   ▼
materializer = 引擎 self-host「上下文框架下想」   ◀─ SUT(被测,膜另一侧)
   │  ③agent 等 → 用户侧 想 → agent 使用 → … collapse 成一条对话
   ▼
event & trace
   │  ④judge:把 execution_anchors 投影到 trace
   ▼
GT 命中清单 → 分数 → 聚合(A×L 画像)     好 collapse → 固化 R4(回归) ┈防火墙┈ 不回流 agent corpus
```

---

## 1. 测什么（G1 定位 · A 边坐标）

G1 = 人机交互组 = **A1 / A2 / A3 / A4 / A14**（Avant-Bench 流水线图的五条边）：

| A | 边 | 归属 | 我们做什么 |
|---|---|---|---|
| **A1** | 用户→harness（下达） | 用户膜（域不变） | **用户侧出招** |
| **A14** | harness→用户（请示/汇报/回显） | 用户膜（域不变） | **用户侧收招 + 判分主来源** |
| A2/A3/A4 | 操作接口/loop（SUT 内环） | SUT 内部 | 不碰，只从 trace 观测 |

- **A1/A14 域不变**：D-001/D-002/C-001 用同一套 schema，只换 world + 业务知识。
- **G1-ness = (A1 或 A14 非 L0)**：A1×L0（非对话发起，种子从 A2/世界事件进）+ A14≥L1（agent 单向汇报）= **监督型 G1**；只有 A1×L0 ∧ A14×L0 才出 G1。

---

## 2. 核心对象（schema）

### 2.1 template（**只有 A×L**，per-A 的 L 向量 L0–L4 + jd 变量）

```jsonc
{
  interaction_group: "G1",
  axl_cells: [ { A, L, role, desc:"[边表示·恒定] L?:特化" }, ... ],   // 混档 = 正常
  变量登记表: [ { 变量, jd锚, 池, "generalize?" }, ... ],             // 可扫的泛化轴
  sampling: { grid_over: [...] }                                     // = 覆盖账本
}
```
- **A×L 向量 = 题的身份（固定，不扫）**；jd 变量（场景/目标/欠定形式/persona/noise）= 格内泛化轴。
- template 里**没有** simnorm、没有内核、没有交互脚本——交互形态是下游涌现的。

### 2.2 execution_anchors（= s_base，**跑前规格，invariant，persona 无关**）

```yaml
execution_anchors:                # "一条正确运行必须办成/说清什么";judge 时逐条投影→GT
  target: W-05
  required_disclosures: [ {slot, value}, ... ]     # A1×L3 欠定 → 用户必须(某种方式)传达
  required_confirmations: [ {echo_has, wait}, ... ] # A14×L3 → agent 须回显+等确认
  required_actions: [ verb, ... ]                   # A4 → 须闭环执行(落 target 上)
  bound_constraints: { alt_max, no_fly, ... }       # A2 → 不得违反
  internalize_fallback: [ ... ]                     # L4 维 → 应内化兜底(各方面列全)
  goal_predicate: "..."                             # 想要的结果
  history: [ ... ]                                  # L3 历史指代用
```
每字段由某个 (A,L) 格经**逐维塑形表**（§8 principles）推出。

### 2.3 persona（= P_π，从 persona 库取，PPol schema）

```json
{ "persona_id","description","axis_placement":{...},"reasoning",
  "noise_level","expanded_instruction":"150-250字 roleplay" }
```
- **s_base ⊕ P_π**（PPol）：用户侧 prompt = anchors 渲染的 s_base ⊕ persona 的 expanded_instruction。**只变 HOW，不变 what**。
- **persona 库 = 用户侧的 worlds.库**；两条正交子轴：**persona-style**（爱聊/话少/多疑/急…压 A3/A14）× **interaction-pattern**（配合/含糊/变卦…压特定格）。
- 轴 = **tau-trait ∪ PPol seed ∪ 域轴**（skeptical/impatient/terse/frustrated/ambiguous + detail/expertise/trust），paired-playbook 格式。pool **自造**（域绑定）但 bootstrap（轴+方法+身份种子现成）。

### 2.4 config = execution_anchors ⊕ persona

materializer 直接吃这个。**GT 不在 config 里**——config 只是"可能对话"的分布（§5）。

---

## 3. 生成管线（template → config）

`mock_user_constructor(template, world_config, 业务知识) → config`：读 A×L 向量 → 套**逐维塑形表**（§8）→ 锚世界填对象 → 灌业务常识 → 出 `execution_anchors ⊕ persona`。**结构域不变，填充域参数化**（= config-agent 的用户侧特化，只填充不发明）。

三条**正交轴**（别缠一起）：

| 轴 | 变什么 | 由谁定 |
|---|---|---|
| **A×L 难度** | 考什么 / 上下文谁持有 | template |
| **R 复现档 R0–R4** | 多确定（materializer 决策核） | 运行配置 |
| **noise realism** | 表面纹理（GT 对 noise 不变） | persona-style 产出 |

---

## 4. 运行：materializer = 引擎 self-host「上下文框架下想」★

**关键洞见：模拟用户不用新造子系统——它是引擎在膜另一侧自己跑一次 `想`，persona 入框架、anchors 入素材。**

```
用户侧产出下一句 A1 =
  ::(上下文框架下想: 描述=作为此用户回应对话, 框架=persona | 下一句)
   = ::(查:上下文 | ctx)                     ctx = 对话历史
  @' ::(框架下想: &[描述,ctx], persona | 下一句)
   = ::(查:框架 | persona文)  @' ::(想: 描述, persona文, 素材=anchors | 下一句)
```

**交接循环**（materializer 控制循环，R 不变）：

```
用户侧发种子 A1(execution_anchors 决定"要传达什么", persona 决定"怎么说")
loop:
   SUT 处理 → 落 A14(请示/回显/汇报) 或 动作 → 进入 等
   agent 一「等」→ 用户侧跑 上下文框架下想(persona框架) → 产下一句 A1 → 喂回 SUT「使用」
until  goal_predicate 满足 | 预算耗尽(轮数上限 = 1 + 澄清(A1_L) + 汇报/确认(A14_L))
```

- **collapse**：anchors⊕persona 是分布，跑一次塌成一条具体对话。
- **决策核按 R 档**：R4 回放 / R3 规则 / **R2 策略核+LLM膜** / R1·R0 自由 LLM（`想` 就是这层）。
- **隔离（必守）**：用户侧 `想` 的 LLM ≠ SUT 的 LLM（防同模型作弊）→ 引擎需 per-side LLM 配置。
- **第一版轻量**：用户侧只跑 `想`（生成一句）；以后升成真·用户简诺（披露/追问/批准… 动词表，见待办）。

---

## 5. 判分：两相位真值

```
① spec(跑前)  : execution_anchors —— 可声明规格,invariant
② collapse+run: materializer 塌成一条 trace
③ judge(跑后) : execution_anchors 逐条投影到 trace → 命中/未命中 = GT
```

**跑前叫 anchors（规格），跑后投影才叫 GT（判决）**——同一份内容两相位，合"先不翻，judge 时才对"。

交互点 = anchors 字段（§5 principles）：意图/动作/终态（沿用 pre/actions/post）+ 澄清/披露/确认/兜底/达成（新增，挂 A1/A14）。

**每条 A = trace 里不同的踩点（anchor point）**——决定各 anchors 字段去 trace 哪里对（详表见 principles §5.x）：

| A | trace 踩点 | 引擎步 | 域 |
|---|---|---|---|
| A1 | 意图理解的 `想` | 读→想→整合 summary | 域不变 |
| A2 | 上下文参数存/取 | `记下`/`查` | 域不变 |
| A3 | 后续持续步 | `继续`/`整合` | 域不变 |
| A14 | 发消息/留存 | `发`/`记下`(留存) | 域不变 |
| A4 | 对实体的编排 | 域动词(drone_command / 改文件·跑命令) | **分域** |

**A1/A2/A3/A14 踩 meta-V（域不变）、A4 踩 domain-V（分域）**——用户侧域不变、A4 是 G1→G2/G3 的桥。黑盒 SUT 下 A2/A3 只能踩效果/reasoning（U-Q7）。

**红线（demo 跑出来抓到的）**：**披露/elicitation 锚点必须判 agent 行为（问出并用上），绝不能判"用户话里出没出现那个词"**——否则 front-load 全说的用户对任何无视它的 agent 都白送满分。同理承 E0–E5：分数代码算、不可观测点不进分母、单调救援、执行门（说了没做→降 partial）。

**R × E 耦合**：R3/R4 给精确符号 GT（硬门）；R0/R1/R2 交互点多需语义判（软门）。复现强度取两者下确界。

**防火墙**：判分后的 GT/轨迹**绝不回流 agent corpus**（教到考题=作废）。corpus 飞轮（编诺，帮 agent）与 test 飞轮（校准/红队，测 agent）两池隔离。

---

## 6. 搭建：复用 vs 新建（→ app 文件）

| 需要的 | 现成件（复用） | 新建/改 |
|---|---|---|
| 生成用户下一句 | `上下文框架下想`/`框架下想`/`想.py`（纯） | 直接调 |
| persona = 框架 | 框架基础设施（`externals/框架/`、store 框架别名、FramesView） | persona 落成 per-session 框架 |
| 交接/挂起唤醒 | `等.py` + `engine.stream_resume` | agent`等`→转调用户侧（非等人） |
| 用户方开关 | `sut_responder.py`（应答方镜像）+ `scenario.py:触发oracle`（雏形） | 加 `用户方 = 人 / 模拟用户`，升格 oracle |
| 编排循环 | `engine.stream_turn` | 模拟用户模式：等→想→loop + 终止 |
| GT 投影 | test runner 断言 + `invariants` | anchors→judge（披露 agent 侧判） |
| 固化/回归 | 编诺 `compare_precipitate` + 守门 + `加自会话` | 好 collapse → R4 frozen；加 `用户归一` |

**红线**：并列加 C-001/用户侧分支，**不改 D-001 既有行为**；测试用 `META_V_DB=<temp>`；用户侧 LLM key 只进 `.env`。

---

## 7. 分阶段落地

| 阶段 | 产出 | 依赖 |
|---|---|---|
| **P0** | 4 个 schema 定稿（template / execution_anchors / persona / config） | 本文 |
| **P1** | persona 库 seed 轴表（tau-trait∪PPol seed∪域轴）+ 3–5 个域 base persona | PPol/tau-trait |
| **P2** | `mock_user_constructor`（逐维塑形表 → config），跑通 template→config | P0/P1 |
| **P3** | `用户方` responder = 引擎 self-host `上下文框架下想`（persona 框架）+ 用户方开关 | 用户侧 LLM 隔离配置 |
| **P4** | materializer 循环（等→想→loop）+ 终止（goal/预算） | P3 |
| **P5** | GT 投影（anchors→judge，披露 agent 侧）+ 接 test runner | P4 |
| **P6** | 固化（好 collapse→R4 frozen）+ 防火墙 | 编诺现成 |
| **P7** | test 飞轮：校准（Kappa）/ 红队 | gold 样本 |

---

## 8. 已验证 & 待办

**已跑通**（`scratchpad/g1_demo.py`，R3 确定性，无 LLM）：同 execution_anchors × 2 persona → 不同 collapse（7 vs 5 轮）但 **GT 同 9/9（persona 变、anchors 命中不变）**；坏 agent（飞错井+不回显+超高）→ **1/9（test 能区分）**。**验证了：管路 + GT 投影 + 两条核心属性。** 未验：R1/R2 LLM collapse 的真实度（keys 空）。

**待拍板**（挪自 principles §14）：

| # | 议题 |
|---|---|
| U-Q3 | 用户侧 LLM 与 SUT LLM 隔离怎么配（防作弊，**P3 阻塞项**） |
| U-Q5 | 用户侧动词表（披露/追问/批准/否决/变卦/催促/放弃/确认）——升级到真·用户简诺时用 |
| U-Q10 | `mock_user_constructor` 确定性程度（结构确定 + 值填充可 LLM 辅助） |
| — | **红线固化**：披露/elicitation 判据必须 agent 侧（demo findings，写进 §5 principles） |

---

## 9. 参考

- 设计原则（axes/逐维塑形/编诺/两相位）：[`用户情境_设计原则.zh.md`](用户情境_设计原则.zh.md)
- 一道走查题（AL→config→run→GT）：[`G1示例_从AL到persona_config.zh.md`](G1示例_从AL到persona_config.zh.md)
- config 三分/承重不变量/AxL：内部前期资料《无人机案例到可执行 config 规范》
- 先例：PPol（arxiv 2605.12894，s_base⊕P_π/persona schema/goal-invariance）· tau-trait（collinear-ai，trait 轴）· τ-bench/τ²-bench（hidden persona+goal/独立 LLM 用户）
- 引擎接线：`sut_responder.py` · `scenario.py:触发oracle` · `_展开式lemma.py`（上下文框架下想）· `想.py` · `等.py` · `engine.stream_turn/stream_resume`
