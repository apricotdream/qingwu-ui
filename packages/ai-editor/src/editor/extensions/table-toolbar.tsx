import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isDeleteConfirmActive, setDeleteConfirmActive } from "../utils/delete-confirm";
import { DeleteConfirmDialog } from "../utils/delete-confirm-dialog";

interface TableToolbarProps {
  editor: Editor;
}

function findTable(editor: Editor): { node: PmNode; pos: number } | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "table") {
      return { node, pos: $from.before(d) };
    }
  }
  return null;
}

function tableToRows(node: PmNode): string[][] {
  const rows: string[][] = [];
  node.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => {
      cells.push(cell.textContent.replace(/\n/g, " ").trim());
    });
    rows.push(cells);
  });
  return rows;
}

function rowsToMarkdown(rows: string[][]): string {
  if (rows.length === 0) return "";
  const cols = Math.max(...rows.map((r) => r.length), 1);
  const pad = (r: string[]) =>
    r.concat(Array(Math.max(0, cols - r.length)).fill("")).slice(0, cols);
  const header = pad(rows[0]);
  const body = rows.slice(1).map(pad);
  const line = (r: string[]) => `| ${r.join(" | ")} |`;
  return [line(header), line(Array(cols).fill("---")), ...body.map(line)].join("\n");
}

function rowsToCsv(rows: string[][]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function parseTable(text: string): string[][] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const lines = trimmed.split(/\r?\n/);
  if (lines.length >= 2 && lines.every((l) => l.includes("|"))) {
    const rows = lines
      .filter((l) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(l))
      .map((l) =>
        l
          .replace(/^\s*\|/, "")
          .replace(/\|\s*$/, "")
          .split("|")
          .map((c) => c.trim()),
      );
    if (rows.length > 0 && rows[0].length > 1) return rows;
  }
  if (lines.length >= 1) {
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const rows = lines.map((l) => l.split(sep).map((c) => c.trim()));
    if (rows.length > 0 && rows[0].length > 1) return rows;
  }
  return null;
}

export function TableToolbar({ editor }: TableToolbarProps) {
  // pos only changes when entering/leaving a table (drives mount/unmount).
  const [pos, setPos] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const isEditable = editor.isEditable;

  // Reposition via direct DOM mutation + rAF; never triggers React re-render.
  const reposition = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = barRef.current;
      if (el == null || pos == null) return;
      const dom = editor.view.nodeDOM(pos);
      if (!(dom instanceof HTMLElement)) return;
      const r = dom.getBoundingClientRect();
      const top = r.top > 40 ? r.top - 34 : Math.min(r.bottom + 4, window.innerHeight - 40);
      el.style.top = `${top}px`;
      el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 160))}px`;
    });
  }, [editor, pos]);

  // Only re-evaluate target table on selection/focus change, NOT every transaction.
  const updateTarget = useCallback(() => {
    if (!editor.isEditable || !editor.isActive("table")) {
      setPos(null);
      return;
    }
    const found = findTable(editor);
    if (!found) {
      setPos(null);
      return;
    }
    setPos((prev) => (prev === found.pos ? prev : found.pos));
  }, [editor]);

  useEffect(() => {
    updateTarget();
    editor.on("selectionUpdate", updateTarget);
    editor.on("focus", updateTarget);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      editor.off("selectionUpdate", updateTarget);
      editor.off("focus", updateTarget);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [editor, updateTarget, reposition]);

  // Reposition immediately after target table changes.
  useEffect(() => {
    reposition();
  }, [pos, reposition]);

  const buildTableNode = (rows: string[][]): PmNode | null => {
    const { schema } = editor.state;
    if (
      !schema.nodes.table ||
      !schema.nodes.tableRow ||
      !schema.nodes.tableCell ||
      !schema.nodes.tableHeader
    )
      return null;
    const colCount = Math.max(...rows.map((r) => r.length));
    const rowNodes = rows.map((row, ri) => {
      const cells: PmNode[] = [];
      for (let c = 0; c < colCount; c++) {
        const text = row[c] ?? "";
        const cellType = ri === 0 ? schema.nodes.tableHeader : schema.nodes.tableCell;
        const content = text ? schema.text(text) : null;
        cells.push(cellType.create(null, content ? [content] : []));
      }
      return schema.nodes.tableRow.create(null, cells);
    });
    return schema.nodes.table.create(null, rowNodes);
  };

  const copyTable = () => {
    const found = findTable(editor);
    if (!found) return;
    const md = rowsToMarkdown(tableToRows(found.node));
    navigator.clipboard?.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadTable = () => {
    const found = findTable(editor);
    if (!found) return;
    const csv = rowsToCsv(tableToRows(found.node));
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "table.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const pasteTable = async () => {
    if (!isEditable) return;
    try {
      const text = await navigator.clipboard?.readText();
      if (!text) return;
      const rows = parseTable(text);
      if (!rows || rows.length === 0) return;
      const node = buildTableNode(rows);
      if (!node) return;
      // Re-find table: user may have moved caret during async clipboard read.
      const found = findTable(editor);
      const chain = editor.chain().focus();
      if (found) {
        const endPos = Math.min(found.pos + found.node.nodeSize, editor.state.doc.content.size);
        chain.setTextSelection(endPos);
      }
      chain.insertContent(node).run();
    } catch {
      /* clipboard unavailable */
    }
  };

  const triggerAI = () => {
    if (!isEditable) return;
    if (pos == null) return;
    editor.chain().focus().setNodeSelection(pos).run();
    const storage = (editor.storage as any).qingwuUI as { openAI?: () => void } | undefined;
    storage?.openAI?.();
  };

  const deleteTable = () => {
    if (!isEditable) return;
    editor.chain().focus().deleteTable().run();
  };

  if (!isEditable) return null;
  if (pos == null) return null;

  // zIndex 100000: above web-fullscreen (99999) and delete-confirm (10001).
  const style: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 100000,
  };

  return (
    <div ref={barRef} style={style} className="tbl-toolbar" contentEditable={false}>
      <button type="button" className="tbl-btn" onClick={copyTable} title="复制">
        {copied ? (
          <svg
            className="tbl-btn-icon tbl-btn-icon--check"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg
            className="tbl-btn-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3"
            />
          </svg>
        )}
      </button>
      <button type="button" className="tbl-btn" onClick={downloadTable} title="下载">
        <svg
          className="tbl-btn-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </button>
      <button type="button" className="tbl-btn" onClick={pasteTable} title="粘贴">
        <svg
          className="tbl-btn-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      </button>
      <button type="button" className="tbl-btn tbl-btn--ai" onClick={triggerAI} title="AI 助手">
        <svg
          className="tbl-btn-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </button>
      <button
        type="button"
        className="tbl-btn tbl-btn--del"
        onClick={() => {
          if (!isEditable || isDeleteConfirmActive()) return;
          setDeleteConfirmActive(true);
          setShowDeleteConfirm(true);
        }}
        title="删除"
      >
        <svg
          className="tbl-btn-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        title="确认删除表格"
        message="此操作不可撤销。"
        onCancel={() => {
          setDeleteConfirmActive(false);
          setShowDeleteConfirm(false);
        }}
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 300));
          setDeleteConfirmActive(false);
          deleteTable();
        }}
      />
    </div>
  );
}
