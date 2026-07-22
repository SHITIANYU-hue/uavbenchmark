# 运行质量指标：对照变量树（.3 节点 / .4 过程）与案例 scoring

> **编号：** A1–A17（`ability-id-v3-2026-07-20`）  
> **分组：** G1=A1–A5 · G2=A6–A9 · G3=A10–A11 · G4=A12–A13 · G5=A14/A16 · G6=A15/A17
> **对照源：** 变量树四层（`docs/jd_4layer_pattern.md`、`knowledge/jd_variable_tree_version2.json`）  
> **已写回树：** `.3`=节点质量、`.4`=过程协议（均含 `runtime_metrics` / `grader_metrics`）；能力根提示 `case_metrics`。重跑：`python3 scripts/annotate_jd_tree_metrics_v2.py`。

> **审阅状态：** 本文及 `knowledge/metric_set_*.json` 中的现有数值是未受审演示候选，`applies_by_default=false`，`threshold_authority=TBD`。没有业务、安全或法规依据前，不得作为默认 Grader 阈值。

---

## 0. 先分清：树槽位 vs 案例 scoring

**「节点 / 过程」说的是变量树四层槽位，不是另起一套 metric 分类。**

```
.1 本体目录
.2 方法与边界
.3 质量标准   ← 树·节点质量（合格阈值）
.4 兜底协议   ← 树·过程协议（异常/处置/升级）
```

| 挂载 | 在哪 | 是什么 | 白墙例子 |
|---|---|---|---|
| **树·节点 .3** | `jd-x.3.*` | 合格阈值/标准；案例 🔒/🔀 绑定 | `jd-11.3.1.1` 位置误差 `[0.1,0.3]m`；`jd-11.3.2.1`=`RMS` |
| **树·过程 .4** | `jd-x.4.*` | 异常类型、处置动作、升级目标 | `jd-11.4.1.1` 关注异常；`jd-11.4.2.1` 处置动作 |
| **案例 scoring** | `case.scoring` / `jd-0.7` | 整局 episode outcome；**不是**树叶子 | `SR` / `CR` / `SPL` |

```
树 jd-11.3.*     →  案例 values 绑定阈值     →  grader：跟踪是否达标
树 jd-11.4.*     →  案例 values 绑定异常/处置 →  grader：是否按协议保护/恢复
（非树叶子）     →  case.scoring             →  整局 SR/CR/SPL
```

约定：

1. 合格线、公差 → 写树上 **`.3`**。
2. 求助/重规划/保护/升级等过程 → 写树上 **`.4`**。
3. 整局成功/碰撞/SPL → 只写 **`case.scoring`**，不塞进 `.3`/`.4` 叶子。

---

## 1. 各 A 的树·节点质量锚点（jd-x.3）

下列叶子来自现行变量树。案例绑定**合格阈值**时挂这里（同白墙 `jd-11.3.*`）。

### G1 交互 / 规划 / 编排 / 监督

| A | jd-x.3 | 节点（质量锚点） |
|---|---|---|
| A1 意图入口 | jd-1.3 | jd-1.3.1 指称消解准确率 · jd-1.3.2 歧义检测召回率 |
| A2 实况填参 | jd-2.3 | jd-2.3.1 必填参数覆盖率 · jd-2.3.2 参数合法性 |
| A3 分步推理 | jd-3.3 | jd-3.3.1 步骤完整性 · jd-3.3.2 依赖一致性 · jd-3.3.3 完成语义正确性 |
| A4 编排执行 | jd-4.3 | jd-4.3.1 阶段完成度 · jd-4.3.2 交接完整性 |
| A5 请求交接 | jd-5.3 | jd-5.3.1 交接成功率 · jd-5.3.2 响应时效 |

### G2 感知 / 定位 / 资源

