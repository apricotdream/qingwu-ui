import katex from "katex";

/** HTML 属性转义（data-latex 用于 markdown 解析回传源码） */
export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "&#10;");
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 把 LaTeX 源码渲染成 KaTeX HTML。
 * 空源码返回空串；非法语法交给 KaTeX 输出错误样式（throwOnError: false），
 * renderToString 本身抛错时退回纯文本，避免编辑器整块崩掉。
 */
export function renderMathHtml(latex: string, displayMode: boolean): string {
  const source = latex ?? "";
  if (!source.trim()) return "";

  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      trust: false,
      output: "htmlAndMathml",
    });
  } catch {
    return `<span class="math-fallback">${escapeText(source)}</span>`;
  }
}
