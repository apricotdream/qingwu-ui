import type { FC } from "react";

interface Props {
  open: boolean;
  filename: string;
  onRender: () => void;
  onAttach: () => void;
  onClose: () => void;
}

export const MdImportDialog: FC<Props> = ({ open, filename, onRender, onAttach, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[calc(100vw-32px)] max-w-[420px] bg-background rounded-2xl shadow-2xl border border-default-200 overflow-hidden animate-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-default-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <h2 className="text-base font-semibold">导入 Markdown 文件</h2>
          </div>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-default-400 hover:text-default-600 hover:bg-default-100 transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-default-50 dark:bg-default-100/10 border border-default-100">
            <span className="text-2xl">📝</span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{filename}</p>
              <p className="text-xs text-default-400 mt-0.5">Markdown 文件</p>
            </div>
          </div>

          <p className="text-sm text-default-600 text-center">选择导入方式：</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-default-200 hover:border-primary hover:bg-primary/5 transition-all text-left group"
              onClick={onRender}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">直接渲染</p>
                <p className="text-xs text-default-400 mt-1">将内容解析并渲染到编辑器中</p>
              </div>
            </button>

            <button
              type="button"
              className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-default-200 hover:border-primary hover:bg-primary/5 transition-all text-left group"
              onClick={onAttach}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-5.7l-1.414-1.414"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">作为附件</p>
                <p className="text-xs text-default-400 mt-1">以附件形式嵌入，支持预览和下载</p>
              </div>
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-default-100 bg-default-50/50">
          <p className="text-xs text-default-400 text-center">
            选择「直接渲染」将解析 Markdown 语法 · 选择「附件」保留原始文件
          </p>
        </div>
      </div>
    </div>
  );
};
