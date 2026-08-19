/** 扩展侧边栏：剪藏主界面，含草稿编辑、历史管理、推送与下载。 */
import { toast } from "@qingwu-ui/toast";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setLocale, t } from "../shared/i18n";
import { send } from "../shared/messaging";
import { getSettingsWithRetry } from "../shared/settings-client";
import { renderTemplate } from "../shared/templates/engine";
import type { ClipperSettings, ClipRecord, ExtractedContent, Locale } from "../shared/types";
import {
  Badge,
  Button,
  Field,
  Icon,
  Input,
  Modal,
  QingWuLogo,
  Switch,
  Textarea,
  ThemeProvider,
  useTheme,
} from "../shared/ui";

type Tab = "clip" | "history" | "settings";

export function App() {
  const [settings, setSettings] = useState<ClipperSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const s = await getSettingsWithRetry();
        setSettings(s);
        setLocale(s.locale);
      } catch (e) {
        setLoadError((e as Error).message);
      }
    })();
  }, []);

  if (loadError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-ink-500">
        <div>扩展后台未响应：{loadError}</div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 rounded-lg bg-qingwu-600 text-white"
        >
          重新加载
        </button>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-ink-500">加载中…</div>
    );
  }

  return (
    <ThemeProvider
      initialMode={settings.theme}
      initialAccent={settings.accent}
      onModeChange={(mode) => void persistSettings({ ...settings, theme: mode }, setSettings)}
      onAccentChange={(accent) => void persistSettings({ ...settings, accent }, setSettings)}
    >
      <Inner settings={settings} setSettings={setSettings} />
    </ThemeProvider>
  );
}

async function persistSettings(s: ClipperSettings, setter: (s: ClipperSettings) => void) {
  setter(s);
  await send("settings:set", s);
}

