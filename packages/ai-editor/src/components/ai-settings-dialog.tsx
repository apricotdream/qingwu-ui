import { type FC, useCallback, useEffect, useState } from "react";
import { createAILanguageModelProvider, getAIProvider, setAIProvider } from "../editor/ai";

const STORAGE_KEY = "qingwu_ai_config";
// 安全增强：API Key 改用 sessionStorage，关闭标签页后自动清除
const SESSION_STORAGE_KEY = "qingwu_ai_config_session";

interface AIConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

function loadAIConfig(): AIConfig | null {
  try {
    const sessionRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionRaw) return JSON.parse(sessionRaw);
    // 旧 localStorage 配置迁移
    const localRaw = localStorage.getItem(STORAGE_KEY);
    if (localRaw) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, localRaw);
      } catch {
        /* ignore */
      }
      localStorage.removeItem(STORAGE_KEY);
      return JSON.parse(localRaw);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveAIConfig(config: AIConfig) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESETS: Array<{ label: string; baseURL: string; model: string }> = [
  { label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", model: "deepseek-v4-flash" },
  {
    label: "通义千问",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.7-plus",
  },
  { label: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-5.6-luna" },
  { label: "智谱 GLM", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-5.2" },
  { label: "Moonshot", baseURL: "https://api.moonshot.ai/v1", model: "kimi-k2.6" },
];

export const AISettingsDialog: FC<Props> = ({ open, onClose }) => {
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState("https://api.deepseek.com/v1");
  const [model, setModel] = useState("deepseek-v4-flash");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testToast, setTestToast] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    const saved = loadAIConfig();
    if (saved) {
      setApiKey(saved.apiKey || "");
      setBaseURL(saved.baseURL || "https://api.deepseek.com/v1");
      setModel(saved.model || "deepseek-v4-flash");
    }
    // 检查是否已配置写作助手
    try {
      getAIProvider();
      setHasProvider(true);
    } catch {
      setHasProvider(false);
    }
  }, []);

  const handlePreset = useCallback((preset: (typeof PRESETS)[number]) => {
    setBaseURL(preset.baseURL);
    setModel(preset.model);
    setError(null);
    setTestToast(null);
  }, []);

  useEffect(() => {
    if (!testToast) return;
    const timer = window.setTimeout(() => setTestToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [testToast]);

  const handleTest = useCallback(async () => {
    if (!apiKey || !baseURL || !model || testing) return;
    setError(null);
    setTestToast(null);
    setTesting(true);
    try {
      const provider = await createAILanguageModelProvider({ apiKey, baseURL, model });
      await provider.generate({
        mode: "zap",
        context: "请只回复 OK，用于测试连接。",
        instruction: "只回复 OK",
      });
      setTestToast({ type: "success", message: "写作助手服务连接成功" });
    } catch (e) {
      setTestToast({
        type: "error",
        message: e instanceof Error ? e.message : "写作助手服务连接失败",
      });
    } finally {
      setTesting(false);
    }
  }, [apiKey, baseURL, model, testing]);

  const handleSave = useCallback(async () => {
    if (!apiKey || !baseURL || !model) return;
    setError(null);
    setTestToast(null);
    try {
      const provider = await createAILanguageModelProvider({ apiKey, baseURL, model });
      setAIProvider(provider);
      saveAIConfig({ apiKey, baseURL, model });
      setHasProvider(true);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建 Provider 失败");
    }
  }, [apiKey, baseURL, model, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {testToast && (
        <div
          className={`fixed right-4 top-4 z-[10001] w-[calc(100vw-32px)] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-sm ${
            testToast.type === "success"
              ? "border-green-200 bg-green-50/95 text-green-700"
              : "border-danger-200 bg-danger-50/95 text-danger"
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">{testToast.type === "success" ? "✓" : "!"}</span>
            <span className="min-w-0 break-words">{testToast.message}</span>
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[calc(100vw-32px)] max-w-[460px] max-h-[85vh] bg-background rounded-2xl shadow-2xl border border-default-200 overflow-hidden animate-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-default-100">
          <h2 className="text-base font-semibold">写作助手设置</h2>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-default-400 hover:text-default-600 hover:bg-default-100 transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {hasProvider && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-green-50 border border-green-100">
            <div className="flex items-center gap-2 text-xs text-green-700 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              写作助手服务已配置
            </div>
            <div className="text-sm font-medium text-green-800">已就绪</div>
          </div>
        )}
        {!hasProvider && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-default-50 border border-default-100">
            <div className="flex items-center gap-2 text-xs text-default-500 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-default-400" />
              未配置写作助手服务
            </div>
            <div className="text-sm text-default-600">填写下方信息以启用写作助手</div>
          </div>
        )}

        <div className="p-5 max-h-[50vh] overflow-y-auto space-y-3">
          <div>
            <label className="block text-xs text-default-500 mb-2">快速选择</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="px-2.5 py-1 text-xs rounded-lg border border-default-200 hover:bg-default-100 transition-colors"
                  onClick={() => handlePreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-default-500 mb-1">API Key *</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
              placeholder="sk-xxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-default-500 mb-1">API Endpoint (Base URL)</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
              placeholder="https://api.deepseek.com/v1"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-default-500 mb-1">模型名称 (Model)</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
              placeholder="deepseek-v4-flash"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>

          <div className="p-3 rounded-lg bg-default-50 text-[11px] text-default-500 leading-relaxed">
            所有兼容 OpenAI Chat Completions API 的服务均可使用。
            <br />
            切换模型只需修改 Base URL 和 Model 字段，无需改业务代码。
          </div>

          {error && <div className="p-3 rounded-lg bg-danger-50 text-sm text-danger">{error}</div>}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="py-2.5 rounded-xl text-sm font-medium border border-default-200 hover:bg-default-100 transition-all disabled:opacity-40"
              disabled={!apiKey || !baseURL || !model || testing}
              onClick={handleTest}
            >
              {testing ? "测试中..." : "测试连接"}
            </button>
            <button
              type="button"
              className={`py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 ${
                saved ? "bg-green-500 text-white" : "bg-primary text-white hover:opacity-90"
              }`}
              disabled={!apiKey || !baseURL || !model || testing}
              onClick={handleSave}
            >
              {saved ? "✓ 已保存" : "保存并应用"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
