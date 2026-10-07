/**
 * 预览代理 Service Worker - 最简透传，不处理数据
 * 页面 fetch /preview-proxy/{base64} 不含 .pdf/.zip，IDM 不拦截
 * SW 直接透传 fetch 响应，不做任何数据处理避免二进制损坏
 */
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

  // 纯透传：直接返回 fetch 响应，不提取/重建，避免二进制损坏
  // no-store 防止 SW 缓存损坏数据
  event.respondWith(fetch(targetUrl, { cache: "no-store" }));
});
