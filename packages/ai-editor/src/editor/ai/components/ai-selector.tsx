import type { Editor } from "@tiptap/core";
import { type Fragment, Slice } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { t } from "../../i18n";
import { CloseIcon, SparklesIcon } from "../../icons";
import { type AIMode, getAIProvider } from "../index";
import { scheduleOrphanRemoval } from "../pending-removal";

interface AISelectorProps {
  editor: Editor;
  onClose: () => void;
}

const AI_MODES: Array<{
  mode: AIMode;
  labelKey: string;
  descKey: string;
  icon: string;
}> = [
  {
    mode: "continue",
    labelKey: "editor.ai.continue",
    descKey: "editor.ai.continueDesc",
    icon: "→",
  },
  { mode: "improve", labelKey: "editor.ai.improve", descKey: "editor.ai.improveDesc", icon: "✨" },
  { mode: "shorter", labelKey: "editor.ai.shorter", descKey: "editor.ai.shorterDesc", icon: "↓" },
  { mode: "longer", labelKey: "editor.ai.longer", descKey: "editor.ai.longerDesc", icon: "↑" },
  { mode: "fix", labelKey: "editor.ai.fix", descKey: "editor.ai.fixDesc", icon: "✓" },
  {
    mode: "translate",
    labelKey: "editor.ai.translate",
    descKey: "editor.ai.translateDesc",
    icon: "🌐",
  },
  { mode: "zap", labelKey: "editor.ai.zap", descKey: "editor.ai.zapDesc", icon: "⚡" },
];

/** 媒体节点类型：其 attrs.src 是需要对比/删除的资源 */
const MEDIA_NODE_NAMES = new Set(["image", "attachmentEmbed", "audioEmbed", "videoEmbed"]);

/** 媒体节点类型 → i18n key（确认弹窗列表用） */
const NODE_LABEL_KEYS: Record<string, string> = {
  image: "editor.ai.nodeImage",
  attachmentEmbed: "editor.ai.nodeAttachment",
  videoEmbed: "editor.ai.nodeVideo",
  audioEmbed: "editor.ai.nodeAudio",
};

interface MediaRef {
  type: string;
  src: string;
}

type SelectionRange = { from: number; to: number; empty: boolean };

function parseMarkdownFragment(editor: Editor, text: string) {
  // 通过 (editor.storage as any).qingwuUI 调用注册的 markdown 解析器（多实例安全）
  const storage = (editor.storage as any).qingwuUI as
    | { parseMd?: (schema: unknown, text: string) => unknown }
    | undefined;
  return storage?.parseMd?.(editor.schema, text) || null;
}

/** 收集 [from, to) 范围内的媒体节点（含 src） */
function collectRangeMedia(editor: Editor, from: number, to: number): MediaRef[] {
  const list: MediaRef[] = [];
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (MEDIA_NODE_NAMES.has(node.type.name)) {
      const src = (node.attrs as { src?: string | null }).src;
      if (src) list.push({ type: node.type.name, src });
    }
    return true;
  });
  return list;
}

/** 收集整篇文档的媒体 src 集合 */
function collectDocMediaSet(editor: Editor): Set<string> {
  const urls = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (MEDIA_NODE_NAMES.has(node.type.name)) {
      const src = (node.attrs as { src?: string | null }).src;
      if (src) urls.add(src);
    }
    return true;
  });
  return urls;
}

/** 全文替换：单个 transaction 替换整篇 → 单步 undo */
function replaceAllContent(editor: Editor, text: string) {
  const fragment = parseMarkdownFragment(editor, text) as Fragment | null;
  if (fragment && fragment.size > 0) {
    const tr = editor.state.tr;
    tr.replaceWith(0, editor.state.doc.content.size, fragment);
    tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size));
    editor.view.dispatch(tr.scrollIntoView());
    editor.commands.focus();
    return;
  }
  // 纯文本/空结果兜底：setContent 自动包段落，且为单个 undo 步骤
  editor.commands.setContent(text);
  editor.commands.focus();
}

