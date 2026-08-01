import type { AIConfig, AIProvider } from "../index";
import { createOpenAICompatProvider } from "./openai-compat";

/**
 * OpenAI 官方提供商
 *
 * 默认模型: gpt-4o-mini
 */
export function createOpenAIProvider(config: Partial<AIConfig> & { apiKey: string }): AIProvider {
  return createOpenAICompatProvider({
    apiKey: config.apiKey,
    baseURL: config.baseURL || "https://api.openai.com/v1",
    model: config.model || "gpt-4o-mini",
    headers: config.headers,
  });
}
