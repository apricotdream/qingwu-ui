import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@qingwu-ui/ai-editor": path.resolve(__dirname, "./src/editor/index.ts"),
    },
  },
  build: {
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
