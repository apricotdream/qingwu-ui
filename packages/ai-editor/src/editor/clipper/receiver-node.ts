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
    // 不能向任意网页开放本地写入接口；拒绝 null Origin 和 DNS rebinding 的网页来源。
    const address = server.address();
    const localOrigin = `http://${host}:${typeof address === "object" && address ? address.port : port}`;
    const origin = req.headers.origin;
    if (
      origin !== undefined &&
      (typeof origin !== "string" ||
        (origin !== localOrigin && !opts.allowedOrigins?.includes(origin)) ||
        origin === "null")
    ) {
      sendErr(res, 403, "FORBIDDEN", "不允许此来源访问本地接收器");
      return;
    }
    res.setHeader("Vary", "Origin");
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
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
      const contentType = req.headers["content-type"];
      if (
        typeof contentType !== "string" ||
        contentType.split(";")[0].trim().toLowerCase() !== "application/json"
      ) {
        sendErr(res, 415, "UNSUPPORTED_MEDIA_TYPE", "仅接受 application/json");
        return;
      }
      // token 校验
      if (opts.token) {
        const auth = req.headers.authorization ?? "";
        if (auth !== `Bearer ${opts.token}`) {
          sendErr(res, 401, "UNAUTHORIZED", "token 校验失败");
          return;
        }
      }
      const chunks: Buffer[] = [];
      let size = 0;
      try {
        for await (const chunk of req.iterator({ destroyOnReturn: false })) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += bytes.byteLength;
          if (size > 10 * 1024 * 1024) {
            res.setHeader("Connection", "close");
            sendErr(res, 413, "PAYLOAD_TOO_LARGE", "请求体不能超过 10MB");
            return;
          }
          chunks.push(bytes);
        }
      } catch {
        sendErr(res, 400, "INVALID_JSON", "读取请求体失败");
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf-8");
      let payload: IncomingClip;
      try {
        payload = JSON.parse(raw) as IncomingClip;
      } catch {
        sendErr(res, 400, "INVALID_JSON", "请求体不是合法 JSON");
        return;
      }
      if (!payload || typeof payload.markdown !== "string" || !payload.markdown.trim()) {
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
  server.requestTimeout = 15_000;

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  const url = `http://${host}:${typeof address === "object" && address ? address.port : port}`;

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
