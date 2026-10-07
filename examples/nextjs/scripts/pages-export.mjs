// GitHub Pages 静态导出：output: export 不允许 API 路由，构建期间临时移走 app/api，构建后还原

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // examples/nextjs/scripts
const root = join(here, ".."); // examples/nextjs
const apiDir = join(root, "app", "api");
// 必须放在 app/ 之外：App Router 会扫描 app/** 下的所有子目录（包括点目录）
const apiBak = join(root, ".api-pages-bak");

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) throw new Error(`命令失败: ${cmd} ${args.join(" ")} (exit ${r.status})`);
}

try {
  // 1) 同步 file-viewer 静态资源（与 build/dev 一致）
  run(process.execPath, ["scripts/sync-file-viewer.mjs"]);

  // 2) 临时移走 API 路由（export 不支持）
  const hadApi = existsSync(apiDir);
  if (hadApi) {
    rmSync(apiBak, { recursive: true, force: true });
    renameSync(apiDir, apiBak);
    console.log("[pages-export] 已临时移出 app/api");
  }

  // 3) 静态导出构建（PAGES_EXPORT=1 触发 next.config.ts 的 export 配置；--webpack 适配 next 16）
  try {
    run(process.execPath, ["node_modules/next/dist/bin/next", "build", "--webpack"], {
      PAGES_EXPORT: "1",
    });
  } finally {
    // 4) 无论成败都还原 API 路由
    if (existsSync(apiBak)) {
      renameSync(apiBak, apiDir);
      console.log("[pages-export] 已还原 app/api");
    }
  }
} catch (err) {
  console.error(`[pages-export] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

const outDir = join(root, "out");
if (!existsSync(outDir)) {
  console.error("[pages-export] 导出目录不存在: out/ —— 构建可能失败");
  process.exit(1);
}
console.log(`[pages-export] 静态导出完成: ${outDir}`);
