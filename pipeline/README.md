# Pipeline UI

`pipeline.html` 是入口薄壳；样式和脚本在本目录：

```text
pipeline/
  css/app.css
  js/
    constants.js      # 五步标签、默认 Coverage、世界侧 JD
    utils.js
    state.js          # 进度与阶段跳转
    scenarios.js
    coverage.js       # A×L 选择 / Seed 随机
    jd.js             # JD 分组、用户侧·世界侧
    agent.js          # 扩充 / 分类 / fill-tbd
    persistence.js    # 保存·加载检查点
    steps.js          # STEP 1–5 界面
    shell.js          # 侧栏 Provider / 进度
    main.js           # render / init
```

脚本按依赖顺序以普通 `<script>` 加载（共享全局，兼容 `onclick`）。新逻辑加到对应文件即可，尽量不要把 `pipeline.html` 再堆厚。
