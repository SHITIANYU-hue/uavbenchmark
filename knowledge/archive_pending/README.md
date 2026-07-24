# 待归档 / 待清理资料

本目录只记录待处理范围，不在本批次移动或删除文件。

Pipeline 当前权威数据源是：

- `knowledge/jd_variable_tree_version2.json`
- STEP 3 调用时使用 `include_global=false`，只展示 A×L 对应的能力变量

以下资料仍保留在原位置，供回溯；它们不作为当前 Pipeline 的变量选择来源：

- `knowledge/jd_variable_tree_version1.json`
- `knowledge/jd_variable_tree_global_draft.json`
- `knowledge/jd_variable_tree_g1_a1_a5_draft.json`
- `knowledge/jd_variable_tree_g2_g3_renumbered_draft.json`
- `knowledge/jd_variable_tree_a9_resource_management_draft.json`
- `knowledge/jd_variable_tree_a11_control_draft.json`
- `knowledge/jd_variable_tree_legacy_inspection_source.json`
- `knowledge/jd_variable_tree_legacy_inspection_source.yaml`
- `knowledge/jd_variable_tree_legacy_white_wall_v0_6.json`
- 根目录 `JD业务变量树_version1.html`

处理建议：

1. 团队确认 V2 的全局变量不再使用后，将 V1、global draft 和各能力 draft 一并迁入
   `knowledge/archive/`，不要继续放在权威数据源旁边。
2. 根目录旧版 HTML 移入 `docs/generated/jd-tree/` 或停止跟踪，避免被误认为源数据。
3. 删除动作必须在团队确认清理清单后单独执行；本批次不删除任何历史文件。
