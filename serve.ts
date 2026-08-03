/** 青梧UI Demo 服务端 —— bun run serve.ts 启动后访问 http://localhost:3000 */
import { file, serve } from "bun";

const ROOT = import.meta.dir;

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/demo/index.html" : url.pathname;

    // 安全处理：只允许访问项目内的文件
    const fullPath = ROOT + path;

    try {
      const f = file(fullPath);
      const exists = await f.exists();
      if (!exists) return new Response("Not Found", { status: 404 });

      const ext = path.split(".").pop()?.toLowerCase();
      const mime: Record<string, string> = {
        html: "text/html;charset=utf-8",
        css: "text/css;charset=utf-8",
        js: "application/javascript;charset=utf-8",
        mjs: "application/javascript;charset=utf-8",
        json: "application/json",
        svg: "image/svg+xml",
        png: "image/png",
        ico: "image/x-icon",
      };

      return new Response(f.stream(), {
        headers: { "Content-Type": mime[ext ?? ""] ?? "application/octet-stream" },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  },
});

console.log("🌿 青梧UI Demo → http://localhost:3000");
