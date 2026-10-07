/** 预览代理 SW：纯透传 fetch，不处理数据避免二进制损坏；URL 不含 .pdf/.zip，IDM 不拦截 */
const PREVIEW_PROXY_PREFIX = "/preview-proxy/";

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(PREVIEW_PROXY_PREFIX)) return;

  const encoded = url.pathname.slice(PREVIEW_PROXY_PREFIX.length);
  let targetUrl;
  try {
    const std = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
    targetUrl = decodeURIComponent(atob(padded));
  } catch {
    return;
  }
  if (!targetUrl.startsWith("https://")) return;

  // 纯透传，不提取/重建响应避免二进制损坏；no-store 防止 SW 缓存损坏数据
  event.respondWith(fetch(targetUrl, { cache: "no-store" }));
});
