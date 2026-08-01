// 主编辑器组件

export type { Editor } from "@tiptap/core";
// 附件上传限制工具
export { formatBytes, getDocAttachmentTotal, validateAttachmentFile } from "./attachment-limits";
export type { AttachmentLimits } from "./attachment-limits";
// 图片上传弹窗
export { ImageUploadDialog } from "../components/image-upload-dialog";
export type { TocPanelProps } from "../components/toc";
// 目录面板
export { TocPanel } from "../components/toc";
export type {
  AILanguageModelConfig,
  AIMode,
  AIProvider,
  AIRequest,
} from "./ai";
// 写作助手 - LangChain.js 统一接口
export {
  buildSystemPrompt,
  createAILanguageModelProvider,
  getAIProvider,
  setAIProvider,
} from "./ai";
export { createDeepSeekProvider } from "./ai/providers/deepseek";
export { createOpenAIProvider } from "./ai/providers/openai";
// 兼容旧版导出（标记为 deprecated）
export { createOpenAICompatProvider } from "./ai/providers/openai-compat";
export { createQwenProvider } from "./ai/providers/qwen";
export type {
  BrowserClipperReceiver,
  ClipperErrorBody,
  ClipperErrorCode,
  ClipperErrResponse,
  ClipperOkResponse,
  ClipperReceiver,
  ClipperReceiverOptions,
  ClipperResponse,
  IncomingClip,
} from "./clipper/receiver";
// Web Clipper 接收器（让浏览器扩展可推送剪藏到编辑器）
// 仅导出纯浏览器实现；Node HTTP 接收器（startClipperReceiver / stopClipperReceiver）
// 经独立子入口 `@qingwu/ai-editor/clipper` 暴露，避免 node:http 进入浏览器产物。
export { startBrowserClipperReceiver } from "./clipper/receiver";
// 扩展
export {
  CodeBlock,
  createSlashCommandExtension,
  getEditorExtensions,
  ImageUpload,
  SearchHighlight,
  VideoEmbed,
} from "./extensions";
export type { BubbleMenuAction } from "./extensions/bubble-menu";
export { getBubbleMenuActions, getSearchEngine, setSearchEngine } from "./extensions/bubble-menu";
export { CODE_LANGUAGES } from "./extensions/code-block";
export type { SearchOptions } from "./extensions/search-highlight";
export { getSearchState } from "./extensions/search-highlight";
export type { SlashCommandItem } from "./extensions/slash-command";
export { getDefaultSlashCommands } from "./extensions/slash-command";
export type { I18nDict, Locale } from "./i18n";
// i18n
export { getLocale, setLocale, t, tf } from "./i18n";
export type { QingWuAIEditorProps } from "./ai-editor";
export { QingWuAIEditor } from "./ai-editor";
export type {
  COSStorageConfig,
  LocalStorageConfig,
  OSSStorageConfig,
  S3StorageConfig,
  StorageConfig,
  StorageProvider,
  StorageProviderType,
} from "./storage";
// 存储
export {
  getStorageInfo,
  getStorageProvider,
  loadStorageConfig,
  registerS3PreviewConfig,
  setStorageProvider,
  signPreviewUrlHeaders,
} from "./storage";
export { createCOSStorage } from "./storage/providers/cos";
export { createLocalStorage } from "./storage/providers/local";
export { createOSSStorage } from "./storage/providers/oss";
export type { S3StorageOptions } from "./storage/providers/s3";
export { createS3Storage } from "./storage/providers/s3";
// 安全工具
export { escapeHtml, sanitizeHtml, sanitizeSvg } from "./utils/sanitize";
