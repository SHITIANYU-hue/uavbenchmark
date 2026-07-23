# Machine contract v0.1

当前 JSON Schema 使用 Draft 2020-12：

- `jd_tree_selection.schema.json`：一次经人工确认的 JD Version2 细粒度变量选择、canonical 追溯和 Agent 允许范围。
- `task_template.schema.json`：可实例化任务、coverage、JD slot、阶段、接口和 metric 规格。
- `task_instance.schema.json`：template + seed 的确定性编译结果。
- `ground_truth.schema.json`：仅供 grader 使用的 hidden GT。
- `sut_trace.schema.json`：逐行校验 JSONL；第一行 header，后续为 observable event。
- `grader_result.schema.json`：独立 A×L gate、metric、failure reason 与复现信息。

案例二扩展性审计后，`task_template` 额外支持：

- `runtime_dependencies[]`：外部定位、低层飞控等运行依赖，强制 `scored: false`；
- `attribution_rules[]`：决策、执行与共享结果的归因/禁止重复计分规则；
- `task_level_gates[]`：跨能力共享的安全终态或完整性 gate。

`grader_result.task_level_results[]` 与逐 A×L 的 `coverage_results[]` 分开，避免共享安全终态被重复计分。

## v0.1 的有意限制

JSON Schema 只负责单 artifact 的结构合法性。以下跨文件/时序规则留给后续 validator：

- template/instance ID 和 hash 是否匹配；
- phase `order` 是否唯一、tick 是否单调；
- disturbance 是否晚于足够长的 nominal phase；
- platform 与 protection action 是否兼容；
- GT 是否通过其他引用路径泄露给 SUT；
- metric 参数、threshold 和 coverage gate 是否已获人工批准。

所有未标定 threshold 必须为：

```json
{"value": null, "status": "TBD"}
```

例子在 `examples/contracts/`，仅用于结构测试，不代表业务时长、平台动作或正式评分值。
