# Pipeline UI

`pipeline.html` 是入口薄壳；样式和脚本在本目录：

```text
pipeline/
  css/app.css
  js/
    constants.js      # 六步标签、能力编号与基础常量
    utils.js
    state.js          # 进度与阶段跳转
    scenarios.js
    coverage.js       # A×L 人工选择
    jd.js             # JD 分组、用户侧·世界侧
    jd_tree_v2.js     # A×L 子树加载、业务变量选择与清单导出
    agent.js          # 扩充 / 分类 / 变量范围约束提取 / TBD 来源复核
    persistence.js    # 保存·加载检查点
    steps.js          # STEP 1–6 界面（含批量 Task Template 与三类交付）
    shell.js          # 侧栏 Provider / 进度
    main.js           # render / init
```

脚本按依赖顺序以普通 `<script>` 加载（共享全局，兼容 `onclick`）。新逻辑加到对应文件即可，尽量不要把 `pipeline.html` 再堆厚。
