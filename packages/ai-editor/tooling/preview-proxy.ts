import { lookup as lookupCallback } from "node:dns";
import { lookup } from "node:dns/promises";
import { get as httpGet, type IncomingMessage } from "node:http";
import { get as httpsGet } from "node:https";
import { BlockList, isIP } from "node:net";
import { Readable } from "node:stream";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  blocked.addSubnet(address, prefix, "ipv6");
const publicV6 = new BlockList();
publicV6.addSubnet("2000::", 3, "ipv6");

export function isPublicIp(address: string): boolean {
  const family = isIP(address);
  if (!family) return false;
  if (family === 6 && !publicV6.check(address, "ipv6")) return false;
  return !blocked.check(address, family === 6 ? "ipv6" : "ipv4");
}

class ProxyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** 解析和建立连接使用同一个已验证 IP，防止二次 DNS 查询和重定向绕过。 */
export async function resolvePublicTarget(target: string) {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new ProxyError(403, "Forbidden URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new ProxyError(403, "Forbidden URL");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: { address: string; family: number }[];
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await lookup(hostname, { all: true });
  } catch {
    throw new ProxyError(403, "Forbidden host");
  }
  const first = addresses[0];
  if (!first || addresses.some(({ address }) => !isPublicIp(address)))
    throw new ProxyError(403, "Forbidden address");
  return { url, address: first.address };
}

export async function previewResource(encoded: string): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!/^[A-Za-z0-9_+/-]+={0,2}$/.test(encoded)) throw new ProxyError(403, "Forbidden URL");
    const target = decodeURIComponent(Buffer.from(encoded, "base64url").toString("utf8"));
    const { url, address } = await resolvePublicTarget(target);
    const controller = new AbortController();
    // 超时覆盖整个响应体，不能只限制响应头到达时间。
    timer = setTimeout(() => controller.abort(), 8000);
    const upstream = await new Promise<IncomingMessage>((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsGet : httpGet)(
        url,
        {
          signal: controller.signal,
          lookup: (_hostname, options, callback) => lookupCallback(address, options, callback),
        },
        resolve,
      );
      request.on("error", reject);
    });
    const status = upstream.statusCode || 502;
    const maxBytes = 100 * 1024 * 1024;
    if (status < 200 || status >= 300 || Number(upstream.headers["content-length"]) > maxBytes) {
      upstream.destroy();
      throw new ProxyError(
        status >= 300 && status < 400 ? 403 : status >= 400 ? status : 413,
        "Upstream rejected",
      );
    }
    const body = Readable.from(
      (async function* () {
        let received = 0;
        try {
          for await (const chunk of upstream) {
            received += chunk.byteLength;
            if (received > maxBytes) throw new Error("Payload too large");
            yield chunk;
          }
        } finally {
          clearTimeout(timer);
          upstream.destroy();
        }
      })(),
    );
    return new Response(Readable.toWeb(body) as ReadableStream, {
      headers: {
        "Content-Type": upstream.headers["content-type"] || "application/octet-stream",
        "Content-Disposition": "attachment",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    clearTimeout(timer);
    const status =
      error instanceof ProxyError
        ? error.status
        : (error as Error).name === "AbortError"
          ? 504
          : 502;
    return Response.json(
      { error: status === 403 ? "Forbidden" : "Preview unavailable" },
      { status },
    );
  }
}
