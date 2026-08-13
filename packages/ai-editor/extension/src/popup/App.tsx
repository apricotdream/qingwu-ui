/** 扩展弹窗：快捷入口，触发整页 / 选区剪藏并打开侧边栏。 */
import { toast } from "@apricotdream/toast";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { setLocale, t } from "../shared/i18n";
import { send } from "../shared/messaging";
import { getSettingsWithRetry } from "../shared/settings-client";
import type { ClipperSettings, ExtractedContent } from "../shared/types";
import { Badge, Button, Icon, QingWuLogo, ThemeProvider, useTheme } from "../shared/ui";

// popup 直接调 sidePanel.open（popup 是用户手势上下文，
// 通过消息让 background 调会丢失手势而失败）
function openSidePanelFromPopup() {
  try {
    void chrome.sidePanel?.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  } catch (e) {
    console.warn("打开 sidePanel 失败:", e);
  }
  window.close();
}

export function App() {
  const [settings, setSettings] = useState<ClipperSettings | null>(null);
  return (
    <ThemeProvider
      initialMode={settings?.theme ?? "auto"}
      initialAccent={settings?.accent ?? "qingwu"}
      onModeChange={(mode) => settings && persist({ ...settings, theme: mode }, setSettings)}
      onAccentChange={(accent) => settings && persist({ ...settings, accent }, setSettings)}
    >
      <Inner settings={settings} setSettings={setSettings} />
    </ThemeProvider>
  );
}

async function persist(next: ClipperSettings, setter: (s: ClipperSettings) => void) {
  setter(next);
  await send("settings:set", next);
}

