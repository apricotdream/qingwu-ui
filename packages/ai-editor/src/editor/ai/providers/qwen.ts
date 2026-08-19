import type { AIConfig, AIProvider } from "../index";
import { createOpenAICompatProvider } from "./openai-compat";

/**
 * 通义千问提供商。API Key: https://dashscope.console.aliyun.com/apiKey
 * 默认模型 qwen3.7-plus；可用 qwen-turbo/max/plus；baseURL 需以 /compatible-mode/v1 结尾
 */
export function createQwenProvider(config: Partial<AIConfig> & { apiKey: string }): AIProvider {
  return createOpenAICompatProvider({
    apiKey: config.apiKey,
    baseURL: config.baseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: config.model || "qwen3.7-plus",
    headers: config.headers,
  });
}
