/** 内容提取器 - 策略链 site-rule → readability → selection → full-dom 兜底，失败给 warnings 不静默 */

import type {
  ExtractedContent,
  ExtractedImage,
  ExtractedLink,
  ExtractedVideo,
  ExtractStrategy,
  SiteRule,
} from "../types";

const NEGATIVE_SELECTORS = [
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "iframe",
  "script",
  "style",
  "noscript",
  "svg",
  "[aria-hidden='true']",
  "[role='navigation']",
  "[role='banner']",
  "[role='complementary']",
  "[role='search']",
  ".ad",
  ".ads",
  ".advert",
  ".advertisement",
  ".sidebar",
  ".side-bar",
  ".comment",
  ".comments",
  ".related",
  ".recommend",
  ".share",
  ".social",
  ".newsletter",
  ".subscribe",
  ".promo",
  ".modal",
  ".popup",
  ".breadcrumb",
  ".pagination",
  ".post-meta",
  ".meta",
  ".tags",
  "#comment",
  "#comments",
  "#sidebar",
  "#header",
  "#footer",
  "#nav",
  "#navigation",
];

const POSITIVE_HINTS = [
  "article",
  "content",
  "main",
  "post",
  "entry",
  "story",
  "body",
  "text",
  "blog",
  "markdown",
  "container",
];

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "BLOCKQUOTE",
  "PRE",
  "LI",
  "TD",
  "TH",
  "DD",
  "DT",
  "FIGURE",
  "FIGCAPTION",
  "ASIDE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "UL",
  "OL",
  "TABLE",
]);

function qsa<T extends Element>(root: ParentNode, sel: string): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

function textDensity(el: Element): number {
  const text = el.textContent ?? "";
  const tags = el.querySelectorAll("*").length || 1;
  return text.length / tags;
}

function scoreNode(el: Element): number {
  let score = 0;
  const cls = `${el.className} ${el.id}`.toLowerCase();
  for (const h of POSITIVE_HINTS) if (cls.includes(h)) score += 25;
  if (/article|main/i.test(el.tagName)) score += 30;
  if (el.tagName === "P") score += 5;
  score += Math.min(50, (el.textContent?.length ?? 0) / 50);
  score += textDensity(el) > 30 ? 15 : 0;
  // 长度惩罚
  if ((el.textContent?.length ?? 0) < 80) score -= 30;
  return score;
}

function pickBestCandidate(doc: Document): {
  el: Element;
  strategy: ExtractStrategy;
  warnings: string[];
} {
  // 1) 显式语义标签
  const article = doc.querySelector("article");
  if (article && (article.textContent?.length ?? 0) > 200) {
    return { el: article, strategy: "readability", warnings: [] };
  }
  const main = doc.querySelector("main, [role='main']");
  if (main && (main.textContent?.length ?? 0) > 200) {
    return { el: main, strategy: "readability", warnings: [] };
  }

  // 2) 打分
  const candidates = qsa<HTMLElement>(doc.body, "div, section, article, main");
  let best: { el: Element; score: number } | null = null;
  for (const c of candidates) {
    const score = scoreNode(c);
    if (!best || score > best.score) best = { el: c, score };
  }
  if (best && best.score > 50) {
    return { el: best.el, strategy: "readability", warnings: [] };
  }

  // 3) 兜底
  return {
    el: doc.body,
    strategy: "full-dom",
    warnings: ["未能通过 Readability 找到正文，已回退到整页 DOM"],
  };
}

function stripNegatives(root: Element) {
  for (const sel of NEGATIVE_SELECTORS) {
    for (const el of qsa(root, sel)) el.remove();
  }
}

function readMeta(doc: Document, names: string[]): string | undefined {
  for (const n of names) {
    const m = doc.querySelector(`meta[name='${n}']`) ?? doc.querySelector(`meta[property='${n}']`);
    const v = m?.getAttribute("content");
    if (v) return v.trim();
  }
  return undefined;
}

