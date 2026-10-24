import type { Editor } from "@tiptap/core";
import { type FC, useCallback, useState } from "react";
import { t } from "../editor/i18n";
import {
  createMarkdownDownload,
  createPrintHtml,
  type ExportFormat,
  getExportContent,
  waitForPrintImages,
} from "../editor/utils/document-export";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
}

export const ExportDialog: FC<ExportDialogProps> = ({ open, onClose, editor }) => {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState("");

  const getContent = useCallback(
    (format: ExportFormat): string => (editor ? getExportContent(editor, format) : ""),
    [editor],
  );

  const downloadFile = useCallback(
    async (format: ExportFormat) => {
      if (!editor) return;
      setBusy(format);
      setError("");
      try {
        const mimeMap: Record<string, string> = {
          html: "text/html",
          json: "application/json",
          text: "text/plain",
        };
        const result =
          format === "md"
            ? await createMarkdownDownload(editor)
            : {
                blob: new Blob([getContent(format)], { type: `${mimeMap[format]};charset=utf-8` }),
                filename: `qingwu-doc.${format === "text" ? "txt" : format}`,
              };
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        // 保留到浏览器接管下载后再释放。
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        onClose();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t("editor.export.failed"));
      } finally {
        setBusy(null);
      }
    },
    [editor, getContent, onClose],
  );

  const handleCopy = useCallback(
    async (format: ExportFormat) => {
      const content = getContent(format);
      try {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        setError(t("editor.export.failed"));
      }
    },
    [getContent],
  );

  const handlePDF = useCallback(async () => {
    if (!editor) return;
    // 必须在点击事件内同步打开窗口，避免异步准备图片后被浏览器拦截。
    const w = window.open("", "_blank");
    if (!w) {
      setError(t("editor.export.popupBlocked"));
      return;
    }
    setBusy("pdf");
    setError("");
    w.document.body.textContent = t("editor.export.preparing");
    try {
      const html = await createPrintHtml(editor);
      w.document.open();
      w.document.write(html);
      w.document.close();
      await waitForPrintImages(w.document);
      w.focus();
      w.print();
      onClose();
    } catch (cause) {
      w.close();
      setError(cause instanceof Error ? cause.message : t("editor.export.failed"));
    } finally {
      setBusy(null);
    }
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
                  <button
                    type="button"
                    className="qed-btn qed-btn--ghost"
                    disabled={busy !== null}
                    onClick={handlePDF}
                  >
                    {busy === key ? t("editor.export.preparing") : t("editor.export.download")}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="qed-btn qed-btn--primary"
                      disabled={busy !== null}
                      onClick={() => downloadFile(key)}
                    >
                      {busy === key ? t("editor.export.preparing") : t("editor.export.download")}
                    </button>
                    <button
                      type="button"
                      className="qed-btn qed-btn--ghost"
                      disabled={busy !== null}
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

        {error && (
          <div className="qed-export-error" role="alert">
            {error}
          </div>
        )}
        <div className="qed-footer">{t("editor.export.footer")}</div>
      </div>
    </div>
  );
};
