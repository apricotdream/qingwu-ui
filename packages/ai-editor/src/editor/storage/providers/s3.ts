import type { StorageProvider } from "../index";

export interface S3StorageOptions {
  /** S3 服务端点，如 https://s3.amazonaws.com */
  endpoint: string;
  /** Bucket 名称 */
  bucket: string;
  /** 区域，如 us-east-1 / auto */
  region: string;
  /** Access Key ID */
  accessKeyId: string;
  /** Secret Access Key */
  secretAccessKey: string;
  /** 自定义访问域名（CDN），用于返回可访问的资源 URL */
  customDomain?: string;
  uploadPrefix?: string;
  /**
   * 对象键文件名模板，留空默认「{ts}{tz}_{src}_{name}_{rand}{ext}」。
   * 占位符：{ts}=时间戳、{tz}=时区(如 +0800)、{src}=出处(editor/cover)、
   * {name}=原名(去扩展名)、{ext}=扩展名(含点，如 .jpg)、{rand}=随机串
   */
  nameTemplate?: string;
}

// ── AWS Signature V4 最小实现 ──

function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return crypto.subtle.digest("SHA-256", toArrayBuffer(bytes)).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  );
}

function toArrayBuffer(buf: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (buf instanceof ArrayBuffer) return buf;
  // Uint8Array.buffer 返回 ArrayBuffer | SharedArrayBuffer，这里新建一份拷贝
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(key),
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
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretKey}`).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

async function signS3Request(
  method: string,
  url: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  body: Uint8Array | null,
): Promise<Headers> {
  const urlObj = new URL(url);
  const host = urlObj.host;
  const canonicalUri = urlObj.pathname;
  const canonicalQuery = urlObj.searchParams.toString();
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const service = "s3";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const payloadHash = body ? await sha256Hex(body) : await sha256Hex("");

  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const contentType = "application/octet-stream";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `content-type:${contentType}`,
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

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("x-amz-content-sha256", payloadHash);
  headers.set("x-amz-date", amzDate);
  headers.set(
    "Authorization",
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  );
  return headers;
}

// ── S3 Provider ──

export function createS3Storage(config: S3StorageOptions): StorageProvider {
  const endpoint = config.endpoint.replace(/\/+$/, "");
  const endpointUrl = new URL(endpoint);
  const endpointPath = endpointUrl.pathname.replace(/\/+$/, "");
  const endpointHasBucket =
    endpointUrl.hostname === config.bucket ||
    endpointUrl.hostname.startsWith(`${config.bucket}.`) ||
    endpointPath.split("/").filter(Boolean).includes(config.bucket);
  const apiBase = endpointHasBucket ? endpoint : `${endpoint}/${config.bucket}`;
  // 资源访问地址：优先使用自定义域名，否则复用实际上传地址前缀
  const accessBase = config.customDomain
    ? `https://${config.customDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
    : apiBase;

  const getObjectKey = (url: string) => {
    if (url.startsWith(`${accessBase}/`)) return url.slice(accessBase.length + 1);
    if (url.startsWith(`${apiBase}/`)) return url.slice(apiBase.length + 1);
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.replace(/^\/+/, "");
      return endpointHasBucket
        ? path
        : path.replace(new RegExp(`^${config.bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`), "");
    } catch {
      return url.replace(/^\/+/, "");
    }
  };

  return {
    name: `S3 (${config.bucket})`,
    type: "s3",

    async upload(file: File, source: string = "editor"): Promise<string> {
      /* {ext} 含点号（如 ".jpg"），默认模板「{ts}{tz}_{src}_{name}_{rand}{ext}」直接可用 */
      const ext = `.${file.name.split(".").pop() || "bin"}`;
      const prefix = config.uploadPrefix || "qingwu";
      /* 默认「{ts}{tz}_{src}_{name}_{rand}{ext}」；留空模板也走默认 */
      const template = config.nameTemplate || "{ts}{tz}_{src}_{name}_{rand}{ext}";
      const ts = Date.now();
      const rnd = Math.random().toString(36).slice(2);
      const fname = file.name.replace(/\.[^.]+$/, "");
      const offsetMin = -new Date().getTimezoneOffset();
      const sign = offsetMin >= 0 ? "+" : "-";
      const absMin = Math.abs(offsetMin);
      const tz = `${sign}${String(Math.floor(absMin / 60)).padStart(2, "0")}${String(absMin % 60).padStart(2, "0")}`;
      const keyName = template
        .replace("{ts}", String(ts))
        .replace("{tz}", tz)
        .replace("{src}", source)
        .replace("{name}", fname)
        .replace("{ext}", ext)
        .replace("{rand}", rnd);
      const objectKey = `${prefix}/${keyName}`;
      const uploadUrl = `${apiBase}/${objectKey}`;
      const body = new Uint8Array(await file.arrayBuffer());

      const headers = await signS3Request(
        "PUT",
        uploadUrl,
        config.region,
        config.accessKeyId,
        config.secretAccessKey,
        body,
      );

      const response = await fetch(uploadUrl, { method: "PUT", headers, body });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`S3 上传失败: ${response.status} ${text}`);
      }
      return `${accessBase}/${objectKey}`;
    },

    async remove(url: string): Promise<void> {
      const key = getObjectKey(url);
      const deleteUrl = `${apiBase}/${key}`;
      const headers = await signS3Request(
        "DELETE",
        deleteUrl,
        config.region,
        config.accessKeyId,
        config.secretAccessKey,
        null,
      );
      const deleteResp = await fetch(deleteUrl, { method: "DELETE", headers });
      if (!deleteResp.ok) {
        const text = await deleteResp.text().catch(() => "");
        throw new Error(`S3 删除失败: ${deleteResp.status} ${text}`);
      }
    },
  };
}
