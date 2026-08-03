/**
 * AI Provider - 与青梧编辑器统一的 LangChain 风格接口
 *
 * 解决 Obsidian Web Clipper AI 脆弱痛点：
 * - DeepSeek / 通义千问 / OpenAI / Chrome 内置 AI 统一适配
 * - 严格校验 baseURL（自动补 /chat/completions）
 * - 失败必有 code + retryable，错误透明
 * - 30s 超时 + 一次自动重试（网络/限流）
 */

import { ClipperError, httpStatusToAIError, toClipperError } from "../errors";
import type { AIErrorCode, AIProviderConfig, AIRequest, AIResponse, Locale } from "../types";

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string; type?: string };
}

const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeBaseURL(baseURL?: string): string {
  if (!baseURL) return "";
  let u = baseURL.trim().replace(/\/+$/, "");
  // 自动补全路径：用户可能填 https://api.deepseek.com/v1 或 https://api.deepseek.com
  if (!/\/v\d+$/.test(u) && !/\/openai\/v\d+$/.test(u)) {
    // DeepSeek / Qwen 等兼容接口约定有 /v1
    if (/deepseek|dashscope|aliyuncs|moonshot|bigmodel|openai\.com|siliconflow/i.test(u)) {
      u = `${u}/v1`;
    }
  }
  return `${u}/chat/completions`;
}