function Inner({
  settings,
  setSettings,
}: {
  settings: ClipperSettings;
  setSettings: (s: ClipperSettings) => void;
}) {
  const [tab, setTab] = useState<Tab>("clip");
  const [draft, setDraft] = useState<ClipDraft | null>(null);
  const [activeRecord, setActiveRecord] = useState<ClipRecord | null>(null);
  const [extracting, setExtracting] = useState(false);
  const applyPendingDraft = useCallback(
    (content: ExtractedContent) => {
      setTab("clip");
      setDraft(createClipDraft(content, settings));
    },
    [settings],
  );

  // 监听 background 的快捷提取请求
  useEffect(() => {
    const listener = async (msg: unknown) => {
      if (typeof msg !== "object" || msg === null) return;
      const m = msg as { kind: string; payload?: unknown };
      if (m.kind === "clip:extract") {
        await runExtract(
          m.payload as { mode: "page" | "selection" | "bookmark"; selection?: string },
        );
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [settings]);

  // 恢复悬浮球暂存的 pendingDraft
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!settings) return;

    const consumePendingDraft = async (content: ExtractedContent) => {
      applyPendingDraft(content);
      await chrome.storage.local.remove("pendingDraft");
    };

    if (!restoredRef.current) {
      restoredRef.current = true;
      void (async () => {
        try {
          const { pendingDraft } = await chrome.storage.local.get<{
            pendingDraft?: { content: ExtractedContent; savedAt: number };
          }>("pendingDraft");
          if (pendingDraft?.content) {
            await consumePendingDraft(pendingDraft.content);
          }
        } catch {
          /* ignore */
        }
      })();
    }

    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== "local") return;
      const pendingDraft = changes.pendingDraft?.newValue as
        | { content?: ExtractedContent }
        | undefined;
      if (pendingDraft?.content) {
        void consumePendingDraft(pendingDraft.content).catch(() => {});
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [settings, applyPendingDraft]);

  const runExtract = useCallback(
    async (
      payload: { mode: "page" | "selection" | "bookmark"; selection?: string },
      activeSettings = settings,
    ) => {
      if (!activeSettings) return;
      setExtracting(true);
      setTab("clip");
      try {
        let p = payload;
        if (payload.mode === "selection" && !payload.selection) {
          // 从当前 tab 取选区
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            const r = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                const sel = window.getSelection();
                const text = sel?.toString() ?? "";
                let html = text;
                try {
                  const range = sel?.getRangeAt(0);
                  if (range) {
                    const div = document.createElement("div");
                    div.appendChild(range.cloneContents());
                    html = div.innerHTML;
                  }
                } catch {}
                return { text, html, hasSelection: text.length > 0 };
              },
            });
            const sel = r?.[0]?.result as
              | { text: string; html: string; hasSelection: boolean }
              | undefined;
            if (!sel?.hasSelection) {
              toast.warn("未选中文本", { description: "请先在页面上选中要剪藏的文本" });
              setExtracting(false);
              return;
            }
            p = { mode: "selection", selection: sel.html };
          }
        }
        const content = await send<ExtractedContent>("clip:extract", p);
        setDraft(createClipDraft(content, activeSettings));
        // 消费 pendingDraft（实时提取覆盖暂存）
        try {
          await chrome.storage.local.remove("pendingDraft");
        } catch {}
        if (content.warnings.length > 0) {
          toast.warn(content.warnings[0], { duration: 6000 });
        }
        // 自动 AI
        if (activeSettings.ai && (activeSettings.autoSummary || activeSettings.autoTags)) {
          void runAutoAI(content, activeSettings);
        }
      } catch (e) {
        const err = e as Error;
        toast.error(t("toast.clip.failed"), { description: err.message, duration: 8000 });
      } finally {
        setExtracting(false);
      }
    },
    [settings],
  );

  async function refreshPanel() {
    const latestSettings = await getSettingsWithRetry();
    setSettings(latestSettings);
    setLocale(latestSettings.locale);
    if (draft) {
      await runExtract({ mode: draft.content.selection ? "selection" : "page" }, latestSettings);
    }
  }

  async function runAutoAI(content: ExtractedContent, activeSettings = settings) {
    if (!activeSettings?.ai) return;
    if (activeSettings.autoSummary) {
      void send<{ ok: boolean; data?: unknown; error?: { message: string } }>("ai:run", {
        request: {
          mode: "summary",
          text: content.contentText,
          targetLang: activeSettings.locale,
          maxTokens: 300,
        },
      })
        .then((r: any) => {
          if (r?.ok && r.data) {
            setDraft((d) => (d ? { ...d, aiSummary: String(r.data) } : d));
          }
        })
        .catch((e: Error) => toast.warn(t("toast.ai.unknown"), { description: e.message }));
    }
    if (activeSettings.autoTags) {
      void send<{ ok: boolean; data?: unknown }>("ai:run", {
        request: { mode: "tags", text: content.contentText.slice(0, 4000) },
      })
        .then((r: any) => {
          if (r?.ok && Array.isArray(r.data)) {
            setDraft((d) => (d ? { ...d, aiTags: r.data as string[] } : d));
          }
        })
        .catch(() => {});
    }
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-ink-950">
      <SidePanelHeader
        tab={tab}
        onTab={setTab}
        onRefresh={() => void refreshPanel()}
        onExtract={(m) => void runExtract({ mode: m })}
      />
      <div className="flex-1 overflow-y-auto">
        {tab === "clip" && (
          <ClipTab
            draft={draft}
            setDraft={setDraft}
            settings={settings}
            extracting={extracting}
            onSaved={(rec) => {
              setActiveRecord(rec);
              setTab("history");
            }}
          />
        )}
        {tab === "history" && (
          <HistoryTab
            activeId={activeRecord?.id}
            onOpen={(r) => {
              setDraft({
                content: r.content,
                noteTitle: r.noteTitle,
                notePath: r.notePath,
                tags: r.tags,
                templateId: r.templateId,
                aiSummary: r.aiSummary ?? "",
                aiTags: r.aiTags ?? [],
                aiTranslation: r.aiTranslation ?? null,
                autoSummaryRan: true,
              });
              setTab("clip");
            }}
          />
        )}
        {tab === "settings" && (
          <SettingsTab
            settings={settings}
            onChange={(s) => {
              setSettings(s);
              void persistSettings(s, () => {});
            }}
            onOpenOptions={() => chrome.runtime.openOptionsPage()}
          />
        )}
      </div>
    </div>
  );
}

interface ClipDraft {
  content: ExtractedContent;
  noteTitle: string;
  notePath: string;
  tags: string[];
  templateId: string;
  aiSummary: string;
  aiTags: string[];
  aiTranslation: { lang: Locale; text: string } | null;
  autoSummaryRan: boolean;
}

function createClipDraft(content: ExtractedContent, settings: ClipperSettings): ClipDraft {
  const now = new Date();
  const notePath = (settings.recentPaths[0] ?? "Clippings/{{YYYY}}/{{MM}}")
    .replace(/{{YYYY}}/g, String(now.getFullYear()))
    .replace(/{{MM}}/g, String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/{{DD}}/g, String(now.getDate()).padStart(2, "0"));

  return {
    content,
    noteTitle: content.title,
    notePath,
    tags: [],
    templateId: settings.defaultTemplateId,
    aiSummary: "",
    aiTags: [],
    aiTranslation: null,
    autoSummaryRan: false,
  };
}

