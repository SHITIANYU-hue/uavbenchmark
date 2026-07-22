# JD 业务变量树

## 文件职责

| 文件 | 作用 |
|---|---|
| `../../jd-variable-tree/js/app.js` | 页面数据加载、能力切换、搜索与审阅交互 |
| `../../jd-variable-tree/css/app.css` | 页面样式 |
| `../../knowledge/jd_variable_tree_version1.json` | 审计语义与 canonical/JD-global 来源树 |
| `../../knowledge/jd_variable_tree_version2.json` | 团队四层结构与 Version 1 审计语义合并后的主树 |
| `../../knowledge/jd_variable_tree_a9_resource_management_draft.json` | A9 健康、能源与资源管理分支草案 |
| `../../knowledge/jd_variable_tree_legacy_inspection_source.json` | 旧巡检树迁移源；仅用于生成与审计 |
| `../../knowledge/jd_variable_tree_legacy_white_wall_v0_6.json` | 旧白墙 v0.6 迁移源；仅用于生成与审计 |
| `../../scripts/generate_jd_variable_tree_version1.mjs` | 汇总和迁移变量树数据 |
| `../../scripts/expand_jd_variable_tree_version1.mjs` | 在 66 个 canonical 槽位不变的前提下，为基线缺失的 A12–A17 补入来源约束子树；禁止 EX 临时编号 |
| `../../scripts/validate_jd_variable_tree_version1.mjs` | 结构、编号、`related_jd`、Hidden GT/SUT 边界、数据流角色及 optional proposed 子树校验 |
| `../../scripts/merge_jd_variable_tree_v1_into_v2.mjs` | 将 Version 1 审计语义保守迁移到 Version 2；同时标记 metric 草案权威状态 |
| `../../scripts/validate_jd_variable_tree_version2.mjs` | 校验 Version 2 编号、来源、JD-global、TBD 说明及 Hidden GT 隔离 |
| `../../scripts/build_jd_variable_tree_standalone.mjs` | 生成可独立打开的单文件 HTML |
| `../../JD业务变量树_version1.html` | 构建产物；用于分享，不应直接手工编辑 |

## 修改与构建

先修改生成脚本、基础 JSON 或页面代码，再依次执行：

```bash
node scripts/generate_jd_variable_tree_version1.mjs
node scripts/expand_jd_variable_tree_version1.mjs
node scripts/validate_jd_variable_tree_version1.mjs
node scripts/build_jd_variable_tree_standalone.mjs
node scripts/merge_jd_variable_tree_v1_into_v2.mjs
node scripts/validate_jd_variable_tree_version2.mjs
```

本地审阅：

```bash
./scripts/serve_jd_variable_tree.sh
```

然后访问 `http://127.0.0.1:8766/JD业务变量树_version2.html`。合并边界见 [Version 2 合并说明](JD业务变量树_version2_合并说明.md)。

节点的 `variable_role` 用于区分可配置输入、合同/schema、运行时观察、派生指标和 Hidden Ground Truth；它是数据合同元数据，不是新增 JD 业务变量。

## 发布范围

变量树页面源码、生成脚本、校验脚本、`knowledge/` 下的机读数据和独立 HTML 均属于可复现交付，应一起提交。原始会议材料、DOCX、研究输入和内部工作记录保存在本机 `local/`，不作为页面运行依赖。
