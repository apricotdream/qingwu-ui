import { generateText, streamText } from "ai";

// ---- 类型定义 ----

export type AIMode = "continue" | "improve" | "shorter" | "longer" | "fix" | "translate" | "zap";

export interface AIRequest {
  mode: AIMode;
  prompt?: string;
  context: string;
  instruction?: string;
}

export interface AIProvider {
  stream(req: AIRequest): AsyncIterable<string>;
  generate(req: AIRequest): Promise<string>;
}

export interface AILanguageModelConfig {
  /** API Key */
  apiKey: string;
  /** OpenAI 兼容 API 端点 */
  baseURL: string;
  /** 模型名称 */
  model: string;
}

/** @deprecated 请使用 AILanguageModelConfig */
export interface AIConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  headers?: Record<string, string>;
}

// ---- 系统提示词 ----

export function buildSystemPrompt(mode: AIMode, instruction?: string): string {
  const prompts: Record<AIMode, string> = {
    continue:
      "你是一个写作助手。请从下文尾部自然流畅地续写内容，保持风格一致。只输出续写的内容，不要加任何前缀说明。",
    improve:
      "你是一个文字润色专家。请优化以下文本的表达，提升文采和流畅度，保持原意不变。只输出润色后的文本。",
    shorter: "你是一个精简专家。请将以下文本精简，保留核心信息，删除冗余。只输出精简后的文本。",
    longer: "你是一个内容扩写专家。请丰富以下文本的细节和层次，增加深度。只输出扩写后的文本。",
    fix: "你是一个校对专家。请修正以下文本中的语法错误、错别字和标点问题。只输出修正后的文本。",
    translate: "你是一个翻译专家。请将以下文本翻译为英文。只输出翻译后的文本。",
    zap: instruction || "你是一个全能的 AI 写作助手。请根据用户的指令处理文本。",
  };
  return prompts[mode];
}

// ---- Vercel AI SDK Provider ----

let currentProvider: AIProvider | null = null;

/**
 * 基于 Vercel AI SDK 创建统一的 AI Provider。
 * 所有兼容 OpenAI Chat Completions API 的服务均可使用，统一配置：
 *
 * - OpenAI:     baseURL = "https://api.openai.com/v1",     model = "gpt-4o-mini"
 * - DeepSeek:   baseURL = "https://api.deepseek.com/v1",    model = "deepseek-chat"
 * - Qwen:       baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1", model = "qwen-plus"
 * - Anthropic:  baseURL = "https://api.anthropic.com/v1",   model = "claude-sonnet-4-20250514"
 * - 智谱 GLM:   baseURL = "https://open.bigmodel.cn/api/paas/v4", model = "glm-4"
 * - MiniMax:    baseURL = "https://api.minimax.chat/v1",     model = "abab6.5s-chat"
 * - Moonshot:   baseURL = "https://api.moonshot.cn/v1",      model = "moonshot-v1-8k"
 */
export async function createAILanguageModelProvider(
  config: AILanguageModelConfig,
): Promise<AIProvider> {
  // @ai-sdk/openai 为可选 peer 依赖：不安装时主入口仍可正常引入，
  // 仅在调用本函数（默认 provider）时才加载；自定义 provider 走 setAIProvider() 无需安装。
  let createOpenAI: typeof import("@ai-sdk/openai").createOpenAI;
  try {
    ({ createOpenAI } = await import("@ai-sdk/openai"));
  } catch {
    throw new Error(
      "缺少可选依赖 @ai-sdk/openai。使用默认 provider 请先安装：npm i @ai-sdk/openai；或调用 setAIProvider() 注册自定义 provider。",
    );
  }
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  // 必须显式用 chat()：@ai-sdk/openai 的默认调用 openai(model) 走 Responses API（POST /responses），
  // 而 DeepSeek / 通义 / GLM 等兼容端点只实现了 /chat/completions，默认调用会 404。
  const model = openai.chat(config.model);

  return {
    async *stream(req: AIRequest): AsyncIterable<string> {
      const result = await streamText({
        model,
        system: buildSystemPrompt(req.mode, req.instruction),
        prompt: req.context,
        temperature: 0.7,
        maxOutputTokens: 2048,
      });
      for await (const chunk of result.textStream) {
        yield chunk;
      }
    },

    async generate(req: AIRequest): Promise<string> {
      const result = await generateText({
        model,
        system: buildSystemPrompt(req.mode, req.instruction),
        prompt: req.context,
        temperature: 0.7,
        maxOutputTokens: 2048,
      });
      return result.text;
    },
  };
}

export function setAIProvider(provider: AIProvider) {
  currentProvider = provider;
}

export function getAIProvider(): AIProvider {
  if (!currentProvider) {
    throw new Error(
      "未配置 AI 服务。请调用 createAILanguageModelProvider() 创建并通过 setAIProvider() 注册。",
    );
  }
  return currentProvider;
}
