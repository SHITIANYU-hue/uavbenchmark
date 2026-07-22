# JD 业务变量树 Version 2 合并说明

## 合并结论

Version 2 继续使用团队树的四层结构、A11 细分和交互网页作为主干；Version 1 不作为第二棵平行树拼接，而是提供已审计的数据流语义、来源、Canonical JD 引用、JD-global 分支和校验规则。

当前编号基线为：

- `A15 = 审计日志`，属于 G6；
- `A16 = 合规申报`，属于 G5；
- `A17 = 安全包络`，属于 G6；
- `jd-15.* / jd-16.* / jd-17.*` 与上述能力同步。

因此，A1–A17 虽连续编号，但不能通过数字区间推断尾部 G 组，必须读取权威字典中的显式 `g_group`。

## 合并策略

1. Version 2 的 17 棵能力树和四层结构保持 `proposed`，不冒充 56 个 local canonical JD。
2. 仅在“同一能力、同一名称、唯一匹配”时迁移 Version 1 的审计语义；未唯一匹配的变量保留 `variable_role=TBD`。
3. Version 1 的 10 个 JD-global canonical 分支整体并入 Version 2，并在网页中单列 `JD-global`。
4. A11 `jd-11.1.3.*` 下的世界侧实际几何、外观、布局和运动变量标记为 Hidden Ground Truth，只投影到 World Config / Harness，不作为 SUT 输入。
5. 白墙窄缝继续保存在独立 CASE 覆盖层，不升级为 canonical JD。
6. metric set 中已有数值保留供团队审阅，但统一标记为未受审演示候选、默认不生效、阈值权威来源为 TBD。

## 当前统计

- Version 2：444 个节点、317 个变量叶子；
- JD-global：94 个节点，其中 10 个 canonical JD；
- Version 1 唯一语义匹配：56 个节点；
- A11 Hidden GT：26 个变量节点；
- 数据流角色待确认：201 个变量节点。

这些数量是当前结构审计结果，不是扩展指标，也不是验收阈值。

## 仍需人工确认

- 201 个 TBD 节点的生产者、配置侧、可见性和投影目标；
- Version 2 四层 proposed 节点与 56 个 local canonical JD 的正式映射；
- metric set 中每个数值的业务、安全或法规依据；
- A11 proposed 动态包络与案例 Profile 的正式边界；
- simulator / world-side config 与 user-side config 的最终接口合同。

## 可复现构建

```bash
.venv/bin/python scripts/sync_authoritative_dictionary_order.py
.venv/bin/python scripts/build_knowledge_catalog.py
node scripts/generate_jd_variable_tree_version1.mjs
node scripts/expand_jd_variable_tree_version1.mjs
node scripts/validate_jd_variable_tree_version1.mjs
node scripts/merge_jd_variable_tree_v1_into_v2.mjs
node scripts/validate_jd_variable_tree_version2.mjs
```

网页读取 `knowledge/jd_variable_tree_version2.json`，入口为根目录 `JD业务变量树_version2.html`。
