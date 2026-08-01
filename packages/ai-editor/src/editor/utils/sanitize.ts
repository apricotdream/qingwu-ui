/**
 * HTML 清洗工具。
 *
 * 主路径使用 DOMPurify（基于 DOM 解析），可防御正则无法覆盖的 XSS 向量：
 * SVG 命名空间、CSS 表达式、Unicode 解析差异、属性拆分等。
 * 当 DOMPurify 不可用（SSR / 无 document）时回退到正则清洗。
 */
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
 * 清洗 HTML 内容（DOMPurify 主路径）。
 *
 * 移除：script/style/iframe/object/embed/svg/math/frame/applet/link/meta/base
 * 标签、on* 事件处理器、javascript:/vbscript:/data:text/html 协议、
 * CSS expression() 与 url(javascript:)。
 *
 * 保留：编辑器节点 data-* 属性、class、style（已清洗）、src、href、
 * colspan/rowspan、target/rel。自定义节点（videoEmbed/audioEmbed/attachmentEmbed）
 * 序列化为 <div data-*-embed>，使其数据在 iframe 剥离后仍能保留。
 */
export function sanitizeHtml(html: string): string {
  const purify = getPurify();
  if (purify) {
    return purify.sanitize(html, {
      ALLOW_DATA_ATTR: true,
      ADD_ATTR: ["target", "rel"],
    });
  }
  return regexSanitize(html);
}

/**
 * 清洗 SVG 内容（保留 <svg> 标签，移除危险元素/属性）。
 *
 * 用于可信库输出（如 mermaid，其本身已运行在严格模式）。
 * 不能用于用户自建 SVG（应直接拒绝）。
 * 保持基于正则（不使用 DOMPurify svg profile），以避免剥离 mermaid
 * 严格模式在边缘情况遗留的 style/foreignObject 残片。
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
