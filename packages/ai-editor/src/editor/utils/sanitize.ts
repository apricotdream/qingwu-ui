/** HTML 清洗工具：主路径 DOMPurify（可防正则无法覆盖的 XSS 向量），不可用（SSR/无 document）时回退正则清洗 */
import DOMPurify from "dompurify";

let purifyReady: boolean | null = null;

function getPurify(): typeof DOMPurify | null {
  if (purifyReady === false) return null;
  if (purifyReady === true) return DOMPurify;
  if (typeof window === "undefined" || !window.document) {
    purifyReady = false;
    return null;
  }
  purifyReady = !!DOMPurify.isSupported;
  return purifyReady ? DOMPurify : null;
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

/** 基于正则的兜底清洗（SSR / 无 DOM 场景）。 */
function regexSanitize(html: string): string {
  return html
    .replace(
      /<(script|style|iframe|object|embed|svg|math|frame|applet|link|meta|base)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      "",
    )
    .replace(
      /<(script|style|iframe|object|embed|svg|math|frame|applet|link|meta|base)\b[^>]*\/?>/gi,
      "",
    )
    .replace(/(?:\s|\/)+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
    .replace(
      /((?:href|src|action|formaction|xlink:href|data|background|dynsrc|lowsrc)\s*=\s*["'])\s*(?:javascript|vbscript|livescript|mocha):/gi,
      "$1#",
    )
    .replace(
      /((?:href|src|action|formaction)\s*=\s*["'])\s*data:\s*(?:text\/html|image\/svg\+xml|application\/x-javascript|application\/javascript)/gi,
      "$1#",
    )
    .replace(/expression\s*\(/gi, "(")
    .replace(
      /url\s*\(\s*["']?\s*(?:javascript|vbscript|data:text\/html|data:image\/svg\+xml)[^)]*\)/gi,
      "url(#)",
    );
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
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
  }
  return regexSanitize(html);
}

/**
 * 清洗 SVG（保留 <svg>，移除危险元素/属性）。
 * 仅用于可信库输出（如 mermaid），不可用于用户自建 SVG。
 * 用正则而非 DOMPurify svg profile，避免剥离 mermaid 遗留的 style/foreignObject 残片。
 */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /((?:href|xlink:href|src)\s*=\s*["'])\s*(?:javascript|vbscript|livescript|mocha):/gi,
      "$1#",
    )
    .replace(
      /((?:href|xlink:href|src)\s*=\s*["'])\s*data:\s*(?:text\/html|application\/javascript)/gi,
      "$1#",
    );
}
