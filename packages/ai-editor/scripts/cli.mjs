#!/usr/bin/env node
import { dirname, join } from "node:path";
/**
 * @qingwu-ui/ai-editor 命令行入口
 *
 * 用法：
 *   npx @qingwu-ui/ai-editor copy-assets [--out 目录]
 *       拷贝附件预览（PDF/Word/Excel/PPT/压缩包）所需的 worker/wasm/字体资源。
 */
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [command, ...rest] = process.argv.slice(2);

if (command === "copy-assets" || command === "init-assets") {
  // copy-assets.mjs 自己读 process.argv，需要把命令名剥掉只留参数
  process.argv = [process.argv[0], process.argv[1], ...rest];
  await import(pathToFileURL(join(here, "copy-assets.mjs")).href);
} else {
  console.log(`@qingwu-ui/ai-editor CLI

命令：
  copy-assets [--out 目录]   拷贝附件预览所需 worker/wasm/字体到 public/file-viewer
                             （默认输出到当前目录的 public/file-viewer）
`);
  if (command) console.error(`未知命令：${command}`);
  process.exit(command ? 1 : 0);
}
