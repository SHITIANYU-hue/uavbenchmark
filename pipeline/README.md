# Pipeline UI modules

`pipeline.html` is a thin shell. Styles and scripts live here:

```
pipeline/
  css/app.css          # all styles
  js/
    constants.js       # STAGES, defaults, WORLD_SIDE_JD
    utils.js           # escapeHtml, pill, uid
    state.js           # state + stage navigation
    scenarios.js       # scenario prompt helpers
    coverage.js        # A×L picker + validation hints
    jd.js              # JD grouping, domain edits, user/world sides
    agent.js           # expand / analyze / fill-tbd
    persistence.js     # save / load checkpoint
    steps.js           # STEP 1–5 workspace renderers
    shell.js           # run-context sidebar
    main.js            # render(), init(), header buttons
```

Scripts are classic globals loaded in dependency order (not ES modules), so
existing `onclick="..."` handlers keep working. Prefer adding new helpers to
the closest module above rather than growing `pipeline.html`.
