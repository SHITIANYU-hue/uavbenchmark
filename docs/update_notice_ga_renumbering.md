# Update Notice：A 顺序化重编号（A1–A17）

> **状态：** 已执行；2026-07-22 完成尾部编号修订
> **日期：** 2026-07-19；修订于 2026-07-22
> **影响范围：** 能力域 ID、JD 槽位 ID、schema、代码、测试、文档、UI 文案
> **回滚策略：** 在 git 上打 tag `pre-a-renumbering` 作为回滚点

## 0. TL;DR

把 17 个能力域从跳跃式编号改成**连续的 A1–A17**，去掉字母后缀并同步重命名 JD 槽位。**G1–G6 编号不变**；2026-07-22 尾部修订后，A15 属 G6、A16 属 G5、A17 属 G6，因此不能再用数字区间推断组别。概念词 `A×L` / 「17 个 A」**保持不变**。

## 1. 动机

- 当前 A 编号不按 G 组递增，A14 出现在 A4 和 A5 之间、A11 出现在 A6b 和 A7 之间，引用与交流成本高。
- 字母后缀（A6a/A6b、A9a/A9b）在 ID 排序、字符串比较和正则匹配中需要特判。
- 改成连续 A1–A17 后，编号自然递增、无后缀特例；同时保留 `A` 前缀以避免大规模文案替换。
- A 顺序化后仍使用显式 `A→G` 映射，避免尾部编号修订造成组别误判。

## 2. 决策摘要

| 决策项 | 选择 |
|---|---|
| A 编号方案 | 按当前 `abilities` 块物理顺序重排为 A1–A17，保留 `A` 前缀，去掉字母后缀 |
| G 组编号 | **G1–G6 完全保留**，不改名；使用显式映射，不再假设每组都是连续 A 区间 |
| JD 槽位 ID | 同步重命名，前缀对齐新 A 编号 |
| 概念词 | `A×L` / 「17 个 A」 / 「68 个 A×L」 / `G1`–`G6` **全部保持不变** |

## 3. 能力域编号映射（旧 A → 新 A）

按当前 `AxL责任定义字典_17A_68单元_机读版.md` 中 `abilities` 块的物理顺序：

| 旧 A | 新 A | G | ability |
|---|---|---|---|
| A1   | **A1**  | G1 | 意图 / 交互入口 |
| A2   | **A2**  | G1 | 任务规范 / 约束模型 |
| A3   | **A3**  | G1 | 意图推理 / 任务解释 |
| A4   | **A4**  | G1 | 交互到执行编排 |
| A14  | **A5**  | G1 | 监督 / 请求 / 交接 |
| A5   | **A6**  | G2 | 环境感知 / 态势感知 |
| A6a  | **A7**  | G2 | 自定位 / 姿态航向估计 |
| A6b  | **A8**  | G2 | 相对定位 / 方位关系估计 |
| A11  | **A9**  | G2 | 健康 / 能源 / 资源管理 |
| A7   | **A10** | G3 | 导航 / 航迹 / 轨迹管理 |
| A8   | **A11** | G3 | 飞行控制 / 执行机构 |
| A9a  | **A12** | G4 | 载荷动作执行 |
| A9b  | **A13** | G4 | 载荷成果生成 / 远端呈现 |
| A10  | **A14** | G5 | 通信 / C2 / 遥测 |
| A15  | **A15** | G6 | 日志 / 审计 / 保证证据 |
| A13  | **A16** | G5 | 空域 / 交通 / 合规接入 |
| A12  | **A17** | G6 | 安全包络 / 运行保证 / 处置建议 |

## 3.5 G 组（G1–G6）：编号不变，尾部使用显式映射

**G1–G6 的编号与命名完全不变**，依然是 6 个组。A1–A14 仍可按原区间理解，但 A15–A17 必须使用下表的显式映射：

