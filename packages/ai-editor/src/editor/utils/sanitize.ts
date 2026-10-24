/** HTML 清洗工具：主路径 DOMPurify（可防正则无法覆盖的 XSS 向量），不可用（SSR/无 document）时按文本输出 */
import DOMPurify from "dompurify";

function getPurify(): typeof DOMPurify | null {
  return typeof window !== "undefined" && window.document && DOMPurify.isSupported
    ? DOMPurify
    : null;
}

/** HTML 实体转义 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (c) => map[c] || c);
}

/**
 * 清洗 HTML（DOMPurify 主路径）。
 * 移除 script/style/iframe 等标签、on* 事件、javascript:/data:text/html 协议、CSS expression；
 * 保留 data-*、class、style、src、href 及自定义 embed 节点序列化。
 */
export function sanitizeHtml(html: string): string {
  const purify = getPurify();
  if (purify) {
    return purify.sanitize(html, {
      ALLOW_DATA_ATTR: true,
      ADD_ATTR: ["target", "rel"],
      // blob: 允许（编辑器以 blob URL 占位媒体；默认会滤掉导致回显 src 被清空）
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    });
  }
  // 没有安全的 DOM 解析器时按文本输出，不能用正则假装完成 HTML 清洗。
  return escapeHtml(html);
}

/** 图表 SVG 使用解析器清洗，阻止实体编码、命名空间和动画属性绕过。 */
export function sanitizeSvg(svg: string): string {
  const purify = getPurify();
  if (!purify) return escapeHtml(svg);
  return purify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["foreignObject", "animate", "set", "animateMotion", "animateTransform"],
  });
}
