import { describe, expect, it } from "vitest";
import {
  createSlashCommandExtension,
  getDefaultSlashCommands,
} from "../src/editor/extensions/slash-command";
import { setLocale, t } from "../src/editor/i18n";

describe("Slash 命令扩展", () => {
  it("createSlashCommandExtension 返回一个 Tiptap Extension", () => {
    const ext = createSlashCommandExtension(() => getDefaultSlashCommands((key: string) => t(key)));
    expect(ext).toBeDefined();
    expect(ext.name).toBe("slashCommand");
    expect(typeof ext.name).toBe("string");
  });

  it("默认命令列表包含中英文项", () => {
    setLocale("zh-CN");
    const zhItems = getDefaultSlashCommands((key: string) => t(key));
    expect(zhItems.length).toBeGreaterThan(0);
    expect(zhItems[0].title).toContain("标题");

    setLocale("en-US");
    const enItems = getDefaultSlashCommands((key: string) => t(key));
    expect(enItems[0].title).toContain("Heading");
  });

  it("命令列表支持 i18n 动态切换", () => {
    // 中文
    setLocale("zh-CN");
    const zhItems = getDefaultSlashCommands((key: string) => t(key));
    const zhTitles = zhItems.map((i) => i.title);

    // 英文
    setLocale("en-US");
    const enItems = getDefaultSlashCommands((key: string) => t(key));
    const enTitles = enItems.map((i) => i.title);

    // 语言切换后标题应该不同
    expect(zhTitles).not.toEqual(enTitles);
  });
});
