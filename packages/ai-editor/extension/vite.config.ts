import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";

const target = process.env.TARGET ?? "chrome";

// vite 把 HTML 输入文件原样输出到 dist/<target>/src/popup/index.html
// 但 manifest.json 引用的是 popup/index.html（无 src 前缀）
// 此插件在构建结束后物理移动文件到正确路径
function flattenHtmlPaths(): Plugin {
  return {
    name: "flatten-html-paths",
    apply: "build",
    closeBundle() {
      const outDir = resolve(__dirname, `dist/${target}`);
      const srcDir = resolve(outDir, "src");
      if (!existsSync(srcDir)) return;
      for (const sub of ["popup", "sidepanel", "options"]) {
        const from = resolve(srcDir, sub, "index.html");
        const to = resolve(outDir, sub, "index.html");
        if (existsSync(from)) {
          mkdirSync(resolve(to, ".."), { recursive: true });
          renameSync(from, to);
        }
      }
      // 删除空的 src 目录
      try {
        rmSync(srcDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), flattenHtmlPaths()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  build: {
    outDir: resolve(__dirname, `dist/${target}`),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      input: {
        "background/service-worker": resolve(__dirname, "src/background/service-worker.ts"),
        "content/content-script": resolve(__dirname, "src/content/content-script.ts"),
        "popup/index": resolve(__dirname, "src/popup/index.html"),
        "sidepanel/index": resolve(__dirname, "src/sidepanel/index.html"),
        "options/index": resolve(__dirname, "src/options/index.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  define: {
    __TARGET__: JSON.stringify(target),
  },
});
