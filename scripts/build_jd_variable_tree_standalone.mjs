import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const templatePath = path.join(projectRoot, "jd-variable-tree.html");
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

const template = fs.readFileSync(templatePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
const catalog = JSON.parse(fs.readFileSync(combinedCatalogPath, "utf8"));

const safeCatalog = JSON.stringify(catalog).replaceAll("</script", "<\\/script");
const safeApp = app.replaceAll("</script", "<\\/script");

const standalone = template
  .replace(
    /\s*<a[\s\S]*?data-standalone-download[\s\S]*?<\/a>/,
    "",
  )
  .replace(
    '<link rel="stylesheet" href="jd-variable-tree/css/app.css">',
    `<style>\n${css}\n</style>`,
  )
  .replace(
    '<script src="jd-variable-tree/js/app.js"></script>',
    `<script>window.__JD_VARIABLE_TREE_CATALOG__ = ${safeCatalog};</script>\n  <script>\n${safeApp}\n  </script>`,
  );

fs.writeFileSync(outputPath, standalone, "utf8");

const byteSize = fs.statSync(outputPath).size;
console.log(
  `${combinedCatalogPath}\n${outputPath}\n${byteSize} bytes`,
);