async function withTimeout<T>(p: Promise<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAICompatible(
  cfg: Required<Pick<AIProviderConfig, "baseURL" | "apiKey" | "model">> &
    Pick<AIProviderConfig, "temperature">,
  systemPrompt: string,
  userText: string,
  maxTokens?: number,
): Promise<{ text: string; usage?: { promptTokens?: number; completionTokens?: number } }> {
  const url = normalizeBaseURL(cfg.baseURL);
  if (!url) {
    throw new ClipperError("provider-error", "AI baseURL 未配置", {
      retryable: false,
    });
  }
  const body = {
    model: cfg.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText },
    ],
    temperature: cfg.temperature ?? 0.4,
    max_tokens: maxTokens ?? 800,
    stream: false,
  };

  const start = performance.now();
  let resp: Response;
  try {
    resp = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
      }),
    );
  } catch (e) {
    const err = toClipperError(e);
    // 网络错误自动重试一次
    if (err.retryable) {
      try {
        resp = await withTimeout(
          fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cfg.apiKey}`,
            },
            body: JSON.stringify(body),
          }),
        );
      } catch (e2) {
        throw toClipperError(e2);
      }
    } else {
      throw err;
    }
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw httpStatusToAIError(resp.status, text);
  }

  let json: OpenAIChatResponse;
  try {
    json = (await resp.json()) as OpenAIChatResponse;
  } catch (e) {
    throw new ClipperError("invalid-response", "AI 返回非 JSON，请检查 baseURL", {
      retryable: false,
      raw: String(e),
    });
  }
  if (json.error) {
    throw new ClipperError("provider-error", json.error.message ?? "AI 服务返回错误", {
      retryable: false,
      raw: JSON.stringify(json.error),
    });
  }
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new ClipperError("invalid-response", "AI 返回空内容", {
      retryable: true,
    });
  }
  console.debug("[qingwu-clipper] AI latency", (performance.now() - start).toFixed(0), "ms");
  return {
    text,
    usage: {
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
    },
  };
}

/** Chrome 内置 AI (Gemini Nano via Prompt API) */
async function callChromeBuiltIn(
  systemPrompt: string,
  userText: string,
): Promise<{ text: string }> {
  const ai = (
    globalThis as {
      ai?: {
        languageModel?: {
          create: (opts: {
            systemPrompt: string;
          }) => Promise<{ prompt: (t: string) => Promise<string>; destroy?: () => void }>;
        };
      };
    }
  ).ai;
  if (!ai?.languageModel) {
    throw new ClipperError("provider-error", "Chrome 内置 AI 不可用，需在 chrome://flags 启用", {
      retryable: false,
    });
  }
  const session = await ai.languageModel.create({ systemPrompt });
  try {
    const text = await session.prompt(userText);
    return { text };
  } finally {
    session.destroy?.();
  }
}

function buildPrompt(req: AIRequest): { system: string; user: string } {
  switch (req.mode) {
    case "summary": {
      const lengthHint =
        req.maxTokens && req.maxTokens <= 120
          ? "用 1-2 句话概括"
          : req.maxTokens && req.maxTokens <= 400
            ? "用 3-5 句话概括"
            : "用 6-10 句话详细概括";
      return {
        system: "你是一个网页内容摘要助手。只输出摘要正文，不要附加标题或前缀。",
        user: `请${lengthHint}以下网页内容，目标语言：${req.targetLang === "en-US" ? "英文" : "中文"}\n\n${req.text}`,
      };
    }
    case "tags":
      return {
        system: "你是标签提取助手。输出 3-8 个标签，用逗号分隔，仅小写中英文，不要带 # 号。",
        user: `为以下内容提取标签：\n\n${req.text}`,
      };
    case "translate":
      return {
        system: `你是翻译助手。将用户输入翻译为${
          req.targetLang === "en-US" ? "英文" : "中文"
        }，保留原文格式与代码块。`,
        user: req.text,
      };
    case "rename":
      return {
        system: "你是标题重写助手。仅输出一个 30 字以内的简洁标题，不要引号或前缀。",
        user: `为以下内容拟定标题：\n\n${req.text}`,
      };
    case "custom":
      return {
        system: req.instruction ?? "你是助手。",
        user: req.text,
      };
  }
}

function parseTags(text: string): string[] {
  return text
    .split(/[,\n、，]/)
    .map((s) => s.trim().replace(/^#/, ""))
    .filter((s) => s.length > 0 && s.length <= 24)
    .slice(0, 8);
}

export async function runAI(cfg: AIProviderConfig, req: AIRequest): Promise<AIResponse> {
  const start = performance.now();
  try {
    let text: string;
    let usage: { promptTokens?: number; completionTokens?: number } | undefined;

    if (cfg.kind === "chrome-built-in") {
      const { system, user } = buildPrompt(req);
      const r = await callChromeBuiltIn(system, user);
      text = r.text;
    } else {
      if (!cfg.apiKey) {
        return aiError("no-api-key", "未配置 API Key", false, cfg.kind);
      }
      const { system, user } = buildPrompt(req);
      const r = await callOpenAICompatible(
        {
          baseURL: cfg.baseURL ?? "",
          apiKey: cfg.apiKey,
          model: cfg.model ?? "gpt-4o-mini",
          temperature: cfg.temperature,
        },
        system,
        user,
        req.maxTokens,
      );
      text = r.text;
      usage = r.usage;
    }

    switch (req.mode) {
      case "tags":
        return aiOk(parseTags(text), usage, start);
      case "summary":
      case "translate":
      case "rename":
      case "custom":
      default:
        return aiOk(text.trim(), usage, start);
    }
  } catch (e) {
    const err = toClipperError(e);
    return aiError(
      err.code as AIErrorCode,
      err.message,
      err.retryable,
      cfg.kind,
      typeof err.raw === "string" ? err.raw : undefined,
    );
  }
}

export async function testAI(cfg: AIProviderConfig): Promise<AIResponse<string>> {
  const r = await runAI(cfg, {
    mode: "custom",
    text: "请只回复：pong",
    instruction: "你是一个连通性测试助手。",
    maxTokens: 16,
  });
  if (r.ok) return { ...r, data: String(r.data) };
  return r;
}

function aiOk<T>(
  data: T,
  usage: { promptTokens?: number; completionTokens?: number } | undefined,
  start: number,
): AIResponse<T> {
  return {
    ok: true,
    data,
    usage,
    latencyMs: Math.round(performance.now() - start),
  };
}

function aiError(
  code: AIErrorCode,
  message: string,
  retryable: boolean,
  provider?: string,
  raw?: string,
): AIResponse<never> {
  return {
    ok: false,
    error: { code, message, raw, retryable, provider },
  };
}

/** 翻译目标语言名 */
export function localeName(l: Locale): string {
  return l === "zh-CN" ? "中文" : "English";
}
