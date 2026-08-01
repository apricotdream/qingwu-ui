import { describe, expect, it } from "vitest";
import { type AIMode, buildSystemPrompt } from "../src/editor/ai";

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