| A | jd-x.3 | 节点（质量锚点） |
|---|---|---|
| A6 环境感知 | jd-6.3 | jd-6.3.1 检出率 · jd-6.3.2 误报率 · jd-6.3.3 分类精度 |
| A7 自身定位 | jd-7.3 | jd-7.3.1 位置误差容忍 · jd-7.3.2 姿态误差容忍 · jd-7.3.3 可用性标准 |
| A8 相对定位 | jd-8.3 | jd-8.3.1 距离估计精度 · jd-8.3.2 方位估计精度 · jd-8.3.3 关联正确率 |
| A9 资源管理 | jd-9.3 | jd-9.3.1 预警阈值 · jd-9.3.2 返航储备要求 · jd-9.3.3 消耗预测精度 |

### G3 导航 / 飞控

| A | jd-x.3 | 节点（质量锚点） |
|---|---|---|
| A10 导航飞行 | jd-10.3 | jd-10.3.1 横向偏差 · jd-10.3.2 高度偏差 · jd-10.3.3 到达精度 |
| A11 控制飞行 | jd-11.3 | **跟踪误差** jd-11.3.1.1–1.4（位置/速度/姿态/航向容忍）· **瞬态稳定** jd-11.3.2.1–2.4（评价方式/超调/调节时间/振荡）· **执行余量** jd-11.3.3.1–3.2 · **激活阶段** jd-11.3.4.1 |

### G4 载荷 / 成果

| A | jd-x.3 | 节点（质量锚点） |
|---|---|---|
| A12 载荷执行 | jd-12.3 | jd-12.3.1 动作时序精度 · jd-12.3.2 动作成功率 · jd-12.3.3 数据质量 |
| A13 成果呈现 | jd-13.3 | jd-13.3.1 覆盖完整度 · jd-13.3.2 格式合规性 · jd-13.3.3 内容质量 |

### G5 通信 / 合规

| A | jd-x.3 | 节点（质量锚点） |
|---|---|---|
| A14 通信链路 | jd-14.3 | jd-14.3.1 延迟标准 · jd-14.3.2 可靠性 · jd-14.3.3 吞吐量 |
| A16 合规申报 | jd-16.3 | jd-16.3.1 授权完整性 · jd-16.3.2 申报时效 |

### G6 审计 / 安全包络

| A | jd-x.3 | 节点（质量锚点） |
|---|---|---|
| A15 审计日志 | jd-15.3 | jd-15.3.1 证据格式规格 · jd-15.3.2 完整性 · jd-15.3.3 时间戳精度 |
| A17 安全包络 | jd-17.3 | jd-17.3.1 分相位安全阈值 · jd-17.3.2 安全态定义 · jd-17.3.3 安全响应时效 |

---

## 1b. 各 A 的树·过程协议锚点（jd-x.4）

处置/升级/验证挂 **`.4`**（不是 metric 旁路分类）。组名已写回树（如 A11=`控制处置协议`）。

| A | jd-x.4 | 过程锚点（摘） |
|---|---|---|
| A1 | jd-1.4 | 歧义类型 · 消解动作 · 升级目标 |
| A2 | jd-2.4 | 缺省类型 · 处置动作 |
| A3 | jd-3.4 | 失败类型 · 处置动作 · 升级目标 |
| A4 | jd-4.4 | 重编排触发 · 策略 · 人机交接点 |
| A5 | jd-5.4 | 升级触发 · 升级动作 · 高层通知 |
| A6–A9 | jd-6.4…9.4 | 异常类型 · 处置动作 · 升级目标 |
| A10 | jd-10.4 | 偏航触发 · 重规划动作 · 升级目标 |
| A11 | jd-11.4 | 异常类别 · 处置动作 · 切换保护 · 验证与升级（白墙绑定异常/处置） |
| A12–A17 | jd-12.4…17.4 | 同构：异常 · 处置 · 升级/留存 |

---

## 2. 案例 scoring（对照白墙）

案例 JSON 的 `scoring` 是 **episode 汇总**，与树上的 `.3`/`.4` 并列，不互相替代。

**白墙窄缝（A11）示例**（`knowledge/case_white_wall_narrow_gap.json`）：

