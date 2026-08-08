// 方案 A：演示站不重复入库 file-viewer 静态资源。
// dev/build/start/e2e 前从 packages/ai-editor/public/file-viewer 同步到本地 public/。
// 单源在 packages/ai-editor，避免 ~24MB×2 的重复提交。
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // examples/nextjs/scripts
const root = join(here, ".."); // examples/nextjs
const src = join(root, "..", "..", "packages", "ai-editor", "public", "file-viewer");
const dest = join(root, "public", "file-viewer");

if (!existsSync(src)) {
  console.error(`[sync-file-viewer] 源目录不存在：${src}`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`[sync-file-viewer] 已同步 ${src} → ${dest}`);
