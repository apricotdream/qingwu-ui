/**
 * Node 实现：node:http 起本地 HTTP 服务接收扩展剪藏（需 Node 18+ / Electron / Tauri）。
 * 经子入口 @qingwu-ui/ai-editor/clipper 暴露，避免 node:http 进浏览器产物；仅监听 127.0.0.1 + 可选 token。
 */
import type {
  ClipperErrorCode,
  ClipperOkResponse,
  ClipperReceiver,
  ClipperReceiverOptions,
  ClipperResponse,
  IncomingClip,
} from "./types";

/** 启动 HTTP 接收器；纯浏览器场景请用主入口的 startBrowserClipperReceiver */
export async function startClipperReceiver(opts: ClipperReceiverOptions): Promise<ClipperReceiver> {
  const port = opts.port ?? 7321;
  const host = opts.host ?? "127.0.0.1";

  // 动态 import，避免在纯浏览器环境报错
  let http: typeof import("node:http") | null = null;
  try {
    http = await import("node:http");
  } catch {
    throw new Error(
      "Clipper 接收器需要 Node.js 运行时（在 Electron 主进程 / Tauri / Node 中可用）",
    );
  }

  type Res = import("node:http").ServerResponse;

  // 统一响应：所有路由返回 { ok, data? } | { ok: false, error: { code, message } }
  const sendJson = (res: Res, status: number, body: ClipperResponse) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const sendOk = (res: Res, data?: unknown) =>
    sendJson(res, 200, { ok: true, data } as ClipperOkResponse);
  const sendErr = (res: Res, status: number, code: ClipperErrorCode, message: string) =>
    sendJson(res, status, { ok: false, error: { code, message } });

  const server = http.createServer(async (req, res) => {
    // CORS 预检
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? "/";

    // 健康检查
    if (req.method === "GET" && (url === "/" || url === "/health")) {
      try {
        const data = await (opts.onHealth?.() ?? { service: "qingwu-clipper" });
        sendOk(res, data);
      } catch (e) {
        sendErr(res, 500, "INTERNAL", (e as Error).message);
      }
      return;
    }

    // 剪藏推送
    if (req.method === "POST" && url === "/clip") {
      // token 校验
      if (opts.token) {
        const auth = req.headers.authorization ?? "";
        if (auth !== `Bearer ${opts.token}`) {
          sendErr(res, 401, "UNAUTHORIZED", "token 校验失败");
          return;
        }
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks).toString("utf-8");
      let payload: IncomingClip;
      try {
        payload = JSON.parse(raw) as IncomingClip;
      } catch {
        sendErr(res, 400, "INVALID_JSON", "请求体不是合法 JSON");
        return;
      }
      if (!payload.markdown) {
        sendErr(res, 422, "MARKDOWN_REQUIRED", "缺少 markdown 字段");
        return;
      }
      try {
        await opts.onClip(payload, req as unknown as Request);
        sendOk(res, { at: new Date().toISOString() });
      } catch (e) {
        sendErr(res, 500, "INTERNAL", (e as Error).message);
      }
      return;
    }

    sendErr(res, 404, "NOT_FOUND", "路由不存在");
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const url = `http://${host}:${port}`;

  return {
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

export async function stopClipperReceiver(s: ClipperReceiver): Promise<void> {
  await s.close();
}
