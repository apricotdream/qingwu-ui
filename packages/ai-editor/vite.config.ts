import dns from "node:dns/promises";
import path from "node:path";
import { fileViewerRenderers } from "@file-viewer/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// SSRF 闃叉姢锛氱姝唬鐞嗗埌鍐呯綉/鏈湴/淇濈暀鍦板潃
// 鍛戒腑浠讳竴鍗虫嫆缁濓紙瑕嗙洊 IPv4 绉佹湁娈?+ IPv6 鏈湴 + 浜戝厓鏁版嵁鍦板潃锛?
const BLOCKED_HOST_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^198\.1[89]\./, // 鍩哄噯娴嬭瘯 198.18.0.0/15
  /^255\.255\.255\.255$/, // 骞挎挱鍦板潃
  /^0\.0\.0\.0$/,
  /^localhost$/i,
];
// 浜戝厓鏁版嵁鏈嶅姟甯歌鍦板潃锛圓WS/Azure/GCP/闃块噷浜戯級
const BLOCKED_METADATA_HOSTS = ["169.254.169.254", "metadata.google.internal", "100.100.100.200"];

function isBlockedHost(hostname: string): boolean {
  if (BLOCKED_METADATA_HOSTS.includes(hostname)) return true;
  return BLOCKED_HOST_PATTERNS.some((re) => re.test(hostname));
}

/**
 * 鍒ゆ柇 IP 鏄惁鍦ㄧ缃?淇濈暀娈?
 * 瑕嗙洊 IPv4 绉佹湁娈点€両Pv6 鏈湴銆丆GNAT銆佸熀鍑嗘祴璇曘€佸箍鎾瓑
 */
function isBlockedIp(ip: string): boolean {
  // IPv6
  if (ip === "::1" || ip === "::" || /^fc00:/i.test(ip) || /^fe80:/i.test(ip)) return true;
  // IPv4
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(ip))) return true;
  return false;
}

/**
 * SSRF DNS rebinding 闃叉姢锛?
 * 瀛楃涓?hostname 妫€鏌ラ€氳繃鍚庯紝鍐嶇敤 dns.lookup 瑙ｆ瀽瀹為檯 IP
 * 闃叉鏀诲嚮鑰呯敤鍩熷悕鎸囧悜绉佺綉 IP锛圖NS rebinding锛?
 */
async function isBlockedByDns(hostname: string): Promise<boolean> {
  try {
    // 鍚屾椂瑙ｆ瀽 IPv4 鍜?IPv6锛屼换涓€鍛戒腑鍗虫嫆缁?
    const results = await dns.lookup(hostname, { all: true });
    for (const r of results) {
      if (isBlockedIp(r.address)) return true;
    }
    return false;
  } catch {
    // DNS 瑙ｆ瀽澶辫触锛氫繚瀹堟嫆缁?
    return true;
  }
}

// 涓婃父璇锋眰瓒呮椂锛坢s锛? 閬垮厤鎱㈠搷搴旀寕姝?dev server
const UPSTREAM_TIMEOUT_MS = 8000;
// 鍝嶅簲浣撳ぇ灏忎笂闄愶紙瀛楄妭锛? 闃叉鍐呭瓨鐖嗙偢
const MAX_RESPONSE_BYTES = 100 * 1024 * 1024; // 100MB

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
          try {
            const std = encoded.replace(/-/g, "+").replace(/_/g, "/");
            const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
            const targetUrl = decodeURIComponent(Buffer.from(padded, "base64").toString("utf-8"));
            if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
              res.statusCode = 403;
              res.end("Forbidden");
              return;
            }
            // SSRF 闃叉姢锛氭嫆缁濆唴缃?鏈湴/鍏冩暟鎹湴鍧€
            const parsed = new URL(targetUrl);
            if (isBlockedHost(parsed.hostname)) {
              res.statusCode = 403;
              res.end("Forbidden: blocked host");
              return;
            }
            // SSRF 闃叉姢锛欴NS rebinding 妫€鏌?- 瑙ｆ瀽瀹為檯 IP 鍚庡啀娆℃牎楠?
            if (await isBlockedByDns(parsed.hostname)) {
              res.statusCode = 403;
              res.end("Forbidden: blocked resolved IP");
              return;
            }

            // 瓒呮椂鎺у埗锛氳秴杩?8s 涓诲姩缁堟涓婃父
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
            let response: Response;
            try {
              response = await fetch(targetUrl, { signal: controller.signal });
            } finally {
              clearTimeout(timer);
            }
            if (!response.ok) {
              res.statusCode = response.status;
              res.end(`Upstream ${response.status}`);
              return;
            }
            // 澶у皬闄愬埗锛氭嫆缁濊繃澶у搷搴?
            const contentLength = Number(response.headers.get("Content-Length") || 0);
            if (contentLength > MAX_RESPONSE_BYTES) {
              res.statusCode = 413;
              res.end("Payload too large");
              return;
            }
            // 娴佸紡杞彂锛岄伩鍏嶄竴娆℃€ф妸鏁翠釜鏂囦欢鍔犺浇杩?dev server 鍐呭瓨
            res.setHeader(
              "Content-Type",
              response.headers.get("Content-Type") || "application/octet-stream",
            );
            if (response.body) {
              const reader = response.body.getReader();
              let received = 0;
              const pump = async (): Promise<void> => {
                const { done, value } = await reader.read();
                if (done) {
                  res.end();
                  return;
                }
                received += value.byteLength;
                if (received > MAX_RESPONSE_BYTES) {
                  res.destroy();
                  return;
                }
                res.write(value);
                return pump();
              };
              await pump();
            } else {
              const buffer = Buffer.from(await response.arrayBuffer());
              res.setHeader("Content-Length", String(buffer.length));
              res.end(buffer);
            }
          } catch (err) {
            if ((err as Error).name === "AbortError") {
              res.statusCode = 504;
              res.end("Upstream timeout");
            } else {
              res.statusCode = 500;
              res.end("Proxy error");
            }
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@apricotdream/ai-editor": path.resolve(__dirname, "./src/editor/index.ts"),
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
