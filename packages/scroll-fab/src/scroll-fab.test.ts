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

/** 桌面悬停推进到描边绕满（ringMs=800） */
function hoverToComplete(el: EventTarget, from = 0): void {
  fire(el, "pointerenter");
  pump(from);
  pump(from + 400);
  pump(from + 800);
}

/** 触屏按住推进到描边绕满 */
function pressToComplete(el: EventTarget, from = 0): void {
  fire(el, "pointerdown", { pointerType: "touch" });
  pump(from);
  pump(from + 400);
  pump(from + 800);
}

/** 描边衰减倒转回零 */
function decayToZero(from: number): void {
  for (let t = from; t <= from + 400; t += 100) pump(t);
}

/** 程序滚动动画走完（dur≤1200） */
function settleScroll(from: number): void {
  for (let t = from; t <= from + 1500; t += 100) pump(t);
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

  test("悬停绕满 → 翻转为返回顶部（纯翻转，不附带滚动）", () => {
    const fab = new ScrollFab();
    hoverToComplete(fab.el);
    expect(fab.currentMode).toBe("to-top");
    expect(fab.el.getAttribute("aria-label")).toContain("返回顶部");
    settleScroll(900);
    expect(scrollToCalls).toBe(0);
    expect(scroll.y).toBe(0);
    fab.destroy();
  });

  test("双向对称：移开衰减后再悬停绕满翻回去底部", () => {
    const fab = new ScrollFab();
    hoverToComplete(fab.el); // to-top
    fire(fab.el, "pointerleave");
    decayToZero(900);
    hoverToComplete(fab.el, 1400); // 再绕满 → to-bottom
    expect(fab.currentMode).toBe("to-bottom");
    expect(fab.el.getAttribute("aria-label")).toContain("滚动到底部");
    fab.destroy();
  });

  test("桌面点击恒为当前模式动作：先滚到底，翻转后点击回顶部", () => {
    const fab = new ScrollFab();
    fire(fab.el, "click");
    settleScroll(0);
    expect(scroll.y).toBe(5000);

    hoverToComplete(fab.el, 1600); // 悬停翻转到 to-top
    expect(fab.currentMode).toBe("to-top");
    fire(fab.el, "click");
    settleScroll(1700);
    expect(scroll.y).toBe(0);
    fab.destroy();
  });

  test("悬停中途移开：描边衰减隐藏，不翻转不动作", () => {
    const fab = new ScrollFab();
    fire(fab.el, "pointerenter");
    pump(0);
    pump(300); // 绕至 ~3/8
    fire(fab.el, "pointerleave");
    decayToZero(400);
    expect(fab.currentMode).toBe("to-bottom");
    expect(scrollToCalls).toBe(0);
    expect(fab.el.querySelector(".qsf-bar")?.hasAttribute("hidden")).toBe(true);
    fab.destroy();
  });

  test("桌面按压不驱动描边（悬停才是推进源）", () => {
    const fab = new ScrollFab();
    fire(fab.el, "pointerdown");
    pump(0);
    pump(400);
    pump(800);
    expect(fab.currentMode).toBe("to-bottom");
    expect(fab.el.querySelector(".qsf-bar")?.hasAttribute("hidden")).toBe(true);
    fire(fab.el, "pointerup"); // 按压释放不执行动作（动作走 click）
    expect(scrollToCalls).toBe(0);
    fab.destroy();
  });

  test("触屏按住绕满：松手被消费不滚动；再次轻点执行新动作", () => {
    scroll.y = 5000;
    const fab = new ScrollFab();
    pressToComplete(fab.el);
    expect(fab.currentMode).toBe("to-top");
    fire(fab.el, "pointerup");
    decayToZero(900);
    expect(scrollToCalls).toBe(0); // 绕满翻转的手势不附带滚动

    fire(fab.el, "pointerdown", { pointerType: "touch" }); // 轻点 = 动作
    pump(1400);
    fire(fab.el, "pointerup");
    settleScroll(1500);
    expect(scroll.y).toBe(0);
    fab.destroy();
  });

  test("触屏轻点立即执行动作，合成点击被吞不双触发", () => {
    const fab = new ScrollFab();
    fire(fab.el, "pointerdown", { pointerType: "touch" });
    pump(0);
    fire(fab.el, "pointerup");
    settleScroll(100);
    expect(scroll.y).toBe(5000);
    const calls = scrollToCalls;
    fire(fab.el, "click"); // 触屏合成 click（ghost）应被抑制
    expect(scrollToCalls).toBe(calls);
    fab.destroy();
  });

  test("触屏按住位移超阈值：放弃描边且不执行动作", () => {
    const fab = new ScrollFab();
    fire(fab.el, "pointerdown", { pointerType: "touch" });
    pump(0);
    pump(300);
    fire(fab.el, "pointermove", { pointerType: "touch", clientX: 60 });
    fire(fab.el, "pointerup", { pointerType: "touch" });
    settleScroll(400);
    expect(scrollToCalls).toBe(0);
    expect(fab.currentMode).toBe("to-bottom");
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
    fire(fab.el, "pointerdown", { pointerType: "touch", pointerId: 1 });
    fire(fab.el, "pointerdown", { pointerType: "touch", pointerId: 2 });
    fire(fab.el, "pointerup", { pointerType: "touch", pointerId: 2 });
    expect(scrollToCalls).toBe(0);
    fire(fab.el, "pointerup", { pointerType: "touch", pointerId: 1 });
    settleScroll(0);
    expect(scrollToCalls).toBeGreaterThan(0);
    expect(scroll.y).toBeGreaterThan(0);
    fab.destroy();
  });

  test("pointercancel 视为放弃，松手不触发动作", () => {
    const fab = new ScrollFab();
    fire(fab.el, "pointerdown", { pointerType: "touch" });
    pump(0);
    fire(fab.el, "pointercancel", { pointerType: "touch" });
    fire(fab.el, "pointerup", { pointerType: "touch" });
    settleScroll(100);
    expect(scrollToCalls).toBe(0);
    fab.destroy();
  });

  test("程序滚动中途 wheel 输入立即打断", () => {
    const fab = new ScrollFab();
    fire(fab.el, "click");
    pump(0);
    pump(300);
    const y = scroll.y;
    expect(y).toBeGreaterThan(0);
    window.dispatchEvent(new Event("wheel"));
    settleScroll(400);
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
    hoverToComplete(fab.el);
    fab.destroy();
    expect(document.querySelector(".qsf-root")).toBeNull();
  });
});