function insertAIContent(
  editor: Editor,
  text: string,
  position: "replace" | "below",
  range: SelectionRange,
) {
  const fragment = parseMarkdownFragment(editor, text);

  editor.commands.focus();
  if (!fragment) {
    const chain = editor.chain().focus();
    if (position === "replace") {
      chain
        .setTextSelection({ from: range.from, to: range.to })
        .deleteSelection()
        .insertContent(text)
        .run();
    } else {
      chain.insertContentAt(range.to, text).run();
    }
    return;
  }

  const tr = editor.state.tr;
  if (position === "replace") {
    tr.replaceRange(range.from, range.to, new Slice(fragment as any, 0, 0));
  } else {
    tr.insert(Math.min(range.to, editor.state.doc.content.size), fragment as any);
  }
  editor.view.dispatch(tr.scrollIntoView());
}

export function AISelector({ editor, onClose }: AISelectorProps) {
  const [selectedMode, setSelectedMode] = useState<AIMode | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 全文替换 / 选区替换前，若会移除媒体节点则弹确认（列出类型×数量） */
  const [confirmState, setConfirmState] = useState<{
    position: "replace" | "replaceAll";
    willRemove: MediaRef[];
  } | null>(null);
  /** AI 执行那一刻的选区快照：插入范围与按钮显隐都基于它，流式期间改选区不影响结果 */
  const selectionRef = useRef<SelectionRange>({ from: 0, to: 0, empty: true });
  const inputRef = useRef<HTMLInputElement>(null);
  /** 流式文本区 ref + 自动滚底跟随标志：生成中最新内容始终可见 */
  const streamingBoxRef = useRef<HTMLDivElement>(null);
  const followStreamRef = useRef(true);

  const handleModeSelect = useCallback(
    async (mode: AIMode) => {
      setSelectedMode(mode);
      setError(null);

      if (mode !== "zap") {
        await executeAI(mode);
        return;
      }

      // zap 模式需要先输入自定义指令
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor],
  );

  const executeAI = useCallback(
    async (mode: AIMode) => {
      // 快照选区：无选区时 AI context 为全文、插入走「全文替换/插入到下方」；
      // 有选区时 context 为选区文本、插入走「替换/插入到下方」
      const sel = editor.state.selection;
      selectionRef.current = { from: sel.from, to: sel.to, empty: sel.empty };
      setIsLoading(true);
      setStreamingText("");
      // 新一轮生成：恢复自动滚底跟随（上一轮若用户上滚已暂停）
      followStreamRef.current = true;
      setError(null);

      try {
        const provider = getAIProvider();
        const selectedText = sel.empty
          ? editor.state.doc.textContent
          : editor.state.doc.textBetween(sel.from, sel.to);

        const chunks: string[] = [];
        for await (const chunk of provider.stream({
          mode,
          context: selectedText,
          instruction: mode === "zap" ? customInstruction : undefined,
        })) {
          chunks.push(chunk);
          setStreamingText(chunks.join(""));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("editor.ai.error"));
      } finally {
        setIsLoading(false);
      }
    },
    [editor, customInstruction],
  );

  // 流式自动滚底跟随：文本增长时滚到底（最新内容始终可见）；
  // 用户主动上滚即暂停跟随，滚回底部恢复。
  // 监听挂载以 streamingText 是否出现为依赖：文本区是条件渲染，挂载后再绑定。
  useEffect(() => {
    const el = streamingBoxRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      followStreamRef.current = nearBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [Boolean(streamingText)]);

  // 生成中每段文本落到 DOM 前滚到底，避免「最新一行在折叠线下」的闪烁
  useLayoutEffect(() => {
    const el = streamingBoxRef.current;
    if (!el || !followStreamRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [streamingText]);

  /** 执行替换并清理孤儿资源：旧媒体 − 新媒体 → 延迟删（undo 窗口内可救回） */
  const applyAIResult = useCallback(
    (position: "replace" | "replaceAll", text: string, range: { from: number; to: number }) => {
      const oldUrls = new Set(collectRangeMedia(editor, range.from, range.to).map((m) => m.src));
      if (position === "replaceAll") {
        replaceAllContent(editor, text);
      } else {
        insertAIContent(editor, text, "replace", selectionRef.current);
      }
      const newUrls = collectDocMediaSet(editor);
      const orphans = [...oldUrls].filter((url) => !newUrls.has(url));
      scheduleOrphanRemoval(editor, orphans);
    },
    [editor],
  );

  const handleInsert = useCallback(
    (position: "replace" | "replaceAll" | "below") => {
      if (position === "below") {
        insertAIContent(editor, streamingText, "below", selectionRef.current);
        onClose();
        return;
      }
      const sel = selectionRef.current;
      const range =
        position === "replaceAll"
          ? { from: 0, to: editor.state.doc.content.size }
          : { from: sel.from, to: sel.to };
      const willRemove = collectRangeMedia(editor, range.from, range.to);
      // 有媒体节点将被移除 → 先确认；无媒体直接替换
      if (willRemove.length > 0) {
        setConfirmState({ position, willRemove });
        return;
      }
      applyAIResult(position, streamingText, range);
      onClose();
    },
    [editor, streamingText, applyAIResult, onClose],
  );

  const confirmReplace = useCallback(() => {
    if (!confirmState) return;
    const { position } = confirmState;
    const range =
      position === "replaceAll"
        ? { from: 0, to: editor.state.doc.content.size }
        : { from: selectionRef.current.from, to: selectionRef.current.to };
    applyAIResult(position, streamingText, range);
    setConfirmState(null);
    onClose();
  }, [confirmState, editor, streamingText, applyAIResult, onClose]);

  const handleDiscard = useCallback(() => {
    setStreamingText("");
    setSelectedMode(null);
    setError(null);
  }, []);

  /* 确认弹窗里的「将移除节点」按类型统计 */
  const willRemoveCounts: Record<string, number> = {};
  for (const m of confirmState?.willRemove ?? []) {
    willRemoveCounts[m.type] = (willRemoveCounts[m.type] ?? 0) + 1;
  }

  return (
    <>
      <div className="ai-selector w-full flex-1 min-h-0 flex flex-col">
        {/* 头部：标题 + 关闭 */}
        <div className="flex items-center justify-between pl-3 pr-1.5 py-1.5 border-b border-default-100 shrink-0">
          <span className="flex items-center gap-1.5 text-xs font-medium text-default-500">
            <SparklesIcon className="text-primary" />
            {t("editor.ai.trigger")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("editor.ai.close")}
            title={t("editor.ai.close")}
            className="flex items-center justify-center w-6 h-6 rounded-md text-default-400 hover:bg-default-100 hover:text-default-700 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* 模式自适应胶囊：窄面板 4 列，宽面板（宽度随编辑器）自动排满单行 */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5 p-2 shrink-0">
          {AI_MODES.map(({ mode, labelKey, descKey, icon }) => (
            <button
              key={mode}
              type="button"
              className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl border transition-colors ${
                selectedMode === mode
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-default-200 text-default-600 hover:bg-default-100 hover:text-default-900"
              }`}
              onClick={() => handleModeSelect(mode)}
              title={t(descKey)}
            >
              <span className="text-base leading-none">{icon}</span>
              <span className="text-[11px] leading-none truncate">{t(labelKey)}</span>
            </button>
          ))}
        </div>

        {/* 状态区：flex 列，流式文本区可伸缩滚动，操作按钮常驻底部 */}
        <div className="px-3 pb-3 flex-1 min-h-0 flex flex-col">
          {!selectedMode && (
            <p className="text-[11px] text-default-400 leading-relaxed">
              {t("editor.ai.triggerDesc")}
            </p>
          )}

          {selectedMode === "zap" && !isLoading && !streamingText && !error && (
            <div>
              <input
                ref={inputRef}
                className="w-full px-3 py-2 text-sm border border-default-200 rounded-lg focus:outline-none focus:border-primary bg-background"
                placeholder={t("editor.ai.customPlaceholder")}
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customInstruction.trim()) {
                    executeAI("zap");
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg disabled:opacity-50"
                  disabled={!customInstruction.trim()}
                  onClick={() => executeAI("zap")}
                >
                  {t("editor.ai.confirm")}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs border border-default-200 rounded-lg hover:bg-default-100"
                  onClick={() => setSelectedMode(null)}
                >
                  {t("editor.ai.back")}
                </button>
              </div>
            </div>
          )}

          {(isLoading || streamingText || error) && (
            <div className="flex-1 min-h-0 flex flex-col">
              {isLoading && !streamingText && (
                <div className="flex items-center gap-2 text-sm text-default-500">
                  <span className="animate-spin">⏳</span>
                  {t("editor.ai.thinking")}
                </div>
              )}

              {streamingText && (
                <>
                  {/* 流式文本区：面板被 max-height 钳制时收缩并滚动；ref 供自动滚底跟随 */}
                  <div
                    ref={streamingBoxRef}
                    className="flex-1 min-h-0 overflow-y-auto text-sm whitespace-pre-wrap text-default-700 mb-3"
                  >
                    {streamingText}
                    {isLoading && <span className="animate-pulse">▊</span>}
                  </div>
                  {!isLoading && (
                    <div className="flex gap-2 shrink-0">
                      {selectionRef.current.empty ? (
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg"
                          onClick={() => handleInsert("replaceAll")}
                        >
                          {t("editor.ai.replaceAll")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg"
                          onClick={() => handleInsert("replace")}
                        >
                          {t("editor.ai.replace")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs border border-default-200 rounded-lg hover:bg-default-100"
                        onClick={() => handleInsert("below")}
                      >
                        {t("editor.ai.insert")}
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs text-danger"
                        onClick={handleDiscard}
                      >
                        {t("editor.ai.discard")}
                      </button>
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="text-sm text-danger">
                  <p>{error}</p>
                  <button
                    type="button"
                    className="mt-2 px-3 py-1 text-xs border border-default-200 rounded-lg hover:bg-default-100"
                    onClick={() => {
                      setError(null);
                      setSelectedMode(null);
                    }}
                  >
                    {t("editor.ai.back")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 替换确认弹窗：列出将移除的媒体节点类型×数量 */}
      {confirmState && (
        <div className="qed-root" style={{ zIndex: 10000 }} onClick={() => setConfirmState(null)}>
          <div className="qed-backdrop" onClick={() => setConfirmState(null)} />
          <div className="qed-card animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="qed-header">
              <h2 className="qed-title">
                {confirmState.position === "replaceAll"
                  ? t("editor.ai.replaceAllTitle")
                  : t("editor.ai.replaceTitle")}
              </h2>
              <button
                type="button"
                className="qed-close"
                onClick={() => setConfirmState(null)}
                aria-label={t("editor.ai.close")}
              >
                ✕
              </button>
            </div>
            <div className="qed-body">
              <p className="mb-2">
                {confirmState.position === "replaceAll"
                  ? t("editor.ai.replaceAllText")
                  : t("editor.ai.replaceText")}
              </p>
              {Object.keys(willRemoveCounts).length > 0 && (
                <>
                  <p className="text-xs text-default-500">{t("editor.ai.removeNodes")}</p>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(willRemoveCounts).map(([type, count]) => (
                      <li key={type} className="text-sm text-default-700">
                        {t(NODE_LABEL_KEYS[type] ?? type)} ×{count}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div
              className="qed-footer"
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                type="button"
                className="qed-btn qed-btn--ghost"
                onClick={() => setConfirmState(null)}
              >
                {t("editor.ai.cancel")}
              </button>
              <button type="button" className="qed-btn qed-btn--primary" onClick={confirmReplace}>
                {t("editor.ai.confirmReplace")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