| 案例指标 | 定义 | 与树槽位关系 |
|---|---|---|
| SR | 到达终点 + 无碰撞 + 未越界 + 时限内 | 案例 outcome；成功条件可锚 `jd-0.7`，不是 `jd-11.3.*` |
| CR | 发生 ≥1 次碰撞的 episode 占比 | 案例 Gate；控制节点质量再好，碰撞仍在案例层计 |
| SPL | `S × l / max(p, l)` 路径效率 | 案例效率；路径贴合可参考 A10 的 `jd-10.3`，但 SPL 仍记在案例 |

同案例树上的绑定（摘录）：

| 树槽位 | 案例绑定 | 作用 |
|---|---|---|
| jd-11.3.1.1 位置误差容忍 | 🔀 `[0.1, 0.3] m` | 节点质量：seed 抽阈值 → grader 判跟踪是否达标 |
| jd-11.3.2.1 误差评价方式 | 🔒 `RMS` | 节点质量：固定评价口径 |
| jd-11.4.1.1 / jd-11.4.2.1 | 异常类别 / 处置动作 | 过程协议：是否按协议保护/恢复 |
| DOC-成功条件 / jd-0.7 | 🔒 到达+无碰撞+… | 喂给 **案例 scoring** SR，不是树叶子 |

**写法规则（新建案例时）：**

- 阈值、公差、合格线 → `values["jd-x.3.*"]`（树·节点）
- 异常/处置/升级/验证 → `values["jd-x.4.*"]`（树·过程）
- SR / CR / SPL / 任务是否完成 → `scoring`（案例，非树叶子）

---

## 3. 原 A×L 指标：对照树槽位（.3 / .4）或案例 scoring

下列保留原核心指标名与证据/来源。列 **树锚点** 含义：

- `jd-x.3` = 挂树上节点质量层  
- `jd-x.4` = 挂树上过程协议层  
- `案例` = 只在 `case.scoring`（不是树叶子）

方向符号：↑ 越高越好，↓ 越低越好。

### G1

#### A1 意图入口 · jd-1.3

| A×L | 树锚点 | 核心指标 | 解释 | 证据 / GT | 来源 | 成熟度 |
|---|---|---|---|---|---|---|
| A1×L1 | jd-1.3.1 | intent_macro_f1；slot_f1；semantic_frame_accuracy | 意图/槽/语义帧正确 ↑ | intent/slot/frame GT | 对话协议；PX4 Drone Agent | 成熟 |
| A1×L2 | jd-1.3.1 | referent_accuracy；slot_referent_joint_accuracy；no_target_rejection_f1 | 指称与联合绑定正确 ↑；无目标拒绝 ↑ | object catalog；bbox/mask/ID | RefDrone；GeoText-1652；AVDN | 可迁移 |
| A1×L3 | jd-1.3.2 / jd-1.4.* | ambiguity_detection_f1；post_confirmation_accuracy | 歧义检出 ↑；消解/升级走 .4；ask/wait → A5 | ambiguity GT；interpretation artifact | AVDN；KnowNo | 可迁移 |
| A1×L4 | jd-1.4.* | evidence_pointer_accuracy；selective_risk_coverage；ece；cross_turn_consistency | 证据锚点/选择性风险 ↑，ECE ↓，跨轮自洽 ↑ | provenance；置信；跨轮 state | KnowNo；S-ATLAS | 项目校准 |

#### A2 实况填参 · jd-2.3

