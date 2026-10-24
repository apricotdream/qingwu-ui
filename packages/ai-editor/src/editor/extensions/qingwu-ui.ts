import { Extension } from "@tiptap/core";
import type { AttachmentLimits } from "../attachment-limits";

/** UI 回调注册中心：用 Extension.addStorage 替代 window.__qingwu_* 全局变量，
 *  多实例安全、类型安全、不污染全局。宿主挂载时写入回调，扩展内 storage.qingwuUI.xxx?.() 调用 */
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
  // 优先处理标题退出，避免 Ctrl+Enter 被默认的硬换行快捷键接管。
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      "Ctrl-Enter": () =>
        this.editor.isEditable &&
        this.editor.isActive("heading") &&
        this.editor.commands.setParagraph(),
    };
  },

  addStorage() {
    return {} as QingwuUIStorage;
  },
});
