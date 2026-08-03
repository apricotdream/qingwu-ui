import { resolve } from "node:path";
import { defineConfig } from "vite";

const target = process.env.TARGET ?? "chrome";

/**
 * content script 单独构建。
 *
 * MV3 manifest 的 content_scripts 按经典脚本（非 module）加载，
 * 入口文件不能含顶层 import —— 主构建把 shared 模块拆成 chunks 后，
 * content-script.js 以 import 开头会直接 SyntaxError，整个脚本失效。
 * 这里用 IIFE + inlineDynamicImports 把依赖全部内联成单文件。
 */
export default defineConfig({
  build: {
    outDir: resolve(__dirname, `dist/${target}`),
    // 追加进主构建产物目录，不能清空
    emptyOutDir: false,
    target: "es2022",
    rollupOptions: {
      input: {
        "content/content-script": resolve(__dirname, "src/content/content-script.ts"),
      },
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "[name].js",
      },
    },
  },
});
