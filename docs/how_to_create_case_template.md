# 如何从业务案例生成 Config Agent Task Template

## 1. 三层文件不要混在一起

### A. Case Intake：你填写的业务输入

文件格式：YAML。
示例：`examples/intake/case2_oilfield_intake.yaml`。

你需要填写：

1. `case_id/title/summary`：案例身份和一句话任务；
2. `fixed_boundaries`：所有实例都不允许改变的业务边界；
3. `coverage`：正式评分的 A×L、角色、SUT 责任和不负责项；
4. `runtime_dependencies`：外部定位、飞控、执行器等运行条件；
5. `attribution_rules`：能力之间如何分工、如何避免重复计分；
6. `task_level_gates`：跨能力共享的安全终态或完整性条件；
7. `variables`：Config Agent 可以填充的 slot 及允许域；
8. `phases/disturbances`：阶段顺序和异常注入位置；
9. `interfaces`：SUT 可见输入、SUT 输出、hidden GT 和 executor 责任；
10. `metrics`：指标名称与参数；未标定 threshold 必须为 `null/TBD`。

你不需要填写 Python、JSON Schema 或 simulator API。

### B. Task Template：Python 生成的机器合同

Python compiler 会：

- 根据 A 编号自动补 G；
- 自动生成 `coverage_id`；
- 把 L0/外部条件挡在正式 coverage 之外；
- 强制 runtime dependency 为 `scored: false`；
- 补齐 schema/version/provenance；
- 保留变量允许域供 Config Agent 使用；
- 检查 `TBD` threshold 不能携带数值；
- 按 `task_template.schema.json` 校验结果。

输出示例：`examples/case2_oilfield_corridor/task_template.generated.json`。

### C. Task Instance：Config Agent 后续生成

Config Agent 的输入是 Task Template，而不是原始长篇 Markdown。

它负责：

```text
读取 jd_slots / allowed_values / constraints
→ 按 enumerate 或 seed sampling 选择取值
→ 可选使用 LM 补充复杂自然语言/场景描述
→ 确定性 validator 检查边界和兼容性
→ 输出 task_instance
```

Config Agent 不得修改固定 A×L、创造 threshold 或发明 simulator 接口。

## 2. 当前命令

在项目根目录运行：

```bash
PYTHONPATH=src python3 -m uav_benchmark.compiler \
  --input examples/intake/case2_oilfield_intake.yaml \
  --output examples/case2_oilfield_corridor/task_template.generated.json
```

只做合法性检查：

```bash
PYTHONPATH=src python3 -m uav_benchmark.compiler \
  --input examples/intake/case2_oilfield_intake.yaml \
  --check
```

成功时会显示：

```text
VALID: case2_oilfield_corridor_template (4 coverage cells)
```

## 3. YAML 中最关键的一段

```yaml
coverage:
  - ability: A11
    level: L4
    role: primary
    responsibilities:
      - 持续维护资源预算
      - 自主选择兜底策略
      - 验证处置后的安全终态
    out_of_scope:
      - 返航或备降路线的低层执行性能

runtime_dependencies:
  - dependency_id: external_low_level_flight_control
    ability: A8
    provider: executor
    responsibilities:
      - 提供低层速度、姿态和着陆控制
    status: proposed

variables:
  - slot_id: fallback_branch
    description: 需要覆盖的资源兜底分支
    visibility: grader_only
    binding:
      mode: enum
      allowed_values: [continue_safe, shorten_and_return, safe_landing]
      status: proposed
```

这段表达的是：A11×L4 正式评分，A8 只是外部运行依赖；Config Agent 可以在三个候选资源分支中遍历或采样。

## 4. 从 Markdown 到 YAML

长篇案例 Markdown 仍然有用，但它属于研究和审阅材料。进入 pipeline 前，应提炼成 Case Intake YAML。转换时只提取：

- 已确认的固定责任；
- 可实例化变量及允许域；
- hidden GT；
- 可观察 SUT 输出；
- 外部 actor；
- attribution/gate；
- 未决项及 `TBD`。

无法确认的数值、业务规则和接口不要猜测，保留为 `TBD` 或 reference slot。
