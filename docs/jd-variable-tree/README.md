# JD 业务变量树

## 文件职责

| 文件 | 作用 |
|---|---|
| `../../jd-variable-tree/js/app.js` | 页面数据加载、能力切换、搜索与审阅交互 |
| `../../jd-variable-tree/css/app.css` | 页面样式 |
| `../../knowledge/jd_variable_tree_version1.json` | 页面读取的完整机读数据 |
| `../../knowledge/jd_variable_tree_a9_resource_management_draft.json` | A9 健康、能源与资源管理分支草案 |
| `../../knowledge/jd_variable_tree_legacy_inspection_source.json` | 旧巡检树迁移源；仅用于生成与审计 |
| `../../knowledge/jd_variable_tree_legacy_white_wall_v0_6.json` | 旧白墙 v0.6 迁移源；仅用于生成与审计 |
| `../../scripts/generate_jd_variable_tree_version1.mjs` | 汇总和迁移变量树数据 |
| `../../scripts/validate_jd_variable_tree_version1.mjs` | 结构、编号与引用校验 |
| `../../scripts/build_jd_variable_tree_standalone.mjs` | 生成可独立打开的单文件 HTML |
| `../../JD业务变量树_version1.html` | 构建产物；用于分享，不应直接手工编辑 |

## 修改与构建

先修改生成脚本、基础 JSON 或页面代码，再依次执行：

```bash
node scripts/generate_jd_variable_tree_version1.mjs
node scripts/validate_jd_variable_tree_version1.mjs
node scripts/build_jd_variable_tree_standalone.mjs
```

本地审阅：

```bash
./scripts/serve_jd_variable_tree.sh
```

然后访问 `http://127.0.0.1:8766/JD业务变量树_version1.html`。

## 发布范围

变量树页面源码、生成脚本、校验脚本、`knowledge/` 下的机读数据和独立 HTML 均属于可复现交付，应一起提交。原始会议材料、DOCX、研究输入和内部工作记录保存在本机 `local/`，不作为页面运行依赖。
