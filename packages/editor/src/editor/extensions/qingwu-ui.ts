import { Extension } from "@tiptap/core";

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
}

export const QingwuUI = Extension.create({
  name: "qingwuUI",

  addStorage() {
    return {} as QingwuUIStorage;
  },
});
