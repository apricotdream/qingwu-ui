import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ScrollFab } from "./scroll-fab";

let rafId = 0;
let rafCbs = new Map<number, (t: number) => void>();
const scroll = { y: 0, max: 5000, innerH: 800 };
let scrollToCalls = 0;

function pump(ts: number): void {
  const list = [...rafCbs.values()];
  rafCbs.clear();
  for (const cb of list) cb(ts);
}

function fire(el: EventTarget, type: string, init: Record<string, unknown> = {}): void {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
  Object.assign(e, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 0, clientY: 0 }, init);
  el.dispatchEvent(e);
}

/** 推进到描边绕满（holdMs=800） */
function holdToComplete(el: EventTarget, from = 0): void {
  fire(el, "pointerdown");
  pump(from);
  pump(from + 400);
  pump(from + 800);
}

beforeEach(() => {
  document.body.innerHTML = "";
  rafCbs = new Map();
  rafId = 0;
  scroll.y = 0;
  scroll.max = 5000;
  scrollToCalls = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    rafCbs.set(++rafId, cb);
    return rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafCbs.delete(id);
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    get: () => scroll.innerH + scroll.max,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    get: () => scroll.innerH,
  });
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => scroll.y,
  });
  window.scrollTo = ((_: number, y: number) => {
    scrollToCalls += 1;
    scroll.y = y;
  }) as typeof window.scrollTo;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ScrollFab", () => {
  test("不可滚动时隐藏，可滚动后重现", () => {
    scroll.max = 0;
    const fab = new ScrollFab();
    expect(fab.el.hidden).toBe(true);
    scroll.max = 5000;
    window.dispatchEvent(new Event("scroll"));
    expect(fab.el.hidden).toBe(false);
    fab.destroy();
  });

  test("按住绕满 → 翻转为返回顶部，顺带滚到底", () => {
    const fab = new ScrollFab();
    holdToComplete(fab.el);
    expect(fab.currentMode).toBe("to-top");
    expect(fab.el.getAttribute("aria-label")).toContain("返回顶部");
    // 翻转触发的滚底动画走完（dur=1200）
    for (let t = 800; t <= 2100; t += 100) pump(t);
    expect(scroll.y).toBe(5000);
    fab.destroy();
  });

  test("未绕满松手 = 执行当前模式动作（滚到底），描边衰减隐藏", () => {
    const fab = new ScrollFab();
    fire(fab.el, "pointerdown");
    pump(0);
    pump(300);
    fire(fab.el, "pointerup");
    expect(fab.currentMode).toBe("to-bottom");
    for (let t = 300; t <= 1600; t += 100) pump(t);
    expect(scroll.y).toBe(5000);
    expect(fab.el.querySelector(".qsf-bar")?.hasAttribute("hidden")).toBe(true);
    fab.destroy();
  });

  test("按住位移超阈值：放弃描边且不执行动作", () => {
    const fab = new ScrollFab();
    fire(fab.el, "pointerdown");
    pump(0);
    pump(300);
    fire(fab.el, "pointermove", { clientX: 60 });
    fire(fab.el, "pointerup");
    for (let t = 300; t <= 800; t += 100) pump(t);
    expect(scrollToCalls).toBe(0);
    expect(fab.currentMode).toBe("to-bottom");
    fab.destroy();
  });

  test("返回顶部模式：短按滚到顶；再绕满翻回去底部且不再滚动", () => {
    const fab = new ScrollFab();
    scroll.y = 5000;
    holdToComplete(fab.el); // 翻到 to-top（附带动画已在跑）
    for (let t = 800; t <= 2100; t += 100) pump(t);
    fire(fab.el, "pointerup");
    for (let t = 2150; t <= 2450; t += 100) pump(t); // 描边衰减回零
    const before = scrollToCalls;
    fire(fab.el, "pointerdown");
    pump(2500);
    pump(2600); // 绕至 ~1/8 松手 = 短按
    fire(fab.el, "pointerup");
    for (let t = 2600; t <= 3900; t += 100) pump(t);
    expect(scroll.y).toBe(0); // 短按 → 回顶部
    expect(scrollToCalls).toBeGreaterThan(before);

    holdToComplete(fab.el, 4000); // 再绕满 → 翻回 to-bottom，无滚动
    expect(fab.currentMode).toBe("to-bottom");
    const at = scrollToCalls;
    for (let t = 4800; t <= 5500; t += 100) pump(t);
    expect(scrollToCalls).toBe(at);
    fire(fab.el, "pointerup");
    fab.destroy();
  });

  test("键盘 Enter/Space 一键翻转模式", () => {
    const fab = new ScrollFab();
    fab.el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(fab.currentMode).toBe("to-top");
    fab.el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(fab.currentMode).toBe("to-bottom");
    fab.destroy();
  });

  test("多点触控：首指针独占，第二指针按下被忽略", () => {
    const fab = new ScrollFab();
    fire(fab.el, "pointerdown", { pointerId: 1 });
    fire(fab.el, "pointerdown", { pointerId: 2 });
    fire(fab.el, "pointerup", { pointerId: 2 });
    expect(scrollToCalls).toBe(0);
    fire(fab.el, "pointerup", { pointerId: 1 });
    pump(0);
    pump(600);
    expect(scrollToCalls).toBeGreaterThan(0);
    expect(scroll.y).toBeGreaterThan(0);
    fab.destroy();
  });

  test("pointercancel 视为放弃，松手不触发动作", () => {
    const fab = new ScrollFab();
    fire(fab.el, "pointerdown");
    pump(0);
    fire(fab.el, "pointercancel");
    fire(fab.el, "pointerup");
    expect(scrollToCalls).toBe(0);
    fab.destroy();
  });

  test("程序滚动中途 wheel 输入立即打断", () => {
    const fab = new ScrollFab();
    fire(fab.el, "pointerdown");
    fire(fab.el, "pointerup");
    pump(0);
    pump(300);
    const y = scroll.y;
    expect(y).toBeGreaterThan(0);
    window.dispatchEvent(new Event("wheel"));
    for (let t = 400; t <= 2000; t += 100) pump(t);
    expect(scroll.y).toBe(y);
    fab.destroy();
  });

  test("滚动中内容变长 → 追击新底端", () => {
    const fab = new ScrollFab();
    fab.scrollToBottom();
    pump(0);
    pump(200);
    scroll.max = 9000; // 懒加载变长
    for (let t = 300; t <= 1800; t += 100) pump(t);
    expect(scroll.y).toBe(9000);
    fab.destroy();
  });

  test("animate:false 瞬时到位", () => {
    const fab = new ScrollFab({ animate: false });
    fab.scrollToBottom();
    expect(scroll.y).toBe(5000);
    fab.scrollToTop();
    expect(scroll.y).toBe(0);
    fab.destroy();
  });

  test("自定义容器 target 独立工作", () => {
    const box = document.createElement("div");
    Object.defineProperty(box, "scrollHeight", { configurable: true, get: () => 2000 });
    Object.defineProperty(box, "clientHeight", { configurable: true, get: () => 400 });
    Object.defineProperty(box, "scrollTop", {
      configurable: true,
      get: () => scroll.y,
      set: (v: number) => {
        scroll.y = v;
      },
    });
    document.body.append(box);
    const fab = new ScrollFab({ target: box, animate: false });
    expect(fab.el.hidden).toBe(false);
    fab.scrollToBottom();
    expect(scroll.y).toBe(1600);
    fab.destroy();
  });

  test("destroy 移除节点与描边循环", () => {
    const fab = new ScrollFab();
    holdToComplete(fab.el);
    fab.destroy();
    expect(document.querySelector(".qsf-root")).toBeNull();
  });
});