| A×L | 树锚点 | 核心指标 | 解释 | 证据 / GT | 来源 | 成熟度 |
|---|---|---|---|---|---|---|
| A2×L1 | jd-2.3.2 | parameter_exact_match；unit_normalization_accuracy；parse_validity | 值/单位/结构合法 ↑ | field GT；单位表；schema | 语义解析协议 | 成熟 |
| A2×L2 | jd-2.3.1 | required_field_recall；whole_schema_exact_match；executable_configuration_rate | 必填覆盖与可执行配置 ↑ | Config schema；dry-run | ALFRED；Config v2 | 可迁移 |
| A2×L3 | jd-2.3.1 / jd-2.3.2 | constraint_satisfaction；conflict_detection_f1；unsafe_omission_rate Gate | 约束满足与冲突识别 ↑；安全漏填 ↓ | rule set；安全字段 GT | HiL-Bench；规则引擎 | 项目校准 |
| A2×L4 | jd-2.4.* | field_provenance_accuracy；executable_and_safe_spec_rate；human_correction_edit_cost | 来源标注与可执行安全率 ↑；编辑成本 ↓ | provenance 标签；diff | 项目扩展 | 项目校准 |

#### A3 分步推理 · jd-3.3

| A×L | 树锚点 | 核心指标 | 解释 | 证据 / GT | 来源 | 成熟度 |
|---|---|---|---|---|---|---|
| A3×L1 | jd-3.3.1 | skill_selection_accuracy；declared_precondition_validity；declared_effect_predicate_f1 | 技能/前提/效果声明正确 ↑ | 显式计划；skill catalog | ALFRED；ALFWorld | 成熟 |
| A3×L2 | jd-3.3.1 / jd-3.3.2 | required_subgoal_recall；dependency_edge_f1；validator_accepted_plan_rate；normalized_plan_edit_distance | 子目标与依赖 ↑；编辑距离 ↓ | subgoal DAG；合法计划族 | LoTa-Bench；DriveLM | 可迁移 |
| A3×L3 | jd-3.3.3 / jd-3.4.* | blocker_detection_f1；missing_condition_recall；explicit_plan_revision_accuracy | 阻塞声明与修订 ↑；求助时机 → A5 | blocker GT；版本化计划 | HiL-Bench；KnowNo | 可迁移 |
| A3×L4 | jd-3.4.* | retained_constraint_accuracy；stale_assumption_rate；completion_update_accuracy | 保留约束/更新完成条件 ↑；过期假设 ↓ | constraint graph | 项目扩展 | 项目校准 |

#### A4 编排执行 · jd-4.3

| A×L | 树锚点 | 核心指标 | 解释 | 证据 / GT | 来源 | 成熟度 |
|---|---|---|---|---|---|---|
| A4×L1 | jd-4.3.1 | next_step_accuracy；dispatch_schema_validity；transition_predicate_f1 | 下一步与迁移正确 ↑（不评物理结果） | tool-call；workflow state | ALFRED action protocol | 成熟 |
| A4×L2 | jd-4.3.1 / jd-4.3.2 | workflow_validity_rate；weighted_stage_recall；precedence_violation_rate；termination_correctness | 阶段覆盖 ↑；顺序违规 ↓；结束正确 ↑ | GT state machine | LoTa-Bench；HUGE-Bench | 可迁移 |
| A4×L3 | jd-4.4.* | interruption_detection_f1；trigger_timing_error；unsafe_continuation Gate；resume_state_accuracy | 中断识别与恢复阶段 ↑；交接协议 → A5 | interruption timeline | HiL-Bench | 项目校准 |
| A4×L4 | jd-4.4.* | replanning_trigger_f1；repaired_workflow_validity；valid_stage_retention；workflow_oscillation_rate | 重编排触发/修复 ↑；振荡 ↓；计划修订 → A3 | pre/post workflow；validator | 动态重编排协议 | 可迁移 |

#### A5 请求交接 · jd-5.3

