/** 扩展选项页：配置推送方式、HTTP 端点、AI、模板与语言等。 */
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { send } from "../shared/messaging";
import { extractVars, renderTemplate } from "../shared/templates/engine";
import { setLocale, t } from "../shared/i18n";
import {
  clearHiddenHosts,
  getFabConfig,
  resetFabPosition,
  setFabEnabled,
  showFabOnHost,
  type FabConfig,
} from "../shared/fab";
import {
  Badge,
  Button,
  Field,
  Icon,
  Input,
  QingWuLogo,
  Select,
  Switch,
  Textarea,
  ThemeProvider,
  ToastProvider,
  useToast,
} from "../shared/ui";
import type {
  AIProviderConfig,
  AccentColor,
  ClipperSettings,
  EditorTarget,
  Locale,
  Template,
  ThemeMode,
} from "../shared/types";

type Section = "general" | "appearance" | "ai" | "templates" | "editor" | "siterules";

export function App() {
  const [settings, setSettings] = useState<ClipperSettings | null>(null);
  const [section, setSection] = useState<Section>("general");

  useEffect(() => {
    void (async () => {
      const s = await send<ClipperSettings>("settings:get");
      setSettings(s);
      setLocale(s.locale);
    })();
  }, []);

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500">
        加载中…
      </div>
    );
  }

  return (
    <ThemeProvider
      initialMode={settings.theme}
      initialAccent={settings.accent}
      onModeChange={(m) => void save({ ...settings, theme: m }, setSettings)}
      onAccentChange={(a) => void save({ ...settings, accent: a }, setSettings)}
    >
      <ToastProvider>
        <div className="min-h-screen bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-ink-100">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <Header />
            <div className="mt-6 grid grid-cols-[200px_1fr] gap-6">
              <Sidebar section={section} onSection={setSection} />
              <div className="space-y-4">
                {section === "general" && (
                  <GeneralSection settings={settings} onSave={(s) => void save(s, setSettings)} />
                )}
                {section === "appearance" && (
                  <AppearanceSection
                    settings={settings}
                    onSave={(s) => void save(s, setSettings)}
                  />
                )}
                {section === "ai" && (
                  <AISection settings={settings} onSave={(s) => void save(s, setSettings)} />
                )}
                {section === "templates" && (
                  <TemplatesSection
                    settings={settings}
                    onSave={(s) => void save(s, setSettings)}
                  />
                )}
                {section === "editor" && (
                  <EditorSection settings={settings} onSave={(s) => void save(s, setSettings)} />
                )}
                {section === "siterules" && (
                  <SiteRulesSection settings={settings} onSave={(s) => void save(s, setSettings)} />
                )}
              </div>
            </div>
          </div>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

async function save(s: ClipperSettings, setter: (s: ClipperSettings) => void) {
  setter(s);
  await send("settings:set", s);
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <QingWuLogo size={36} />
        <div>
          <h1 className="text-lg font-semibold">{t("app.name")}</h1>
          <p className="text-xs text-ink-500">{t("app.tagline")}</p>
        </div>
      </div>
      <Badge variant="outline">v0.1.0</Badge>
    </div>
  );
}