function SidePanelHeader({
  tab,
  onTab,
  onRefresh,
  onExtract,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  onRefresh: () => void;
  onExtract: (m: "page" | "selection" | "bookmark") => void;
}) {
  const { resolved, setMode } = useTheme();
  return (
    <div className="border-b border-ink-200 dark:border-ink-800 bg-white/80 dark:bg-ink-950/80 backdrop-blur sticky top-0 z-10">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <QingWuLogo size={22} />
          <span className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            {t("app.name")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            className="h-7 w-7 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-600 dark:text-ink-300"
            title={t("action.refresh")}
          >
            <Icon name="refresh" size={14} />
          </button>
          <button
            type="button"
            onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
            className="h-7 w-7 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-600 dark:text-ink-300"
          >
            <Icon name={resolved === "dark" ? "sun" : "moon"} size={14} />
          </button>
        </div>
      </div>
      <div className="flex px-3 gap-1 -mb-px">
        <TabButton active={tab === "clip"} onClick={() => onTab("clip")} icon="clip">
          {t("action.clip")}
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => onTab("history")} icon="history">
          {t("action.history")}
        </TabButton>
        <TabButton active={tab === "settings"} onClick={() => onTab("settings")} icon="settings">
          {t("action.openSettings")}
        </TabButton>
      </div>
      {/* 快速提取菜单 */}
      <div className="flex gap-1 px-3 py-1.5 border-t border-ink-100 dark:border-ink-900">
        <Button size="sm" variant="subtle" onClick={() => onExtract("page")}>
          <Icon name="clip" size={12} />
          {t("action.clipPage")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onExtract("selection")}>
          <Icon name="selection" size={12} />
          {t("action.clipSelection")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onExtract("bookmark")}>
          <Icon name="bookmark" size={12} />
          {t("action.clipBookmark")}
        </Button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: import("../shared/ui").IconName;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "text-qingwu-700 dark:text-qingwu-300"
          : "text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200"
      }`}
    >
      <Icon name={icon} size={13} />
      {children}
      {active && (
        <motion.div
          layoutId="tab-underline"
          className="absolute left-2 right-2 -bottom-px h-0.5 bg-qingwu-600 dark:bg-qingwu-400 rounded-full"
        />
      )}
    </button>
  );
}

// ===== Clip Tab =====

function ClipTab({
  draft,
  setDraft,
  settings,
  extracting,
  onSaved,
}: {
  draft: ClipDraft | null;
  setDraft: (d: ClipDraft | null) => void;
  settings: ClipperSettings;
  extracting: boolean;
  onSaved: (rec: ClipRecord) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const preview = useMemo(() => {
    if (!draft) return "";
    const tpl = settings.templates.find((x) => x.id === draft.templateId) ?? settings.templates[0];
    if (!tpl) return "";
    return renderTemplate(tpl, {
      content: draft.content,
      tags: draft.tags,
      aiSummary: draft.aiSummary,
      aiTags: draft.aiTags,
      extra: { aiTranslation: draft.aiTranslation?.text ?? "" },
    }).rendered;
  }, [draft, settings.templates]);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const r = await send<{ id: string; warnings: string[] }>("clip:save", {
        content: draft.content,
        noteTitle: draft.noteTitle,
        notePath: draft.notePath,
        tags: draft.tags,
        templateId: draft.templateId,
        aiSummary: draft.aiSummary || undefined,
        aiTags: draft.aiTags.length ? draft.aiTags : undefined,
        aiTranslation: draft.aiTranslation,
      });
      toast.success(t("toast.clip.saved"));
      // 加载刚保存的记录用于推/下载
      const rec = await send<ClipRecord>("clip:get", { id: r.id });
      onSaved(rec);
    } catch (e) {
      toast.error(t("toast.clip.failed"), {
        description: (e as Error).message,
        duration: 8000,
      });
    } finally {
      setSaving(false);
    }
  }

  if (extracting) {
    return <ExtractingSkeleton />;
  }

  if (!draft) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-qingwu-100 to-qingwu-200 dark:from-qingwu-900/40 dark:to-qingwu-800/40 flex items-center justify-center text-qingwu-600 dark:text-qingwu-300 mb-4">
          <Icon name="clip" size={28} />
        </div>
        <h2 className="text-base font-semibold text-ink-800 dark:text-ink-100 mb-1">
          准备好剪藏了吗？
        </h2>
        <p className="text-xs text-ink-500 dark:text-ink-400 max-w-[260px]">
          点击上方「剪藏当前页 / 选区 / 书签」开始，或使用快捷键 Alt+Shift+C
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* 标题 */}
      <Field label={t("label.title")}>
        <Input
          value={draft.noteTitle}
          onChange={(e) => setDraft({ ...draft, noteTitle: e.target.value })}
          placeholder={draft.content.title}
        />
      </Field>

      {/* 元信息卡片 */}
      <MetaCard content={draft.content} />

      {/* 路径 + 标签 */}
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("label.path")} hint={t("hint.pathAutocomplete")}>
          <PathInput
            value={draft.notePath}
            onChange={(v) => setDraft({ ...draft, notePath: v })}
            recent={settings.recentPaths}
          />
        </Field>
        <Field label={t("label.tags")} hint={t("hint.tagsAutocomplete")}>
          <TagsInput
            tags={draft.tags}
            onChange={(tags) => setDraft({ ...draft, tags })}
            recent={settings.recentTags}
            aiTags={draft.aiTags}
            onAcceptAi={() => {
              setDraft({
                ...draft,
                tags: [...new Set([...draft.tags, ...draft.aiTags])],
                aiTags: [],
              });
            }}
          />
        </Field>
      </div>

      {/* 模板 */}
      <Field label={t("label.template")}>
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm text-ink-900 dark:text-ink-100 focus:outline-none focus:border-qingwu-500"
            value={draft.templateId}
            onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}
          >
            {settings.templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="md" onClick={() => setShowPreview(true)}>
            <Icon name="eye" size={14} />
            {t("action.preview")}
          </Button>
        </div>
      </Field>

      {/* AI 操作 */}
      <AIPanel draft={draft} setDraft={setDraft} settings={settings} />

      {/* 操作按钮 */}
      <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-ink-950 pt-2 flex gap-2 border-t border-ink-100 dark:border-ink-900">
        <Button onClick={handleSave} loading={saving} className="flex-1">
          <Icon name="check" size={14} />
          {t("action.save")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void pushOrDownload(draft, "push")}
          title={t("action.push")}
        >
          <Icon name="push" size={14} />
        </Button>
        <Button
          variant="secondary"
          onClick={() => void pushOrDownload(draft, "download")}
          title={t("action.download")}
        >
          <Icon name="download" size={14} />
        </Button>
        <Button
          variant="secondary"
          onClick={() => void pushOrDownload(draft, "copy")}
          title={t("action.copyMd")}
        >
          <Icon name="copy" size={14} />
        </Button>
      </div>

      <Modal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title={t("settings.template.preview")}
        size="lg"
        footer={
          <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
            {t("action.cancel")}
          </Button>
        }
      >
        <pre className="text-xs font-mono text-ink-700 dark:text-ink-300 whitespace-pre-wrap break-words bg-ink-50 dark:bg-ink-900 rounded-lg p-3 max-h-[60vh] overflow-y-auto">
          {preview}
        </pre>
      </Modal>
    </div>
  );
}

async function pushOrDownload(draft: ClipDraft, op: "push" | "download" | "copy") {
  try {
    // 先保存
    const r = await send<{ id: string }>("clip:save", {
      content: draft.content,
      noteTitle: draft.noteTitle,
      notePath: draft.notePath,
      tags: draft.tags,
      templateId: draft.templateId,
      aiSummary: draft.aiSummary || undefined,
      aiTags: draft.aiTags.length ? draft.aiTags : undefined,
      aiTranslation: draft.aiTranslation,
    });
    if (op === "push") {
      await send("push:editor", { recordId: r.id });
      toast.success(t("toast.push.ok"));
    } else if (op === "download") {
      await send("download:md", { recordId: r.id });
      toast.success(t("toast.download.ok"));
    } else {
      const rec = await send<ClipRecord>("clip:get", { id: r.id });
      await copyText(rec.renderedMarkdown);
      toast.success(t("toast.copy.ok"));
    }
  } catch (e) {
    toast.error(
      op === "push"
        ? t("toast.push.failed")
        : op === "download"
          ? t("toast.clip.failed")
          : t("toast.clip.failed"),
      {
        description: (e as Error).message,
        duration: 8000,
        action: (e as Error).message.includes("超时")
          ? { label: t("action.retry"), onClick: () => void pushOrDownload(draft, op) }
          : undefined,
      },
    );
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    if (!ok) throw new Error("复制失败，请先聚焦侧栏窗口后重试");
  }
}

function MetaCard({ content }: { content: ExtractedContent }) {
  return (
    <div className="card p-3 space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400">
        <Icon name="external" size={11} />
        <a
          href={content.url}
          target="_blank"
          rel="noreferrer"
          className="truncate hover:text-qingwu-600 dark:hover:text-qingwu-400 max-w-[70%]"
        >
          {content.url}
        </a>
        <Badge variant="muted" className="ml-auto">
          {content.strategy}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Meta label="作者" value={content.author} />
        <Meta label="发布" value={content.publishedAt?.slice(0, 10)} />
        <Meta label="字数" value={String(content.wordCount)} />
      </div>
      {content.warnings.length > 0 && (
        <div className="mt-1 px-2 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-1.5">
          <Icon name="warning" size={12} />
          {content.warnings[0]}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-ink-400 dark:text-ink-500">{label}</div>
      <div className="text-ink-700 dark:text-ink-300 truncate">{value || "—"}</div>
    </div>
  );
}

function PathInput({
  value,
  onChange,
  recent,
}: {
  value: string;
  onChange: (v: string) => void;
  recent: string[];
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = recent
    .filter((r) => r !== value && r.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 5);
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Clippings/2026/07"
      />
      {focused && suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-20 mt-1 left-0 right-0 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg shadow-pop overflow-hidden"
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => onChange(s)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 flex items-center gap-1.5"
            >
              <Icon name="folder" size={11} className="text-ink-400" />
              {s}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function TagsInput({
  tags,
  onChange,
  recent,
  aiTags,
  onAcceptAi,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  recent: string[];
  aiTags: string[];
  onAcceptAi: () => void;
}) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const suggestions = recent
    .filter((r) => !tags.includes(r) && r.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 6);

  function addTag(t: string) {
    const v = t.trim().replace(/^#/, "");
    if (!v) return;
    if (!tags.includes(v)) onChange([...tags, v]);
    setInput("");
  }

  return (
    <div>
      <div
        className="flex flex-wrap gap-1 p-1.5 rounded-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 min-h-[36px] focus-within:border-qingwu-500"
        onClick={() => {
          const el = document.getElementById("tag-input");
          el?.focus();
        }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-qingwu-50 dark:bg-qingwu-900/30 text-qingwu-700 dark:text-qingwu-300 text-[11px]"
          >
            #{tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(tags.filter((x) => x !== tag));
              }}
              className="hover:text-qingwu-900 dark:hover:text-white"
            >
              <Icon name="x" size={10} />
            </button>
          </span>
        ))}
        <input
          id="tag-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(input);
            } else if (e.key === "Backspace" && !input && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 150);
            if (input) addTag(input);
          }}
          className="flex-1 min-w-[60px] bg-transparent text-xs px-1 py-0.5 outline-none text-ink-900 dark:text-ink-100"
          placeholder={tags.length === 0 ? "输入后按 Enter" : ""}
        />
      </div>
      {aiTags.length > 0 && (
        <button
          type="button"
          onClick={onAcceptAi}
          className="mt-1 inline-flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400 hover:underline"
        >
          <Icon name="ai" size={10} />
          接受 AI 标签：{aiTags.map((t) => `#${t}`).join(" ")}
        </button>
      )}
      {focused && suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-20 mt-1 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-lg shadow-pop overflow-hidden"
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => addTag(s)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 flex items-center gap-1.5"
            >
              <Icon name="tag" size={11} className="text-ink-400" />
              {s}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

type AIActionMode = "summary" | "tags" | "translate" | "rename";

type AIResultDraft =
  | { mode: "summary"; title: string; text: string }
  | { mode: "tags"; title: string; tags: string[] }
  | { mode: "translate"; title: string; text: string; targetLang: Locale }
  | { mode: "rename"; title: string; text: string };

function AIPanel({
  draft,
  setDraft,
  settings,
}: {
  draft: ClipDraft;
  setDraft: (d: ClipDraft) => void;
  settings: ClipperSettings;
}) {
  const [busy, setBusy] = useState<AIActionMode | null>(null);
  const [result, setResult] = useState<AIResultDraft | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const resultText = result
    ? result.mode === "tags"
      ? result.tags.map((tag) => `#${tag}`).join(" ")
      : result.text
    : "";

  async function callAI(mode: AIActionMode, extra?: { targetLang?: Locale; instruction?: string }) {
    if (!settings.ai) {
      toast.warn(t("toast.ai.noKey"));
      return;
    }
    setBusy(mode);
    setResult(null);
    try {
      const r = await send<{ ok: boolean; data: unknown; error?: { message: string } }>("ai:run", {
        request: {
          mode,
          text: draft.content.contentText,
          targetLang: extra?.targetLang,
          instruction: extra?.instruction,
          maxTokens: mode === "summary" ? 300 : mode === "tags" ? 100 : undefined,
        },
      });
      const resp = r as any;
      if (!resp.ok) {
        toast.error(resp.error?.message ?? t("toast.ai.unknown"), {
          duration: 8000,
          action: { label: t("action.retry"), onClick: () => void callAI(mode, extra) },
        });
        return;
      }

      const data = resp.data;
      if (mode === "tags") {
        setResult({
          mode,
          title: t("ai.tags"),
          tags: Array.isArray(data) ? data.map(String) : [],
        });
      } else if (mode === "translate") {
        const targetLang = extra?.targetLang ?? (settings.locale === "zh-CN" ? "en-US" : "zh-CN");
        setResult({
          mode,
          title: `${t("ai.translate")} ${targetLang === "en-US" ? "EN" : "中文"}`,
          text: String(data ?? ""),
          targetLang,
        });
      } else if (mode === "rename") {
        setResult({ mode, title: t("ai.rename"), text: String(data ?? draft.noteTitle) });
      } else {
        setResult({ mode, title: t("ai.summary.medium"), text: String(data ?? "") });
      }
      toast.success("AI 完成");
    } catch (e) {
      toast.error(t("toast.ai.unknown"), {
        description: (e as Error).message,
        duration: 8000,
        action: { label: t("action.retry"), onClick: () => void callAI(mode, extra) },
      });
    } finally {
      setBusy(null);
    }
  }

  function applyResult(target: "field" | "content") {
    if (!result) return;
    if (result.mode === "tags") {
      setDraft({
        ...draft,
        tags: [...new Set([...draft.tags, ...result.tags])],
        aiTags: [],
      });
    } else if (result.mode === "rename") {
      const title = result.text.trim() || draft.noteTitle;
      setDraft({
        ...draft,
        noteTitle: title,
        content: { ...draft.content, title },
      });
    } else if (result.mode === "summary") {
      setDraft({ ...draft, aiSummary: result.text });
    } else if (target === "field") {
      setDraft({ ...draft, aiTranslation: { lang: result.targetLang, text: result.text } });
    } else {
      const text = result.text;
      setDraft({
        ...draft,
        content: {
          ...draft.content,
          contentText: text,
          markdown: text,
          contentHtml: text,
          excerpt: text.slice(0, 200),
          wordCount: text.length,
          selection: draft.content.selection ? text : draft.content.selection,
        },
      });
    }
    toast.success("已应用 AI 结果");
  }

  async function copyResult() {
    if (!resultText) return;
    await copyText(resultText);
    toast.success(t("toast.copy.ok"));
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-700 dark:text-ink-300 flex items-center gap-1.5">
          <Icon name="ai" size={13} className="text-violet-500" />
          AI 助手
        </span>
        {!settings.ai && <Badge variant="muted">未配置</Badge>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <AIButton
          icon="summary"
          label={t("ai.summary.medium")}
          loading={busy === "summary"}
          onClick={() => callAI("summary")}
        />
        <AIButton
          icon="tag"
          label={t("ai.tags")}
          loading={busy === "tags"}
          onClick={() => callAI("tags")}
        />
        <AIButton
          icon="translate"
          label={`${t("ai.translate")} ${settings.locale === "zh-CN" ? "EN" : "中"}`}
          loading={busy === "translate"}
          onClick={() =>
            callAI("translate", { targetLang: settings.locale === "zh-CN" ? "en-US" : "zh-CN" })
          }
        />
        <AIButton
          icon="rename"
          label={t("ai.rename")}
          loading={busy === "rename"}
          onClick={() => callAI("rename")}
        />
      </div>

      {result && (
        <div className="mt-2 rounded-lg border border-violet-100 dark:border-violet-900/50 bg-violet-50/70 dark:bg-violet-950/30 overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-violet-100 dark:border-violet-900/50">
            <span className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
              {result.title}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="px-1.5 py-0.5 rounded text-[10px] text-violet-700 dark:text-violet-300 hover:bg-white/70 dark:hover:bg-ink-900"
              >
                预览
              </button>
              <button
                type="button"
                onClick={() => void copyResult()}
                className="px-1.5 py-0.5 rounded text-[10px] text-violet-700 dark:text-violet-300 hover:bg-white/70 dark:hover:bg-ink-900"
              >
                复制
              </button>
            </div>
          </div>
          <div className="p-2 text-xs text-ink-700 dark:text-ink-300 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {resultText}
          </div>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            <Button size="sm" variant="subtle" onClick={() => applyResult("field")}>
              <Icon name="check" size={12} />
              {result.mode === "summary"
                ? "替换摘要"
                : result.mode === "tags"
                  ? "接受标签"
                  : result.mode === "rename"
                    ? "替换标题"
                    : "保存翻译"}
            </Button>
            {result.mode === "translate" && (
              <Button size="sm" variant="ghost" onClick={() => applyResult("content")}>
                <Icon name="edit" size={12} />
                替换正文
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              丢弃
            </Button>
          </div>
        </div>
      )}

      {draft.aiSummary && !result && (
        <div className="mt-1 p-2 rounded-md bg-violet-50 dark:bg-violet-950/30 text-xs text-ink-700 dark:text-ink-300 whitespace-pre-wrap">
          {draft.aiSummary}
        </div>
      )}
      {busy && (
        <div className="flex items-center gap-2 text-[11px] text-violet-600 dark:text-violet-400">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.25"
            />
            <path
              d="M22 12a10 10 0 0 1-10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          {t("ai.thinking")}
        </div>
      )}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="AI 结果预览"
        size="lg"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>
              关闭
            </Button>
            <Button size="sm" onClick={() => void copyResult()}>
              复制
            </Button>
          </>
        }
      >
        <pre className="text-xs font-mono text-ink-700 dark:text-ink-300 whitespace-pre-wrap break-words bg-ink-50 dark:bg-ink-950 rounded-lg p-3 max-h-[60vh] overflow-auto">
          {resultText}
        </pre>
      </Modal>
    </div>
  );
}
function AIButton({
  icon,
  label,
  loading,
  onClick,
}: {
  icon: import("../shared/ui").IconName;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 text-[11px] font-medium hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-50 transition-colors"
    >
      <Icon name={icon} size={11} />
      {label}
      {loading && (
        <svg className="animate-spin h-2.5 w-2.5 ml-0.5" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            strokeOpacity="0.25"
          />
          <path
            d="M22 12a10 10 0 0 1-10 10"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}

function ExtractingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <div className="space-y-2">
        <div className="h-3 w-16 rounded shimmer" />
        <div className="h-8 w-full rounded-lg shimmer" />
      </div>
      <div className="card p-3 space-y-2">
        <div className="h-3 w-32 rounded shimmer" />
        <div className="h-3 w-48 rounded shimmer" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-16 rounded-lg shimmer" />
        <div className="h-16 rounded-lg shimmer" />
      </div>
      <div className="card p-3 space-y-2">
        <div className="h-3 w-20 rounded shimmer" />
        <div className="h-3 w-full rounded shimmer" />
        <div className="h-3 w-5/6 rounded shimmer" />
        <div className="h-3 w-4/5 rounded shimmer" />
      </div>
      <div className="text-center text-[11px] text-ink-500 dark:text-ink-400">
        {t("ai.thinking")}
      </div>
    </div>
  );
}

// ===== History Tab =====

function HistoryTab({ activeId, onOpen }: { activeId?: string; onOpen: (r: ClipRecord) => void }) {
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [items, setItems] = useState<ClipRecord[]>([]);
  const [active, setActive] = useState<ClipRecord | null>(null);

  const reload = useCallback(async () => {
    const { items } = await send<{ items: ClipRecord[]; total: number }>("clip:list", {
      query,
      favoriteOnly: favOnly,
      limit: 100,
    });
    setItems(items);
  }, [query, favOnly]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!activeId) return;
    void (async () => {
      const r = await send<ClipRecord>("clip:get", { id: activeId });
      setActive(r);
    })();
  }, [activeId]);

  async function toggleFav(r: ClipRecord) {
    await send("clip:update", { id: r.id, favorite: !r.favorite });
    void reload();
    if (active?.id === r.id) setActive({ ...r, favorite: !r.favorite });
  }

  async function deleteRec(r: ClipRecord) {
    await send("clip:delete", { id: r.id });
    toast.success("已删除");
    void reload();
    if (active?.id === r.id) setActive(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 flex gap-2 border-b border-ink-100 dark:border-ink-900">
        <div className="relative flex-1">
          <Icon
            name="search"
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("label.search")}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-ink-100 dark:bg-ink-900 border border-transparent focus:border-qingwu-500 focus:bg-white dark:focus:bg-ink-950 outline-none text-ink-900 dark:text-ink-100"
          />
        </div>
        <button
          type="button"
          onClick={() => setFavOnly(!favOnly)}
          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
            favOnly
              ? "bg-amber-50 dark:bg-amber-950/30 text-amber-500"
              : "text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
          }`}
          title={t("label.favoriteOnly")}
        >
          <Icon name={favOnly ? "star-filled" : "star"} size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center py-12 text-xs text-ink-400">
            {query ? t("empty.search") : t("empty.history")}
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-900">
            {items.map((r) => (
              <li
                key={r.id}
                className={`px-3 py-2.5 cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-900/60 ${
                  active?.id === r.id ? "bg-qingwu-50/40 dark:bg-qingwu-900/20" : ""
                }`}
                onClick={async () => {
                  setActive(r);
                  // clip:list 返回精简列表项（无 content），点击需先 clip:get 拿完整记录
                  const full = await send<ClipRecord>("clip:get", { id: r.id });
                  onOpen(full);
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-ink-900 dark:text-ink-100 truncate">
                      {r.noteTitle}
                    </div>
                    <div className="text-[10px] text-ink-500 dark:text-ink-400 truncate">
                      {r.notePath} · {new Date(r.createdAt).toLocaleString()}
                    </div>
                    {r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="px-1 py-0 rounded text-[10px] bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleFav(r);
                      }}
                      className={`h-6 w-6 rounded flex items-center justify-center ${
                        r.favorite ? "text-amber-500" : "text-ink-400 hover:text-amber-500"
                      }`}
                    >
                      <Icon name={r.favorite ? "star-filled" : "star"} size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteRec(r);
                      }}
                      className="h-6 w-6 rounded flex items-center justify-center text-ink-400 hover:text-rose-500"
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ===== Settings Tab (condensed) =====

function SettingsTab({
  settings,
  onChange,
  onOpenOptions,
}: {
  settings: ClipperSettings;
  onChange: (s: ClipperSettings) => void;
  onOpenOptions: () => void;
}) {
  return (
    <div className="p-3 space-y-4">
      <div className="card p-3 space-y-3">
        <div className="text-xs font-semibold text-ink-800 dark:text-ink-100">
          {t("settings.section.appearance")}
        </div>
        <Field label={t("settings.theme")}>
          <div className="flex gap-2">
            {(["auto", "light", "dark"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ ...settings, theme: m })}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs ${
                  settings.theme === m
                    ? "bg-qingwu-600 text-white"
                    : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400"
                }`}
              >
                <Icon name={m === "auto" ? "auto" : m === "dark" ? "moon" : "sun"} size={12} />
                {m === "auto" ? "自动" : m === "dark" ? "深色" : "浅色"}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("settings.locale")}>
          <div className="flex gap-2">
            {(["zh-CN", "en-US"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onChange({ ...settings, locale: l })}
                className={`flex-1 py-1.5 rounded-lg text-xs ${
                  settings.locale === l
                    ? "bg-qingwu-600 text-white"
                    : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400"
                }`}
              >
                {l === "zh-CN" ? "中文" : "English"}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="card p-3 space-y-2">
        <div className="text-xs font-semibold text-ink-800 dark:text-ink-100">
          {t("settings.section.ai")}
        </div>
        {settings.ai ? (
          <div className="text-[11px] text-ink-600 dark:text-ink-400">
            {settings.ai.kind} · {settings.ai.model ?? "默认模型"}
          </div>
        ) : (
          <div className="text-[11px] text-ink-500 dark:text-ink-400">{t("toast.ai.noKey")}</div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-600 dark:text-ink-400">
            {t("settings.ai.autoSummary")}
          </span>
          <Switch
            checked={settings.autoSummary}
            onChange={(v) => onChange({ ...settings, autoSummary: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-600 dark:text-ink-400">
            {t("settings.ai.autoTags")}
          </span>
          <Switch
            checked={settings.autoTags}
            onChange={(v) => onChange({ ...settings, autoTags: v })}
          />
        </div>
      </div>

      <Button variant="secondary" className="w-full" onClick={onOpenOptions}>
        <Icon name="settings" size={14} />
        打开完整设置
      </Button>
    </div>
  );
}