| A×L | 树锚点 | 核心指标 | 解释 | 证据 / GT | 来源 | 成熟度 |
|---|---|---|---|---|---|---|
| A5×L1 | jd-5.3.1 / jd-5.3.2 | status_accuracy；required_field_completeness；report_latency；unsupported_claim_rate | 状态与必填 ↑；延迟与无证据声明 ↓ | report schema；timestamp | 项目状态报告 | 可迁移 |
| A5×L2 | jd-5.3.1 | failure_notification_f1；payload_completeness；acknowledgement_detection；protocol_violation_rate | 通知/载荷/ACK ↑；协议违规 ↓ | failure event；ack GT | 人机通知协议 | 可迁移 |
| A5×L3 | jd-5.4.* | ask_precision；blocker_recall；ask_f1；late_request_rate Gate；wait_compliance Gate | 求助精度与等待合规 ↑；迟问 ↓ | ask/action timeline | HiL-Bench；KnowNo | 阈值待校准 |
| A5×L4 | jd-5.4.* | authority_routing_accuracy；handoff_completeness；readback_accuracy；authority_violation Gate | 权限路由与交接完整 ↑；越权 = 0 | authority matrix；handoff | handoff 研究 | 项目校准 |

### G2

#### A6 环境感知 · jd-6.3

| A×L | 树锚点 | 核心指标 | 解释 | 证据 / GT | 来源 | 成熟度 |
|---|---|---|---|---|---|---|
| A6×L1 | jd-6.3.1 / .2 / .3 | class_f1 / map；localization_iou；false_alarm_rate | 检出/定位 ↑，误报 ↓ | class；bbox/mask | VisDrone；COCO | 成熟 |
| A6×L2 | jd-6.3.1 / jd-6.3.3 | hota；idf1；duplicate_rate；track_completeness | 跨帧关联与完整度 ↑；重复 ↓ | track GT | HOTA；UrbanVideo-Bench | 成熟 |
| A6×L3 | jd-6.4.* | degradation_detection_auroc；fpr95；time_to_alert；unsafe_continuation Gate | 退化识别 ↑；误警/延迟/危险继续 ↓ | degradation timeline | BEDI；OOD | 可迁移 |
| A6×L4 | jd-6.4.* | reobservation_success；post_recovery_perception_score；recovery_verification_accuracy | 复核与恢复后感知 ↑ | recovery action；pre/post GT | AeroVerse | 项目校准 |

#### A7 自身定位 · jd-7.3

| A×L | 树锚点 | 核心指标 | 解释 | 证据 / GT | 来源 | 成熟度 |
|---|---|---|---|---|---|---|
| A7×L1 | jd-7.3.1 / jd-7.3.2 | position_rmse；orientation_error；pose_quality_accuracy | 位姿误差 ↓；质量分级 ↑ | pose GT；quality label | TartanAir；EuRoC | 成熟 |
| A7×L2 | jd-7.3.1 / jd-7.3.3 | ate；rpe；drift_rate；localization_availability | 轨迹/漂移 ↓；可用率 ↑ | trajectory GT；validity mask | EuRoC；UZH-FPV | 成熟 |
| A7×L3 | jd-7.3.3 / jd-7.4.* | integrity_risk；missed_detection_rate；false_alert_rate；time_to_alert Gate | 完整性风险与告警延迟 ↓ | alert limit；fault injection | 导航完整性指标 | 可迁移 |
| A7×L4 | jd-7.4.* | relocalization_success；recovery_time；post_recovery_ate；recovery_verification_accuracy | 重定位成功 ↑；耗时与误差 ↓ | relocalization event | SLAM recovery | 可迁移 |

#### A8 相对定位 · jd-8.3

| A×L | 树锚点 | 核心指标 | 解释 | 证据 / GT | 来源 | 成熟度 |
|---|---|---|---|---|---|---|
| A8×L1 | jd-8.3.1 / jd-8.3.2 | range_error；bearing_error；relative_pose_error | 相对几何误差 ↓ | relative geometry GT | SpatialSky-Bench | 成熟 |
| A8×L2 | jd-8.3.1–.3 | relative_tracking_accuracy；abs_rel / epe；target_loss_rate | 跟踪准确 ↑；深度/光流误差与丢失 ↓ | depth/flow/track GT | 深度/光流协议 | 可迁移 |
| A8×L3 | jd-8.4.* | loss_detection_f1；jump_detection_f1；time_to_protect；unsafe_continuation Gate | 丢失/跳变检出 ↑；保护延迟 ↓ | occlusion/jump injection | BEDI | 可迁移 |
| A8×L4 | jd-8.4.* | reacquisition_success；reacquisition_time；post_reacquisition_error；verification_accuracy | 重捕获成功 ↑；耗时与误差 ↓ | reappearance GT | 项目恢复扩展 | 项目校准 |