| G 组 | 新 A 区间 | 能力数 | 含义（沿用既有定义） |
|---|---|---|---|
| G1 | A1–A5   | 5 | 交互 / 规划 / 编排 / 监督 |
| G2 | A6–A9   | 4 | 感知 / 定位 / 资源 |
| G3 | A10–A11 | 2 | 导航 / 飞控 |
| G4 | A12–A13 | 2 | 载荷动作 / 成果 |
| G5 | A14、A16 | 2 | 通信 / 空域合规 |
| G6 | A15、A17 | 2 | 日志审计 / 安全包络 |

实现要求：`src/uav_benchmark/compiler/intake.py` 保留 17 项显式映射；`pipeline/js/jd.js` 继续通过 `abilityMeta(a_id).g_group` 动态查表。docs / UI 文案中的 `G1`–`G6` 引用保留。

## 4. JD 槽位 ID 映射

10 个 global 变量（`jd-0.N`）**不变**。56 个 local 变量按所属 A 的新编号重新对齐前缀：

| 旧前缀 | 旧属 A | 新前缀 | 新属 A | 备注 |
|---|---|---|---|---|
| jd-1.N   | A1   | **jd-1.N**   | A1  | 不变 |
| jd-2.N   | A2   | **jd-2.N**   | A2  | 不变 |
| jd-3.N   | A3   | **jd-3.N**   | A3  | 不变 |
| jd-4.N   | A4   | **jd-4.N**   | A4  | 不变 |
| jd-5.N   | A5   | **jd-6.N**   | A6  | ⚠ ID 交换 |
| jd-6a.N  | A6a  | **jd-7.N**   | A7  | 去字母后缀 |
| jd-6b.N  | A6b  | **jd-8.N**   | A8  | 去字母后缀 |
| jd-7.N   | A7   | **jd-10.N**  | A10 | ⚠ ID 交换 |
| jd-8.N   | A8   | **jd-11.N**  | A11 | ⚠ ID 交换 |
| jd-9a.N  | A9a  | **jd-12.N**  | A12 | 去字母后缀 |
| jd-9b.N  | A9b  | **jd-13.N**  | A13 | 去字母后缀 |
| jd-10.N  | A10  | **jd-14.N**  | A14 | ⚠ ID 交换 |
| jd-11.N  | A11  | **jd-9.N**   | A9  | ⚠ ID 交换 |
| jd-12.N  | A12  | **jd-17.N**  | A17 | ⚠ ID 交换 |
| jd-13.N  | A13  | **jd-16.N**  | A16 | ⚠ ID 交换 |
| jd-14.N  | A14  | **jd-5.N**   | A5  | ⚠ ID 交换 |
| jd-15.N  | A15  | **jd-15.N**  | A15 | 不变 |

### ⚠ 关键风险：ID 交换

旧 → 新不是单向递增，存在多组**双向交换**：
- 旧 `jd-5.N`（A5）↔ 旧 `jd-14.N`（A14）：互换到新 `jd-6.N` 和新 `jd-5.N`
- 旧 `jd-7.N`（A7）↔ 旧 `jd-10.N`（A10）：互换到新 `jd-10.N` 和新 `jd-14.N`
- 旧 `jd-8.N`（A8）↔ 旧 `jd-11.N`（A11）：互换到新 `jd-11.N` 和新 `jd-9.N`
- 旧 `jd-12.N`（A12）迁移到 `jd-17.N`，旧 `jd-13.N`（A13）迁移到 `jd-16.N`；审计域 `jd-15.N` 保持不变

**必须用一次性原子脚本完成**（建议先全部加临时前缀 `__tmp__jd-`，再分两步落地），不能逐 ID 滚动提交，否则中途会出现 ID 冲突。

## 5. 受影响文件清单

### 5.1 源头文件（手改 → 跑 builder 重建产物）

| 文件 | 改动 |
|---|---|
| `AxL责任定义字典_17A_68单元_机读版.md` | `a_id:` / `cell:` / `ability`（不变）/ `responsibility` 文本中的 `{jd-K.N ...}` 引用；文件标题与 `schema_version` 升级 |
| `JD业务变量字典_66槽位_机读版.md` | `owner_a:` / `related_a:` / `id: jd-K.N`；`naming_rule` 段落改写；`schema_version` 升级 |