function Sidebar({
  section,
  onSection,
}: {
  section: Section;
  onSection: (s: Section) => void;
}) {
  const items: Array<{ id: Section; icon: import("../shared/ui").IconName; label: string }> = [
    { id: "general", icon: "settings", label: t("settings.section.general") },
    { id: "appearance", icon: "sun", label: t("settings.section.appearance") },
    { id: "ai", icon: "ai", label: t("settings.section.ai") },
    { id: "templates", icon: "edit", label: t("settings.section.templates") },
    { id: "editor", icon: "push", label: t("settings.section.editor") },
    { id: "siterules", icon: "folder", label: t("settings.section.siteRules") },
  ];
  return (
    <nav className="space-y-1">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onSection(it.id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            section === it.id
              ? "bg-qingwu-50 dark:bg-qingwu-900/30 text-qingwu-700 dark:text-qingwu-300 font-medium"
              : "text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
          }`}
        >
          <Icon name={it.icon} size={15} />
          {it.label}
        </button>
      ))}
    </nav>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 space-y-4"
    >
      <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-100">{title}</h2>
      {children}
    </motion.div>
  );
}

function GeneralSection({
  settings,
  onSave,
}: {
  settings: ClipperSettings;
  onSave: (s: ClipperSettings) => void;
}) {
  return (
    <Card title={t("settings.section.general")}>
      <Field label={t("settings.locale")}>
        <div className="flex gap-2">
          {(["zh-CN", "en-US"] as Locale[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLocale(l);
                onSave({ ...settings, locale: l });
              }}
              className={`flex-1 py-2 rounded-lg text-sm ${
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
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm">{t("settings.ai.autoSummary")}</div>
          <div className="text-[11px] text-ink-500">剪藏页面后自动调用 AI 生成摘要</div>
        </div>
        <Switch
          checked={settings.autoSummary}
          onChange={(v) => onSave({ ...settings, autoSummary: v })}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm">{t("settings.ai.autoTags")}</div>
          <div className="text-[11px] text-ink-500">剪藏页面后自动提取标签</div>
        </div>
        <Switch
          checked={settings.autoTags}
          onChange={(v) => onSave({ ...settings, autoTags: v })}
        />
      </div>
    </Card>
  );
}

function AppearanceSection({
  settings,
  onSave,
}: {
  settings: ClipperSettings;
  onSave: (s: ClipperSettings) => void;
}) {
  return (
    <Card title={t("settings.section.appearance")}>
      <Field label={t("settings.theme")}>
        <div className="flex gap-2">
          {(["auto", "light", "dark"] as ThemeMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSave({ ...settings, theme: m })}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm ${
                settings.theme === m
                  ? "bg-qingwu-600 text-white"
                  : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400"
              }`}
            >
              <Icon name={m === "auto" ? "auto" : m === "dark" ? "moon" : "sun"} size={13} />
              {m === "auto" ? "自动" : m === "dark" ? "深色" : "浅色"}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t("settings.accent")}>
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              { id: "qingwu", label: "青梧", color: "#0d9488" },
              { id: "dracula", label: "Dracula", color: "#bd93f9" },
              { id: "violet", label: "紫罗兰", color: "#8b5cf6" },
              { id: "amber", label: "琥珀", color: "#f59e0b" },
            ] as Array<{ id: AccentColor; label: string; color: string }>
          ).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSave({ ...settings, accent: a.id })}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all ${
                settings.accent === a.id
                  ? "border-qingwu-500 bg-qingwu-50/40 dark:bg-qingwu-900/20"
                  : "border-transparent bg-ink-100 dark:bg-ink-800"
              }`}
            >
              <span
                className="h-5 w-5 rounded-full"
                style={{ background: a.color }}
              />
              <span className="text-[11px]">{a.label}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className="border-t border-ink-100 dark:border-ink-900 pt-4 space-y-4">
        <FabSettings />
      </div>
    </Card>
  );
}

/** 剪藏悬浮球设置：总开关（全局）+ 重置位置 + 已隐藏网站列表（与 content script 实时同步） */
function FabSettings() {
  const [config, setConfig] = useState<FabConfig | null>(null);
  const toast = useToast();

  useEffect(() => {
    void getFabConfig().then(setConfig);
    // 内容脚本右键隐藏 / 其它页面修改时保持界面同步
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ) => {
      if (area !== "local") return;
      void getFabConfig().then(setConfig);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  if (!config) return null;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm">{t("settings.fab.enabled")}</div>
          <div className="text-[11px] text-ink-500">{t("settings.fab.enabledHint")}</div>
        </div>
        <Switch
          checked={config.enabled}
          onChange={(v) => {
            setConfig({ ...config, enabled: v });
            void setFabEnabled(v);
          }}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm">{t("settings.fab.resetPosition")}</div>
          <div className="text-[11px] text-ink-500">{t("settings.fab.resetPositionHint")}</div>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            void resetFabPosition();
            toast.push({ level: "success", message: t("settings.fab.resetPosition") + " ✓" });
          }}
        >
          {t("settings.fab.resetPosition")}
        </Button>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-sm">{t("settings.fab.hiddenHosts")}</div>
          {config.hiddenHosts.length > 0 && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setConfig({ ...config, hiddenHosts: [] });
                void clearHiddenHosts();
              }}
            >
              {t("settings.fab.restoreAll")}
            </Button>
          )}
        </div>
        {config.hiddenHosts.length === 0 ? (
          <div className="text-xs text-ink-400">{t("settings.fab.noHiddenHosts")}</div>
        ) : (
          <ul className="space-y-1">
            {config.hiddenHosts.map((host) => (
              <li key={host} className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-ink-600 dark:text-ink-400 truncate">
                  {host}
                </span>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setConfig({
                      ...config,
                      hiddenHosts: config.hiddenHosts.filter((h) => h !== host),
                    });
                    void showFabOnHost(host);
                  }}
                >
                  {t("settings.fab.restore")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function AISection({
  settings,
  onSave,
}: {
  settings: ClipperSettings;
  onSave: (s: ClipperSettings) => void;
}) {
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const cfg = settings.ai ?? {
    kind: "openai" as const,
    baseURL: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    temperature: 0.4,
  };

  async function test() {
    setTesting(true);
    try {
      const r = await send<{ ok: boolean; data?: { data: string }; error?: { message: string } }>(
        "ai:test",
        cfg,
      );
      if (r.ok && r.data?.data) {
        toast.push({ level: "success", message: "连接成功", detail: `返回：${r.data.data.slice(0, 80)}` });
      } else {
        toast.push({
          level: "error",
          message: "连接失败",
          detail: r.error?.message ?? "未知错误",
          duration: 8000,
        });
      }
    } catch (e) {
      toast.push({
        level: "error",
        message: "连接失败",
        detail: (e as Error).message,
        duration: 8000,
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card title={t("settings.section.ai")}>
      <Field label={t("settings.ai.provider")}>
        <Select
          value={cfg.kind}
          onChange={(e) =>
            onSave({
              ...settings,
              ai: { ...cfg, kind: e.target.value as AIProviderConfig["kind"] },
            })
          }
        >
          <option value="openai">OpenAI 兼容（OpenAI / DeepSeek / Qwen / Moonshot 等）</option>
          <option value="deepseek">DeepSeek（预设）</option>
          <option value="qwen">通义千问（预设）</option>
          <option value="chrome-built-in">Chrome 内置 AI（Gemini Nano）</option>
          <option value="custom">自定义</option>
        </Select>
      </Field>

      {cfg.kind !== "chrome-built-in" && (
        <>
          <Field label={t("settings.ai.baseURL")} hint="自动补全 /v1/chat/completions">
            <Input
              value={cfg.baseURL ?? ""}
              placeholder="https://api.deepseek.com/v1 或 https://api.openai.com/v1"
              onChange={(e) =>
                onSave({ ...settings, ai: { ...cfg, baseURL: e.target.value } })
              }
            />
          </Field>
          <Field label={t("settings.ai.apiKey")}>
            <Input
              type="password"
              value={cfg.apiKey ?? ""}
              placeholder="sk-..."
              onChange={(e) =>
                onSave({ ...settings, ai: { ...cfg, apiKey: e.target.value } })
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("settings.ai.model")}>
              <Input
                value={cfg.model ?? ""}
                placeholder="deepseek-chat / qwen-plus / gpt-4o-mini"
                onChange={(e) =>
                  onSave({ ...settings, ai: { ...cfg, model: e.target.value } })
                }
              />
            </Field>
            <Field label={t("settings.ai.temperature")}>
              <Input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={cfg.temperature ?? 0.4}
                onChange={(e) =>
                  onSave({
                    ...settings,
                    ai: { ...cfg, temperature: Number(e.target.value) },
                  })
                }
              />
            </Field>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-[11px] p-2 rounded-md flex gap-1.5">
            <Icon name="info" size={12} className="mt-0.5 shrink-0" />
            <span>
              DeepSeek 用户请填 baseURL <code>https://api.deepseek.com</code>，模型填 <code>deepseek-chat</code>。插件会自动补全 <code>/v1/chat/completions</code>，不会出现 404。
            </span>
          </div>
        </>
      )}

      {cfg.kind === "chrome-built-in" && (
        <div className="bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 text-[11px] p-2 rounded-md flex gap-1.5">
          <Icon name="info" size={12} className="mt-0.5 shrink-0" />
          <span>
            在 chrome://flags 启用 <code>Prompt API for Gemini Nano</code> 与 <code>Optimization Guide On Device Model</code>，重启浏览器后生效。
          </span>
        </div>
      )}

      <Button variant="secondary" onClick={() => void test()} loading={testing}>
        <Icon name="check" size={13} />
        {t("settings.ai.test")}
      </Button>
    </Card>
  );
}

function TemplatesSection({
  settings,
  onSave,
}: {
  settings: ClipperSettings;
  onSave: (s: ClipperSettings) => void;
}) {
  const [activeId, setActiveId] = useState<string>(settings.defaultTemplateId);
  const active = settings.templates.find((t) => t.id === activeId) ?? settings.templates[0];
  const toast = useToast();

  const preview = active
    ? renderTemplate(active, {
        content: sampleContent(),
        tags: ["sample", "test"],
        aiSummary: "这是一段 AI 摘要示例",
        aiTags: ["ai-tag"],
      }).rendered
    : "";

  const vars = active ? extractVars(active) : [];

  function updateActive(patch: Partial<Template>) {
    if (!active) return;
    onSave({
      ...settings,
      templates: settings.templates.map((t) =>
        t.id === active.id ? { ...t, ...patch } : t,
      ),
    });
  }

  function addNew() {
    const id = `tpl-${Date.now()}`;
    const tpl: Template = {
      id,
      name: "未命名模板",
      body: "---\ntitle: {{title}}\nurl: {{url}}\n---\n\n# {{title}}\n\n{{content}}\n",
      isDefault: false,
    };
    onSave({ ...settings, templates: [...settings.templates, tpl] });
    setActiveId(id);
    toast.push({ level: "success", message: "已新建模板" });
  }

  function removeActive() {
    if (!active || active.builtIn) return;
    const next = settings.templates.filter((t) => t.id !== active.id);
    onSave({ ...settings, templates: next, defaultTemplateId: next[0]?.id ?? "" });
    setActiveId(next[0]?.id ?? "");
  }

  function setDefault() {
    if (!active) return;
    onSave({
      ...settings,
      defaultTemplateId: active.id,
      templates: settings.templates.map((t) => ({
        ...t,
        isDefault: t.id === active.id,
      })),
    });
  }

  return (
    <Card title={t("settings.section.templates")}>
      <div className="flex gap-2">
        <Select value={activeId} onChange={(e) => setActiveId(e.target.value)} className="flex-1">
          {settings.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isDefault ? " · 默认" : ""}
            </option>
          ))}
        </Select>
        <Button variant="secondary" size="md" onClick={addNew}>
          <Icon name="plus" size={13} />
          {t("settings.template.new")}
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={setDefault}
          disabled={active?.isDefault}
        >
          设为默认
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={removeActive}
          disabled={!active || active.builtIn}
        >
          <Icon name="trash" size={13} />
        </Button>
      </div>

      {active && (
        <>
          <Field label="模板名称">
            <Input
              value={active.name}
              onChange={(e) => updateActive({ name: e.target.value })}
            />
          </Field>
          <Field label={t("settings.template.pathPattern")}>
            <Input
              value={active.pathPattern ?? ""}
              placeholder="*://*.zhihu.com/*"
              onChange={(e) => updateActive({ pathPattern: e.target.value })}
            />
          </Field>
          <Field
            label={t("settings.template.body")}
            hint={t("settings.template.vars")}
          >
            <Textarea
              value={active.body}
              onChange={(e) => updateActive({ body: e.target.value })}
              className="min-h-[180px] font-mono text-xs"
            />
          </Field>
          <div className="flex flex-wrap gap-1">
            {vars.map((v) => (
              <Badge key={v} variant="muted">
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
          <div>
            <div className="text-xs text-ink-600 dark:text-ink-400 mb-1.5">
              {t("settings.template.preview")}
            </div>
            <pre className="text-xs font-mono text-ink-700 dark:text-ink-300 whitespace-pre-wrap break-words bg-ink-50 dark:bg-ink-900 rounded-lg p-3 max-h-[200px] overflow-y-auto">
              {preview}
            </pre>
          </div>
        </>
      )}
    </Card>
  );
}

function EditorSection({
  settings,
  onSave,
}: {
  settings: ClipperSettings;
  onSave: (s: ClipperSettings) => void;
}) {
  const toast = useToast();
  const target: EditorTarget = settings.editorTarget ?? {
    kind: "http",
    endpoint: "http://127.0.0.1:7321/clip",
    autoPush: false,
  };

  async function testConnection() {
    if (target.kind !== "http" || !target.endpoint) {
      toast.push({ level: "warning", message: "请填写 HTTP 端点" });
      return;
    }
    try {
      const r = await fetch(target.endpoint, {
        method: "OPTIONS",
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok || r.status === 404 || r.status === 405) {
        toast.push({
          level: "success",
          message: "已联系到青梧编辑器",
          detail: `状态码 ${r.status}`,
        });
      } else {
        toast.push({
          level: "warning",
          message: "已响应但状态异常",
          detail: `状态码 ${r.status}`,
        });
      }
    } catch (e) {
      toast.push({
        level: "error",
        message: t("error.push.network"),
        detail: (e as Error).message,
        duration: 8000,
      });
    }
  }

  return (
    <Card title={t("settings.section.editor")}>
      <Field label={t("settings.editor.kind")}>
        <Select
          value={target.kind}
          onChange={(e) =>
            onSave({
              ...settings,
              editorTarget: { ...target, kind: e.target.value as EditorTarget["kind"] },
            })
          }
        >
          <option value="http">HTTP（推荐）- 推送到青梧编辑器本地服务</option>
          <option value="file">文件 - 下载到指定目录</option>
          <option value="native-message">Native Messaging（实验性）</option>
          <option value="oss">同步到 OSS（需配置青梧编辑器存储）</option>
        </Select>
      </Field>

      {target.kind === "http" && (
        <>
          <Field label={t("settings.editor.endpoint")}>
            <Input
              value={target.endpoint ?? ""}
              placeholder="http://127.0.0.1:7321/clip"
              onChange={(e) =>
                onSave({
                  ...settings,
                  editorTarget: { ...target, endpoint: e.target.value },
                })
              }
            />
          </Field>
          <Field label="编辑器页面 URL（浏览器降级通道）">
            <Input
              value={target.editorUrl ?? ""}
              placeholder="http://localhost:5173"
              onChange={(e) =>
                onSave({
                  ...settings,
                  editorTarget: { ...target, editorUrl: e.target.value },
                })
              }
            />
          </Field>
          <div className="bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 text-[11px] p-2 rounded-md flex gap-1.5">
            <Icon name="info" size={12} className="mt-0.5 shrink-0" />
            <span>
              HTTP 推送失败时（如纯浏览器 dev 模式无本地服务），插件会打开此页面并通过 postMessage 推送剪藏。默认 http://localhost:5173（vite dev）。
            </span>
          </div>
          <Button variant="secondary" onClick={() => void testConnection()}>
            <Icon name="check" size={13} />
            {t("settings.editor.test")}
          </Button>
        </>
      )}

      {target.kind === "file" && (
        <Field label={t("settings.editor.directory")}>
          <Input
            value={target.directory ?? ""}
            placeholder="Clippings"
            onChange={(e) =>
              onSave({
                ...settings,
                editorTarget: { ...target, directory: e.target.value },
              })
            }
          />
        </Field>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-ink-100 dark:border-ink-900">
        <div>
          <div className="text-sm">{t("settings.editor.autoPush")}</div>
          <div className="text-[11px] text-ink-500">剪藏保存后立即推送到编辑器</div>
        </div>
        <Switch
          checked={target.autoPush ?? false}
          onChange={(v) =>
            onSave({
              ...settings,
              editorTarget: { ...target, autoPush: v },
            })
          }
        />
      </div>
    </Card>
  );
}

function SiteRulesSection({
  settings,
  onSave,
}: {
  settings: ClipperSettings;
  onSave: (s: ClipperSettings) => void;
}) {
  const rules = settings.siteRules;
  return (
    <Card title={t("settings.section.siteRules")}>
      <div className="text-[11px] text-ink-500">
        为特定站点定义正文选择器，优先于通用 Readability 算法
      </div>
      {rules.length === 0 ? (
        <div className="text-center py-6 text-xs text-ink-400">暂无规则</div>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    onSave({
                      ...settings,
                      siteRules: rules.filter((x) => x.id !== r.id),
                    })
                  }
                  className="text-rose-500 hover:text-rose-700"
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
              <div className="text-[11px] text-ink-500 font-mono">{r.pattern}</div>
              {r.contentSelector && (
                <div className="text-[11px] text-ink-600">
                  正文：<code>{r.contentSelector}</code>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="secondary"
        onClick={() =>
          onSave({
            ...settings,
            siteRules: [
              ...rules,
              {
                id: `rule-${Date.now()}`,
                name: "新规则",
                pattern: "*://*.example.com/*",
                contentSelector: "article",
              },
            ],
          })
        }
      >
        <Icon name="plus" size={13} />
        新增规则
      </Button>
    </Card>
  );
}

function sampleContent() {
  return {
    url: "https://example.com/post",
    finalUrl: "https://example.com/post",
    title: "示例文章标题",
    author: "示例作者",
    siteName: "示例站",
    publishedAt: "2026-07-19T10:00:00.000Z",
    description: "这是一段示例描述",
    lang: "zh-CN",
    excerpt: "这是示例正文的前 200 字。",
    contentHtml: "<p>这是示例正文。</p>",
    contentText: "这是示例正文。",
    markdown: "这是示例正文。",
    images: [],
    videos: [],
    links: [],
    wordCount: 100,
    readingMinutes: 1,
    strategy: "readability" as const,
    capturedAt: new Date().toISOString(),
    warnings: [],
  };
}
