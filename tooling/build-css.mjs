#!/usr/bin/env node
/**
 * 合并样式文件：tokens.css 在前，组件 CSS 按顺序接在后面。
 * 用法：node build-css.mjs <输出文件> <组件CSS...>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [out, ...inputs] = process.argv.slice(2);

if (!out || inputs.length === 0) {
  console.error("用法: node build-css.mjs <输出文件> <组件CSS...>");
  process.exit(1);
}

// tokens.css 的位置相对本脚本固定
const tokens = fs.readFileSync(
  path.join(__dirname, "..", "packages", "tokens", "src", "tokens.css"),
  "utf8",
);
const parts = inputs.map((file) => fs.readFileSync(file, "utf8"));

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${tokens}\n${parts.join("\n")}`);