### 5.2 重新生成（不要手改）

```
.venv/bin/python scripts/build_knowledge_catalog.py
```

会重建：
- `knowledge/agent_reference_catalog.json`
- `knowledge/axl_responsibility_catalog.json`
- `knowledge/jd_dictionary.json`
- `knowledge/catalog_build_report.json`

### 5.3 代码与 schema（机械替换）

| 文件 | 改动 |
|---|---|
| `src/uav_benchmark/compiler/intake.py:14` | `ABILITY_TO_GROUP` 字典 17 个键改为新 A1–A17（去字母后缀） |
| `schemas/task_template.schema.json` | `ability` enum 改为 `["A1", ..., "A17"]`（17 项，无字母后缀） |
| `schemas/grader_result.schema.json` | 同上 |
| `pipeline/js/jd.js:4` | 正则简化：`/^(A\d+[a-z]?)/i` → `/^(A\d+)/i`（不再需要字母后缀捕获组） |
| `pipeline/js/jd.js:30` | cell 解析正则同步简化：去掉 `([a-z]?)` 捕获组 |
| `pipeline/js/constants.js` | `DEFAULT_TARGET_LEVELS` 对象键名替换为新 A1–A17 |
| `scripts/build_knowledge_catalog.py:206-222` | `legacy_semantic_conflicts` 中硬编码的 `jd-8.1/8.2/8.3` 改成 `jd-11.1/11.2/11.3` |
| `scripts/build_knowledge_catalog.py:159` | `catalog_version` 字符串升级 |

### 5.4 测试与样例

| 文件 | 改动 |
|---|---|
| `tests/agent_contract_checks.py` | fixture cell 字符串、a_id 断言、jd-K.N 引用 |
| `tests/compiler/test_intake.py` | coverage 列表断言；**注意 `A99` 是故意构造的非法测试值，不要误改** |
| `tests/contracts/test_schemas.py` | fixture ability 字段 |
| `examples/intake/case2_oilfield_intake.yaml` | ability 字段 + 中文叙述中的 A/JD 引用 |
| `examples/intake/case_intake_template.yaml` | ability 字段 |
| `examples/contracts/task_template.valid.json` | ability 字段 + 描述文案 |
| `examples/contracts/grader_result.valid.json` | ability 字段 |
| `examples/case2_oilfield_corridor/task_template.generated.json` | **建议删掉重新生成**，不要手改 |

### 5.5 文档（具体 ID 引用替换，概念词 `A×L` 保持不变）

| 文件 | 改动要点 |
|---|---|
| `README.md` | 具体能力编号引用替换；版本号说明；`A×L` / 「17 个 A」**保留** |
| `docs/codebase_guide.md` | 仅具体 A 编号引用替换 |
| `docs/config_agent_quickstart.md` | 仅具体 A 编号引用替换 |
| `docs/pipeline_ui_walkthrough.md` | 仅具体 A 编号引用替换 |
| `docs/how_to_create_case_template.md` | ability 字段 + 具体编号引用 |
| `docs/archive/模版二_油田管廊缺陷巡检.md` | 密集中文叙述 + 表格中的具体 A×L / JD 引用，建议脚本批量替换 |

### 5.6 UI 文案（**几乎无需改动**）

`pipeline/js/steps.js`、`agent.js`、`coverage.js`、`shell.js` 中的文案**几乎全部是概念词 `A×L`**，按决策保留不变。仅 `pipeline/js/constants.js` 的对象键名需改（已在 §5.3 列出）。

### 5.7 无需改动

