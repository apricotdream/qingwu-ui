import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "./calendar";
import type { DayMetaProvider, PanelProvider } from "./providers";

function mount(): HTMLElement {
  const root = document.createElement("div");
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.textContent = "";
  vi.useRealTimers();
});

describe("Calendar · 内置 Provider 默认注册", () => {
  it("打开后面板渲染出农历小字（内置 LunarDayMetaProvider）", () => {
    const cal = new Calendar(mount(), { selected: "2026-08-01" });
    cal.open();
    expect(document.querySelector(".qw-cal-cell-sub")).not.toBeNull();
    cal.destroy();
  });
});

describe("Calendar · 用户 Provider 追加", () => {
  it("自定义 DayMetaProvider 的小字按追加顺序渲染", () => {
    const custom: DayMetaProvider = {
      id: "custom",
      getDayMeta: (date) =>
        date.getDate() === 15 ? { sub: "自定义", subClass: "is-custom" } : null,
    };
    const cal = new Calendar(mount(), {
      selected: "2026-08-01",
      dayMetaProviders: [custom],
    });
    cal.open();
    const subs = [...document.querySelectorAll<HTMLElement>(".qw-cal-cell-sub")];
    const hit = subs.find((s) => s.textContent === "自定义");
    expect(hit).not.toBeUndefined();
    expect(hit?.className).toContain("is-custom");
    cal.destroy();
  });

  it("PanelProvider 在打开时渲染一次选中日期；翻月不重渲；选中变化重渲", () => {
    const render = vi.fn(() => '<div class="test-weather">晴</div>');
    const panelProvider: PanelProvider = {
      id: "weather",
      render,
    };
    const cal = new Calendar(mount(), {
      selected: "2026-08-01",
      panelProviders: [panelProvider],
    });

    cal.open();
    expect(render).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".test-weather")).not.toBeNull();

    // 翻月（navigate）不触发重渲
    (cal as unknown as { navigate(delta: number): void }).navigate(1);
    expect(render).toHaveBeenCalledTimes(1);

    // 选中日期变化 → 重渲（翻月后点击新月份网格内的日期）
    const grid = document.querySelector(".qw-cal-grid")!;
    const cell = grid.querySelector<HTMLElement>('[data-date="2026-09-15"]');
    cell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(render).toHaveBeenCalledTimes(2);
    cal.destroy();
  });
});

describe("Calendar · 焦点管理（最小档）", () => {
  it("打开后焦点移到「今天」按钮", () => {
    // 选中日非今天，保证「今天」按钮可见
    const cal = new Calendar(mount(), { selected: "2026-12-25" });
    cal.open();
    expect(document.activeElement).toBe(document.querySelector(".qw-cal-today-btn"));
    cal.destroy();
  });

  it("关闭动画结束后焦点归还输入框", () => {
    vi.useFakeTimers();
    const cal = new Calendar(mount(), { selected: "2026-08-01" });
    cal.open();
    cal.close();
    expect(document.activeElement).not.toBe(document.querySelector(".qw-cal-input"));
    vi.advanceTimersByTime(250);
    expect(document.activeElement).toBe(document.querySelector(".qw-cal-input"));
    cal.destroy();
  });
});

describe("Calendar · popover 形态", () => {
  it("open 后 overlay 带 --popover 类，且不锁 body 滚动", () => {
    const cal = new Calendar(mount(), { mode: "popover", selected: "2026-08-01" });
    cal.open();
    const overlay = document.querySelector(".qw-cal-overlay--popover");
    expect(overlay).not.toBeNull();
    expect(document.body.style.overflow).toBe("");
    cal.destroy();
  });

  it("popover 形态不渲染取消/确认按钮", () => {
    const cal = new Calendar(mount(), { mode: "popover", selected: "2026-08-01" });
    cal.open();
    expect(document.querySelector(".qw-cal-confirm-btn")).toBeNull();
    expect(document.querySelector(".qw-cal-cancel-btn")).toBeNull();
    cal.destroy();
  });

  it("popover 点日期：面板收起 + 详情浮层弹出 + onChange 回发完整 datetime", () => {
    const onChange = vi.fn();
    const cal = new Calendar(mount(), {
      mode: "popover",
      selected: "2026-08-01",
      onChange,
    });
    cal.open();
    const grid = document.querySelector(".qw-cal-grid")!;
    const cell = grid.querySelector<HTMLElement>('[data-date="2026-08-15"]');
    cell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-08-15 00:00:00");
    /* 面板收起（is-open 移除；hidden 由动画计时器延迟设置） */
    const overlay = document.querySelector(".qw-cal-overlay--popover") as HTMLElement;
    expect(overlay.classList.contains("is-open")).toBe(false);
    /* 详情浮层弹出 */
    expect(document.querySelector(".qw-cal-detail-pop")).not.toBeNull();
    cal.destroy();
  });

  it("popover 详情浮层可被外部点击 / destroy 关闭", () => {
    const cal = new Calendar(mount(), { mode: "popover", selected: "2026-08-01" });
    cal.open();
    const grid = document.querySelector(".qw-cal-grid")!;
    const cell = grid.querySelector<HTMLElement>('[data-date="2026-08-10"]');
    cell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".qw-cal-detail-pop")).not.toBeNull();

    /* 外部点击关闭 */
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(document.querySelector(".qw-cal-detail-pop")).toBeNull();

    /* 再选中一次，destroy 时清理 */
    cal.open();
    const cell2 = grid.querySelector<HTMLElement>('[data-date="2026-08-12"]');
    cell2?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    cal.destroy();
    expect(document.querySelector(".qw-cal-detail-pop")).toBeNull();
  });
});

describe("Calendar · 销毁清理", () => {
  it("destroy 调用所有 Provider 的 destroy 钩子", () => {
    const dmDestroy = vi.fn();
    const pnDestroy = vi.fn();
    const cal = new Calendar(mount(), {
      dayMetaProviders: [{ id: "dm", getDayMeta: () => null, destroy: dmDestroy }],
      panelProviders: [{ id: "pn", render: () => null, destroy: pnDestroy }],
    });
    cal.destroy();
    expect(dmDestroy).toHaveBeenCalledTimes(1);
    expect(pnDestroy).toHaveBeenCalledTimes(1);
  });
});
