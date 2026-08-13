/**
 * Background service worker - 消息中枢 + AI 调用 + 推送青梧编辑器
 *
 * 解决 Obsidian 痛点：
 * - 错误透明：所有操作返回结构化结果（ok/err）
 * - AI 失败有重试 & 降级提示
 * - 推送失败显示原始错误码（endpoint 不存在/网络不可达）
 */

import { runAI, testAI } from "../shared/ai/provider";
import { ClipperError, toClipperError } from "../shared/errors";
import { sliceForAI } from "../shared/extract/readability";
import {
  type AIRunPayload,
  type DownloadMdPayload,
  type ExtractPayload,
  err,
  type ListPayload,
  type ListResult,
  type MessageResponse,
  type NotifyPayload,
  ok,
  type PushEditorPayload,
  type SavePayload,
  type TemplateRenderPayload,
} from "../shared/messages";
import { registerHandler } from "../shared/messaging";
import { db, loadSettings, settingsStore } from "../shared/storage/db";
import { renderTemplate } from "../shared/templates/engine";
import type {
  AIProviderConfig,
  ClipperSettings,
  ClipRecord,
  ExtractedContent,
} from "../shared/types";

// ===== 启动初始化 =====
chrome.runtime.onInstalled.addListener(async () => {
  await loadSettings();
  await ensureContextMenus();
  await ensureSidePanelDefault();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureContextMenus();
  await ensureSidePanelDefault();
});

// 配置 side panel：设置默认 path + 点击扩展图标直接打开 side panel
// （openPanelOnActionClick 是最可靠的打开方式，由 Chrome 内部处理用户手势）
async function ensureSidePanelDefault() {
  if (!chrome.sidePanel?.setOptions) return;
  try {
    await chrome.sidePanel.setOptions({
      path: "sidepanel/index.html",
      enabled: true,
    });
    // 点击扩展图标时打开 side panel（替代 popup）
    if (chrome.sidePanel.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (e) {
    console.warn("sidePanel 配置失败:", e);
  }
}

async function ensureContextMenus() {
  if (!chrome.contextMenus) return;
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: "clip-page",
      title: "青梧 · 剪藏当前页面",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: "clip-selection",
      title: "青梧 · 剪藏选区",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "clip-link",
      title: "青梧 · 剪藏此链接",
      contexts: ["link"],
    });
    chrome.contextMenus.create({
      id: "clip-image",
      title: "青梧 · 剪藏图片地址",
      contexts: ["image"],
    });
  } catch (e) {
    console.warn("contextMenus 初始化失败", e);
  }
}

// ===== 上下文菜单 =====
chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  const tabId = tab?.id;
  if (!tabId) return;
  let mode: ExtractPayload = { mode: "page" };
  if (info.menuItemId === "clip-selection" && info.selectionText) {
    mode = { mode: "selection", selection: info.selectionText };
  } else if (info.menuItemId === "clip-link" && info.linkUrl) {
    // 链接：仅书签
    mode = { mode: "bookmark" };
  } else if (info.menuItemId === "clip-image" && info.srcUrl) {
    mode = { mode: "bookmark" };
  }
  // 同步打开 sidepanel（保留用户手势），再异步通知 sidepanel 提取
  openSidePanelForCurrentWindow();
  setTimeout(() => {
    chrome.runtime
      .sendMessage({
        id: crypto.randomUUID(),
        kind: "clip:extract",
        payload: mode,
      })
      .catch(() => {});
  }, 200);
});

// ===== 快捷键 =====
chrome.commands?.onCommand.addListener((command) => {
  if (command === "open-sidepanel") {
    // sidePanel.open 必须在用户手势同步上下文调用，
    // 不能先 await（会丢失手势）。用 windowId 常量避免异步 query。
    openSidePanelForCurrentWindow();
    return;
  }
  // 剪藏命令：先打开 sidepanel 再触发提取
  void openSidePanelForCurrentWindow();
  const mode: ExtractPayload =
    command === "clip-selection" ? { mode: "selection" } : { mode: "page" };
  setTimeout(() => {
    chrome.runtime
      .sendMessage({
        id: crypto.randomUUID(),
        kind: "clip:extract",
        payload: mode,
      })
      .catch(() => {});
  }, 200);
});

