import { Extension } from "@tiptap/core";
import type { AttachmentLimits } from "../attachment-limits";

/**
 * UI 回调注册中心
 *
 * 用 Tiptap 的 Extension.addStorage 替代 window.__qingwu_* 全局变量：
 * - 支持多编辑器实例（每个 editor 有独立 storage）
 * - 类型安全（不再需要 as unknown as Record<string, unknown>）
 * - 不污染全局命名空间
 *
 * 使用方式：
 * - React 组件挂载时：editor.storage.qingwuUI.openImageDialog = () => setShow(true)
 * - TipTap 扩展内调用：editor.storage.qingwuUI.openImageDialog?.()
 */
export interface QingwuUIStorage {
  openImageDialog?: () => void;
  openVideoDialog?: () => void;
  openAI?: () => void;
  chooseMd?: (filename: string, resolve: (v: "render" | "attach" | null) => void) => void;
  parseMd?: (schema: unknown, text: string) => unknown;
  /**
   * 当前附件上传限制（字节）。宿主运行期更新，上传路径实时读取，
   * 避免依赖扩展重建（tiptap setOptions 不重建扩展）。
   */
  limits?: Partial<AttachmentLimits>;
}

export const QingwuUI = Extension.create({
  name: "qingwuUI",

  addStorage() {
    return {} as QingwuUIStorage;
  },
});
