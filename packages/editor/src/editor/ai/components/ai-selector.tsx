import type { Editor } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import { useCallback, useRef, useState } from "react";
import { t } from "../../i18n";
import { type AIMode, getAIProvider } from "../index";

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

function parseMarkdownFragment(editor: Editor, text: string) {
  // 通过 (editor.storage as any).qingwuUI 调用注册的 markdown 解析器（多实例安全）
  const storage = (editor.storage as any).qingwuUI as
    | { parseMd?: (schema: unknown, text: string) => unknown }
    | undefined;
  return storage?.parseMd?.(editor.schema, text) || null;
}

function insertAIContent(editor: Editor, text: string, position: "replace" | "below") {
  const { from, to } = editor.state.selection;
  const fragment = parseMarkdownFragment(editor, text);

  editor.commands.focus();
  if (!fragment) {
    const chain = editor.chain().focus();
    if (position === "replace") {
      chain.setTextSelection({ from, to }).deleteSelection().insertContent(text).run();
    } else {
      chain.insertContentAt(to, text).run();
    }
    return;
  }

  const tr = editor.state.tr;
  if (position === "replace") {
    tr.replaceRange(from, to, new Slice(fragment as any, 0, 0));
  } else {
    tr.insert(Math.min(to, editor.state.doc.content.size), fragment as any);
  }
  editor.view.dispatch(tr.scrollIntoView());
}

export function AISelector({ editor, onClose }: AISelectorProps) {
  const [selectedMode, setSelectedMode] = useState<AIMode | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setIsLoading(true);
      setStreamingText("");
      setError(null);

      try {
        const provider = getAIProvider();
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.selection.empty
          ? editor.state.doc.textContent
          : editor.state.doc.textBetween(from, to);

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

  const handleInsert = useCallback(
    (position: "replace" | "below") => {
      insertAIContent(editor, streamingText, position);
      onClose();
    },
    [editor, streamingText, onClose],
  );

  const handleDiscard = useCallback(() => {
    setStreamingText("");
    setSelectedMode(null);
    setError(null);
  }, []);

  // 显示模式选择
  if (!selectedMode) {
    return (
      <div className="ai-selector p-2 w-64">
        <div className="text-xs text-default-500 mb-2 px-2">{t("editor.ai.trigger")}</div>
        {AI_MODES.map(({ mode, labelKey, descKey, icon }) => (
          <button
            key={mode}
            type="button"
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-default-100 transition-colors text-left"
            onClick={() => handleModeSelect(mode)}
          >
            <span className="text-lg w-6 text-center shrink-0">{icon}</span>
            <div className="min-w-0">
              <div className="text-sm font-medium">{t(labelKey)}</div>
              <div className="text-xs text-default-400 truncate">{t(descKey)}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // 显示 zap 自定义指令输入
  if (selectedMode === "zap" && !isLoading && !streamingText && !error) {
    return (
      <div className="ai-selector p-3 w-72">
        <div className="text-xs text-default-500 mb-2">{t("editor.ai.zapDesc")}</div>
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
    );
  }

  // 加载或流式输出或错误
  return (
    <div className="ai-selector p-3 w-72 max-h-80 overflow-y-auto">
      {isLoading && !streamingText && (
        <div className="flex items-center gap-2 text-sm text-default-500">
          <span className="animate-spin">⏳</span>
          {t("editor.ai.thinking")}
        </div>
      )}

      {streamingText && (
        <>
          <div className="text-sm whitespace-pre-wrap text-default-700 mb-3 max-h-48 overflow-y-auto">
            {streamingText}
            {isLoading && <span className="animate-pulse">▊</span>}
          </div>
          {!isLoading && (
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg"
                onClick={() => handleInsert("replace")}
              >
                {t("editor.ai.replace")}
              </button>
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
  );
}