#### A9 资源管理 · jd-9.3

| A×L | 树锚点 | 核心指标 | 解释 | 证据 / GT | 来源 | 成熟度 |
|---|---|---|---|---|---|---|
| A9×L1 | jd-9.3.1 | soc_error；remaining_flight_time_error；health_state_accuracy | 电量/航时误差 ↓；健康判断 ↑ | battery/health GT | UAVBench；NASA Li-ion | 成熟 |
| A9×L2 | jd-9.3.2 / jd-9.3.3 | energy_prediction_error；reserve_margin_violation_rate；deadline_miss_ratio；warning_lead_time | 预测误差与储备违规 ↓；有效预警提前量 | energy timeline；reserve config | ALFA；实时资源指标 | 可迁移 |
| A9×L3 | jd-9.4.* | health_risk_detection_f1；missed_warning_rate；time_to_protect；unsafe_resource_continuation Gate | 风险识别 ↑；漏警/延迟/危险继续 ↓ | degradation；threshold | PADRE；RflyMAD | 可迁移 |
| A9×L4 | 案例 + jd-9.4.* | safe_exit_decision_accuracy；safe_exit_success；remaining_reserve_at_exit；reconfiguration_success | 安全退出与储备 ↑（常与案例 outcome 一起报） | decision GT；exit trajectory | UAVBench；ALFA | 项目校准 |

### G3

#### A10 导航飞行 · jd-10.3

| A×L | 树锚点 | 核心指标 | 解释 | 证据 / GT | 来源 | 成熟度 |
|---|---|---|---|---|---|---|
| A10×L1 | jd-10.3.* | path_validity_rate；constraint_satisfaction；path_length_ratio | 路径可行与约束 ↑；长度比近 1 | map；geofence；reference path | UAV-ON；OpenFly | 可迁移 |
| A10×L2 | 案例（对照 jd-10.3.1–.3） | navigation_success；**spl**；sdtw；route_completion | 整局导航成功与效率 ↑（SPL 属案例层，同白墙） | trajectory；success radius | UAVBench；FlightBench | 成熟 |
| A10×L3 | jd-10.4.* | route_blockage_detection_f1；time_to_protect；infraction_rate；unsafe_continuation Gate | 阻塞检出 ↑；违规与危险继续 ↓ | blockage injection | FlightBench | 可迁移 |
| A10×L4 | jd-10.4.* | replanning_trigger_f1；replanning_latency；new_path_feasibility；post_replan_success | 重规划触发与新路径可行 ↑；延迟 ↓ | old/new route；validator | 动态导航协议 | 可迁移 |

#### A11 控制飞行（白墙主能力）

**约定：** 下表「核心指标」= 要用的 metric；「树节点」= 该 metric 的实例化槽位（见 `knowledge/metric_set_a11_default.json`）。

