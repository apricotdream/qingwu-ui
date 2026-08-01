import dns from "node:dns/promises";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 服务端预览代理：/api/preview/{base64} -> Node.js fetch S3 URL
// 自 vite.config.ts 的 preview-proxy 中间件迁移（SSRF 防护逻辑保持一致）。

// 禁止代理到内网/本地/保留地址（覆盖 IPv4 私有段 + IPv6 本地 + 云元数据地址）
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
  /^198\.1[89]\./, // 基准测试 198.18.0.0/15
  /^255\.255\.255\.255$/, // 广播地址
  /^0\.0\.0\.0$/,
  /^localhost$/i,
];
// 云元数据服务常见地址（AWS/Azure/GCP/阿里云）
const BLOCKED_METADATA_HOSTS = ["169.254.169.254", "metadata.google.internal", "100.100.100.200"];

function isBlockedHost(hostname: string): boolean {
  if (BLOCKED_METADATA_HOSTS.includes(hostname)) return true;
  return BLOCKED_HOST_PATTERNS.some((re) => re.test(hostname));
}

/** 判断 IP 是否在私网/保留段 */
function isBlockedIp(ip: string): boolean {
  // IPv6
  if (ip === "::1" || ip === "::" || /^fc00:/i.test(ip) || /^fe80:/i.test(ip)) return true;
  // IPv4
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(ip))) return true;
  return false;
}

/**
 * SSRF DNS rebinding 防护：字符 hostname 检查通过后，再用 dns.lookup 解析实际 IP
 * 防止攻击者用域名指向私网 IP（DNS rebinding）
 */
async function isBlockedByDns(hostname: string): Promise<boolean> {
  try {
    const results = await dns.lookup(hostname, { all: true });
    for (const r of results) {
      if (isBlockedIp(r.address)) return true;
    }
    return false;
  } catch {
    // DNS 解析失败：保守拒绝
    return true;
  }
}

// 上游请求超时（ms），避免慢响应挂起
const UPSTREAM_TIMEOUT_MS = 8000;
// 响应体大小上限（字节），防止内存爆炸
const MAX_RESPONSE_BYTES = 100 * 1024 * 1024; // 100MB

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const encoded = path.join("/");
  try {
    const std = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
    const targetUrl = decodeURIComponent(Buffer.from(padded, "base64").toString("utf-8"));
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    // SSRF 防护：拒绝内网/本地/元数据地址
    const parsed = new URL(targetUrl);
    if (isBlockedHost(parsed.hostname)) {
      return Response.json({ error: "Forbidden: blocked host" }, { status: 403 });
    }
    // SSRF 防护：DNS rebinding 检查 - 解析实际 IP 后再校验
    if (await isBlockedByDns(parsed.hostname)) {
      return Response.json({ error: "Forbidden: blocked resolved IP" }, { status: 403 });
    }

    // 超时控制：超过 8s 主动终止上游
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(targetUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      return Response.json({ error: `Upstream ${response.status}` }, { status: response.status });
    }
    // 大小限制：拒绝过大响应
    const contentLength = Number(response.headers.get("Content-Length") || 0);
    if (contentLength > MAX_RESPONSE_BYTES) {
      return Response.json({ error: "Payload too large" }, { status: 413 });
    }

    const headers = new Headers();
    const upstreamType = response.headers.get("Content-Type");
    if (upstreamType) headers.set("Content-Type", upstreamType);

    // 流式转发，避免一次性把整个文件加载进内存
    const upstreamBody = response.body;
    if (upstreamBody) {
      let received = 0;
      const stream = new ReadableStream({
        async start(controller) {
          const reader = upstreamBody.getReader();
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              received += value.byteLength;
              if (received > MAX_RESPONSE_BYTES) {
                controller.error(new Error("Payload too large"));
                return;
              }
              controller.enqueue(value);
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });
      return new Response(stream, { headers });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    headers.set("Content-Length", String(buffer.length));
    return new Response(buffer, { headers });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return Response.json({ error: "Upstream timeout" }, { status: 504 });
    }
    return Response.json({ error: "Proxy error" }, { status: 500 });
  }
}
