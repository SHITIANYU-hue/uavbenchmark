import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const cssPath = path.join(projectRoot, "jd-variable-tree/css/app.css");
const appPath = path.join(projectRoot, "jd-variable-tree/js/app.js");
const combinedCatalogPath = path.join(
  projectRoot,
  "knowledge/jd_variable_tree_version1.json",
);
const outputPath = path.join(
  projectRoot,
  "JD业务变量树_version1.html",
);

const css = fs.readFileSync(cssPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
const catalog = JSON.parse(fs.readFileSync(combinedCatalogPath, "utf8"));

const safeCatalog = JSON.stringify(catalog).replaceAll("</script", "<\\/script");
const safeApp = app.replaceAll("</script", "<\\/script");

const standalone = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="data:,">
  <title>JD 业务变量树｜version1</title>
  <style>
${css}
  </style>
</head>
<body>
  <header class="app-header">
    <div class="brand">
      <span class="brand-kicker">UAV BENCHMARK</span>
      <strong>JD 业务变量树</strong>
      <span>A1 · A2 · A3 · A4 · A5 · A6 · A7a · A7b · A8 · A9 · A10</span>
    </div>
    <div class="header-actions">
      <button class="review-action" id="importCommentsButton" type="button">导入建议</button>
      <button class="review-action" id="exportCommentsButton" type="button">
        导出建议 <span id="totalCommentCount">0</span>
      </button>
      <input id="commentImportInput" type="file" accept="application/json,.json" hidden>
    </div>
  </header>

  <main>
    <nav class="ability-tabs" id="abilityTabs" aria-label="能力树切换"></nav>

    <section class="map-panel">
      <header class="map-head">
        <div>
          <span class="eyebrow">MIND MAP</span>
          <h1 id="mapTitle">加载中</h1>
        </div>
        <span class="map-count" id="mapCount"></span>
      </header>
      <div class="map-viewport" id="mapViewport">
        <div class="mindmap" id="mindmap" aria-label="JD 思维导图"></div>
      </div>
    </section>
  </main>

  <dialog class="detail-dialog" id="detailDialog" aria-labelledby="detailTitle">
    <div class="dialog-head">
      <div>
        <span class="detail-id" id="detailId"></span>
        <h2 id="detailTitle"></h2>
      </div>
      <button class="close-button" id="closeDialogButton" type="button" aria-label="关闭详情">×</button>
    </div>
    <div class="dialog-body" id="dialogBody"></div>
  </dialog>

  <script>window.__JD_VARIABLE_TREE_CATALOG__ = ${safeCatalog};</script>
  <script>
${safeApp}
  </script>
</body>
</html>
`;

fs.writeFileSync(outputPath, standalone, "utf8");

const byteSize = fs.statSync(outputPath).size;
console.log(
  `${combinedCatalogPath}\n${outputPath}\n${byteSize} bytes`,
);
