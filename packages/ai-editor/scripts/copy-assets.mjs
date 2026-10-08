#!/usr/bin/env node
/**
 * 附件预览 worker/wasm/字体资源一次性拷贝。
 *
 * 背景：@file-viewer 的渲染引擎（PDF / Word / Excel / PPT / 压缩包）在运行时
 * 需要一批 worker、wasm、字体静态文件。这些不是普通 JS 模块，npm install 不会
 * 自动放进静态目录，所以由本命令从已安装的 @file-viewer 包及其传递依赖中抽出，
 * 拷到项目的 public/file-viewer（路径与 FILE_VIEWER_OPTIONS 默认值对齐）。
 *
 * 用法：
 *   npx @qingwu-ui/ai-editor copy-assets                 # 拷到 ./public/file-viewer
 *   npx @qingwu-ui/ai-editor copy-assets --out static/fv # 自定义输出目录
 *
 * 注意：请在「项目根目录」执行，默认输出到 public/。
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = resolve(
  process.cwd(),
  outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : join("public", "file-viewer"),
);

// 以本包自身位置为起点解析 @file-viewer 锚点包，再从锚点包解析它的传递依赖。
// 这样无论 bun（隔离 node_modules）、npm/pnpm（提升/符号链接）布局如何都能定位。
const selfRequire = createRequire(import.meta.url);
function anchorRequire(anchor) {
  const pkgJson = selfRequire.resolve(`${anchor}/package.json`);
  return createRequire(pathToFileURL(pkgJson));
}

const pdfReq = anchorRequire("@file-viewer/renderer-pdf");
const wordReq = anchorRequire("@file-viewer/renderer-word");
const presReq = anchorRequire("@file-viewer/renderer-presentation");
const arcReq = anchorRequire("@file-viewer/renderer-archive");
const ssReq = anchorRequire("@file-viewer/renderer-spreadsheet");

/** 取某包安装目录：解析入口文件（受 exports 限制时也可用），再向上找到包根 */
function pkgDir(req, name) {
  let entry;
  try {
    entry = req.resolve(name);
  } catch {
    // 入口兜底：用已知存在的子路径
    entry = req.resolve(`${name}/package.json`);
    return dirname(entry);
  }
  const tail = name.split("/").pop();
  let dir = dirname(entry);
  for (let i = 0; i < 8; i++) {
    if (basename(dir) === tail) return dir;
    dir = dirname(dir);
  }
  return dirname(entry);
}

const pdfjs = pkgDir(pdfReq, "pdfjs-dist");
const noto = pkgDir(pdfReq, "@fontsource-variable/noto-sans-sc");
const fvDocx = pkgDir(wordReq, "@file-viewer/docx");
const fvPpt = pkgDir(presReq, "@file-viewer/ppt");
const fvPptx = pkgDir(presReq, "@file-viewer/pptx");
const libarchive = pkgDir(arcReq, "libarchive.js");
const spreadsheet = pkgDir(ssReq, "@file-viewer/renderer-spreadsheet");

// [来源, 目标] 列表，目标相对 outDir
const copies = [
  [join(pdfjs, "build/pdf.worker.mjs"), "vendor/pdf/pdf.worker.mjs"],
  [join(pdfjs, "cmaps"), "vendor/pdf/cmaps"],
  [join(pdfjs, "wasm"), "vendor/pdf/wasm"],
  [join(pdfjs, "standard_fonts"), "vendor/pdf/standard_fonts"],
  [join(noto, "files"), "vendor/pdf/fonts/files"],
  [join(noto, "index.css"), "vendor/pdf/fonts/noto-sans-sc.css"],
  [join(fvDocx, "dist/docx-preview.worker.js"), "vendor/docx/docx.worker.js"],
  [join(fvDocx, "dist/jszip.min.js"), "vendor/docx/jszip.min.js"],
  [join(fvPpt, "index.mjs"), "vendor/ppt/index.mjs"],
  [join(fvPpt, "worker.mjs"), "vendor/ppt/worker.mjs"],
  [join(fvPpt, "frame-cache.mjs"), "vendor/ppt/frame-cache.mjs"],
  [join(fvPpt, "ppt-native.wasm"), "vendor/ppt/ppt-native.wasm"],
  [join(fvPpt, "ppt-font-cjk.otf"), "vendor/ppt/ppt-font-cjk.otf"],
  [join(fvPpt, "manifest.json"), "vendor/ppt/manifest.json"],
  [join(fvPpt, "package.json"), "vendor/ppt/package.json"],
  [join(fvPpt, "LICENSE"), "vendor/ppt/LICENSE"],
  [join(fvPpt, "NOTICE"), "vendor/ppt/NOTICE"],
  [join(fvPptx, "dist/worker/pptx.worker.js"), "vendor/pptx/pptx.worker.js"],
  [join(libarchive, "dist/worker-bundle.js"), "vendor/libarchive/worker-bundle.js"],
  [join(libarchive, "dist/libarchive.wasm"), "vendor/libarchive/libarchive.wasm"],
  [join(spreadsheet, "dist/worker/sheet.worker.js"), "vendor/xlsx/sheet.worker.js"],
];

let count = 0;
const missing = [];
for (const [from, toRel] of copies) {
  if (!existsSync(from)) {
    missing.push(from);
    continue;
  }
  const to = join(outDir, toRel);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  count++;
}

if (missing.length) {
  console.error("以下资源在已安装包中未找到，可能依赖未装好：");
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

console.log(`✓ 已拷贝 ${count} 项附件预览资源到 ${outDir}`);
console.log("  确保部署后 /file-viewer/vendor/... 可访问即可（与默认 FILE_VIEWER_OPTIONS 对齐）。");
