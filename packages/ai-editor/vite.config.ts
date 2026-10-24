import path from "node:path";
import { fileViewerRenderers } from "@file-viewer/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// SSRF 闃叉姢锛氱姝唬鐞嗗埌鍐呯綉/鏈湴/淇濈暀鍦板潃
// 鍛戒腑浠讳竴鍗虫嫆缁濓紙瑕嗙洊 IPv4 绉佹湁娈?+ IPv6 鏈湴 + 浜戝厓鏁版嵁鍦板潃锛?
import { previewResource } from "./tooling/preview-proxy";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    fileViewerRenderers({
      copyAssets: { mode: "dev", baseDir: "file-viewer" },
      inject: false,
      // 只拷贝实际使用的格式引擎资产（pdf/word/spreadsheet/presentation/archive/text），
      // 避免 typst/cad/drawio/ofd 等 138MB 全量资产进入静态目录
      formats: ["pdf", "word", "spreadsheet", "presentation", "archive", "text"],
    }),
    // 鏈嶅姟绔瑙堜唬鐞嗭細/api/preview/{base64} -> Node.js fetch S3 URL
    // IDM 娴忚鍣ㄦ墿灞曞彧鑳界湅鍒?/api/preview/... 璇锋眰锛堜笉鍚?.pdf/.7z锛夛紝鏃犳硶鎷︽埅
    {
      name: "preview-proxy",
      configureServer(server) {
        server.middlewares.use("/api/preview", async (req, res) => {
          const encoded = (req.url || "").replace(/^\//, "");
          const response = await previewResource(encoded);
          res.statusCode = response.status;
          response.headers.forEach((value, name) => {
            res.setHeader(name, value);
          });
          if (!response.body) {
            res.end();
            return;
          }
          const reader = response.body.getReader();
          res.on("close", () => {
            void reader.cancel().catch(() => {});
          });
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!res.write(value))
                await new Promise<void>((resolve) => {
                  res.once("drain", resolve);
                  res.once("close", resolve);
                });
              if (res.destroyed) break;
            }
            res.end();
          } catch {
            res.destroy();
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@qingwu-ui/ai-editor": path.resolve(__dirname, "./src/editor/index.ts"),
    },
  },
  optimizeDeps: {
    entries: ["index.html"],
    include: [
      "react",
      "react-dom",
      "@tiptap/react",
      "@tiptap/core",
      "@tiptap/starter-kit",
      "dompurify",
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@tiptap")) return "tiptap";
          if (/[\\/]node_modules[\\/](react|react-dom)([\\/]|$)/.test(id)) return "vendor";
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
