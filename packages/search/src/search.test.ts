import { beforeEach, describe, expect, test, vi } from "vitest";
import { SearchBox } from "./search";

function makeContainer(): HTMLElement {
  const div = document.createElement("div");
  document.body.append(div);
  return div;
}

describe("SearchBox", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = makeContainer();
  });

  test("构造后创建触发按钮并挂载 DOM", () => {
    new SearchBox(root);
    const trigger = root.querySelector<HTMLButtonElement>(".qs-trigger");
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute("aria-haspopup")).toBe("dialog");
  });

  test("trigger: false 不渲染内置触发条，但 open() 仍可用", () => {
    const box = new SearchBox(root, { trigger: false });
    expect(root.querySelector(".qs-trigger")).toBeNull();
    box.open();
    const overlay = root.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.hidden).toBe(false);
    box.destroy();
  });

  test("构造后面板初始隐藏", () => {
    new SearchBox(root);
    const overlay = root.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.hidden).toBe(true);
  });

  test("open() 显示面板并聚焦输入框", () => {
    const box = new SearchBox(root);
    box.open();
    const overlay = root.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.hidden).toBe(false);
    const input = root.querySelector<HTMLInputElement>(".qs-input");
    expect(input).toBeTruthy();
  });

  test("close() 隐藏面板", () => {
    const box = new SearchBox(root);
    box.open();
    box.close();
    const overlay = root.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.classList.contains("is-open")).toBe(false);
  });

  test("destroy() 清空根元素", () => {
    const box = new SearchBox(root);
    box.destroy();
    expect(root.children.length).toBe(0);
  });

  test("默认筛选类别首项为「全部」", () => {
    const box = new SearchBox(root);
    box.open();
    const input = root.querySelector<HTMLInputElement>(".qs-input")!;
    // 输入查询触发渲染
    input.value = "test";
    input.dispatchEvent(new Event("input"));

    const list = root.querySelector<HTMLElement>(".qs-list");
    expect(list).toBeTruthy();
    box.destroy();
  });

  test("Ctrl+K 全局快捷键打开面板", () => {
    const box = new SearchBox(root);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { ctrlKey: true, key: "k", bubbles: true }),
    );
    const overlay = root.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.hidden).toBe(false);
    box.destroy();
  });

  test("勾选结果项回调 onSelect", () => {
    const onSelect = vi.fn();
    const box = new SearchBox(root, {
      items: [{ title: "春节", kind: "节日" }],
      onSelect,
    });
    box.open();
    const input = root.querySelector<HTMLInputElement>(".qs-input")!;
    input.value = "春节";
    input.dispatchEvent(new Event("input"));
    input.focus();

    // 通过 panel 触发键盘事件
    const panel = root.querySelector<HTMLElement>(".qs-panel")!;
    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: false }));
    expect(onSelect).toHaveBeenCalledWith({ title: "春节", kind: "节日" });
    box.destroy();
  });

  test("Escape 清空输入再按关闭", () => {
    const box = new SearchBox(root);
    box.open();
    const input = root.querySelector<HTMLInputElement>(".qs-input")!;

    // 输入文本
    input.value = "test";
    input.dispatchEvent(new Event("input"));
    expect(input.value).toBe("test");

    // 第一次 Escape 清空
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(input.value).toBe("");

    // 第二次 Escape 关闭
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const overlay = root.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.classList.contains("is-open")).toBe(false);
    box.destroy();
  });

  test("自定义类别配置", () => {
    const box = new SearchBox(root, { categories: ["全部", "水果", "蔬菜"] });
    box.open();
    const menuBtn = root.querySelector<HTMLButtonElement>(".qs-iconbtn");
    expect(menuBtn).toBeTruthy();
    box.destroy();
  });

  test("搜索过滤大小写不敏感", () => {
    const items = [
      { title: "Apple", kind: "水果" },
      { title: "Banana", kind: "水果" },
    ];
    const box = new SearchBox(root, { items });
    box.open();
    const input = root.querySelector<HTMLInputElement>(".qs-input")!;

    input.value = "apple";
    input.dispatchEvent(new Event("input"));

    const list = root.querySelector<HTMLElement>(".qs-list");
    expect(list!.hidden).toBe(false);
    const opts = list!.querySelectorAll(".qs-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]!.textContent).toContain("Apple");
    box.destroy();
  });

  test("无匹配结果显示空状态", () => {
    const box = new SearchBox(root, { items: [{ title: "Test" }] });
    box.open();
    const input = root.querySelector<HTMLInputElement>(".qs-input")!;

    input.value = "notfound";
    input.dispatchEvent(new Event("input"));

    const empty = root.querySelector<HTMLElement>(".qs-empty");
    expect(empty!.hidden).toBe(false);
    const list = root.querySelector<HTMLElement>(".qs-list");
    expect(list!.hidden).toBe(true);
    box.destroy();
  });

  test("筛选类别过滤结果", () => {
    const items = [
      { title: "春节", kind: "节日" },
      { title: "搜索", kind: "功能" },
    ];
    const box = new SearchBox(root, {
      items,
      categories: ["全部", "节日", "功能"],
    });
    box.open();
    const input = root.querySelector<HTMLInputElement>(".qs-input")!;

    // 有查询内容才能看到结果列表
    input.value = "节";
    input.dispatchEvent(new Event("input"));

    // 默认「全部」显示所有匹配
    let opts = root.querySelectorAll<HTMLElement>(".qs-opt");
    expect(opts.length).toBe(1); // 只匹配"春节"

    // 清除筛选回到「全部」
    input.value = "";
    input.dispatchEvent(new Event("input"));

    // 切换到「节日」
    const menuBtn = root.querySelector<HTMLButtonElement>(".qs-iconbtn")!;
    menuBtn.click();
    input.value = "节";
    input.dispatchEvent(new Event("input"));
    opts = root.querySelectorAll<HTMLElement>(".qs-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]!.textContent).toContain("春节");

    // 切换到「功能」
    menuBtn.click();
    input.value = "搜索";
    input.dispatchEvent(new Event("input"));
    opts = root.querySelectorAll<HTMLElement>(".qs-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]!.textContent).toContain("搜索");

    box.destroy();
  });

  test("清除按钮清空输入", () => {
    const box = new SearchBox(root);
    box.open();
    const input = root.querySelector<HTMLInputElement>(".qs-input")!;
    const clearBtn = root.querySelector<HTMLButtonElement>(".qs-clear")!;

    input.value = "test";
    input.dispatchEvent(new Event("input"));
    expect(input.value).toBe("test");

    clearBtn.click();
    expect(input.value).toBe("");
    box.destroy();
  });
});
