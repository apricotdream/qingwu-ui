/** 青梧 Web Clipper 共享类型（严格类型化，避免 Obsidian 运行期模板/变量 bug） */

export type Locale = "zh-CN" | "en-US";
export type ThemeMode = "light" | "dark" | "auto";
export type AccentColor = "qingwu" | "dracula" | "violet" | "amber";

/** 剪藏模式 */
export type ClipMode = "page" | "selection" | "bookmark" | "screenshot";

/** 内容提取策略 */
export type ExtractStrategy =
  | "readability" // 通用 Readability 算法
  | "site-rule" // 站点规则优先
  | "manual-selection" // 用户选区
  | "full-dom"; // 整页 DOM 兜底

/** 提取出来的页面内容 */
export interface ExtractedContent {
  url: string;
  finalUrl: string; // 跳转后的最终 URL
  title: string;
  author?: string;
  siteName?: string;
  publishedAt?: string; // ISO 字符串
  modifiedAt?: string;
  description?: string;
  lang?: string;
  excerpt: string; // 摘要文本（前 200 字）
  contentHtml: string; // 干净的 HTML 正文
  contentText: string; // 纯文本正文
  markdown: string; // Markdown 版本
  images: ExtractedImage[];
  videos: ExtractedVideo[];
  links: ExtractedLink[];
  wordCount: number;
  readingMinutes: number;
  strategy: ExtractStrategy;
  selection?: string; // 选区模式时的原文
  capturedAt: string; // ISO 时间戳
  warnings: string[]; // 非致命问题（如：图片懒加载未触发）
}

export interface ExtractedImage {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface ExtractedVideo {
  src: string;
  poster?: string;
  type?: string;
  duration?: number;
}

export interface ExtractedLink {
  href: string;
  text: string;
  internal?: boolean;
}

/** 剪藏条目（持久化） */
export interface ClipRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ClipStatus;
  mode: ClipMode;
  content: ExtractedContent;
  noteTitle: string;
  notePath: string; // 模拟的文件夹路径，如 "Clippings/2026/07"
  tags: string[];
  summary?: string;
  aiSummary?: string;
  aiTags?: string[];
  aiTranslation?: { lang: Locale; text: string } | null;
  templateId: string;
  renderedMarkdown: string;
  favorite: boolean;
  pushStatus?: PushStatus;
}

export type ClipStatus = "draft" | "ready" | "pushed" | "failed";
export type PushStatus =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "ok"; target: string; at: string }
  | { kind: "error"; message: string; at: string; code?: string };

/** AI 提供方配置 */
export interface AIProviderConfig {
  kind:
    | "openai"
    | "deepseek"
    | "qwen"
    | "moonshot"
    | "zhipu"
    | "minimax"
    | "chrome-built-in"
    | "custom";
  baseURL?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  /** 是否走 chrome.storage.sync 跟随多设备 */
  syncAcrossDevices?: boolean;
}

/** AI 请求 */
export interface AIRequest {
  mode: "summary" | "tags" | "translate" | "rename" | "custom";
  text: string;
  targetLang?: Locale;
  instruction?: string;
  maxTokens?: number;
}

/** AI 响应（成功） */
export interface AIResult<T = unknown> {
  ok: true;
  data: T;
  usage?: { promptTokens?: number; completionTokens?: number };
  latencyMs: number;
}

/** AI 响应（失败）- 解决 Obsidian 静默失败的痛点 */
export interface AIError {
  ok: false;
  error: {
    code: AIErrorCode;
    message: string; // 用户可读
    raw?: string; // 原始错误（开发者）
    retryable: boolean;
    provider?: string;
  };
}

export type AIErrorCode =
  | "no-api-key"
  | "network"
  | "rate-limit"
  | "auth-failed"
  | "model-not-found"
  | "context-too-long"
  | "invalid-response"
  | "timeout"
  | "provider-error"
  | "unknown";

export type AIResponse<T = unknown> = AIResult<T> | AIError;

/** 模板定义 */
export interface Template {
  id: string;
  name: string;
  body: string; // Markdown 模板，含 {{变量}}
  pathPattern?: string; // 站点触发器（glob）
  isDefault?: boolean;
  builtIn?: boolean;
}

/** 青梧编辑器推送目标 */
export interface EditorTarget {
  kind: "http" | "native-message" | "file" | "oss" | "cos";
  /** HTTP 模式：青梧编辑器本地服务地址，如 http://127.0.0.1:7321/clip */
  endpoint?: string;
  /** 浏览器降级通道：青梧编辑器页面 URL（HTTP 不可用时用，如 vite dev http://localhost:5173） */
  editorUrl?: string;
  /** Native Messaging：宿主名称 */
  host?: string;
  /** 文件模式：下载目录 */
  directory?: string;
  /** OSS/COS：使用编辑器同步过来的存储配置 id */
  storageId?: string;
  /** 自动推送（剪藏即推） */
  autoPush?: boolean;
}

/** 全局配置 */
export interface ClipperSettings {
  locale: Locale;
  theme: ThemeMode;
  accent: AccentColor;
  ai: AIProviderConfig | null;
  templates: Template[];
  defaultTemplateId: string;
  editorTarget: EditorTarget | null;
  /** 是否启用 AI 自动摘要（剪藏时自动跑） */
  autoSummary: boolean;
  /** 是否启用 AI 自动标签 */
  autoTags: boolean;
  /** 最近使用的路径（用于自动补全） */
  recentPaths: string[];
  /** 最近使用的标签 */
  recentTags: string[];
  /** 高级：站点规则覆盖 */
  siteRules: SiteRule[];
}

export interface SiteRule {
  id: string;
  name: string;
  pattern: string; // URL glob
  titleSelector?: string;
  contentSelector?: string;
  dateSelector?: string;
  authorSelector?: string;
  stripSelectors?: string[];
}
