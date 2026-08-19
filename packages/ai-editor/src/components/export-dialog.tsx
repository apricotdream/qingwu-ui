import type { Editor } from "@tiptap/core";
import { type FC, useCallback, useState } from "react";
import { t } from "../editor/i18n";
import { sanitizeHtml } from "../editor/utils/sanitize";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
}

type ExportFormat = "html" | "json" | "md" | "text" | "pdf";

export const ExportDialog: FC<ExportDialogProps> = ({ open, onClose, editor }) => {
  const [copied, setCopied] = useState(false);

  const getContent = useCallback(
    (format: ExportFormat): string => {
      if (!editor) return "";
      switch (format) {
        case "html":
          return editor.getHTML();
        case "json":
          return JSON.stringify(editor.getJSON(), null, 2);
        case "text":
          return editor.state.doc.textContent;
        case "md": {
          // 尝试通过 tiptap-markdown 扩展的 storage 获取
          const md = (editor.storage as unknown as Record<string, unknown>)?.markdown as
            | { getMarkdown?: () => string }
            | undefined;
          if (md?.getMarkdown) return md.getMarkdown();
          // fallback：HTML 内容（Markdown 渲染器可接受 HTML）
          return editor.getHTML();
        }
        default:
          return "";
      }
    },
    [editor],
  );

  const downloadFile = useCallback(
    (format: ExportFormat) => {
      if (!editor) return;
      const content = getContent(format);
      const mimeMap: Record<string, string> = {
        html: "text/html",
        json: "application/json",
        md: "text/markdown",
        text: "text/plain",
      };
      const extMap: Record<string, string> = {
        html: "html",
        json: "json",
        md: "md",
        text: "txt",
      };

      const blob = new Blob([content], {
        type: mimeMap[format] || "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qingwu-doc.${extMap[format] || "txt"}`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    },
    [editor, getContent, onClose],
  );

  const handleCopy = useCallback(
    async (format: ExportFormat) => {
      const content = getContent(format);
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    [getContent],
  );

  const handlePDF = useCallback(() => {
    if (!editor) return;
    // sanitize 剥离危险内容 + 过滤 iframe/object/embed，防 document.write 执行脚本
    const raw = editor.getHTML();
    const safeHtml = sanitizeHtml(raw)
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
      .replace(/<iframe\b[^>]*\/?>/gi, "")
      .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "")
      .replace(/<embed\b[^>]*\/?>/gi, "");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>青梧文档</title>
      <style>
        body { max-width: 800px; margin: 0 auto; padding: 40px; font-family: "PingFang SC","Microsoft YaHei",sans-serif; line-height: 1.8; color: #333; }
        pre { background: #f4f4f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
        img { max-width: 100%; }
      </style>
      </head>
      <body>${safeHtml}</body>
      </html>
    `);
    w.document.close();
    let printed = false;
    const print = () => {
      if (printed) return;
      printed = true;
      w.focus();
      w.print();
    };
    w.addEventListener("load", print, { once: true });
    w.setTimeout(print, 1000);
    onClose();
  }, [editor, onClose]);

  const formats = [
    {
      key: "html" as ExportFormat,
      labelKey: "editor.export.html",
      descKey: "editor.export.htmlDesc",
      icon: "🌐",
    },
    {
      key: "md" as ExportFormat,
      labelKey: "editor.export.md",
      descKey: "editor.export.mdDesc",
      icon: "📝",
    },
    {
      key: "json" as ExportFormat,
      labelKey: "editor.export.json",
      descKey: "editor.export.jsonDesc",
      icon: "📋",
    },
    {
      key: "text" as ExportFormat,
      labelKey: "editor.export.plainText",
      descKey: "editor.export.plainTextDesc",
      icon: "📄",
    },
    {
      key: "pdf" as ExportFormat,
      labelKey: "editor.export.pdf",
      descKey: "editor.export.pdfDesc",
      icon: "🖨",
    },
  ];

  if (!open) return null;

  return (
    <div className="qed-root">
      <div className="qed-backdrop" onClick={onClose} />
      <div className="qed-card animate-in">
        <div className="qed-header">
          <h2 className="qed-title">{t("editor.export.title")}</h2>
          <button type="button" className="qed-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="qed-body">
          {formats.map(({ key, labelKey, descKey, icon }) => (
            <div key={key} className="qed-row">
              <span className="qed-icon">{icon}</span>
              <div className="qed-meta">
                <div className="qed-label">{t(labelKey)}</div>
                <div className="qed-desc">{t(descKey)}</div>
              </div>
              <div className="qed-actions">
                {key === "pdf" ? (
                  <button type="button" className="qed-btn qed-btn--ghost" onClick={handlePDF}>
                    {t("editor.export.download")}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="qed-btn qed-btn--primary"
                      onClick={() => downloadFile(key)}
                    >
                      {t("editor.export.download")}
                    </button>
                    <button
                      type="button"
                      className="qed-btn qed-btn--ghost"
                      onClick={() => handleCopy(key)}
                    >
                      {copied ? "✓" : t("editor.export.copy")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="qed-footer">导出内容包含所有文本、图片和格式</div>
      </div>
    </div>
  );
};