function parseDate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function htmlToMarkdown(html: string): string {
  // 极简 HTML -> Markdown，保留结构，不引第三方依赖
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(walk).join("");

    switch (tag) {
      case "h1":
        return `\n# ${inner.trim()}\n\n`;
      case "h2":
        return `\n## ${inner.trim()}\n\n`;
      case "h3":
        return `\n### ${inner.trim()}\n\n`;
      case "h4":
        return `\n#### ${inner.trim()}\n\n`;
      case "h5":
        return `\n##### ${inner.trim()}\n\n`;
      case "h6":
        return `\n###### ${inner.trim()}\n\n`;
      case "p":
        return `${inner.trim()}\n\n`;
      case "br":
        return "\n";
      case "hr":
        return "\n---\n\n";
      case "strong":
      case "b":
        return `**${inner}**`;
      case "em":
      case "i":
        return `*${inner}*`;
      case "del":
      case "s":
        return `~~${inner}~~`;
      case "code":
        return `\`${inner}\``;
      case "pre":
        return `\n\`\`\`\n${el.textContent}\n\`\`\`\n\n`;
      case "blockquote":
        return `\n${inner
          .trim()
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n")}\n\n`;
      case "a": {
        const href = el.getAttribute("href") ?? "";
        return `[${inner}](${href})`;
      }
      case "img": {
        const src = el.getAttribute("src") ?? "";
        const alt = el.getAttribute("alt") ?? "";
        return `![${alt}](${src})`;
      }
      case "ul":
      case "ol": {
        const items = qsa(el, ":scope > li");
        const lines = items.map((li, i) => {
          const prefix = tag === "ol" ? `${i + 1}. ` : "- ";
          return `${prefix}${walk(li).trim()}`;
        });
        return `\n${lines.join("\n")}\n\n`;
      }
      case "li":
        return inner;
      case "table":
        return `\n${inner}\n`;
      case "tr": {
        const cells = qsa(el, ":scope > td, :scope > th").map((c) => walk(c).trim());
        return `| ${cells.join(" | ")} |\n`;
      }
      case "thead":
      case "tbody":
        return inner;
      case "figure":
        return `${inner}\n`;
      case "figcaption":
        return `*${inner}*\n`;
      default:
        return BLOCK_TAGS.has(el.tagName) ? `${inner}\n` : inner;
    }
  };

  return walk(tmp)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectImages(root: Element): ExtractedImage[] {
  const out: ExtractedImage[] = [];
  const seen = new Set<string>();
  for (const img of qsa<HTMLImageElement>(root, "img")) {
    let src = img.getAttribute("src") ?? img.dataset.src ?? "";
    if (!src) continue;
    if (src.startsWith("//")) src = `https:${src}`;
    if (src.startsWith("data:")) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    const fig = img.closest("figure");
    const caption =
      fig?.querySelector("figcaption")?.textContent?.trim() || img.getAttribute("alt") || undefined;
    out.push({
      src,
      alt: img.getAttribute("alt") ?? undefined,
      caption,
      width: img.width || undefined,
      height: img.height || undefined,
    });
  }
  return out;
}

function collectVideos(root: Element): ExtractedVideo[] {
  const out: ExtractedVideo[] = [];
  for (const v of qsa<HTMLVideoElement>(root, "video")) {
    const src = v.getAttribute("src") ?? v.querySelector("source")?.getAttribute("src") ?? "";
    if (!src) continue;
    out.push({
      src: src.startsWith("//") ? `https:${src}` : src,
      poster: v.poster || undefined,
    });
  }
  for (const f of qsa<HTMLIFrameElement>(root, "iframe")) {
    const src = f.src;
    if (/youtube|bilibili|vimeo/i.test(src)) {
      out.push({ src });
    }
  }
  return out;
}

function collectLinks(root: Element, baseUrl: string): ExtractedLink[] {
  const out: ExtractedLink[] = [];
  const seen = new Set<string>();
  for (const a of qsa<HTMLAnchorElement>(root, "a[href]")) {
    let href = a.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    try {
      href = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ href, text: a.textContent?.trim() ?? "" });
  }
  return out;
}

export interface ExtractOptions {
  mode: "page" | "selection" | "bookmark";
  selection?: string;
  siteRules?: SiteRule[];
}

