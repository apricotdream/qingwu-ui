/**
 * 图片渲染探针：验证一个 URL 在当前浏览器里**真的能解码显示**。
 *
 * 用于本地媒体解析的"诚实计数"：换链后只有探针通过才计入"已上传"，
 * 避免 toast 宣称成功而页面上仍是碎图/占位。
 *
 * 与 ImageView 的私有桶回退保持一致：直接解码失败时，若 URL 属于已配置
 * 的 S3，再试一次签名请求 + blob 解码。
 */
import { signPreviewUrlHeaders } from "../storage/signed-fetch";

function probeDecode(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Image !== "function") return resolve(true);
    const img = new Image();
    let settled = false;
    const timer = setTimeout(() => done(false), timeoutMs);
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

/**
 * 校验 URL 可被浏览器渲染为图片。
 * 直接解码失败且属于已配置 S3 时，走签名请求 + blob 二次解码（同 ImageView 回退）。
 */
export async function verifyImageRenderable(url: string, timeoutMs = 8000): Promise<boolean> {
  if (await probeDecode(url, timeoutMs)) return true;
  try {
    const headers = await signPreviewUrlHeaders(url);
    if (!headers) return false;
    const resp = await fetch(url, { headers });
    if (!resp.ok) return false;
    const blobUrl = URL.createObjectURL(await resp.blob());
    const ok = await probeDecode(blobUrl, timeoutMs);
    URL.revokeObjectURL(blobUrl);
    return ok;
  } catch {
    return false;
  }
}
