import { NodeViewWrapper } from "@tiptap/react";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "../i18n";
import { renderMathHtml } from "./math-utils";

interface MathViewProps {
  node: { type: { name: string }; attrs: { latex?: string } };
  updateAttributes: (attributes: { latex: string }) => void;
  deleteNode?: () => void;
  editor?: { isEditable?: boolean };
  selected?: boolean;
}

/**
 * 行内 / 块级公式 NodeView：
 * - 只读态只渲染 KaTeX 结果；
 * - 可编辑态点击公式打开浮层，输入源码并实时预览；
 * - 新建的空公式自动打开浮层，取消时删除节点。
 */
export function MathView({ node, updateAttributes, deleteNode, editor, selected }: MathViewProps) {
  const isBlock = node.type.name === "mathBlock";
  const latex = String(node.attrs.latex ?? "");
  const isEditable = editor?.isEditable ?? true;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(latex);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoOpenedRef = useRef(false);
  const saveRef = useRef<() => void>(() => {});
  const cancelRef = useRef<() => void>(() => {});

  const html = useMemo(() => renderMathHtml(latex, isBlock), [latex, isBlock]);
  const previewHtml = useMemo(() => renderMathHtml(draft, isBlock), [draft, isBlock]);

  const save = () => {
    const next = draft.trim();
    if (!next) {
      setOpen(false);
      if (isEditable) deleteNode?.();
      return;
    }
    updateAttributes({ latex: next });
    setOpen(false);
  };

  const cancel = () => {
    setOpen(false);
    // 新建后未填写内容的公式没有保留价值，取消即删除
    if (!latex && isEditable) deleteNode?.();
  };

  saveRef.current = save;
  cancelRef.current = cancel;

  // 斜杠命令插入空公式后自动进入编辑
  useEffect(() => {
    if (!isEditable || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    if (!latex) setOpen(true);
  }, [isEditable, latex]);

  useEffect(() => {
    if (!open) return;
    setDraft(latex);
    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRef.current();
      } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, latex]);

  const openEditor = () => {
    if (isEditable) setOpen(true);
  };

  return (
    <>
      <NodeViewWrapper
        as={isBlock ? "div" : "span"}
        className={`math-node ${isBlock ? "math-node--block" : "math-node--inline"}${
          selected ? " is-selected" : ""
        }`}
        contentEditable={false}
        onMouseDown={(event: ReactMouseEvent) => {
          if (isEditable) event.preventDefault();
        }}
        onClick={(event: ReactMouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          openEditor();
        }}
      >
        {latex ? (
          <span className="math-render" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span className="math-placeholder">{t("editor.math.empty")}</span>
        )}
      </NodeViewWrapper>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm select-none"
            onClick={cancel}
            onMouseDown={(event) => event.preventDefault()}
          >
            <div
              className="w-full max-w-lg mx-4 rounded-xl border border-default-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 text-sm font-medium text-default-800 dark:text-zinc-100">
                {t(isBlock ? "editor.math.blockTitle" : "editor.math.inlineTitle")}
              </div>

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={isBlock ? 5 : 2}
                spellCheck={false}
                placeholder={t("editor.math.placeholder")}
                className="w-full resize-y rounded-lg border border-default-200 dark:border-zinc-700 bg-default-50 dark:bg-zinc-900 px-3 py-2 font-mono text-sm text-default-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-qingwu-500/40"
              />

              <div className="math-dialog-preview">
                {draft.trim() ? (
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                ) : (
                  <span className="math-placeholder">{t("editor.math.emptyPreview")}</span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[11px] text-default-400 dark:text-zinc-500">
                  {t("editor.math.hint")}
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs rounded-lg border border-default-200 dark:border-zinc-600 hover:bg-default-100 dark:hover:bg-zinc-700 transition-colors"
                    onClick={cancel}
                  >
                    {t("editor.math.cancel")}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs rounded-lg bg-qingwu-600 hover:bg-qingwu-700 text-white transition-colors"
                    onClick={save}
                  >
                    {t("editor.math.save")}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
