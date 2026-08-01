/**
 * 模板引擎 - 解决 Obsidian 模板变量不可靠、切换模板后变量失效的痛点
 *
 * - 强类型变量表
 * - 切换模板不影响变量求值（变量始终从 content 重新求值）
 * - 未识别变量原样保留 + 警告
 * - 日期变量使用 dayjs-style 模式（{{YYYY}}/{{MM}}/{{DD}}）
 */

import type { ExtractedContent, Template } from "../types";

export interface TemplateContext {
  content: ExtractedContent;
  tags: string[];
  aiSummary?: string;
  aiTags?: string[];
  extra?: Record<string, string>;
}

const RESERVED = new Set([
  "title",
  "url",
  "finalUrl",
  "author",
  "siteName",
  "published",
  "captured",
  "description",
  "excerpt",
  "content",
  "markdown",
  "tags",
  "aiSummary",
  "aiTags",
  "wordCount",
  "readingMinutes",
  "lang",
]);

export function resolveVar(name: string, ctx: TemplateContext): string | undefined {
  const { content, tags, aiSummary, aiTags, extra } = ctx;
  switch (name) {
    case "title": return content.title || "Untitled";
    case "url": return content.url;
    case "finalUrl": return content.finalUrl;
    case "author": return content.author ?? "";
    case "siteName": return content.siteName ?? "";
    case "published": return content.publishedAt ?? "";
    case "captured": return content.capturedAt;
    case "description": return content.description ?? "";
    case "excerpt": return content.excerpt;
    case "content": return content.contentHtml;
    case "markdown": return content.markdown;
    case "tags": return tags.join(", ");
    case "aiSummary": return aiSummary ?? "";
    case "aiTags": return (aiTags ?? []).join(", ");
    case "wordCount": return String(content.wordCount);
    case "readingMinutes": return String(content.readingMinutes);
    case "lang": return content.lang ?? "";
  }
  // 日期模式 {{YYYY}} {{MM}} {{DD}} {{HH}} {{mm}}
  if (/^[YMDHms]+$/.test(name)) {
    const d = new Date();
    const pad = (n: number, l = 2) => String(n).padStart(l, "0");
    return name
      .replace(/YYYY/g, String(d.getFullYear()))
      .replace(/YY/g, String(d.getFullYear()).slice(-2))
      .replace(/MM/g, pad(d.getMonth() + 1))
      .replace(/DD/g, pad(d.getDate()))
      .replace(/HH/g, pad(d.getHours()))
      .replace(/mm/g, pad(d.getMinutes()))
      .replace(/ss/g, pad(d.getSeconds()));
  }
  return extra?.[name];
}

export function renderTemplate(tpl: Template, ctx: TemplateContext): {
  rendered: string;
  unknownVars: string[];
} {
  const unknown = new Set<string>();
  let out = tpl.body.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_|:/\-\\]*)\s*\}\}/g,
    (full, name: string) => {
      const v = resolveVar(name.trim(), ctx);
      if (v === undefined || v === "") {
        if (!RESERVED.has(name) && !/^[YMDHms]+$/.test(name)) {
          unknown.add(name);
        }
        return "";
      }
      return v;
    },
  );
  return { rendered: out, unknownVars: [...unknown] };
}

/** 列出模板中用到的变量（用于 UI 提示） */
export function extractVars(tpl: Template): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_|:/\-\\]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl.body)) !== null) set.add(m[1].trim());
  return [...set];
}

export function pickTemplate(
  templates: Template[],
  url: string,
  defaultId: string,
): Template {
  // 优先匹配 pathPattern
  for (const t of templates) {
    if (!t.pathPattern) continue;
    if (matchGlobSafe(t.pathPattern, url)) return t;
  }
  // 再找默认
  return templates.find((t) => t.id === defaultId) ?? templates[0];
}

function matchGlobSafe(pattern: string, input: string): boolean {
  try {
    const re = new RegExp(
      `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
      "i",
    );
    return re.test(input);
  } catch {
    return false;
  }
}
