/**
 * S3 签名 GET 请求 — 用于附件预览时对私有桶发起认证读取
 */

import type { S3StorageOptions } from "./providers/s3";

let currentS3Config: S3StorageOptions | null = null;

/** 注册 S3 配置，供附件预览使用 */
export function registerS3PreviewConfig(config: S3StorageOptions | null) {
  currentS3Config = config;
}

function toArrayBuffer(buf: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (buf instanceof ArrayBuffer) return buf;
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return crypto.subtle.digest("SHA-256", toArrayBuffer(bytes)).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  );
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const buf = toArrayBuffer(key);
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    buf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(data));
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const kDate = await hmacSha256(new Uint8Array(enc.encode(`AWS4${secretKey}`)).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

async function signGetHeaders(
  url: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
): Promise<Headers> {
  const u = new URL(url);
  const host = u.host;
  const canonicalUri = u.pathname;
  const canonicalQuery = u.searchParams.toString();
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const service = "s3";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = await sha256Hex("");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    "",
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = Array.from(new Uint8Array(await hmacSha256(signingKey, stringToSign)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const h = new Headers();
  // Host 头由浏览器自动设置，手动 set 会被静默忽略
  h.set("x-amz-content-sha256", payloadHash);
  h.set("x-amz-date", amzDate);
  h.set(
    "Authorization",
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  );
  return h;
}

/**
 * 生成预签名 URL（带 query string 签名参数）
 * 用于 <img>/<video>/<audio> 等无法添加自定义请求头的场景
 * @param expires 过期秒数，默认 3600（1小时）
 *
 * 安全建议：URL 一旦泄漏在有效期内可被任意访问，故默认 1 小时而非 7 天。
 * 图片/视频标签加载时实时生成新 URL 即可。
 */
export async function signUrl(
  url: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  expires: number = 3600,
): Promise<string> {
  const u = new URL(url);
  const host = u.host;
  const canonicalUri = u.pathname;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const service = "s3";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const signedHeaders = "host";

  const params: Array<[string, string]> = [
    ["X-Amz-Algorithm", algorithm],
    ["X-Amz-Credential", `${accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expires)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ];
  params.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const canonicalQuery = params
    .map((p) => `${encodeURIComponent(p[0])}=${encodeURIComponent(p[1])}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    `host:${host}`,
    "",
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const sigBytes = new Uint8Array(await hmacSha256(signingKey, stringToSign));
  const signature = Array.from(sigBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const queryStr =
    params.map((p) => `${p[0]}=${encodeURIComponent(p[1])}`).join("&") +
    "&X-Amz-Signature=" +
    signature;
  return `${u.origin + canonicalUri}?${queryStr}`;
}

function belongsToS3Config(url: string, config: S3StorageOptions): boolean {
  try {
    const u = new URL(url);
    const ep = new URL(config.endpoint.replace(/\/+$/, ""));
    if (u.host === ep.host) return true;
    if (config.customDomain) {
      const cd = new URL(
        `https://${config.customDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`,
      );
      if (u.host === cd.host) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 对属于已配置 S3 的 URL 注入签名头，否则透传
 */
export async function signPreviewUrlHeaders(url: string): Promise<Headers | null> {
  const cfg = currentS3Config;
  if (!cfg) return null;
  if (!belongsToS3Config(url, cfg)) return null;
  return signGetHeaders(url, cfg.region, cfg.accessKeyId, cfg.secretAccessKey);
}

/**
 * 对属于已配置 S3 的 URL 生成预签名 URL（签名在 query string，不触发 CORS 预检）
 * 不属于已配置 S3 时返回 null
 */
export async function signPreviewUrl(url: string, expires: number = 3600): Promise<string | null> {
  const cfg = currentS3Config;
  if (!cfg) return null;
  if (!belongsToS3Config(url, cfg)) return null;
  return signUrl(url, cfg.region, cfg.accessKeyId, cfg.secretAccessKey, expires);
}
