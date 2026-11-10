import { afterEach, describe, expect, it, vi } from "vitest";
import { type AIMode, buildSystemPrompt, createAILanguageModelProvider } from "../src/editor/ai";
import { createDeepSeekProvider } from "../src/editor/ai/providers/deepseek";
import { createOpenAIProvider } from "../src/editor/ai/providers/openai";
import { createOpenAICompatProvider } from "../src/editor/ai/providers/openai-compat";
import { createQwenProvider } from "../src/editor/ai/providers/qwen";

afterEach(() => vi.unstubAllGlobals());

const config = { apiKey: "test-key", baseURL: "https://ai.test/v1", model: "deepseek-flash" };
const request = { mode: "zap" as const, context: "原标题", instruction: "添加年份" };

function mockStream(
  chunks: Array<{ delta: Record<string, unknown>; finish_reason?: string | null }>,
) {
  const data = `${chunks
    .map(
      (choice) =>
        `data: ${JSON.stringify({
          id: "test",
          object: "chat.completion.chunk",
          created: 1,
          model: config.model,
          choices: [{ index: 0, finish_reason: null, ...choice }],
        })}\n\n`,
    )
    .join("")}data: [DONE]\n\n`;
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(data, {
      headers: { "Content-Type": "text/event-stream" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function collect(stream: AsyncIterable<string>) {
  let text = "";
  for await (const chunk of stream) text += chunk;
  return text;
}

describe.each([
  ["默认 provider", createAILanguageModelProvider],
  ["兼容接口", createOpenAICompatProvider],
] as const)("%s 流式回归", (_name, createProvider) => {
  it("只返回思考并耗尽额度时，明确提示输出上限", async () => {
    mockStream([
      { delta: { content: null, reasoning_content: "正在思考年份" } },
      { delta: { content: "" }, finish_reason: "length" },
    ]);
    const provider = await createProvider(config);
    await expect(collect(provider.stream(request))).rejects.toThrow("达到输出上限");
  });

  it("思考后输出正文，仅向编辑器传递正文并透传额度设置", async () => {
    const fetchMock = mockStream([
      { delta: { content: null, reasoning_content: "思考过程" } },
      { delta: { content: "功夫" } },
      { delta: { content: "(2004)" } },
      { delta: {}, finish_reason: "stop" },
    ]);
    const provider = await createProvider({
      ...config,
      maxOutputTokens: 16384,
      reasoningEffort: "low",
    });
    const onReasoning = vi.fn();
    expect(await collect(provider.stream({ ...request, onReasoning }))).toBe("功夫(2004)");
    expect(onReasoning).toHaveBeenCalledWith("思考过程");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(16384);
    expect(body.reasoning_effort).toBe("low");
    expect(body.messages[0].content).toBe("添加年份");
  });

  it("未配置额度时默认使用 8192，空结果不会被当成成功", async () => {
    const fetchMock = mockStream([{ delta: {}, finish_reason: "stop" }]);
    const provider = await createProvider(config);
    await expect(collect(provider.stream(request))).rejects.toThrow("未返回正文");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(8192);
  });

  it("流内错误向上传递", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          () =>
            new Response(
              `data: {"id":"test","object":"chat.completion.chunk","created":1,"model":"deepseek-flash","choices":[{"index":0,"delta":{"content":"部分正文"},"finish_reason":null}]}\n\ndata: {"error":{"message":"模型服务异常","type":"server_error","code":"server_error"}}\n\n`,
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
    );
    const provider = await createProvider(config);
    await expect(collect(provider.stream(request))).rejects.toThrow("模型服务异常");
  });
});

it.each([createDeepSeekProvider, createOpenAIProvider, createQwenProvider])(
  "快捷 provider 透传额度和关闭思考设置",
  async (createProvider) => {
    const fetchMock = mockStream([{ delta: { content: "OK" }, finish_reason: "stop" }]);
    const provider = createProvider({ ...config, maxOutputTokens: 4096, reasoningEffort: "none" });
    expect(await provider.generate(request)).toBe("OK");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      max_tokens: 4096,
      reasoning_effort: "none",
    });
  },
);

it("SDK 非流式生成同样提示思考耗尽额度，连接测试不会误报成功", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "test",
          object: "chat.completion",
          created: 1,
          model: config.model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "", reasoning_content: "思考" },
              finish_reason: "length",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 2048, total_tokens: 2058 },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
  const provider = await createAILanguageModelProvider(config);
  await expect(provider.generate(request)).rejects.toThrow("达到输出上限");
});

it("OpenAI 官方模型保留 SDK 参数适配", async () => {
  const fetchMock = mockStream([{ delta: { content: "OK" }, finish_reason: "stop" }]);
  const provider = await createAILanguageModelProvider({
    ...config,
    baseURL: "https://api.openai.com/v1",
    model: "o3",
    reasoningEffort: "low",
  });
  expect(await collect(provider.stream(request))).toBe("OK");
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.max_completion_tokens).toBe(8192);
  expect(body.max_tokens).toBeUndefined();
  expect(body.temperature).toBeUndefined();
});

describe("AI 提供商", () => {
  it("buildSystemPrompt 为每种模式生成中文提示词", () => {
    const modes: AIMode[] = ["continue", "improve", "shorter", "longer", "fix", "translate", "zap"];

    for (const mode of modes) {
      const prompt = buildSystemPrompt(mode, "自定义指令");
      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe("string");
      // 提示词应该非空
      expect(prompt.length).toBeGreaterThan(0);
    }
  });

  it("zap 模式优先使用自定义指令", () => {
    const prompt = buildSystemPrompt("zap", "把这段改成小红书风格");
    expect(prompt).toContain("小红书风格");
  });

  it("zap 模式无自定义指令时使用默认提示", () => {
    const prompt = buildSystemPrompt("zap");
    expect(prompt).toContain("AI 写作助手");
  });
});
