import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const target = process.env.TARGET ?? "chrome";

// vite 把 HTML 输入文件原样输出到 dist/<target>/src/popup/index.html
// 但 manifest.json 引用的是 popup/index.html（无 src 前缀）
// 此插件在构建结束后物理移动文件到正确路径
function flattenHtmlPaths(): Plugin {
  return {
    name: "flatten-html-paths",
    apply: "build",
    closeBundle() {
      const outDir = resolve(import.meta.dirname, `dist/${target}`);
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
  // tailwind 4 走 vite 插件（CSS-first 配置），不再需要 postcss.config.js
  plugins: [tailwindcss(), react(), flattenHtmlPaths()],
  resolve: {
    alias: [
      // @qingwu-ui/toast 未发布 npm（E404）：直连 workspace 源码，跳过发包。
      // style.css 子路径必须先于主别名匹配，否则会被 "@qingwu-ui/toast" 前缀吃掉。
      {
        find: /^@qingwu-ui\/toast\/style\.css$/,
        replacement: resolve(import.meta.dirname, "../../toast/src/style.css"),
      },
      { find: /^@qingwu-ui\/toast$/, replacement: resolve(import.meta.dirname, "../../toast/src/index.ts") },
      // toast 源码依赖 text-layout（零运行时依赖），同样源码直连
      {
        find: /^@qingwu-ui\/text-layout$/,
        replacement: resolve(import.meta.dirname, "../../text-layout/src/index.ts"),
      },
      { find: "@", replacement: resolve(import.meta.dirname, "src") },
      { find: "@shared", replacement: resolve(import.meta.dirname, "src/shared") },
    ],
  },
  build: {
    outDir: resolve(import.meta.dirname, `dist/${target}`),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      input: {
        "background/service-worker": resolve(import.meta.dirname, "src/background/service-worker.ts"),
        "content/content-script": resolve(import.meta.dirname, "src/content/content-script.ts"),
        "popup/index": resolve(import.meta.dirname, "src/popup/index.html"),
        "sidepanel/index": resolve(import.meta.dirname, "src/sidepanel/index.html"),
        "options/index": resolve(import.meta.dirname, "src/options/index.html"),
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
