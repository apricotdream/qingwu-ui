import type { AIConfig, AIProvider } from "../index";
import { createOpenAICompatProvider } from "./openai-compat";

/**
 * 通义千问 (Qwen) AI 提供商
 *
 * 获取 API Key: https://dashscope.console.aliyun.com/apiKey
 * 默认模型: qwen-plus
 * 也可用: qwen-turbo, qwen-max, qwen-plus
 *
 * 注意：通义千问的 baseURL 需要以 /compatible-mode/v1 结尾
 */
export function createQwenProvider(config: Partial<AIConfig> & { apiKey: string }): AIProvider {
  return createOpenAICompatProvider({
    apiKey: config.apiKey,
    baseURL: config.baseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: config.model || "qwen3.7-plus",
    headers: config.headers,
  });
}
