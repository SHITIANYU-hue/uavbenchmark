# Ability & JD Renumbering Migration Notice

**Date**: 2026-07-16  
**Commit**: `4dde43f` — Migrate ability IDs to continuous A1-A17  
**Scope**: All A (ability) IDs and JD (variable) slot IDs

---

## Why

The original numbering used non-sequential IDs with letter suffixes (`A6a`, `A6b`, `A9a`, `A9b`) and gaps (`A14` appeared before `A5` in group order). This made it hard to remember, reference, and communicate. The new scheme is strictly sequential: **A1 through A17**, grouped by function.

---

## Ability ID Mapping

| Old | New | Ability | Group |
|-----|-----|---------|-------|
| A1 | A1 | 意图 / 交互入口 | G1 |
| A2 | A2 | 任务规范 / 约束模型 | G1 |
| A3 | A3 | 意图推理 / 任务解释 | G1 |
| A4 | A4 | 交互到执行编排 | G1 |
| **A14** | **A5** | 监督 / 请求 / 交接 | G1 |
| **A5** | **A6** | 环境感知 / 态势感知 | G2 |
| **A6a** | **A7** | 自定位 / 姿态航向估计 | G2 |
| **A6b** | **A8** | 相对定位 / 方位关系估计 | G2 |
| **A11** | **A9** | 健康 / 能源 / 资源管理 | G2 |
| **A7** | **A10** | 导航 / 航迹 / 轨迹管理 | G3 |
| **A8** | **A11** | 飞行控制 / 执行机构 | G3 |
| **A9a** | **A12** | 载荷动作执行 | G4 |
| **A9b** | **A13** | 载荷成果生成 / 远端呈现 | G4 |
| **A10** | **A14** | 通信 / C2 / 遥测 | G5 |
| **A13** | **A15** | 空域 / 交通 / 合规接入 | G5 |
| **A12** | **A16** | 安全包络 / 运行保证 / 处置建议 | G6 |
| **A15** | **A17** | 日志 / 审计 / 保证证据 | G6 |

**Rule**: New number = position within the group sequence (G1→A1-A5, G2→A6-A9, G3→A10-A11, G4→A12-A13, G5→A14-A15, G6→A16-A17).

---

## JD Slot ID Mapping

JD slot IDs follow `jd-{owner_A_number}.{index}`. When the owner A number changes, the JD prefix changes too. **43 of 66 JD slots changed IDs.**

### Changed (43 slots)

| Old JD | New JD | Name | Owner Change |
|--------|--------|------|--------------|
| jd-5.1 | jd-6.1 | 业务对象类目 | A5→A6 |
| jd-5.2 | jd-6.2 | 典型场景特征 | A5→A6 |
| jd-5.3 | jd-6.3 | 感知模态集 | A5→A6 |
| jd-5.4 | jd-6.4 | 感知策略适用集 | A5→A6 |
| jd-6a.1 | jd-7.1 | 定位源需求 | A6a→A7 |
| jd-6a.2 | jd-7.2 | 位姿质量先验 | A6a→A7 |
| jd-6a.3 | jd-7.3 | 定位策略适用集 | A6a→A7 |
| jd-6b.1 | jd-8.1 | 相对几何先验 | A6b→A8 |
| jd-6b.2 | jd-8.2 | 相对几何感知机制 | A6b→A8 |
| jd-6b.3 | jd-8.3 | 相对定位策略适用集 | A6b→A8 |
| jd-7.1 | jd-10.1 | 航路拓扑 | A7→A10 |
| jd-7.2 | jd-10.2 | 导航工作机制 | A7→A10 |
| jd-7.3 | jd-10.3 | 轨迹重规划判据 | A7→A10 |
| jd-7.4 | jd-10.4 | 航迹处置策略适用集 | A7→A10 |
| jd-8.1 | jd-11.1 | 控制质量先验 | A8→A11 |
| jd-8.2 | jd-11.2 | 控制工作机制 | A8→A11 |
| jd-8.3 | jd-11.3 | 控制处置策略适用集 | A8→A11 |
| jd-9a.1 | jd-12.1 | 载荷动作目录 | A9a→A12 |
| jd-9a.2 | jd-12.2 | 动作时序先验 | A9a→A12 |
| jd-9a.3 | jd-12.3 | 载荷处置策略适用集 | A9a→A12 |
| jd-9b.1 | jd-13.1 | 成果格式 | A9b→A13 |
| jd-9b.2 | jd-13.2 | 覆盖完整度判据 | A9b→A13 |
| jd-9b.3 | jd-13.3 | 成果处置策略适用集 | A9b→A13 |
| jd-10.1 | jd-14.1 | 链路质量先验 | A10→A14 |
| jd-10.2 | jd-14.2 | 地面站拓扑 | A10→A14 |
| jd-10.3 | jd-14.3 | 通信处置策略适用集 | A10→A14 |
| jd-11.1 | jd-9.1 | 资源消耗包络 | A11→A9 |
| jd-11.2 | jd-9.2 | 资源预警 / 预留策略 | A11→A9 |
| jd-11.3 | jd-9.3 | 资源处置策略适用集 | A11→A9 |
| jd-12.1 | jd-16.1 | 分相位安全阈值 | A12→A16 |
| jd-12.2 | jd-16.2 | 安全处置策略适用集 | A12→A16 |
| jd-12.3 | jd-16.3 | 安全态定义 | A12→A16 |
| jd-13.1 | jd-15.1 | 空域类别 | A13→A15 |
| jd-13.2 | jd-15.2 | 地理围栏集 | A13→A15 |
| jd-13.3 | jd-15.3 | 交通信息源需求 | A13→A15 |
| jd-13.4 | jd-15.4 | 授权生命周期 | A13→A15 |
| jd-13.5 | jd-15.5 | 合规处置策略适用集 | A13→A15 |
| jd-14.1 | jd-5.1 | 交接协议表 | A14→A5 |
| jd-14.2 | jd-5.2 | 偏好对齐协议 | A14→A5 |
| jd-14.3 | jd-5.3 | 高层通知规则 | A14→A5 |
| jd-15.1 | jd-17.1 | 事件类目 | A15→A17 |
| jd-15.2 | jd-17.2 | 证据格式规格 | A15→A17 |
| jd-15.3 | jd-17.3 | 留存策略 | A15→A17 |

### Unchanged (23 slots)

JD slots owned by A1-A4 (which kept their numbers) were not affected: `jd-0.x` (global), `jd-1.x`, `jd-2.x`, `jd-3.x`, `jd-4.x`.

---

## Impact

- **Schema**: `task_template.schema.json` and `grader_result.schema.json` ability enum updated.
- **Knowledge catalog**: All catalog JSON files rebuilt from source dictionaries.
- **Code**: No code changes needed — the catalog is data-driven and validated at runtime.
- **Existing artifacts**: Any saved task templates, instances, or agent results with old IDs are **incompatible** and should be regenerated.
