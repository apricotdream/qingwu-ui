import type { AIConfig, AIProvider, AIRequest } from "../index";
import { buildSystemPrompt } from "../index";

/**
 * OpenAI 兼容的 AI 提供商
 *
 * 适用于所有兼容 OpenAI API 格式的服务：
 * - DeepSeek (api.deepseek.com)
 * - 通义千问 (dashscope.aliyuncs.com/compatible-mode/v1)
 * - MiniMax (api.minimax.chat)
 * - 智谱 GLM (open.bigmodel.cn/api/paas/v4)
 * - 月之暗面 Moonshot (api.moonshot.cn)
 * - OpenAI (api.openai.com)
 */
export function createOpenAICompatProvider(config: AIConfig): AIProvider {
  const { apiKey, baseURL, model, headers: extraHeaders } = config;

  async function* streamChat(systemPrompt: string, userContent: string): AsyncIterable<string> {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API 错误 (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("无法读取响应流");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // 跳过解析失败的行
        }
      }
    }
  }

  return {
    async *stream(req: AIRequest): AsyncIterable<string> {
      const systemPrompt = buildSystemPrompt(req.mode, req.instruction);
      yield* streamChat(systemPrompt, req.context);
    },

    async generate(req: AIRequest): Promise<string> {
      const systemPrompt = buildSystemPrompt(req.mode, req.instruction);
      let result = "";
      for await (const chunk of streamChat(systemPrompt, req.context)) {
        result += chunk;
      }
      return result;
    },
  };
}