| metric | A×L | 树节点（实例化） | 方向 | 说明 |
|---|---|---|---|---|
| `control_constraint_satisfaction` | L1 | `jd-11.3.3.2` 剩余控制权威下限 | ↑ | L1 唯一已落槽 |
| `control_command_validity` | L1 | — | ↑ | **未映射**（树上无叶子） |
| `target_state_prediction_accuracy` | L1 | — | ↑ | **未映射** |
| `tracking_error` | L2 | `jd-11.3.1.1`–`1.4` 位置/速度/姿态/航向容忍 | ↓ | 分轴实例 |
| `ise` | L2 | `jd-11.3.2.1` 误差评价方式 | ↓ | 聚合口径（如 RMS） |
| `control_stability` | L2 | `jd-11.3.2.2`–`2.4` 超调/调节时间/振荡 | ↑/↓ | 瞬态三件套 |
| `constraint_violation_duration` | L2 | `jd-11.3.3.1` 饱和阈值 | ↓ | |
| **`collision` Gate** | L2/L3 | **非树叶子** → `scoring.CR` | ↓ | 案例层 |
| `instability_detection_f1` | L3 | `jd-11.4.1.1` 控制异常类别 | ↑ | |
| `safe_protection_rate` | L3 | `jd-11.4.2.1` 处置动作集 | ↑ | |
| `protection_latency` | L3 | `jd-11.4.4.1` 模式切换保护 | ↓ | |
| `stable_recovery_rate` | L4 | `jd-11.4.2.1` 处置动作集 | ↑ | 与 L3 共槽 |
| `recovery_time` | L4 | `jd-11.4.2.1` 处置动作集 | ↓ | 与 L3 共槽 |
| `post_recovery_tracking_error` | L4 | `jd-11.4.5.1` 处置后控制状态 | ↓ | |
| `safe_degradation_success` | L4 | `jd-11.4.5.2` 跨能力升级目标 | ↑ | |

### G4–G6

树槽位见 §1（`.3`）与 §1b（`.4`）。A×L 详表 **待补**；新建案例先绑 `.3`/`.4`，再写 `scoring`。

| A | jd-x.3 | jd-x.4 | A×L 详表 |
|---|---|---|---|
| A12 载荷执行 | jd-12.3.1–.3 | jd-12.4.* | 待补 |
| A13 成果呈现 | jd-13.3.1–.3 | jd-13.4.* | 待补 |
| A14 通信链路 | jd-14.3.1–.3 | jd-14.4.* | 待补 |
| A15 审计日志 | jd-15.3.1–.3 | jd-15.4.* | 待补 |
| A16 合规申报 | jd-16.3.1–.2 | jd-16.4.* | 待补 |
| A17 安全包络 | jd-17.3.1–.3 | jd-17.4.* | 待补 |

---

## 4. 速查：白墙 / A11 metric 怎么落

完整映射：`knowledge/metric_set_a11_default.json`（metric → 节点实例）。

```
metric_set_a11_default          ← grader 读的 A11 指标实例
├── jd-11.3.1.*   tracking_error
├── jd-11.3.2.1   ise（评价口径）
├── jd-11.3.2.2–4 control_stability
├── jd-11.3.3.1   constraint_violation_duration
├── jd-11.3.3.2   control_constraint_satisfaction
├── jd-11.4.1.1   instability_detection_f1
├── jd-11.4.2.1   safe_protection_rate / stable_recovery_rate / recovery_time
├── jd-11.4.4.1   protection_latency
├── jd-11.4.5.1   post_recovery_tracking_error
└── jd-11.4.5.2   safe_degradation_success

案例 white_wall_narrow_gap      ← 场景 + 可覆盖同节点阈值
├── values：jd-11.1/2 场景包络；可覆盖 jd-11.3/4
└── scoring：SR / CR(collision) / SPL   ← 非树叶子
```

Grader：按节点实例判 `.3`/`.4` → 再算案例 scoring。collision 只在 CR。

---

## 附录：旧编号 → 新编号

| 旧 | 新 | 能力 | 组 |
|---|---|---|---|
| A1–A4 | A1–A4 | 意图/填参/推理/编排 | G1 |
| A14（交接） | **A5** | 请求交接 | G1 |
| A5（感知） | **A6** | 环境感知 | G2 |
| A6a / A6b | **A7 / A8** | 自身/相对定位 | G2 |
| A11（资源） | **A9** | 资源管理 | G2 |
| A7 / A8（导航/控制） | **A10 / A11** | 导航/控制飞行 | G3 |
| A9a / A9b | A12 / A13 | 载荷/成果 | G4 |
| A10（通信） | A14 | 通信链路 | G5 |
| — | A15 / A16 / A17 | 审计 / 合规 / 安全包络 | G5–G6 |
