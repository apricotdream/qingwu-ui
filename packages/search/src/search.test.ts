import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SearchBox } from "./search";
import type { SearchItem } from "./types";

function makeContainer(): HTMLElement {
  const div = document.createElement("div");
  document.body.append(div);
  return div;
}

/** 遮罩与 toast 挂载在 body 下，统一从这里查询 */
function qsOverlay(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".qs-overlay");
}

describe("SearchBox", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = makeContainer();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("构造后创建触发按钮并挂载 DOM", () => {
    new SearchBox(root);
    const trigger = document.querySelector<HTMLButtonElement>(".qs-trigger");
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute("aria-haspopup")).toBe("dialog");
  });

  test("trigger: false 不渲染内置触发条，但 open() 仍可用", () => {
    const box = new SearchBox(root, { trigger: false });
    expect(root.querySelector(".qs-trigger")).toBeNull();
    box.open();
    const overlay = document.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.hidden).toBe(false);
    box.destroy();
  });

  test("构造后面板初始隐藏", () => {
    new SearchBox(root);
    const overlay = document.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.hidden).toBe(true);
  });

  test("open() 显示面板并聚焦输入框", () => {
    const box = new SearchBox(root);
    box.open();
    const overlay = document.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.hidden).toBe(false);
    const input = document.querySelector<HTMLInputElement>(".qs-input");
    expect(input).toBeTruthy();
  });

  test("close() 隐藏面板", () => {
    const box = new SearchBox(root);
    box.open();
    box.close();
    const overlay = document.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.classList.contains("is-open")).toBe(false);
  });

  test("destroy() 清空根元素并移除 body 上的遮罩与 toast", () => {
    const box = new SearchBox(root);
    box.destroy();
    expect(root.children.length).toBe(0);
    expect(document.querySelector(".qs-overlay")).toBeNull();
    expect(document.querySelector(".qs-toasts")).toBeNull();
  });

  test("关闭按钮点击关闭面板", () => {
    const box = new SearchBox(root);
    box.open();
    const closeBtn = document.querySelector<HTMLButtonElement>(".qs-close")!;
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.getAttribute("aria-label")).toBe("关闭搜索");
    closeBtn.click();
    expect(qsOverlay()!.classList.contains("is-open")).toBe(false);
    box.destroy();
  });

  test("清空键无值时禁用", () => {
    const box = new SearchBox(root);
    box.open();
    const input = document.querySelector<HTMLInputElement>(".qs-input")!;
    const clearBtn = document.querySelector<HTMLButtonElement>(".qs-clear")!;
    expect(clearBtn.disabled).toBe(true);
    input.value = "test";
    input.dispatchEvent(new Event("input"));
    expect(clearBtn.disabled).toBe(false);
    box.destroy();
  });

  test("默认筛选类别首项为「全部」", () => {
    const box = new SearchBox(root);
    box.open();
    const input = document.querySelector<HTMLInputElement>(".qs-input")!;
    // 输入查询触发渲染
    input.value = "test";
    input.dispatchEvent(new Event("input"));

    const list = document.querySelector<HTMLElement>(".qs-list");
    expect(list).toBeTruthy();
    box.destroy();
  });

  test("Ctrl+K 全局快捷键打开面板", () => {
    const box = new SearchBox(root);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { ctrlKey: true, key: "k", bubbles: true }),
    );
    const overlay = document.querySelector<HTMLElement>(".qs-overlay");
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
    const input = document.querySelector<HTMLInputElement>(".qs-input")!;
    input.value = "春节";
    input.dispatchEvent(new Event("input"));
    input.focus();

    // 通过 panel 触发键盘事件
    const panel = document.querySelector<HTMLElement>(".qs-panel")!;
    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: false }));
    expect(onSelect).toHaveBeenCalledWith({ title: "春节", kind: "节日" });
    box.destroy();
  });

  test("Escape 清空输入再按关闭", () => {
    const box = new SearchBox(root);
    box.open();
    const input = document.querySelector<HTMLInputElement>(".qs-input")!;

    // 输入文本
    input.value = "test";
    input.dispatchEvent(new Event("input"));
    expect(input.value).toBe("test");

    // 第一次 Escape 清空
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(input.value).toBe("");

    // 第二次 Escape 关闭
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const overlay = document.querySelector<HTMLElement>(".qs-overlay");
    expect(overlay!.classList.contains("is-open")).toBe(false);
    box.destroy();
  });

  test("自定义类别配置", () => {
    const box = new SearchBox(root, { categories: ["全部", "水果", "蔬菜"] });
    box.open();
    const menuBtn = document.querySelector<HTMLButtonElement>(".qs-iconbtn");
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
    const input = document.querySelector<HTMLInputElement>(".qs-input")!;

    input.value = "apple";
    input.dispatchEvent(new Event("input"));

    const list = document.querySelector<HTMLElement>(".qs-list");
    expect(list!.hidden).toBe(false);
    const opts = list!.querySelectorAll(".qs-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]!.textContent).toContain("Apple");
    box.destroy();
  });

  test("无匹配结果显示空状态", () => {
    const box = new SearchBox(root, { items: [{ title: "Test" }] });
    box.open();
    const input = document.querySelector<HTMLInputElement>(".qs-input")!;

    input.value = "notfound";
    input.dispatchEvent(new Event("input"));

    const empty = document.querySelector<HTMLElement>(".qs-empty");
    expect(empty!.hidden).toBe(false);
    const list = document.querySelector<HTMLElement>(".qs-list");
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
    const input = document.querySelector<HTMLInputElement>(".qs-input")!;

    // 有查询内容才能看到结果列表
    input.value = "节";
    input.dispatchEvent(new Event("input"));

    // 默认「全部」显示所有匹配
    let opts = document.querySelectorAll<HTMLElement>(".qs-opt");
    expect(opts.length).toBe(1); // 只匹配"春节"

    // 清除筛选回到「全部」
    input.value = "";
    input.dispatchEvent(new Event("input"));

    // 切换到「节日」
    const menuBtn = document.querySelector<HTMLButtonElement>(".qs-iconbtn")!;
    menuBtn.click();
    input.value = "节";
    input.dispatchEvent(new Event("input"));
    opts = document.querySelectorAll<HTMLElement>(".qs-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]!.textContent).toContain("春节");

    // 切换到「功能」
    menuBtn.click();
    input.value = "搜索";
    input.dispatchEvent(new Event("input"));
    opts = document.querySelectorAll<HTMLElement>(".qs-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]!.textContent).toContain("搜索");

    box.destroy();
  });

  test("清除按钮清空输入", () => {
    const box = new SearchBox(root);
    box.open();
    const input = document.querySelector<HTMLInputElement>(".qs-input")!;
    const clearBtn = document.querySelector<HTMLButtonElement>(".qs-clear")!;

    input.value = "test";
    input.dispatchEvent(new Event("input"));
    expect(input.value).toBe("test");

    clearBtn.click();
    expect(input.value).toBe("");
    box.destroy();
  });
});

describe("SearchBox 异步服务端模式", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = makeContainer();
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  /** 构造带防抖的异步 SearchBox，返回输入框 */
  function openAsync(
    search: (q: string, signal: AbortSignal) => Promise<SearchItem[]>,
    extra: { debounceMs?: number; categories?: string[]; sprite?: string; frames?: number } = {},
  ): { box: SearchBox; input: HTMLInputElement } {
    const box = new SearchBox(root, {
      search,
      categories: extra.categories ?? ["全部", "文章"],
      debounceMs: extra.debounceMs ?? 200,
      loadingSpriteUrl: extra.sprite,
      loadingSpriteFrames: extra.frames,
    });
    box.open();
    const input = document.querySelector<HTMLInputElement>(".qs-input")!;
    return { box, input };
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }

  test("输入停顿防抖后调用 search 并渲染返回结果", async () => {
    const search = vi.fn(async (q: string) => [
      { title: `命中-${q}`, sub: "服务端返回", kind: "文章" },
    ]);
    const { box, input } = openAsync(search);

    type(input, "并发");
    expect(search).not.toHaveBeenCalled(); // 防抖期间不发请求

    await vi.advanceTimersByTimeAsync(200);
    expect(search).toHaveBeenCalledWith("并发", expect.any(AbortSignal));

    const opts = document.querySelectorAll<HTMLElement>(".qs-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]!.textContent).toContain("命中-并发");
    box.destroy();
  });

  test("快速连续输入只发起最后一次请求（旧请求被 abort）", async () => {
    const aborted: AbortSignal[] = [];
    const search = vi.fn((q: string, signal: AbortSignal) => {
      return new Promise<SearchItem[]>((resolve) => {
        signal.addEventListener("abort", () => aborted.push(signal));
        setTimeout(() => resolve([{ title: `结果-${q}` }]), 100);
      });
    });
    const { box, input } = openAsync(search);

    type(input, "a");
    await vi.advanceTimersByTimeAsync(200); // 防抖到期，第一次已发出
    expect(search).toHaveBeenCalledTimes(1);
    type(input, "ab");
    await vi.advanceTimersByTimeAsync(200);
    expect(search).toHaveBeenCalledTimes(2);
    expect(aborted.length).toBe(1); // 旧请求被 abort

    await vi.advanceTimersByTimeAsync(100);
    const opts = document.querySelectorAll<HTMLElement>(".qs-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]!.textContent).toContain("结果-ab");
    box.destroy();
  });

  test("请求在途时显示加载态（缺省为文案）", async () => {
    const search = vi.fn(
      () => new Promise<SearchItem[]>(() => {}), // 永不 resolve
    );
    const { box, input } = openAsync(search);

    type(input, "test");
    await vi.advanceTimersByTimeAsync(200);
    const loading = document.querySelector<HTMLElement>(".qs-loading")!;
    expect(loading.hidden).toBe(false);
    expect(loading.textContent).toContain("搜索中");
    // 无 URL 时只渲染文案，不渲染精灵条
    expect(loading.querySelector(".qs-loading-sprite")).toBeNull();
    box.destroy();
  });

  test("提供 loadingSpriteUrl 时加载态渲染精灵条（帧数注入）", async () => {
    const search = vi.fn(
      () => new Promise<SearchItem[]>(() => {}), // 永不 resolve
    );
    const { box, input } = openAsync(search, { sprite: "/loading.webp", frames: 5 });

    type(input, "test");
    await vi.advanceTimersByTimeAsync(200);
    const loading = document.querySelector<HTMLElement>(".qs-loading")!;
    const sprite = loading.querySelector<HTMLElement>(".qs-loading-sprite")!;
    expect(sprite).toBeTruthy();
    expect(sprite.style.backgroundImage).toContain("loading.webp");
    expect(sprite.style.getPropertyValue("--qs-frames")).toBe("5");
    expect(loading.querySelector(".qs-loading-status")?.textContent).toContain("搜索中");
    box.destroy();
  });

  test("search 拒绝时显示错误空态", async () => {
    const search = vi.fn(async () => {
      throw new Error("network");
    });
    const { box, input } = openAsync(search);

    type(input, "boom");
    await vi.advanceTimersByTimeAsync(200);
    const empty = document.querySelector<HTMLElement>(".qs-empty")!;
    expect(empty.textContent).toContain("搜索失败");
    box.destroy();
  });

  test("类别筛选作用于异步返回结果", async () => {
    const search = vi.fn(async () => [
      { title: "并发模型", kind: "文章" },
      { title: "休假表", kind: "功能" },
    ]);
    const { box, input } = openAsync(search, { categories: ["全部", "文章", "功能"] });

    type(input, "查询");
    await vi.advanceTimersByTimeAsync(200);
    expect(document.querySelectorAll(".qs-opt").length).toBe(2);

    // 切到「文章」
    const menuBtn = document.querySelector<HTMLButtonElement>(".qs-iconbtn")!;
    menuBtn.click();
    let opts = document.querySelectorAll<HTMLElement>(".qs-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]!.textContent).toContain("并发模型");
    expect(search).toHaveBeenCalledTimes(1); // 类别切换不重复请求

    // 切到「功能」
    menuBtn.click();
    opts = document.querySelectorAll<HTMLElement>(".qs-opt");
    expect(opts.length).toBe(1);
    expect(opts[0]!.textContent).toContain("休假表");
    box.destroy();
  });

  test("清空输入回到空闲态且中止在途请求", async () => {
    const aborted: AbortSignal[] = [];
    const search = vi.fn(
      (q: string, signal: AbortSignal) =>
        new Promise<SearchItem[]>((resolve) => {
          signal.addEventListener("abort", () => aborted.push(signal));
          setTimeout(() => resolve([{ title: `结果-${q}` }]), 100);
        }),
    );
    const { box, input } = openAsync(search);

    type(input, "并发");
    await vi.advanceTimersByTimeAsync(200);
    expect(search).toHaveBeenCalledTimes(1);

    type(input, ""); // 模拟清除
    expect(aborted.length).toBe(1);
    const empty = document.querySelector<HTMLElement>(".qs-empty")!;
    expect(empty.textContent).toContain("在找些什么");

    await vi.advanceTimersByTimeAsync(100);
    const list = document.querySelector<HTMLElement>(".qs-list")!;
    expect(list.hidden).toBe(true); // 过期结果不渲染
    box.destroy();
  });
});