export function extractContent(doc: Document, opts: ExtractOptions): ExtractedContent {
  const url = doc.location?.href ?? "";
  const finalUrl = url;
  const warnings: string[] = [];

  // 元信息
  const title =
    readMeta(doc, ["og:title", "twitter:title"]) ??
    doc.title?.trim() ??
    doc.querySelector("h1")?.textContent?.trim() ??
    "";
  const author = readMeta(doc, [
    "author",
    "article:author",
    "og:article:author",
    "twitter:creator",
  ]);
  const siteName =
    readMeta(doc, ["og:site_name", "application-name"]) ?? doc.location?.hostname ?? "";
  const publishedAt = parseDate(
    readMeta(doc, [
      "article:published_time",
      "og:article:published_time",
      "datePublished",
      "date",
    ]) ??
      doc.querySelector("time[datetime]")?.getAttribute("datetime") ??
      undefined,
  );
  const description = readMeta(doc, ["description", "og:description", "twitter:description"]);
  const lang = doc.documentElement.getAttribute("lang") ?? undefined;

  // 书签模式：仅元信息
  if (opts.mode === "bookmark") {
    return {
      url,
      finalUrl,
      title,
      author,
      siteName,
      publishedAt,
      description,
      lang,
      excerpt: description ?? "",
      contentHtml: "",
      contentText: "",
      markdown: `# ${title}\n\n${description ?? ""}\n\n${url}`,
      images: [],
      videos: [],
      links: [{ href: url, text: title }],
      wordCount: 0,
      readingMinutes: 0,
      strategy: "manual-selection",
      capturedAt: new Date().toISOString(),
      warnings,
    };
  }

  // 选区模式
  if (opts.mode === "selection" && opts.selection) {
    const sel = opts.selection;
    const html = sel;
    const text = stripHtml(sel);
    const markdown = htmlToMarkdown(sel);
    return {
      url,
      finalUrl,
      title,
      author,
      siteName,
      publishedAt,
      description,
      lang,
      excerpt: text.slice(0, 200),
      contentHtml: html,
      contentText: text,
      markdown,
      images: [],
      videos: [],
      links: [],
      wordCount: text.length,
      readingMinutes: Math.max(1, Math.ceil(text.length / 600)),
      strategy: "manual-selection",
      selection: text,
      capturedAt: new Date().toISOString(),
      warnings,
    };
  }

  // 站点规则优先
  let strategy: ExtractStrategy = "readability";
  let root: Element | null = null;
  let ruleApplied = false;

  for (const rule of opts.siteRules ?? []) {
    if (!matchGlob(rule.pattern, url)) continue;
    root = rule.contentSelector ? doc.querySelector(rule.contentSelector) : null;
    if (root) {
      strategy = "site-rule";
      ruleApplied = true;
      for (const s of rule.stripSelectors ?? []) {
        qsa(root, s).forEach((e) => {
          e.remove();
        });
      }
      break;
    }
  }

  if (!root) {
    const pick = pickBestCandidate(doc);
    root = pick.el;
    strategy = pick.strategy;
    if (pick.warnings.length) warnings.push(...pick.warnings);
  }

  // 克隆再清理，避免污染原页面
  const clone = root.cloneNode(true) as Element;
  stripNegatives(clone);

  // 触发懒加载（best effort）
  for (const img of qsa<HTMLImageElement>(clone, "img")) {
    const ds = img.dataset.src;
    if (ds && !img.src) img.setAttribute("src", ds);
  }

  const contentHtml = clone.innerHTML;
  const contentText = (clone.textContent ?? "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const markdown = htmlToMarkdown(contentHtml);
  const images = collectImages(clone);
  const videos = collectVideos(clone);
  const links = collectLinks(clone, url);

  if (!contentText || contentText.length < 60) {
    warnings.push("提取到的正文过短，可能页面结构异常；可尝试「剪藏选区」");
  }
  if (!ruleApplied && strategy === "full-dom") {
    warnings.push("未匹配到正文容器，已使用整页 DOM（可能含冗余）");
  }

  return {
    url,
    finalUrl,
    title,
    author,
    siteName,
    publishedAt,
    description,
    lang,
    excerpt: contentText.slice(0, 200),
    contentHtml,
    contentText,
    markdown,
    images,
    videos,
    links,
    wordCount: contentText.length,
    readingMinutes: Math.max(1, Math.ceil(contentText.length / 600)),
    strategy,
    capturedAt: new Date().toISOString(),
    warnings,
  };
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent ?? "").trim();
}

/** glob 匹配（极简实现，支持 * 与 ?） */
export function matchGlob(pattern: string, input: string): boolean {
  if (!pattern) return false;
  const re = new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".")}$`,
    "i",
  );
  return re.test(input);
}

/** 文本对摘要做切片（用于 AI 入参控量） */
export function sliceForAI(text: string, maxChars = 6000): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.7));
  const tail = text.slice(text.length - Math.floor(maxChars * 0.3));
  return `${head}\n\n…（已省略中段）…\n\n${tail}`;
}