// 在当前窗口打开 side panel（用户手势上下文里同步调用 open）
function openSidePanelForCurrentWindow() {
  if (!chrome.sidePanel?.open) {
    console.warn("sidePanel 不可用");
    return;
  }
  try {
    // WINDOW_ID_CURRENT(-1) 表示当前窗口，无需异步 query，保留用户手势
    void chrome.sidePanel.open({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });
  } catch (e) {
    console.warn("sidePanel.open 失败:", e);
  }
}

function openSidePanelForTab(tabId: number) {
  if (!chrome.sidePanel?.open) return;
  try {
    void chrome.sidePanel
      .open({ tabId })
      .catch((e) => console.warn("sidePanel 不可用，回退到独立窗口", e));
  } catch (e) {
    console.warn("sidePanel 不可用，回退到独立窗口", e);
  }
}

// ===== 消息中枢 =====
registerHandler({
  ping: () => ok({ pong: true, at: Date.now() }),

  "clip:extract": async (msg) => {
    const payload = msg.payload as ExtractPayload;
    const settings = await loadSettings();
    // 在 service worker 中调用 content script 提取（content script 有 DOM 访问权）
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return err("no-tab", "找不到当前活动标签页", { retryable: false });
    }
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        func: extractInPage,
        args: [payload, settings.siteRules ?? []],
      });
      const data = results?.[0]?.result as ExtractedContent | null;
      if (!data) {
        return err("extract.empty", "未能提取到内容，请尝试选区模式", {
          retryable: true,
        });
      }
      // 暂存 pendingDraft：悬浮球点击时 sidepanel 可能未开，打开后恢复草稿
      try {
        await chrome.storage.local.set({
          pendingDraft: { content: data, savedAt: Date.now() },
        });
      } catch {
        /* 暂存失败不影响提取响应 */
      }
      return ok(data);
    } catch (e) {
      const err_ = toClipperError(e);
      return err(err_.code, err_.message, {
        raw: typeof err_.raw === "string" ? err_.raw : undefined,
        retryable: err_.retryable,
      });
    }
  },

  "clip:save": async (msg) => {
    const payload = msg.payload as SavePayload;
    const settings = await loadSettings();
    const now = new Date().toISOString();
    const tpl =
      payload.templateId === "default"
        ? (settings.templates.find((t) => t.id === "default") ?? settings.templates[0])
        : (settings.templates.find((t) => t.id === payload.templateId) ?? settings.templates[0]);

    let rendered = "";
    let unknownVars: string[] = [];
    if (tpl) {
      const r = renderTemplate(tpl, {
        content: payload.content,
        tags: payload.tags,
        aiSummary: payload.aiSummary,
        aiTags: payload.aiTags,
        extra: { aiTranslation: payload.aiTranslation?.text ?? "" },
      });
      rendered = r.rendered;
      unknownVars = r.unknownVars;
    }

    const record: ClipRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      status: "ready",
      mode: payload.content.selection ? "selection" : "page",
      content: payload.content,
      noteTitle: payload.noteTitle || payload.content.title || "Untitled",
      notePath: payload.notePath || "Clippings/Inbox",
      tags: payload.tags,
      summary: payload.summary,
      aiSummary: payload.aiSummary,
      aiTags: payload.aiTags,
      aiTranslation: payload.aiTranslation ?? null,
      templateId: tpl?.id ?? "default",
      renderedMarkdown: rendered,
      favorite: false,
      pushStatus: { kind: "none" },
    };

    await db.saveRecord(record);

    // 更新最近路径/标签
    settings.recentPaths = unique([payload.notePath, ...(settings.recentPaths ?? [])]).slice(0, 20);
    settings.recentTags = unique([...payload.tags, ...(settings.recentTags ?? [])]).slice(0, 50);
    await persistSettings(settings);

    // 自动推送
    if (settings.editorTarget?.autoPush) {
      void pushToEditor(record, settings.editorTarget).then(async (r) => {
        if (r.ok) {
          record.pushStatus = { kind: "ok", target: "editor", at: new Date().toISOString() };
          record.status = "pushed";
        } else {
          record.pushStatus = {
            kind: "error",
            message: r.error,
            at: new Date().toISOString(),
          };
          record.status = "failed";
        }
        await db.saveRecord(record);
      });
    }

    return ok({
      id: record.id,
      unknownVars,
      warnings: payload.content.warnings,
    });
  },

  "clip:list": async (msg) => {
    const payload = (msg.payload ?? {}) as ListPayload;
    const { items, total } = await db.listRecords({
      query: payload.query,
      tag: payload.tag,
      favoriteOnly: payload.favoriteOnly,
      limit: payload.limit ?? 50,
      offset: payload.offset ?? 0,
    });
    const out: ListResult = {
      items: items.map((r) => ({
        id: r.id,
        noteTitle: r.noteTitle,
        notePath: r.notePath,
        tags: r.tags,
        createdAt: r.createdAt,
        favorite: r.favorite,
        status: r.status,
      })),
      total,
    };
    return ok(out);
  },

  "clip:get": async (msg) => {
    const { id } = msg.payload as { id: string };
    const r = await db.getRecord(id);
    if (!r) return err("not-found", "记录不存在", { retryable: false });
    return ok(r);
  },

  "clip:delete": async (msg) => {
    const { id } = msg.payload as { id: string };
    await db.deleteRecord(id);
    return ok({ id });
  },

  "clip:update": async (msg) => {
    const patch = msg.payload as Partial<ClipRecord> & { id: string };
    const r = await db.getRecord(patch.id);
    if (!r) return err("not-found", "记录不存在", { retryable: false });
    const updated: ClipRecord = {
      ...r,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await db.saveRecord(updated);
    return ok(updated);
  },

  "ai:run": async (msg) => {
    const { request } = msg.payload as AIRunPayload;
    const settings = await loadSettings();
    if (!settings.ai) {
      return err("no-api-key", "未配置 AI，请先到设置页填写 API Key", {
        retryable: false,
      });
    }
    const sliceMode = request.mode === "summary" || request.mode === "tags";
    const finalText = sliceMode ? sliceForAI(request.text) : request.text;
    const r = await runAI(settings.ai, { ...request, text: finalText });
    if (!r.ok) {
      return err(r.error.code, r.error.message, {
        raw: r.error.raw,
        retryable: r.error.retryable,
      });
    }
    return ok(r);
  },

  "ai:test": async (msg) => {
    const cfg = msg.payload as AIProviderConfig;
    const r = await testAI(cfg);
    if (!r.ok) {
      return err(r.error.code, r.error.message, {
        raw: r.error.raw,
        retryable: r.error.retryable,
      });
    }
    return ok(r);
  },

  "settings:get": async () => {
    const s = await loadSettings();
    return ok(s);
  },

  "settings:set": async (msg) => {
    const s = msg.payload as ClipperSettings;
    await persistSettings(s);
    return ok(s);
  },

  "template:render": async (msg) => {
    const { templateId, content, extra } = msg.payload as TemplateRenderPayload;
    const settings = await loadSettings();
    const tpl = settings.templates.find((t) => t.id === templateId) ?? settings.templates[0];
    if (!tpl) return err("template.missing", "模板不存在", { retryable: false });
    const r = renderTemplate(tpl, {
      content,
      tags: [],
      extra,
    });
    return ok({ rendered: r.rendered, unknownVars: r.unknownVars });
  },

  "push:editor": async (msg) => {
    const { recordId } = msg.payload as PushEditorPayload;
    const settings = await loadSettings();
    if (!settings.editorTarget) {
      return err("push.no-target", "未配置青梧编辑器推送目标", { retryable: false });
    }
    const r = await db.getRecord(recordId);
    if (!r) return err("not-found", "记录不存在", { retryable: false });
    const result = await pushToEditor(r, settings.editorTarget);
    if (!result.ok) {
      r.pushStatus = {
        kind: "error",
        message: result.error,
        at: new Date().toISOString(),
      };
      r.status = "failed";
      await db.saveRecord(r);
      return err("push.failed", result.error, { retryable: result.retryable });
    }
    r.pushStatus = { kind: "ok", target: "editor", at: new Date().toISOString() };
    r.status = "pushed";
    await db.saveRecord(r);
    return ok({ at: r.pushStatus.at });
  },

  "download:md": async (msg) => {
    const { recordId, filename } = msg.payload as DownloadMdPayload;
    const r = await db.getRecord(recordId);
    if (!r) return err("not-found", "记录不存在", { retryable: false });
    const name = filename ?? `${sanitizeFilename(r.noteTitle)}.md`;
    try {
      const url = URL.createObjectURL(
        new Blob([r.renderedMarkdown], { type: "text/markdown;charset=utf-8" }),
      );
      await chrome.downloads.download({
        url,
        filename: name,
        saveAs: false,
      });
      return ok({ name });
    } catch (e) {
      const err_ = toClipperError(e);
      return err("download.failed", err_.message, { retryable: err_.retryable });
    }
  },

  "ui:notify": async (msg) => {
    const payload = msg.payload as NotifyPayload;
    try {
      if (chrome.notifications) {
        await chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon-128.png",
          title: payload.message,
          message: payload.detail ?? "",
          priority: payload.level === "error" ? 2 : 1,
        });
      }
    } catch {
      /* 通知失败不影响主流程 */
    }
    return ok({ delivered: true });
  },

  // 悬浮球来自 content script，跨进程调用 sidePanel.open 容易丢用户手势。
  // 这里直接打开完整侧栏窗口，保留设置 / 历史 / AI / 复制 / 预览等完整功能。
  "tab:open-sidepanel": async (_msg, sender) => {
    const tabId = sender.tab?.id;
    try {
      if (typeof tabId !== "number") {
        return err("sidepanel.no-tab", "无法识别当前标签页", { retryable: false });
      }
      await chrome.sidePanel.open({ tabId });
      return ok({ tabId, mode: "sidepanel" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err("sidepanel.open", message, { retryable: false });
    }
  },
});

