import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Vite 库模式会把 CSS 里的字体强制内联成 base64（assetsInlineLimit 不生效）。
 * KaTeX 字体约 1MB，内联后 styles.css 体积翻十倍；这里在产物阶段把 data:font
 * 还原成 dist/assets/katex-fonts 下的独立文件，并把 CSS 改回相对 URL。
 */
function extractKatexFonts(): Plugin {
  return {
    name: "qingwu-extract-katex-fonts",
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, "dist");
      const cssPath = path.resolve(outDir, "styles.css");
      if (!fs.existsSync(cssPath)) return;

      const source = fs.readFileSync(cssPath, "utf8");
      const fontsDir = path.resolve(outDir, "assets/katex-fonts");
      let index = 0;
      const replaced = source.replace(
        /url\((data:font\/([a-z0-9.+-]+);base64,([^)]+))\)/gi,
        (_match, _uri, mime: string, base64: string) => {
          const ext = mime.includes("woff2")
            ? "woff2"
            : mime.includes("woff")
              ? "woff"
              : mime.includes("ttf")
                ? "ttf"
                : mime.includes("otf")
                  ? "otf"
                  : "bin";
          const fileName = `katex-${index}.${ext}`;
          index += 1;
          fs.mkdirSync(fontsDir, { recursive: true });
          fs.writeFileSync(path.join(fontsDir, fileName), Buffer.from(base64, "base64"));
          return `url(./assets/katex-fonts/${fileName})`;
        },
      );

      if (replaced !== source) {
        fs.writeFileSync(cssPath, replaced);
      }
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [react(), tailwindcss(), extractKatexFonts()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@qingwu-ui/ai-editor": path.resolve(__dirname, "./src/editor/index.ts"),
    },
  },
  build: {
    // 库模式默认会把字体等资源内联成 base64；KaTeX 字体体积大，强制落盘到 dist/assets
    assetsInlineLimit: 0,
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
        clipper: path.resolve(__dirname, "src/clipper.ts"),
      },
      name: "QingWuAIEditor",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "cjs"}`,
      cssFileName: "styles",
    },
    rollupOptions: {
      external: (id) => {
        // Node 内置模块保持外部引用：Node 子入口需原生 import("node:http")，
        // 且不得被浏览器化为桩模块（浏览器主入口已不引用 node 模块）。
        if (id === "node:http" || id.startsWith("node:")) return true;
        if (id === "react" || id === "react-dom" || id.startsWith("react/")) return true;
        if (id.startsWith("@tiptap/")) return true;
        if (id.startsWith("@ai-sdk/")) return true;
        if (id.startsWith("@file-viewer/")) return true;
        if (id === "highlight.js" || id.startsWith("highlight.js/")) return true;
        // 只外部化运行时入口；katex/dist/*.css 由 Vite 在构建期解析并打进 styles.css
        if (id === "katex") return true;
        return [
          "ai",
          "dompurify",
          "lowlight",
          "tiptap-markdown",
          "xgplayer",
          "cmdk",
          "beautiful-mermaid",
          "devicon",
        ].includes(id);
      },
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
      },
    },
  },
});
