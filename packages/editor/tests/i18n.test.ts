import { beforeEach, describe, expect, it } from "vitest";
import { getLocale, setLocale, t, tf } from "../src/editor/i18n";

describe("i18n 国际化", () => {
  beforeEach(() => {
    setLocale("zh-CN");
  });

  it("默认语言为中文", () => {
    expect(getLocale()).toBe("zh-CN");
  });

  it("支持中文翻译", () => {
    expect(t("editor.slash.heading1")).toBe("一级标题");
    expect(t("editor.slash.bulletList")).toBe("无序列表");
    expect(t("editor.ai.continue")).toBe("续写");
  });

  it("支持切换为英文", () => {
    setLocale("en-US");
    expect(t("editor.slash.heading1")).toBe("Heading 1");
    expect(t("editor.slash.bulletList")).toBe("Bullet List");
    expect(t("editor.ai.continue")).toBe("Continue");
  });

  it("切换后 getLocale 返回正确值", () => {
    setLocale("en-US");
    expect(getLocale()).toBe("en-US");
    setLocale("zh-CN");
    expect(getLocale()).toBe("zh-CN");
  });

  it("不存在的 key 返回路径本身", () => {
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("tf 正确替换占位符", () => {
    setLocale("zh-CN");
    expect(tf("editor.wordCount", "100")).toBe("共 100 字");
  });
});