// ===== 在页面上下文执行（注入脚本） =====
type PageExtractStrategy = "readability" | "site-rule" | "manual-selection" | "full-dom";
type PageExtractedImage = {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
};
type PageExtractedVideo = { src: string; poster?: string };
type PageExtractedLink = { href: string; text: string };

function extractInPage(
  payload: ExtractPayload,
  siteRules: import("../shared/types").SiteRule[],
): ExtractedContent | null {
  // 注意：此函数会被序列化注入到页面，不能引用外部变量
  // 我们重新声明一个简化版的提取逻辑（与 readability.ts 同构）
  // 为避免 import 在注入上下文失败，直接使用 page 内的全局函数
  const doc = document;

  const NEGATIVE = [
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
    ".ad",
    ".ads",
    ".advert",
    ".sidebar",
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
    "#comments",
    "#sidebar",
    "#header",
    "#footer",
  ];
  const POSITIVE = ["article", "content", "main", "post", "entry", "story", "body", "text", "blog"];

  function readMeta(names: string[]): string | undefined {
    for (const n of names) {
      const m =
        doc.querySelector(`meta[name='${n}']`) ?? doc.querySelector(`meta[property='${n}']`);
      const v = m?.getAttribute("content");
      if (v) return v.trim();
    }
    return undefined;
  }
  function parseDate(s?: string): string | undefined {
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  const url = location.href;
  const title = readMeta(["og:title", "twitter:title"]) ?? doc.title ?? "";
  const author = readMeta(["author", "article:author", "twitter:creator"]);
  const siteName = readMeta(["og:site_name"]) ?? location.hostname;
  const publishedAt = parseDate(
    readMeta(["article:published_time", "datePublished"]) ??
      doc.querySelector("time[datetime]")?.getAttribute("datetime") ??
      undefined,
  );
  const description = readMeta(["description", "og:description"]);
  const lang = doc.documentElement.getAttribute("lang") ?? undefined;

  if (payload.mode === "bookmark") {
    return {
      url,
      finalUrl: url,
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
      warnings: [],
    };
  }

  if (payload.mode === "selection" && (payload as any).selection) {
    // 用户从右键菜单触发，selectionText 已在 background 提取，但这里走不到
    // 此分支仅用于内部直传 selection 的场景
  }

  // 站点规则
  let root: Element | null = null;
  let strategy: PageExtractStrategy = "readability";
  for (const rule of siteRules ?? []) {
    if (!rule.pattern) continue;
    try {
      const re = new RegExp(
        `^${rule.pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".")}$`,
        "i",
      );
      if (!re.test(url)) continue;
    } catch {
      continue;
    }
    if (rule.contentSelector) {
      root = doc.querySelector(rule.contentSelector);
      if (root) {
        strategy = "site-rule";
        for (const s of rule.stripSelectors ?? []) {
          root.querySelectorAll(s).forEach((e) => {
            e.remove();
          });
        }
        break;
      }
    }
  }

  if (!root) {
    const article = doc.querySelector("article");
    if (article && (article.textContent?.length ?? 0) > 200) {
      root = article;
    } else {
      const main = doc.querySelector("main, [role='main']");
      if (main && (main.textContent?.length ?? 0) > 200) {
        root = main;
      } else {
        // 评分
        let best: { el: Element; score: number } | null = null;
        for (const c of Array.from(
          doc.body.querySelectorAll<HTMLElement>("div, section, article, main"),
        )) {
          const cls = `${c.className} ${c.id}`.toLowerCase();
          let score = 0;
          for (const h of POSITIVE) if (cls.includes(h)) score += 25;
          if (/article|main/i.test(c.tagName)) score += 30;
          score += Math.min(50, (c.textContent?.length ?? 0) / 50);
          if ((c.textContent?.length ?? 0) < 80) score -= 30;
          if (!best || score > best.score) best = { el: c, score };
        }
        root = best && best.score > 50 ? best.el : doc.body;
        strategy = best && best.score > 50 ? "readability" : "full-dom";
      }
    }
  }

  const clone = root!.cloneNode(true) as Element;
  for (const sel of NEGATIVE) {
    clone.querySelectorAll(sel).forEach((e) => {
      e.remove();
    });
  }
  clone.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const ds = img.dataset.src;
    if (ds && !img.src) img.setAttribute("src", ds);
  });

  const contentHtml = (clone as HTMLElement).innerHTML;
  const contentText = (clone.textContent ?? "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 极简 markdown
  const md: string[] = [];
  clone.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,code,img,a,hr").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const txt = el.textContent?.trim() ?? "";
    if (!txt && tag !== "img" && tag !== "hr") return;
    if (tag === "h1") md.push(`\n# ${txt}\n`);
    else if (tag === "h2") md.push(`\n## ${txt}\n`);
    else if (tag === "h3") md.push(`\n### ${txt}\n`);
    else if (tag === "h4") md.push(`\n#### ${txt}\n`);
    else if (tag === "h5") md.push(`\n##### ${txt}\n`);
    else if (tag === "h6") md.push(`\n###### ${txt}\n`);
    else if (tag === "p") md.push(`${txt}\n`);
    else if (tag === "li") md.push(`- ${txt}`);
    else if (tag === "blockquote") md.push(`> ${txt}\n`);
    else if (tag === "pre") md.push(`\n\`\`\`\n${txt}\n\`\`\`\n`);
    else if (tag === "code") md.push(`\`${txt}\``);
    else if (tag === "img") {
      const src = (el as HTMLImageElement).src;
      const alt = el.getAttribute("alt") ?? "";
      if (src && !src.startsWith("data:")) md.push(`![${alt}](${src})`);
    } else if (tag === "a") {
      const href = (el as HTMLAnchorElement).href;
      md.push(`[${txt}](${href})`);
    } else if (tag === "hr") md.push("\n---\n");
  });

  // 图片/视频/链接收集
  const images: PageExtractedImage[] = [];
  const seenImg = new Set<string>();
  clone.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    let src = img.src;
    if (!src || src.startsWith("data:")) return;
    if (src.startsWith("//")) src = `https:${src}`;
    if (seenImg.has(src)) return;
    seenImg.add(src);
    const fig = img.closest("figure");
    const caption = fig?.querySelector("figcaption")?.textContent?.trim() || img.alt || undefined;
    images.push({
      src,
      alt: img.alt || undefined,
      caption,
      width: img.width || undefined,
      height: img.height || undefined,
    });
  });
  const videos: PageExtractedVideo[] = [];
  clone.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
    const src = v.src || v.querySelector("source")?.src;
    if (src) videos.push({ src, poster: v.poster || undefined });
  });
  const links: PageExtractedLink[] = [];
  const seenLink = new Set<string>();
  clone.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    let href = a.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    try {
      href = new URL(href, url).toString();
    } catch {
      return;
    }
    if (seenLink.has(href)) return;
    seenLink.add(href);
    links.push({ href, text: a.textContent?.trim() ?? "" });
  });

  const warnings: string[] = [];
  if (!contentText || contentText.length < 60) warnings.push("提取到的正文过短");
  if (strategy === "full-dom") warnings.push("未匹配到正文容器，已使用整页 DOM");

  return {
    url,
    finalUrl: url,
    title,
    author,
    siteName,
    publishedAt,
    description,
    lang,
    excerpt: contentText.slice(0, 200),
    contentHtml,
    contentText,
    markdown: md
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
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

// ===== 推送青梧编辑器 =====
async function pushToEditor(
  record: ClipRecord,
  target: import("../shared/types").EditorTarget,
): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
  // 浏览器降级通道：HTTP 不可用时（纯 Web dev 模式无 node:http），
  // 通过 chrome.tabs.create 打开编辑器页面 + 注入 postMessage 推送 markdown。
  // 编辑器页面监听 window.message 事件接收。
  async function fallbackBrowserPush(): Promise<
    { ok: true } | { ok: false; error: string; retryable: boolean }
  > {
    let editorUrl = target.editorUrl ?? "http://localhost:5173";
    // 追加 pending=clip 信号：宿主页据此显示「剪藏传入中」等待态，剪藏到达前给出反馈
    try {
      const u = new URL(editorUrl);
      u.searchParams.set("pending", "clip");
      editorUrl = u.toString();
    } catch {
      /* editorUrl 不是合法绝对 URL，保持原样 */
    }
    try {
      const tab = await chrome.tabs.create({ url: editorUrl, active: true });
      if (!tab.id) return { ok: false, error: "无法打开编辑器页面", retryable: true };
      // 等待页面加载完成（最多 8 秒；dev 冷启动首次编译可能较慢）
      await waitForTabComplete(tab.id, 8_000);
      // 等页面接收器就绪（宿主页暴露 __qingwuReady）再投递，避免消息早于接收器注册而被丢弃；
      // 缩短等待并失败透明：未就绪直接报错，不再「静默等满后盲目投递」
      const pageReady = await waitForPageReady(tab.id, 4_000);
      if (!pageReady) {
        return {
          ok: false,
          error:
            "编辑器页面未就绪（未检测到剪藏接收器）。请确认「编辑器地址」指向支持剪藏的页面（如 echo-diary 创作页），且该页面的剪藏开关已开启",
          retryable: true,
        };
      }
      const clipPayload = {
        title: record.noteTitle,
        path: record.notePath,
        tags: record.tags,
        markdown: record.renderedMarkdown,
        sourceUrl: record.content.url,
        capturedAt: record.content.capturedAt,
      };
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        // 必须在主世界投递：隔离世界 postMessage 虽能达主世界，但主世界投递语义更直接
        world: "MAIN",
        func: (payload) => {
          window.postMessage({ kind: "qingwu-clip", clip: payload }, "*");
        },
        args: [clipPayload],
      });
      return { ok: true };
    } catch (e) {
      const err = e instanceof ClipperError ? e : toClipperError(e);
      return { ok: false, error: "浏览器降级失败: " + err.message, retryable: err.retryable };
    }
  }

  try {
    if (target.kind === "http") {
      const endpoint = target.endpoint ?? "http://127.0.0.1:7321/clip";
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: record.noteTitle,
            path: record.notePath,
            tags: record.tags,
            markdown: record.renderedMarkdown,
            sourceUrl: record.content.url,
            capturedAt: record.content.capturedAt,
          }),
          signal: ctrl.signal,
        });
        if (!resp.ok) {
          // HTTP 不可达时降级到浏览器通道（纯 Web dev 模式无 node:http）
          return fallbackBrowserPush();
        }
        return { ok: true };
      } finally {
        clearTimeout(timer);
      }
    }
    if (target.kind === "file") {
      // 通过 downloads API 写入用户目录
      const blob = URL.createObjectURL(
        new Blob([record.renderedMarkdown], { type: "text/markdown;charset=utf-8" }),
      );
      await chrome.downloads.download({
        url: blob,
        filename: `${target.directory ?? "Clippings"}/${sanitizeFilename(record.noteTitle)}.md`,
        saveAs: false,
      });
      return { ok: true };
    }
    if (target.kind === "native-message") {
      return {
        ok: false,
        error: "Native Messaging 推送尚未实现，请在设置中选择 HTTP 模式",
        retryable: false,
      };
    }
    return {
      ok: false,
      error: `暂不支持的推送方式：${target.kind}`,
      retryable: false,
    };
  } catch (e) {
    // HTTP 模式下连接失败（编辑器未启动 receiver），降级到浏览器通道
    if (target.kind === "http") {
      return fallbackBrowserPush();
    }
    const err = e instanceof ClipperError ? e : toClipperError(e);
    return {
      ok: false,
      error: err.message,
      retryable: err.retryable,
    };
  }
}