- `pipeline.html`、`pipeline/css/app.css`（文案全部由 JS 注入）
- `knowledge/business_scenario_registry.json`、`task_template_backbone.json`、`catalog_build_report.json`（无具体 A 编号引用）
- `schemas/ground_truth|sut_trace|task_instance.schema.json`
- `examples/contracts/ground_truth|sut_trace|task_instance.valid.*`
- `scripts/start_agent_demo.sh`
- pipeline JS 中的 `A×L` 概念文案

## 6. 推荐迁移顺序

1. **打 tag**：`git tag pre-a-renumbering` 作为回滚点。
2. **写一次性迁移脚本**：把 §3、§4 的映射表序列化成 JSON，提供 `old_to_new` 接口供后续步骤查询。
3. **改两份源头 MD**：注意 §4 的 ID 交换风险，先批量加 `__tmp__` 前缀再落地新 ID。
4. **改 `build_knowledge_catalog.py`** 的两处硬编码（`legacy_semantic_conflicts` 与 `catalog_version`）。
5. **跑 builder**：`.venv/bin/python scripts/build_knowledge_catalog.py`，确认 17/68/66 计数。
6. **改代码与 schema**：`intake.py` 保留 17 个显式键、两个 schema enum、`jd.js` 两处正则、`constants.js` 键名。
7. **跑测试**：`python -m pytest -q` + `PYTHONPATH=src .venv/bin/python tests/agent_contract_checks.py`。
8. **改 examples**（YAML intake 与 contracts 样例）；删 `task_template.generated.json` 用 compiler 重新编译。
9. **改文档**（仅具体 A 编号与 JD 编号引用；`A×L` 概念词与 `G1`–`G6` 不动）。
10. **人工抽检**：`./scripts/start_agent_demo.sh` → 打开 `http://127.0.0.1:8765`，确认 STEP 2 的 A×L 列表、JD 分组、cell 排序正常。

## 7. Provenance 与向后兼容

- 在 `knowledge/` 下新增 `legacy_id_mapping.json`，持久化 §3、§4 的新旧映射表（含 A 旧→新、JD 旧→新、G 不变的明确声明），并在 `catalog_build_report.json` 里加 `id_mapping_ref` 字段引用。
- 已有 `.agent_runs/` 中的运行记录**保留旧 ID**，不做回填；读取时如需对照，查 `legacy_id_mapping.json`。
- `schema_version` 与 `catalog_version` 字段升级，作为断点；下游消费者应通过版本字段判断新旧编号。
- 如果存在外部仓库 / 文档链接到具体 `jd-K.N`，需登记后单独通知。

## 8. 工作量估计

| 类别 | 文件数 | 难度 |
|---|---|---|
| 源头 MD | 2 | 高（含 ID 交换） |
| Builder 硬编码 | 1 | 低 |
| Knowledge JSON（重建） | 4 | 自动 |
| 代码 | 4 | 中（含正则简化） |
| Schema | 2 | 低 |
| 测试 | 3 | 中 |
| Examples | 5 | 中 |
| 文档（仅具体编号） | 6 | 低（机械替换） |
| 一次性迁移脚本 | 1 | 中 |

**总计：约 28 个文件 + 1 个迁移脚本 + 1 个映射 JSON。**（比 GA 方案少，因为 `A×L` / `G1`–`G6` 概念词与 UI 文案全部保留。）

## 9. 待确认项

- [x] §3 的 A 编号映射已采纳；2026-07-22 最终确认 A15 审计、A16 合规、A17 安全
- [x] §3.5 的 `ABILITY_TO_GROUP` 保留 17 项显式字典，不使用区间推断。
- [ ] `naming_rule` 段落改写后是否需要保留一句「旧版本 jd-K.N 见 `legacy_id_mapping.json`」？
- [ ] `schema_version` 字符串是否一并升级（如 `png-17-abilities-68-cells-2026-07-14` → `a17-abilities-68-cells-2026-07-19`）？
- [ ] G1–G6 的中文名称（如「交互 / 规划 / 编排 / 监督」）是否需要在文档里显式列出？当前字典里只有 `g_group: G1` 这种纯 ID。
