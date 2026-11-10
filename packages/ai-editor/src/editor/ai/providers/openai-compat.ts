import type { AIConfig, AIProvider, AIRequest } from "../index";
import { assertAIResult, buildSystemPrompt, DEFAULT_MAX_OUTPUT_TOKENS } from "../index";

/**
 * OpenAI 兼容提供商，适用于所有兼容 OpenAI API 格式的服务：
 * DeepSeek / 通义千问 / MiniMax / 智谱 GLM / Moonshot / OpenAI
 */
export function createOpenAICompatProvider(config: AIConfig): AIProvider {
  const { apiKey, baseURL, model, headers: extraHeaders } = config;

  async function* streamChat(
    systemPrompt: string,
    userContent: string,
    onReasoning?: AIRequest["onReasoning"],
  ): AsyncIterable<string> {
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
        max_tokens: config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        reasoning_effort: config.reasoningEffort,
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
    let text = "";
    let finishReason: string | undefined;
    let ended = false;

    try {
      while (!ended) {
        const { done, value } = await reader.read();

        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = done ? "" : lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            ended = true;
            break;
          }

          let json: {
            error?: { message?: string };
            choices?: Array<{
              finish_reason?: string | null;
              delta?: { content?: string | null; reasoning_content?: string | null };
            }>;
          };
          try {
            json = JSON.parse(data);
          } catch {
            // 跳过解析失败的行
            continue;
          }
          if (json.error) throw new Error(json.error.message || "AI API 错误");
          const choice = json.choices?.[0];
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          if (choice?.delta?.reasoning_content) onReasoning?.(choice.delta.reasoning_content);
          const content = choice?.delta?.content;
          if (content) {
            text += content;
            yield content;
          }
        }
        if (done) break;
      }
      assertAIResult(text, finishReason);
    } finally {
      try {
        await reader.cancel();
      } finally {
        reader.releaseLock();
      }
    }
  }

  return {
    async *stream(req: AIRequest): AsyncIterable<string> {
      const systemPrompt = buildSystemPrompt(req.mode, req.instruction);
      yield* streamChat(systemPrompt, req.context, req.onReasoning);
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