// ===== 工具 =====
function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// 等待指定 tab 加载完成（complete 状态），超时则 resolve（不抛错，交给后续 executeScript 处理）
function waitForTabComplete(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    // @types/chrome 0.2.x 把 tabs.onUpdated 的 changeInfo 类型更名为 OnUpdatedInfo
    const listener = (id: number, info: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (id === tabId && (info.status === "complete" || tab.status === "complete")) {
        finish();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    // 先检查当前状态
    chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === "complete") finish();
      })
      .catch(() => finish());
    const timer = setTimeout(finish, timeoutMs);
  });
}

// 等待宿主页面暴露 __qingwuReady 标志（表示剪藏接收器已注册），最多 timeoutMs；
// 返回是否就绪：true=可安全投递；false=超时未就绪，由调用方决定失败方式（不再盲目投递）。
async function waitForPageReady(tabId: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        // 必须在主世界读：页面在主世界设的 window.__qingwuReady，隔离世界读不到
        world: "MAIN",
        func: () =>
          (window as unknown as Record<string, boolean>).__qingwuReady === true,
      });
      if (res?.result) return true;
    } catch {
      /* 页面未就绪或暂不可注入，进入下一轮重试 */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function sanitizeFilename(name: string): string {
  return (
    name
      // biome-ignore lint/suspicious/noControlCharactersInRegex: 文件名净化需剔除 0x00-0x1F 控制字符
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .slice(0, 100)
      .trim() || "untitled"
  );
}

async function persistSettings(s: ClipperSettings): Promise<void> {
  await settingsStore.set(s);
}