function Inner({
  settings,
  setSettings,
}: {
  settings: ClipperSettings | null;
  setSettings: (s: ClipperSettings) => void;
}) {
  const [busy, setBusy] = useState<"page" | "selection" | "bookmark" | null>(null);
  const [recentTitles, setRecentTitles] = useState<
    Array<{ id: string; title: string; host: string; at: string }>
  >([]);

  useEffect(() => {
    // SW 冷启动可能暂无应答：helper 内部已重试，彻底失败时降级为无配置界面而非崩溃
    void loadSettingsAndLocale(setSettings).catch((e) =>
      console.warn("[qingwu-clipper] 设置加载失败:", e),
    );
    void loadRecent(setRecentTitles).catch((e) =>
      console.warn("[qingwu-clipper] 最近记录加载失败:", e),
    );
  }, [setSettings]);

  async function doClip(mode: "page" | "selection" | "bookmark") {
    setBusy(mode);
    try {
      let payload: unknown = { mode };
      if (mode === "selection") {
        // 从 content script 取选区
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const result = await chrome.scripting.executeScript({
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
          const sel = result?.[0]?.result as
            | { text: string; html: string; hasSelection: boolean }
            | undefined;
          if (!sel?.hasSelection) {
            toast.warn("未选中文本", { description: "请先在页面上选中要剪藏的文本" });
            return;
          }
          payload = { mode, selection: sel.html };
        }
      }
      const content = await send<ExtractedContent>("clip:extract", payload);
      // 默认值
      const now = new Date();
      const path = (settings?.recentPaths?.[0] ?? "Clippings/{{YYYY}}/{{MM}}")
        .replace(/{{YYYY}}/g, String(now.getFullYear()))
        .replace(/{{MM}}/g, String(now.getMonth() + 1).padStart(2, "0"))
        .replace(/{{DD}}/g, String(now.getDate()).padStart(2, "0"));
      const tpl =
        settings?.templates.find((x) => x.id === (settings?.defaultTemplateId ?? "default")) ??
        settings?.templates[0];
      const r = await send<{ id: string; warnings: string[] }>("clip:save", {
        content,
        noteTitle: content.title,
        notePath: path,
        tags: [],
        templateId: tpl?.id ?? "default",
      });
      toast.success(t("toast.clip.saved"), {
        action: {
          label: "打开侧边栏",
          onClick: () => {
            openSidePanelFromPopup();
          },
        },
      });
      if (r.warnings?.length) {
        toast.warn(r.warnings[0], { duration: 6000 });
      }
      await loadRecent(setRecentTitles);
    } catch (e) {
      const err = e as Error;
      toast.error(t("toast.clip.failed"), {
        description: err.message,
        duration: 8000,
        action: err.message.includes("超时")
          ? { label: t("action.retry"), onClick: () => void doClip(mode) }
          : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-[380px] h-[520px] flex flex-col bg-gradient-to-b from-white to-ink-50/50 dark:from-ink-950 dark:to-ink-900/80">
      <Header />
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {!settings?.ai && <AiSetupBanner />}
        <QuickActions busy={busy} onClip={doClip} />
        <ShortcutsHint />
        <RecentList items={recentTitles} />
      </div>
      <Footer onSettings={() => chrome.runtime.openOptionsPage()} />
    </div>
  );
}

async function loadSettingsAndLocale(setSettings: (s: ClipperSettings) => void) {
  const s = await getSettingsWithRetry();
  setSettings(s);
  setLocale(s.locale);
}

async function loadRecent(
  setRecentTitles: (v: Array<{ id: string; title: string; host: string; at: string }>) => void,
) {
  const { items } = await send<{
    items: Array<{
      id: string;
      noteTitle: string;
      createdAt: string;
    }>;
    total: number;
  }>("clip:list", { limit: 3 });
  setRecentTitles(
    items.map((i) => ({
      id: i.id,
      title: i.noteTitle,
      host: "",
      at: i.createdAt,
    })),
  );
}

function Header() {
  const { resolved, mode, setMode } = useTheme();
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-ink-200/70 dark:border-ink-800/70 bg-white/70 dark:bg-ink-950/70 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <QingWuLogo size={28} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-ink-900 dark:text-ink-100 leading-tight">
            {t("app.name")}
          </span>
          <span className="text-[11px] text-ink-500 dark:text-ink-400 leading-tight">
            {t("app.tagline")}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
        className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
        title={mode === "auto" ? "自动模式" : mode === "dark" ? "深色" : "浅色"}
      >
        <Icon name={resolved === "dark" ? "sun" : "moon"} size={16} />
      </button>
    </div>
  );
}

function AiSetupBanner() {
  return (
    <motion.a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      }}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 mt-3 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-qingwu-50 to-violet-50 dark:from-qingwu-900/30 dark:to-violet-900/20 border border-qingwu-200/60 dark:border-qingwu-800/40 cursor-pointer hover:shadow-soft transition-shadow"
    >
      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-qingwu-500 to-violet-500 flex items-center justify-center text-white shrink-0">
        <Icon name="ai" size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-ink-800 dark:text-ink-100">启用 AI 智能剪藏</div>
        <div className="text-[11px] text-ink-600 dark:text-ink-400">一键生成摘要 / 标签 / 翻译</div>
      </div>
      <Icon name="chevron-right" size={14} className="text-ink-400" />
    </motion.a>
  );
}

function QuickActions({
  busy,
  onClip,
}: {
  busy: "page" | "selection" | "bookmark" | null;
  onClip: (m: "page" | "selection" | "bookmark") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      <ActionButton
        icon="clip"
        label={t("action.clipPage")}
        desc="Alt+Shift+C"
        loading={busy === "page"}
        onClick={() => onClip("page")}
        accent
      />
      <ActionButton
        icon="selection"
        label={t("action.clipSelection")}
        desc="Alt+Shift+S"
        loading={busy === "selection"}
        onClick={() => onClip("selection")}
      />
      <ActionButton
        icon="bookmark"
        label={t("action.clipBookmark")}
        desc={t("status.ready")}
        loading={busy === "bookmark"}
        onClick={() => onClip("bookmark")}
      />
      <ActionButton
        icon="panel"
        label={t("action.openSidePanel")}
        desc="Alt+Shift+P"
        onClick={() => {
          openSidePanelFromPopup();
        }}
      />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  desc,
  onClick,
  loading,
  accent,
}: {
  icon: import("../shared/ui").IconName;
  label: string;
  desc: string;
  onClick: () => void;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      disabled={loading}
      className={`group relative p-3 rounded-xl border text-left transition-all ${
        accent
          ? "bg-gradient-to-br from-qingwu-500 to-qingwu-700 border-qingwu-600 text-white shadow-soft"
          : "bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800 hover:border-qingwu-400 dark:hover:border-qingwu-700 text-ink-900 dark:text-ink-100"
      } disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      <div
        className={`h-7 w-7 rounded-lg flex items-center justify-center mb-2 ${
          accent
            ? "bg-white/20"
            : "bg-qingwu-50 dark:bg-qingwu-900/30 text-qingwu-700 dark:text-qingwu-300"
        }`}
      >
        <Icon name={icon} size={14} />
      </div>
      <div className="text-xs font-semibold leading-tight">{label}</div>
      <div
        className={`text-[10px] mt-0.5 leading-tight ${
          accent ? "text-white/70" : "text-ink-500 dark:text-ink-400"
        }`}
      >
        {desc}
      </div>
      {loading && (
        <div className="absolute inset-0 rounded-xl bg-white/60 dark:bg-ink-950/60 flex items-center justify-center backdrop-blur-sm">
          <svg
            className="animate-spin h-5 w-5 text-qingwu-600 dark:text-qingwu-400"
            viewBox="0 0 24 24"
            fill="none"
          >
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
        </div>
      )}
    </motion.button>
  );
}

function ShortcutsHint() {
  return (
    <div className="mt-3 px-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-900/60 text-[11px] text-ink-500 dark:text-ink-400 flex items-center gap-2">
      <Icon name="info" size={12} />
      <span>{t("hint.shortcut")}</span>
    </div>
  );
}

function RecentList({
  items,
}: {
  items: Array<{ id: string; title: string; host: string; at: string }>;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-ink-700 dark:text-ink-300">
          {t("action.history")}
        </span>
        <Badge variant="muted">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-6 text-xs text-ink-400 dark:text-ink-500">
          {t("empty.history")}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                openSidePanelFromPopup();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors text-left group"
            >
              <div className="h-6 w-6 rounded-md bg-qingwu-50 dark:bg-qingwu-900/30 text-qingwu-700 dark:text-qingwu-300 flex items-center justify-center shrink-0">
                <Icon name="history" size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-ink-800 dark:text-ink-200 truncate">
                  {it.title}
                </div>
                <div className="text-[10px] text-ink-400 dark:text-ink-500">
                  {new Date(it.at).toLocaleString()}
                </div>
              </div>
              <Icon
                name="chevron-right"
                size={12}
                className="text-ink-300 group-hover:text-ink-500"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Footer({ onSettings }: { onSettings: () => void }) {
  return (
    <div className="px-4 py-2.5 border-t border-ink-200/70 dark:border-ink-800/70 bg-white/70 dark:bg-ink-950/70 backdrop-blur flex items-center justify-between">
      <span className="text-[10px] text-ink-400">v0.1.0 · Apache-2.0</span>
      <Button variant="ghost" size="sm" onClick={onSettings}>
        <Icon name="settings" size={14} />
        <span>{t("action.openSettings")}</span>
      </Button>
    </div>
  );
}
