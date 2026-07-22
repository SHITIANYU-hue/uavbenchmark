#!/usr/bin/env python3
"""Annotate jd_variable_tree_version2.json with tree-layer runtime metrics.

Tree layers (not a separate "metric taxonomy"):
  - jd-x.3  节点质量  → metric_layer=node
  - jd-x.4  过程协议  → metric_layer=process
  - ability root / case.scoring → metric_layer=case (episode outcome)

Idempotent: re-running replaces previous metric annotations.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TREE_PATH = ROOT / "knowledge" / "jd_variable_tree_version2.json"

# Display names for .3 groups (aligned to tree A15=审计 / A16=合规 / A17=安全)
QUALITY_GROUP_NAME = {
    "A1": "理解准确度标准",
    "A2": "参数完整性标准",
    "A3": "分解正确性标准",
    "A4": "编排完成度标准",
    "A5": "交接质量标准",
    "A6": "检测质量标准",
    "A7": "位姿精度标准",
    "A8": "几何精度标准",
    "A9": "预警阈值标准",
    "A10": "航迹精度标准",
    "A11": "控制质量标准",
    "A12": "动作质量标准",
    "A13": "成果质量标准",
    "A14": "链路质量标准",
    "A15": "证据质量标准",
    "A16": "合规性标准",
    "A17": "安全态标准",
}

QUALITY_GROUP_DEF = (
    "树·节点质量层（四层 .3）：定义该能力「什么算合格」。"
    "阈值由案例 values 绑定到本层叶子；整局 SR/CR/SPL 写在案例 scoring；"
    "异常处置/求助/重规划等过程挂 .4，不挂本层。"
)

# Display names for .4 groups (过程协议)
PROCESS_GROUP_NAME = {
    "A1": "歧义消解协议",
    "A2": "缺省处置协议",
    "A3": "推理失败处置",
    "A4": "重编排与交接协议",
    "A5": "升级与通知协议",
    "A6": "感知处置协议",
    "A7": "定位处置协议",
    "A8": "几何处置协议",
    "A9": "资源处置协议",
    "A10": "航迹处置协议",
    "A11": "控制处置协议",
    "A12": "载荷处置协议",
    "A13": "成果处置协议",
    "A14": "通信处置协议",
    "A15": "审计处置协议",
    "A16": "合规处置协议",
    "A17": "安全处置协议",
}

PROCESS_GROUP_DEF = (
    "树·过程协议层（四层 .4）：出问题怎么处置、升级、验证。"
    "对应 A×L 的监督/主导自主过程读数；案例可绑定异常类型与处置动作；"
    "合格阈值在 .3，整局 outcome 在 case.scoring。"
)

# A×L rows that belong on jd-x.4 (过程)
AXL_PROCESS_METRICS: dict[str, list[dict]] = {
    "A1": [
        {
            "cell": "A1×L4",
            "layer": "process",
            "metrics": [
                "evidence_pointer_accuracy",
                "selective_risk_coverage",
                "ece",
                "cross_turn_consistency",
            ],
            "anchors": ["jd-1.4.1", "jd-1.4.2", "jd-1.4.3"],
            "direction_zh": "证据锚点/选择性风险 ↑，ECE ↓，跨轮自洽 ↑",
            "evidence": "provenance；置信；跨轮 state",
            "sources": "KnowNo；S-ATLAS",
            "maturity": "项目校准",
        }
    ],
    "A2": [
        {
            "cell": "A2×L4",
            "layer": "process",
            "metrics": [
                "field_provenance_accuracy",
                "executable_and_safe_spec_rate",
                "human_correction_edit_cost",
            ],
            "anchors": ["jd-2.4.1", "jd-2.4.2"],
            "direction_zh": "来源标注与可执行安全率 ↑；编辑成本 ↓",
            "evidence": "provenance 标签；diff",
            "sources": "项目扩展",
            "maturity": "项目校准",
        }
    ],
    "A3": [
        {
            "cell": "A3×L3",
            "layer": "process",
            "metrics": [
                "blocker_detection_f1",
                "missing_condition_recall",
                "explicit_plan_revision_accuracy",
            ],
            "anchors": ["jd-3.4.1", "jd-3.4.2", "jd-3.4.3"],
            "direction_zh": "阻塞声明与计划修订 ↑；求助时机 → A5",
            "evidence": "blocker GT；版本化计划",
            "sources": "HiL-Bench；KnowNo",
            "maturity": "可迁移",
        },
        {
            "cell": "A3×L4",
            "layer": "process",
            "metrics": [
                "retained_constraint_accuracy",
                "stale_assumption_rate",
                "completion_update_accuracy",
            ],
            "anchors": ["jd-3.4.2", "jd-3.4.3"],
            "direction_zh": "保留约束/更新完成条件 ↑；过期假设 ↓",
            "evidence": "constraint graph",
            "sources": "项目扩展",
            "maturity": "项目校准",
        },
    ],
    "A4": [
        {
            "cell": "A4×L3",
            "layer": "process",
            "metrics": [
                "interruption_detection_f1",
                "trigger_timing_error",
                "unsafe_continuation",
                "resume_state_accuracy",
            ],
            "anchors": ["jd-4.4.1", "jd-4.4.3"],
            "direction_zh": "中断识别与恢复阶段 ↑；交接 → A5",
            "evidence": "interruption timeline",
            "sources": "HiL-Bench",
            "maturity": "项目校准",
        },
        {
            "cell": "A4×L4",
            "layer": "process",
            "metrics": [
                "replanning_trigger_f1",
                "repaired_workflow_validity",
                "valid_stage_retention",
                "workflow_oscillation_rate",
            ],
            "anchors": ["jd-4.4.1", "jd-4.4.2"],
            "direction_zh": "重编排触发/修复 ↑；振荡 ↓；计划修订 → A3",
            "evidence": "pre/post workflow；validator",
            "sources": "动态重编排协议",
            "maturity": "可迁移",
        },
    ],
    "A5": [
        {
            "cell": "A5×L3",
            "layer": "process",
            "metrics": [
                "ask_precision",
                "blocker_recall",
                "ask_f1",
                "late_request_rate",
                "wait_compliance",
            ],
            "anchors": ["jd-5.4.1", "jd-5.4.2", "jd-5.4.3"],
            "direction_zh": "求助精度与等待合规 ↑；迟问 ↓",
            "evidence": "ask/action timeline",
            "sources": "HiL-Bench；KnowNo",
            "maturity": "阈值待校准",
        },
        {
            "cell": "A5×L4",
            "layer": "process",
            "metrics": [
                "authority_routing_accuracy",
                "handoff_completeness",
                "readback_accuracy",
                "authority_violation",
            ],
            "anchors": ["jd-5.4.1", "jd-5.4.2", "jd-5.4.3"],
            "direction_zh": "权限路由与交接完整 ↑；越权 = 0",
            "evidence": "authority matrix；handoff",
            "sources": "handoff 研究",
            "maturity": "项目校准",
        },
    ],
    "A6": [
        {
            "cell": "A6×L3",
            "layer": "process",
            "metrics": [
                "degradation_detection_auroc",
                "fpr95",
                "time_to_alert",
                "unsafe_continuation",
            ],
            "anchors": ["jd-6.4.1", "jd-6.4.2", "jd-6.4.3"],
            "direction_zh": "退化识别 ↑；误警/延迟/危险继续 ↓",
            "evidence": "degradation timeline",
            "sources": "BEDI；OOD",
            "maturity": "可迁移",
        },
        {
            "cell": "A6×L4",
            "layer": "process",
            "metrics": [
                "reobservation_success",
                "post_recovery_perception_score",
                "recovery_verification_accuracy",
            ],
            "anchors": ["jd-6.4.2", "jd-6.4.3"],
            "direction_zh": "复核与恢复后感知 ↑",
            "evidence": "recovery action；pre/post GT",
            "sources": "AeroVerse",
            "maturity": "项目校准",
        },
    ],
    "A7": [
        {
            "cell": "A7×L3",
            "layer": "process",
            "metrics": [
                "integrity_risk",
                "missed_detection_rate",
                "false_alert_rate",
                "time_to_alert",
            ],
            "anchors": ["jd-7.4.1", "jd-7.4.2", "jd-7.4.3"],
            "direction_zh": "完整性风险与告警延迟 ↓",
            "evidence": "alert limit；fault injection",
            "sources": "导航完整性指标",
            "maturity": "可迁移",
        },
        {
            "cell": "A7×L4",
            "layer": "process",
            "metrics": [
                "relocalization_success",
                "recovery_time",
                "post_recovery_ate",
                "recovery_verification_accuracy",
            ],
            "anchors": ["jd-7.4.2", "jd-7.4.3"],
            "direction_zh": "重定位成功 ↑；耗时与误差 ↓",
            "evidence": "relocalization event",
            "sources": "SLAM recovery",
            "maturity": "可迁移",
        },
    ],
    "A8": [
        {
            "cell": "A8×L3",
            "layer": "process",
            "metrics": [
                "loss_detection_f1",
                "jump_detection_f1",
                "time_to_protect",
                "unsafe_continuation",
            ],
            "anchors": ["jd-8.4.1", "jd-8.4.2", "jd-8.4.3"],
            "direction_zh": "丢失/跳变检出 ↑；保护延迟 ↓",
            "evidence": "occlusion/jump injection",
            "sources": "BEDI",
            "maturity": "可迁移",
        },
        {
            "cell": "A8×L4",
            "layer": "process",
            "metrics": [
                "reacquisition_success",
                "reacquisition_time",
                "post_reacquisition_error",
                "verification_accuracy",
            ],
            "anchors": ["jd-8.4.2", "jd-8.4.3"],
            "direction_zh": "重捕获成功 ↑；耗时与误差 ↓",
            "evidence": "reappearance GT",
            "sources": "项目恢复扩展",
            "maturity": "项目校准",
        },
    ],
    "A9": [
        {
            "cell": "A9×L3",
            "layer": "process",
            "metrics": [
                "health_risk_detection_f1",
                "missed_warning_rate",
                "time_to_protect",
                "unsafe_resource_continuation",
            ],
            "anchors": ["jd-9.4.1", "jd-9.4.2", "jd-9.4.3"],
            "direction_zh": "风险识别 ↑；漏警/延迟/危险继续 ↓",
            "evidence": "degradation；threshold",
            "sources": "PADRE；RflyMAD",
            "maturity": "可迁移",
        },
        {
            "cell": "A9×L4",
            "layer": "process",
            "metrics": [
                "safe_exit_decision_accuracy",
                "safe_exit_success",
                "remaining_reserve_at_exit",
                "reconfiguration_success",
            ],
            "anchors": ["jd-9.4.2", "jd-9.4.3"],
            "direction_zh": "安全退出与储备 ↑（可与案例 outcome 一并报）",
            "evidence": "decision GT；exit trajectory",
            "sources": "UAVBench；ALFA",
            "maturity": "项目校准",
        },
    ],
    "A10": [
        {
            "cell": "A10×L3",
            "layer": "process",
            "metrics": [
                "route_blockage_detection_f1",
                "time_to_protect",
                "infraction_rate",
                "unsafe_continuation",
            ],
            "anchors": ["jd-10.4.1", "jd-10.4.2", "jd-10.4.3"],
            "direction_zh": "阻塞检出 ↑；违规与危险继续 ↓",
            "evidence": "blockage injection",
            "sources": "FlightBench",
            "maturity": "可迁移",
        },
        {
            "cell": "A10×L4",
            "layer": "process",
            "metrics": [
                "replanning_trigger_f1",
                "replanning_latency",
                "new_path_feasibility",
                "post_replan_success",
            ],
            "anchors": ["jd-10.4.1", "jd-10.4.2"],
            "direction_zh": "重规划触发与新路径可行 ↑；延迟 ↓",
            "evidence": "old/new route；validator",
            "sources": "动态导航协议",
            "maturity": "可迁移",
        },
    ],
    "A11": [
        {
            "cell": "A11×L3",
            "layer": "process",
            "metrics": [
                "instability_detection_f1",
                "protection_latency",
                "safe_protection_rate",
            ],
            "anchors": ["jd-11.4.1.1", "jd-11.4.2.1", "jd-11.4.4.1"],
            "direction_zh": "不稳定检出与保护 ↑；延迟 ↓；碰撞仍在案例 scoring",
            "evidence": "fault timeline；protect action",
            "sources": "Flightmare",
            "maturity": "可迁移",
        },
        {
            "cell": "A11×L4",
            "layer": "process",
            "metrics": [
                "stable_recovery_rate",
                "recovery_time",
                "post_recovery_tracking_error",
                "safe_degradation_success",
            ],
            "anchors": ["jd-11.4.2.1", "jd-11.4.5.1", "jd-11.4.5.2"],
            "direction_zh": "恢复/降级成功 ↑；耗时与误差 ↓",
            "evidence": "recovery trace",
            "sources": "AeroVerse",
            "maturity": "项目校准",
        },
    ],
    "A12": [],
    "A13": [],
    "A14": [],
    "A15": [],
    "A16": [],
    "A17": [],
}

PROCESS_LEAF_GRADER: dict[str, list[dict]] = {
    "jd-1.4.1": [
        {"metric_id": "ambiguity_detection_f1", "direction": "↑", "used_by_axl": ["A1×L3"]}
    ],
    "jd-1.4.2": [
        {
            "metric_id": "post_confirmation_accuracy",
            "direction": "↑",
            "used_by_axl": ["A1×L3", "A1×L4"],
        }
    ],
    "jd-1.4.3": [
        {"metric_id": "selective_risk_coverage", "direction": "↑", "used_by_axl": ["A1×L4"]}
    ],
    "jd-2.4.1": [
        {"metric_id": "unsafe_omission_rate", "direction": "↓", "used_by_axl": ["A2×L3"]}
    ],
    "jd-2.4.2": [
        {
            "metric_id": "human_correction_edit_cost",
            "direction": "↓",
            "used_by_axl": ["A2×L4"],
        }
    ],
    "jd-3.4.1": [
        {"metric_id": "blocker_detection_f1", "direction": "↑", "used_by_axl": ["A3×L3"]}
    ],
    "jd-3.4.2": [
        {
            "metric_id": "explicit_plan_revision_accuracy",
            "direction": "↑",
            "used_by_axl": ["A3×L3"],
        }
    ],
    "jd-3.4.3": [
        {
            "metric_id": "missing_condition_recall",
            "direction": "↑",
            "used_by_axl": ["A3×L3"],
        }
    ],
    "jd-4.4.1": [
        {"metric_id": "replanning_trigger_f1", "direction": "↑", "used_by_axl": ["A4×L4"]},
        {
            "metric_id": "interruption_detection_f1",
            "direction": "↑",
            "used_by_axl": ["A4×L3"],
        },
    ],
    "jd-4.4.2": [
        {
            "metric_id": "repaired_workflow_validity",
            "direction": "↑",
            "used_by_axl": ["A4×L4"],
        }
    ],
    "jd-4.4.3": [
        {"metric_id": "resume_state_accuracy", "direction": "↑", "used_by_axl": ["A4×L3"]}
    ],
    "jd-5.4.1": [
        {"metric_id": "ask_f1", "direction": "↑", "used_by_axl": ["A5×L3"]},
        {
            "metric_id": "authority_routing_accuracy",
            "direction": "↑",
            "used_by_axl": ["A5×L4"],
        },
    ],
    "jd-5.4.2": [
        {"metric_id": "handoff_completeness", "direction": "↑", "used_by_axl": ["A5×L4"]}
    ],
    "jd-5.4.3": [
        {"metric_id": "wait_compliance", "direction": "↑", "used_by_axl": ["A5×L3"]}
    ],
    "jd-6.4.1": [
        {
            "metric_id": "degradation_detection_auroc",
            "direction": "↑",
            "used_by_axl": ["A6×L3"],
        }
    ],
    "jd-6.4.2": [
        {"metric_id": "reobservation_success", "direction": "↑", "used_by_axl": ["A6×L4"]}
    ],
    "jd-6.4.3": [
        {
            "metric_id": "recovery_verification_accuracy",
            "direction": "↑",
            "used_by_axl": ["A6×L4"],
        }
    ],
    "jd-7.4.1": [
        {"metric_id": "integrity_risk", "direction": "↓", "used_by_axl": ["A7×L3"]}
    ],
    "jd-7.4.2": [
        {"metric_id": "relocalization_success", "direction": "↑", "used_by_axl": ["A7×L4"]}
    ],
    "jd-7.4.3": [
        {
            "metric_id": "recovery_verification_accuracy",
            "direction": "↑",
            "used_by_axl": ["A7×L4"],
        }
    ],
    "jd-8.4.1": [
        {"metric_id": "loss_detection_f1", "direction": "↑", "used_by_axl": ["A8×L3"]}
    ],
    "jd-8.4.2": [
        {"metric_id": "reacquisition_success", "direction": "↑", "used_by_axl": ["A8×L4"]}
    ],
    "jd-8.4.3": [
        {"metric_id": "verification_accuracy", "direction": "↑", "used_by_axl": ["A8×L4"]}
    ],
    "jd-9.4.1": [
        {
            "metric_id": "health_risk_detection_f1",
            "direction": "↑",
            "used_by_axl": ["A9×L3"],
        }
    ],
    "jd-9.4.2": [
        {"metric_id": "safe_exit_success", "direction": "↑", "used_by_axl": ["A9×L4"]}
    ],
    "jd-9.4.3": [
        {
            "metric_id": "reconfiguration_success",
            "direction": "↑",
            "used_by_axl": ["A9×L4"],
        }
    ],
    "jd-10.4.1": [
        {
            "metric_id": "route_blockage_detection_f1",
            "direction": "↑",
            "used_by_axl": ["A10×L3"],
        },
        {"metric_id": "replanning_trigger_f1", "direction": "↑", "used_by_axl": ["A10×L4"]},
    ],
    "jd-10.4.2": [
        {"metric_id": "new_path_feasibility", "direction": "↑", "used_by_axl": ["A10×L4"]}
    ],
    "jd-10.4.3": [
        {"metric_id": "post_replan_success", "direction": "↑", "used_by_axl": ["A10×L4"]}
    ],
    "jd-11.4.1.1": [
        {
            "metric_id": "instability_detection_f1",
            "direction": "↑",
            "used_by_axl": ["A11×L3"],
        }
    ],
    "jd-11.4.2.1": [
        {"metric_id": "safe_protection_rate", "direction": "↑", "used_by_axl": ["A11×L3"]},
        {"metric_id": "stable_recovery_rate", "direction": "↑", "used_by_axl": ["A11×L4"]},
    ],
    "jd-11.4.4.1": [
        {"metric_id": "protection_latency", "direction": "↓", "used_by_axl": ["A11×L3"]}
    ],
    "jd-11.4.5.1": [
        {
            "metric_id": "post_recovery_tracking_error",
            "direction": "↓",
            "used_by_axl": ["A11×L4"],
        }
    ],
    "jd-11.4.5.2": [
        {
            "metric_id": "safe_degradation_success",
            "direction": "↑",
            "used_by_axl": ["A11×L4"],
        }
    ],
}

PROCESS_LEAF_DEFS = {
    "jd-1.4.1": "歧义类型目录；过程层触发侧。",
    "jd-1.4.2": "消解动作集；过程层处置。",
    "jd-1.4.3": "升级目标（常 →A5）。",
    "jd-4.4.1": "重编排/中断触发条件。",
    "jd-4.4.2": "重编排策略。",
    "jd-4.4.3": "人机交接点（过程对齐 A5）。",
    "jd-5.4.1": "升级/求助触发。",
    "jd-5.4.2": "升级动作与交接动作。",
    "jd-5.4.3": "高层通知规则。",
    "jd-11.4.1.1": "控制异常类别；白墙可绑定关注异常。",
    "jd-11.4.2.1": "局部控制处置动作集。",
    "jd-11.4.5.1": "处置后控制状态验证。",
    "jd-11.4.5.2": "跨能力升级目标。",
}

# A×L rows: only node-layer (and mixed) entries that belong on jd-x.3
# layer: node | mixed (node + case gate)
AXL_NODE_METRICS: dict[str, list[dict]] = {
    "A1": [
        {
            "cell": "A1×L1",
            "layer": "node",
            "metrics": ["intent_macro_f1", "slot_f1", "semantic_frame_accuracy"],
            "anchors": ["jd-1.3.1"],
            "direction_zh": "意图/槽/语义帧正确 ↑",
            "evidence": "intent/slot/frame GT；Agent 结构化理解结果",
            "sources": "对话理解通用协议；PX4 Drone Agent",
            "maturity": "成熟",
        },
        {
            "cell": "A1×L2",
            "layer": "node",
            "metrics": [
                "referent_accuracy",
                "slot_referent_joint_accuracy",
                "no_target_rejection_f1",
            ],
            "anchors": ["jd-1.3.1"],
            "direction_zh": "指称与联合绑定正确 ↑；无目标拒绝 ↑",
            "evidence": "oracle object catalog；bbox/mask 或实体 ID",
            "sources": "RefDrone；GeoText-1652；AVDN",
            "maturity": "可迁移",
        },
        {
            "cell": "A1×L3",
            "layer": "node",
            "metrics": ["ambiguity_detection_f1", "post_confirmation_accuracy"],
            "anchors": ["jd-1.3.2"],
            "direction_zh": "歧义检出与确认后解释 ↑；ask/wait → A5 过程",
            "evidence": "ambiguity GT；interpretation artifact",
            "sources": "AVDN；KnowNo",
            "maturity": "可迁移",
        },
    ],
    "A2": [
        {
            "cell": "A2×L1",
            "layer": "node",
            "metrics": [
                "parameter_exact_match",
                "unit_normalization_accuracy",
                "parse_validity",
            ],
            "anchors": ["jd-2.3.2"],
            "direction_zh": "值/单位/结构合法 ↑",
            "evidence": "field-level GT；单位表；schema",
            "sources": "语义解析 / task-oriented dialogue 协议",
            "maturity": "成熟",
        },
        {
            "cell": "A2×L2",
            "layer": "node",
            "metrics": [
                "required_field_recall",
                "whole_schema_exact_match",
                "executable_configuration_rate",
            ],
            "anchors": ["jd-2.3.1"],
            "direction_zh": "必填覆盖与可执行配置 ↑",
            "evidence": "Config schema；required/default GT；dry-run",
            "sources": "ALFRED/ALFWorld；项目 Config v2",
            "maturity": "可迁移",
        },
        {
            "cell": "A2×L3",
            "layer": "node",
            "metrics": [
                "constraint_satisfaction",
                "conflict_detection_f1",
                "unsafe_omission_rate",
            ],
            "anchors": ["jd-2.3.1", "jd-2.3.2"],
            "direction_zh": "约束满足与冲突识别 ↑；安全漏填 ↓（Gate）",
            "evidence": "rule set；安全字段 GT",
            "sources": "HiL-Bench；项目规则引擎",
            "maturity": "项目校准",
        },
    ],
    "A3": [
        {
            "cell": "A3×L1",
            "layer": "node",
            "metrics": [
                "skill_selection_accuracy",
                "declared_precondition_validity",
                "declared_effect_predicate_f1",
            ],
            "anchors": ["jd-3.3.1"],
            "direction_zh": "技能/前提/效果声明正确 ↑",
            "evidence": "显式计划；skill catalog；precondition/effect GT",
            "sources": "ALFRED；ALFWorld",
            "maturity": "成熟",
        },
        {
            "cell": "A3×L2",
            "layer": "node",
            "metrics": [
                "required_subgoal_recall",
                "dependency_edge_f1",
                "validator_accepted_plan_rate",
                "normalized_plan_edit_distance",
            ],
            "anchors": ["jd-3.3.1", "jd-3.3.2"],
            "direction_zh": "子目标与依赖 ↑；编辑距离 ↓",
            "evidence": "subgoal DAG；合法计划族",
            "sources": "ALFRED；LoTa-Bench；DriveLM",
            "maturity": "可迁移",
        },
    ],
    "A4": [
        {
            "cell": "A4×L1",
            "layer": "node",
            "metrics": [
                "next_step_accuracy",
                "dispatch_schema_validity",
                "transition_predicate_f1",
            ],
            "anchors": ["jd-4.3.1"],
            "direction_zh": "下一步与迁移正确 ↑（不评物理结果）",
            "evidence": "tool-call；workflow state；transition GT",
            "sources": "ALFRED/ALFWorld action protocol",
            "maturity": "成熟",
        },
        {
            "cell": "A4×L2",
            "layer": "node",
            "metrics": [
                "workflow_validity_rate",
                "weighted_stage_recall",
                "precedence_violation_rate",
                "termination_correctness",
            ],
            "anchors": ["jd-4.3.1", "jd-4.3.2"],
            "direction_zh": "阶段覆盖 ↑；顺序违规 ↓；结束正确 ↑",
            "evidence": "GT state machine；阶段权重",
            "sources": "LoTa-Bench；DriveLM；HUGE-Bench",
            "maturity": "可迁移",
        },
    ],
    "A5": [
        {
            "cell": "A5×L1",
            "layer": "node",
            "metrics": [
                "status_accuracy",
                "required_field_completeness",
                "report_latency",
                "unsupported_claim_rate",
            ],
            "anchors": ["jd-5.3.1", "jd-5.3.2"],
            "direction_zh": "状态与必填 ↑；延迟与无证据声明 ↓",
            "evidence": "report schema；world state；timestamp",
            "sources": "声明协议；项目状态报告 schema",
            "maturity": "可迁移",
        },
        {
            "cell": "A5×L2",
            "layer": "node",
            "metrics": [
                "failure_notification_f1",
                "payload_completeness",
                "acknowledgement_detection",
                "protocol_violation_rate",
            ],
            "anchors": ["jd-5.3.1"],
            "direction_zh": "通知/载荷/ACK ↑；协议违规 ↓",
            "evidence": "failure event；recipient/ack GT",
            "sources": "人机协作通知协议",
            "maturity": "可迁移",
        },
    ],
    "A6": [
        {
            "cell": "A6×L1",
            "layer": "node",
            "metrics": ["class_f1", "map", "localization_iou", "false_alarm_rate"],
            "anchors": ["jd-6.3.1", "jd-6.3.2", "jd-6.3.3"],
            "direction_zh": "检出/定位 ↑，误报 ↓",
            "evidence": "object class；bbox/mask",
            "sources": "VisDrone；COCO；MM-UAVBench",
            "maturity": "成熟",
        },
        {
            "cell": "A6×L2",
            "layer": "node",
            "metrics": ["hota", "idf1", "duplicate_rate", "track_completeness"],
            "anchors": ["jd-6.3.1", "jd-6.3.3"],
            "direction_zh": "跨帧关联与完整度 ↑；重复 ↓",
            "evidence": "frame-level object/track GT",
            "sources": "HOTA；VisDrone tracking；UrbanVideo-Bench",
            "maturity": "成熟",
        },
    ],
    "A7": [
        {
            "cell": "A7×L1",
            "layer": "node",
            "metrics": [
                "position_rmse",
                "orientation_error",
                "pose_quality_accuracy",
            ],
            "anchors": ["jd-7.3.1", "jd-7.3.2"],
            "direction_zh": "位姿误差 ↓；质量分级 ↑",
            "evidence": "timestamped pose GT；quality label",
            "sources": "TartanAir；EuRoC MAV；TUM RGB-D",
            "maturity": "成熟",
        },
        {
            "cell": "A7×L2",
            "layer": "node",
            "metrics": ["ate", "rpe", "drift_rate", "localization_availability"],
            "anchors": ["jd-7.3.1", "jd-7.3.3"],
            "direction_zh": "轨迹/漂移 ↓；可用率 ↑",
            "evidence": "synchronized trajectory GT；validity mask",
            "sources": "TartanAir；EuRoC；UZH-FPV",
            "maturity": "成熟",
        },
    ],
    "A8": [
        {
            "cell": "A8×L1",
            "layer": "node",
            "metrics": ["range_error", "bearing_error", "relative_pose_error"],
            "anchors": ["jd-8.3.1", "jd-8.3.2"],
            "direction_zh": "相对几何误差 ↓",
            "evidence": "target-relative geometry GT",
            "sources": "SpatialSky-Bench",
            "maturity": "成熟",
        },
        {
            "cell": "A8×L2",
            "layer": "node",
            "metrics": [
                "relative_tracking_accuracy",
                "abs_rel",
                "epe",
                "target_loss_rate",
            ],
            "anchors": ["jd-8.3.1", "jd-8.3.2", "jd-8.3.3"],
            "direction_zh": "跟踪准确 ↑；深度/光流误差与丢失 ↓",
            "evidence": "temporal relative-pose/depth/flow GT",
            "sources": "深度估计；optical flow；目标跟踪协议",
            "maturity": "可迁移",
        },
    ],
    "A9": [
        {
            "cell": "A9×L1",
            "layer": "node",
            "metrics": [
                "soc_error",
                "remaining_flight_time_error",
                "health_state_accuracy",
            ],
            "anchors": ["jd-9.3.1"],
            "direction_zh": "电量/航时误差 ↓；健康判断 ↑",
            "evidence": "battery/health GT；power model",
            "sources": "UAVBench；NASA Li-ion Dataset",
            "maturity": "成熟",
        },
        {
            "cell": "A9×L2",
            "layer": "node",
            "metrics": [
                "energy_prediction_error",
                "reserve_margin_violation_rate",
                "deadline_miss_ratio",
                "warning_lead_time",
            ],
            "anchors": ["jd-9.3.2", "jd-9.3.3"],
            "direction_zh": "预测误差与储备违规 ↓；有效预警提前量",
            "evidence": "energy/resource timeline；reserve/deadline config",
            "sources": "UAVBench；ALFA",
            "maturity": "可迁移",
        },
    ],
    "A10": [
        {
            "cell": "A10×L1",
            "layer": "node",
            "metrics": [
                "path_validity_rate",
                "constraint_satisfaction",
                "path_length_ratio",
            ],
            "anchors": ["jd-10.3.1", "jd-10.3.2", "jd-10.3.3"],
            "direction_zh": "路径可行与约束 ↑；长度比近 1",
            "evidence": "map；geofence；reference path",
            "sources": "UAV-ON；OpenFly；FlightBench",
            "maturity": "可迁移",
        },
        {
            "cell": "A10×L2",
            "layer": "mixed",
            "metrics": [
                "navigation_success",
                "spl",
                "sdtw",
                "route_completion",
            ],
            "anchors": ["jd-10.3.1", "jd-10.3.2", "jd-10.3.3"],
            "direction_zh": "节点读数对照 jd-10.3；SPL/成功率为案例层",
            "evidence": "executed trajectory；success radius",
            "sources": "UAV-ON；UAVBench；OpenFly；FlightBench",
            "maturity": "成熟",
        },
    ],
    "A11": [
        {
            "cell": "A11×L1",
            "layer": "node",
            "metrics": [
                "control_command_validity",
                "target_state_prediction_accuracy",
                "control_constraint_satisfaction",
            ],
            "anchors": [
                "jd-11.3.1.1",
                "jd-11.3.1.2",
                "jd-11.3.1.3",
                "jd-11.3.1.4",
            ],
            "direction_zh": "指令可执行与约束满足 ↑",
            "evidence": "current/target state；action dictionary；controller limits",
            "sources": "BEDI；AeroVerse；UAV-ON",
            "maturity": "可迁移",
        },
        {
            "cell": "A11×L2",
            "layer": "mixed",
            "metrics": [
                "tracking_error",
                "ise",
                "constraint_violation_duration",
                "control_stability",
                "collision",
            ],
            "anchors": [
                "jd-11.3.1.1",
                "jd-11.3.1.2",
                "jd-11.3.1.3",
                "jd-11.3.2.1",
                "jd-11.3.2.2",
                "jd-11.3.2.3",
                "jd-11.3.2.4",
            ],
            "direction_zh": "跟踪/越界 ↓，稳定 ↑；collision 为案例 Gate（白墙 CR）",
            "evidence": "high-rate state/control/reference；collision stream",
            "sources": "AirSim；Flightmare；UAVBench；UAV-ON",
            "maturity": "成熟",
        },
    ],
    "A12": [],
    "A13": [],
    "A14": [],
    "A15": [],
    "A16": [],
    "A17": [],
}

# Leaf → primary grader metric ids (for detail pane)
LEAF_GRADER: dict[str, list[dict]] = {
    "jd-1.3.1": [
        {"metric_id": "referent_accuracy", "direction": "↑", "used_by_axl": ["A1×L2"]},
        {"metric_id": "slot_referent_joint_accuracy", "direction": "↑", "used_by_axl": ["A1×L2"]},
        {"metric_id": "intent_macro_f1", "direction": "↑", "used_by_axl": ["A1×L1"]},
    ],
    "jd-1.3.2": [
        {"metric_id": "ambiguity_detection_f1", "direction": "↑", "used_by_axl": ["A1×L3"]},
    ],
    "jd-2.3.1": [
        {"metric_id": "required_field_recall", "direction": "↑", "used_by_axl": ["A2×L2", "A2×L3"]},
    ],
    "jd-2.3.2": [
        {"metric_id": "parameter_exact_match", "direction": "↑", "used_by_axl": ["A2×L1"]},
        {"metric_id": "parse_validity", "direction": "↑", "used_by_axl": ["A2×L1"]},
        {"metric_id": "constraint_satisfaction", "direction": "↑", "used_by_axl": ["A2×L3"]},
    ],
    "jd-3.3.1": [
        {"metric_id": "required_subgoal_recall", "direction": "↑", "used_by_axl": ["A3×L2"]},
        {"metric_id": "skill_selection_accuracy", "direction": "↑", "used_by_axl": ["A3×L1"]},
    ],
    "jd-3.3.2": [
        {"metric_id": "dependency_edge_f1", "direction": "↑", "used_by_axl": ["A3×L2"]},
    ],
    "jd-3.3.3": [
        {"metric_id": "completion_update_accuracy", "direction": "↑", "used_by_axl": ["A3×L4"]},
    ],
    "jd-4.3.1": [
        {"metric_id": "weighted_stage_recall", "direction": "↑", "used_by_axl": ["A4×L2"]},
        {"metric_id": "next_step_accuracy", "direction": "↑", "used_by_axl": ["A4×L1"]},
    ],
    "jd-4.3.2": [
        {"metric_id": "workflow_validity_rate", "direction": "↑", "used_by_axl": ["A4×L2"]},
    ],
    "jd-5.3.1": [
        {"metric_id": "status_accuracy", "direction": "↑", "used_by_axl": ["A5×L1"]},
        {"metric_id": "failure_notification_f1", "direction": "↑", "used_by_axl": ["A5×L2"]},
    ],
    "jd-5.3.2": [
        {"metric_id": "report_latency", "direction": "↓", "used_by_axl": ["A5×L1"]},
    ],
    "jd-6.3.1": [
        {"metric_id": "class_f1", "direction": "↑", "used_by_axl": ["A6×L1"]},
        {"metric_id": "hota", "direction": "↑", "used_by_axl": ["A6×L2"]},
    ],
    "jd-6.3.2": [
        {"metric_id": "false_alarm_rate", "direction": "↓", "used_by_axl": ["A6×L1"]},
    ],
    "jd-6.3.3": [
        {"metric_id": "map", "direction": "↑", "used_by_axl": ["A6×L1"]},
        {"metric_id": "idf1", "direction": "↑", "used_by_axl": ["A6×L2"]},
    ],
    "jd-7.3.1": [
        {"metric_id": "position_rmse", "direction": "↓", "used_by_axl": ["A7×L1"]},
        {"metric_id": "ate", "direction": "↓", "used_by_axl": ["A7×L2"]},
    ],
    "jd-7.3.2": [
        {"metric_id": "orientation_error", "direction": "↓", "used_by_axl": ["A7×L1"]},
    ],
    "jd-7.3.3": [
        {"metric_id": "localization_availability", "direction": "↑", "used_by_axl": ["A7×L2"]},
    ],
    "jd-8.3.1": [
        {"metric_id": "range_error", "direction": "↓", "used_by_axl": ["A8×L1"]},
    ],
    "jd-8.3.2": [
        {"metric_id": "bearing_error", "direction": "↓", "used_by_axl": ["A8×L1"]},
    ],
    "jd-8.3.3": [
        {"metric_id": "relative_tracking_accuracy", "direction": "↑", "used_by_axl": ["A8×L2"]},
    ],
    "jd-9.3.1": [
        {"metric_id": "soc_error", "direction": "↓", "used_by_axl": ["A9×L1"]},
        {"metric_id": "health_state_accuracy", "direction": "↑", "used_by_axl": ["A9×L1"]},
    ],
    "jd-9.3.2": [
        {"metric_id": "reserve_margin_violation_rate", "direction": "↓", "used_by_axl": ["A9×L2"]},
    ],
    "jd-9.3.3": [
        {"metric_id": "energy_prediction_error", "direction": "↓", "used_by_axl": ["A9×L2"]},
    ],
    "jd-10.3.1": [
        {"metric_id": "sdtw", "direction": "↑", "used_by_axl": ["A10×L2"]},
    ],
    "jd-10.3.2": [
        {"metric_id": "path_validity_rate", "direction": "↑", "used_by_axl": ["A10×L1"]},
    ],
    "jd-10.3.3": [
        {"metric_id": "route_completion", "direction": "↑", "used_by_axl": ["A10×L2"]},
    ],
    "jd-11.3.1.1": [
        {"metric_id": "tracking_error", "direction": "↓", "used_by_axl": ["A11×L2"]},
    ],
    "jd-11.3.1.2": [
        {"metric_id": "tracking_error", "direction": "↓", "used_by_axl": ["A11×L2"]},
    ],
    "jd-11.3.1.3": [
        {"metric_id": "tracking_error", "direction": "↓", "used_by_axl": ["A11×L2"]},
    ],
    "jd-11.3.1.4": [
        {"metric_id": "tracking_error", "direction": "↓", "used_by_axl": ["A11×L2"]},
    ],
    "jd-11.3.2.1": [
        {"metric_id": "ise", "direction": "↓", "used_by_axl": ["A11×L2"]},
    ],
    "jd-11.3.2.2": [
        {"metric_id": "control_stability", "direction": "↑", "used_by_axl": ["A11×L2"]},
    ],
    "jd-11.3.2.3": [
        {"metric_id": "control_stability", "direction": "↑", "used_by_axl": ["A11×L2"]},
    ],
    "jd-11.3.2.4": [
        {"metric_id": "control_stability", "direction": "↑", "used_by_axl": ["A11×L2"]},
    ],
    "jd-11.3.3.1": [
        {
            "metric_id": "constraint_violation_duration",
            "direction": "↓",
            "used_by_axl": ["A11×L2"],
        }
    ],
    "jd-11.3.3.2": [
        {
            "metric_id": "control_constraint_satisfaction",
            "direction": "↑",
            "used_by_axl": ["A11×L1"],
        }
    ],
    "jd-12.3.1": [{"metric_id": "action_timing_error", "direction": "↓", "used_by_axl": []}],
    "jd-12.3.2": [{"metric_id": "action_success_rate", "direction": "↑", "used_by_axl": []}],
    "jd-12.3.3": [{"metric_id": "payload_data_quality", "direction": "↑", "used_by_axl": []}],
    "jd-13.3.1": [{"metric_id": "coverage_completeness", "direction": "↑", "used_by_axl": []}],
    "jd-13.3.2": [{"metric_id": "format_compliance", "direction": "↑", "used_by_axl": []}],
    "jd-13.3.3": [{"metric_id": "content_quality", "direction": "↑", "used_by_axl": []}],
    "jd-14.3.1": [{"metric_id": "link_latency", "direction": "↓", "used_by_axl": []}],
    "jd-14.3.2": [{"metric_id": "link_reliability", "direction": "↑", "used_by_axl": []}],
    "jd-14.3.3": [{"metric_id": "link_throughput", "direction": "↑", "used_by_axl": []}],
    "jd-15.3.1": [{"metric_id": "evidence_format_compliance", "direction": "↑", "used_by_axl": []}],
    "jd-15.3.2": [{"metric_id": "audit_completeness", "direction": "↑", "used_by_axl": []}],
    "jd-15.3.3": [{"metric_id": "timestamp_precision", "direction": "↓", "used_by_axl": []}],
    "jd-16.3.1": [{"metric_id": "authorization_completeness", "direction": "↑", "used_by_axl": []}],
    "jd-16.3.2": [{"metric_id": "declaration_latency", "direction": "↓", "used_by_axl": []}],
    "jd-17.3.1": [{"metric_id": "phase_safety_threshold_hit", "direction": "↑", "used_by_axl": []}],
    "jd-17.3.2": [{"metric_id": "safe_state_accuracy", "direction": "↑", "used_by_axl": []}],
    "jd-17.3.3": [{"metric_id": "safety_response_latency", "direction": "↓", "used_by_axl": []}],
}

# Case-layer metrics on ability roots (episode scoring; not jd leaves)
CASE_METRICS: dict[str, list[dict]] = {
    "A10": [
        {
            "metric_id": "navigation_success",
            "layer": "case",
            "definition_zh": "整局导航是否成功到达（对照 jd-10.3 读数，但本身记在 scoring）",
            "example_cases": [],
        },
        {
            "metric_id": "SPL",
            "layer": "case",
            "definition_zh": "成功加权路径效率 S×l/max(p,l)",
            "example_cases": [],
        },
    ],
    "A11": [
        {
            "metric_id": "SR",
            "layer": "case",
            "definition_zh": "成功率 = 到达终点 + 无碰撞 + 未越界 + 时限内",
            "example_cases": ["white_wall_narrow_gap"],
        },
        {
            "metric_id": "CR",
            "layer": "case",
            "definition_zh": "碰撞率 = 发生≥1次碰撞的 episode 占比（案例 Gate，非 jd-11.3 叶子）",
            "example_cases": ["white_wall_narrow_gap"],
        },
        {
            "metric_id": "SPL",
            "layer": "case",
            "definition_zh": "路径效率 = S×l/max(p,l)",
            "example_cases": ["white_wall_narrow_gap"],
        },
    ],
}

LEAF_DEFS = {
    "jd-1.3.1": "指称消解准确率阈值/目标；grader 对照本节点判指称是否合格。",
    "jd-1.3.2": "歧义检测召回率阈值/目标；grader 对照本节点判歧义是否被识别。",
    "jd-2.3.1": "必填参数覆盖率标准；案例可绑定目标覆盖率。",
    "jd-2.3.2": "参数合法性标准（合法/越界/缺失）。",
    "jd-3.3.1": "步骤完整性标准；必要步骤覆盖比例。",
    "jd-3.3.2": "依赖一致性标准（无冲突/有环/断裂）。",
    "jd-3.3.3": "完成语义正确性标准。",
    "jd-4.3.1": "阶段完成度标准。",
    "jd-4.3.2": "交接完整性标准。",
    "jd-5.3.1": "交接成功率标准。",
    "jd-5.3.2": "响应时效标准（发起→确认）。",
    "jd-6.3.1": "检出率标准。",
    "jd-6.3.2": "误报率标准。",
    "jd-6.3.3": "分类精度标准。",
    "jd-7.3.1": "位置误差容忍（阈值，单位 m）。",
    "jd-7.3.2": "姿态误差容忍（阈值，单位 °）。",
    "jd-7.3.3": "定位可用性标准（可信时间比例）。",
    "jd-8.3.1": "距离估计精度标准。",
    "jd-8.3.2": "方位估计精度标准。",
    "jd-8.3.3": "关联正确率标准。",
    "jd-9.3.1": "资源预警阈值（剩余比例）。",
    "jd-9.3.2": "返航储备要求（必须保留比例）。",
    "jd-9.3.3": "消耗预测精度标准。",
    "jd-10.3.1": "横向偏差标准（航迹偏离）。",
    "jd-10.3.2": "高度偏差标准。",
    "jd-10.3.3": "到达精度标准（航点位置误差）。",
    "jd-11.3.1.1": "位置跟踪误差容忍；白墙案例可 🔀 绑定 [0.1,0.3] m。",
    "jd-11.3.1.2": "速度跟踪误差容忍范围。",
    "jd-11.3.1.3": "姿态跟踪误差容忍范围。",
    "jd-11.3.1.4": "航向跟踪误差容忍范围。",
    "jd-11.3.2.1": "误差评价方式（如 RMS）；白墙案例 🔒 RMS。",
    "jd-11.3.2.2": "超调容忍范围。",
    "jd-11.3.2.3": "稳定/调节时间要求。",
    "jd-11.3.2.4": "振荡与抖动容忍范围。",
    "jd-11.3.3.1": "执行机构饱和状态阈值。",
    "jd-11.3.3.2": "剩余控制权威下限。",
    "jd-11.3.4.1": "控制质量激活阶段（何时开始按 .3 计分）。",
}


def layer_of_jd(node_id: str) -> str | None:
    """Return '3' or '4' for jd-A.3... / jd-A.4... else None."""
    if not node_id.startswith("jd-"):
        return None
    parts = node_id.split(".")
    if len(parts) >= 2 and parts[1] in {"3", "4"}:
        return parts[1]
    return None


def is_layer_group(node: dict, layer: str) -> bool:
    nid = node.get("node_id") or ""
    if not (nid.startswith("jd-") and nid.count(".") == 1 and nid.endswith(f".{layer}")):
        return False
    return True


def annotate_variable_leaf(
    node: dict,
    *,
    metric_layer: str,
    metric_role: str,
    defs: dict,
    grader_map: dict,
) -> bool:
    nid = node["node_id"]
    if nid in defs:
        node["definition"] = defs[nid]
    node["metric_layer"] = metric_layer
    node["metric_role"] = metric_role
    metrics = grader_map.get(nid)
    if metrics:
        node["grader_metrics"] = metrics
        cells = sorted({c for m in metrics for c in (m.get("used_by_axl") or [])})
        if cells:
            node["used_by_axl"] = cells
    node["visibility"] = list(
        dict.fromkeys((node.get("visibility") or []) + ["grader_visible"])
    )
    node["observation_channel"] = list(
        dict.fromkeys((node.get("observation_channel") or []) + ["grader"])
    )
    if node.get("difficulty_direction") in (None, "", "neutral"):
        dirs = {m.get("direction") for m in (metrics or [])}
        if dirs == {"↓"}:
            node["difficulty_direction"] = "decreasing"
        elif dirs == {"↑"}:
            node["difficulty_direction"] = "increasing"
    return True


def clear_metric_fields(node: dict) -> None:
    for key in (
        "metric_layer",
        "metric_role",
        "runtime_metrics",
        "grader_metrics",
        "case_metrics",
    ):
        node.pop(key, None)


def main() -> None:
    data = json.loads(TREE_PATH.read_text(encoding="utf-8"))
    nodes = data["nodes"]

    annotated_groups = 0
    annotated_leaves = 0
    annotated_roots = 0
    annotated_process_groups = 0
    annotated_process_leaves = 0

    for node in nodes:
        clear_metric_fields(node)
        nid = node.get("node_id") or ""

        # Ability roots: case-layer hints
        if node.get("node_kind") == "capability_root":
            aid = node.get("owner_a") or node.get("node_id")
            cases = CASE_METRICS.get(aid)
            if cases:
                node["metric_layer"] = "case"
                node["case_metrics"] = cases
            note = (
                f"树上：jd-{aid[1:]}.3=节点质量，jd-{aid[1:]}.4=过程协议；"
                "案例层 outcome 写在 case.scoring（勿挂成树叶子）。"
            )
            if not node.get("definition"):
                node["definition"] = note
            elif "jd-" not in (node.get("definition") or "") or ".3=" not in (
                node.get("definition") or ""
            ):
                # refresh stale case-only note
                if "case.scoring" in (node.get("definition") or "") and ".4" not in (
                    node.get("definition") or ""
                ):
                    node["definition"] = note
            if cases:
                annotated_roots += 1
            continue

        if is_layer_group(node, "3") or (
            node.get("name") in {"质量标准", *QUALITY_GROUP_NAME.values()}
            and layer_of_jd(nid) == "3"
        ):
            aid = node.get("owner_a")
            node["name"] = QUALITY_GROUP_NAME.get(aid, node.get("name") or "质量标准")
            node["definition"] = QUALITY_GROUP_DEF
            node["metric_layer"] = "node"
            node["metric_role"] = "quality_anchor_group"
            node["runtime_metrics"] = {
                "layer": "node",
                "tree_slot": "jd-x.3",
                "source": "metric.md",
                "note": "过程协议见同能力 jd-x.4；案例 outcome 见 case.scoring。",
                "axl": AXL_NODE_METRICS.get(aid, []),
            }
            node["visibility"] = list(
                dict.fromkeys((node.get("visibility") or []) + ["grader_visible"])
            )
            node["observation_channel"] = list(
                dict.fromkeys((node.get("observation_channel") or []) + ["grader"])
            )
            axl_cells = [row["cell"] for row in AXL_NODE_METRICS.get(aid, [])]
            if axl_cells:
                node["used_by_axl"] = axl_cells
            annotated_groups += 1
            continue

        if is_layer_group(node, "4") or (
            node.get("name")
            in {"兜底协议", *PROCESS_GROUP_NAME.values()}
            and layer_of_jd(nid) == "4"
        ):
            aid = node.get("owner_a")
            node["name"] = PROCESS_GROUP_NAME.get(aid, node.get("name") or "兜底协议")
            node["definition"] = PROCESS_GROUP_DEF
            node["metric_layer"] = "process"
            node["metric_role"] = "process_protocol_group"
            node["runtime_metrics"] = {
                "layer": "process",
                "tree_slot": "jd-x.4",
                "source": "metric.md",
                "note": "节点质量阈值见同能力 jd-x.3；案例 outcome 见 case.scoring。",
                "axl": AXL_PROCESS_METRICS.get(aid, []),
            }
            node["visibility"] = list(
                dict.fromkeys((node.get("visibility") or []) + ["grader_visible"])
            )
            node["observation_channel"] = list(
                dict.fromkeys((node.get("observation_channel") or []) + ["grader"])
            )
            axl_cells = [row["cell"] for row in AXL_PROCESS_METRICS.get(aid, [])]
            if axl_cells:
                node["used_by_axl"] = axl_cells
            annotated_process_groups += 1
            continue

        if node.get("node_kind") == "variable":
            layer = layer_of_jd(nid)
            if layer == "3" and len(nid.split(".")) >= 3:
                if annotate_variable_leaf(
                    node,
                    metric_layer="node",
                    metric_role="quality_anchor",
                    defs=LEAF_DEFS,
                    grader_map=LEAF_GRADER,
                ):
                    annotated_leaves += 1
                continue
            if layer == "4" and len(nid.split(".")) >= 3:
                if annotate_variable_leaf(
                    node,
                    metric_layer="process",
                    metric_role="process_protocol",
                    defs=PROCESS_LEAF_DEFS,
                    grader_map=PROCESS_LEAF_GRADER,
                ):
                    annotated_process_leaves += 1
                continue

    data["metric_annotation"] = {
        "version": "1.1.0",
        "source": "metric.md",
        "layers": {
            "node": "树 jd-x.3 质量锚点",
            "process": "树 jd-x.4 过程协议",
            "case": "案例 case.scoring（能力根 case_metrics 提示）",
        },
        "note": "节点/过程是变量树四层槽位，不是独立于树的 metric 分类。",
    }
    cv = str(data.get("catalog_version") or "")
    if cv.count(".") == 2:
        major, minor, patch = cv.split(".")
        if patch.isdigit():
            data["catalog_version"] = f"{major}.{minor}.{int(patch) + 1}"

    TREE_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"node groups={annotated_groups} leaves={annotated_leaves}; "
        f"process groups={annotated_process_groups} leaves={annotated_process_leaves}; "
        f"case roots={annotated_roots} -> {TREE_PATH}"
    )


if __name__ == "__main__":
    main()
