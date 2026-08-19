import type { AIConfig, AIProvider } from "../index";
import { createOpenAICompatProvider } from "./openai-compat";

/**
 * DeepSeek 提供商。API Key: https://platform.deepseek.com/api_keys
 * 默认模型 deepseek-v4-flash；可用 deepseek-reasoner (R1)
 */
export function createDeepSeekProvider(config: Partial<AIConfig> & { apiKey: string }): AIProvider {
  return createOpenAICompatProvider({
    apiKey: config.apiKey,
    baseURL: config.baseURL || "https://api.deepseek.com/v1",
    model: config.model || "deepseek-v4-flash",
    headers: config.headers,
  });
}
