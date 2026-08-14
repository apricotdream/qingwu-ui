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
  vi.unstubAllGlobals();
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

  it("popover 也渲染取消/确认按钮（两种形态统一提交制）", () => {
    const cal = new Calendar(mount(), { mode: "popover", selected: "2026-08-01" });
    cal.open();
    expect(document.querySelector(".qw-cal-confirm-btn")).not.toBeNull();
    expect(document.querySelector(".qw-cal-cancel-btn")).not.toBeNull();
    cal.destroy();
  });

  it("popover 点日期不收起不回发；确认才回发完整 datetime 并收起", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onChange = vi.fn();
    const cal = new Calendar(mount(), {
      mode: "popover",
      selected: "2026-08-01",
      onChange,
    });
    cal.open();
    /* 打开即激活内嵌详情栏（当前选中日期） */
    const side = document.querySelector(".qw-cal-side")!;
    expect(side.classList.contains("is-active")).toBe(true);

    const grid = document.querySelector(".qw-cal-grid")!;
    const cell = grid.querySelector<HTMLElement>('[data-date="2026-08-15"]');
    cell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    /* 提交制：点日期只更新面板，不回发、不收起 */
    expect(onChange).not.toHaveBeenCalled();
    const overlay = document.querySelector(".qw-cal-overlay--popover") as HTMLElement;
    expect(overlay.classList.contains("is-open")).toBe(true);
    /* 详情内嵌仍激活 */
    expect(side.classList.contains("is-active")).toBe(true);

    document
      .querySelector<HTMLButtonElement>(".qw-cal-confirm-btn")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-08-15 00:00:00");
    expect(overlay.classList.contains("is-open")).toBe(false);
    cal.destroy();
  });

  it("popover 面板内 mousedown 不误收起（浮层挂 body，docClick 需排除 overlay）", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const cal = new Calendar(mount(), { mode: "popover", selected: "2026-08-01" });
    cal.open();
    document
      .querySelector(".qw-cal-panel")!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const overlay = document.querySelector(".qw-cal-overlay--popover") as HTMLElement;
    expect(overlay.classList.contains("is-open")).toBe(true);
    cal.destroy();
  });

  it("取消回滚到打开前状态且不回发", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onChange = vi.fn();
    const cal = new Calendar(mount(), { mode: "popover", selected: "2026-08-01", onChange });
    cal.open();
    const input = document.querySelector<HTMLInputElement>(".qw-cal-input")!;
    expect(input.value).toBe("2026-08-01 00:00:00");

    /* 点新日期：输入框实时更新为待定值 */
    document
      .querySelector(".qw-cal-grid")!
      .querySelector<HTMLElement>('[data-date="2026-08-15"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(input.value).toBe("2026-08-15 00:00:00");

    document
      .querySelector<HTMLButtonElement>(".qw-cal-cancel-btn")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("2026-08-01 00:00:00");
    const overlay = document.querySelector(".qw-cal-overlay--popover") as HTMLElement;
    expect(overlay.classList.contains("is-open")).toBe(false);
    cal.destroy();
  });

  it("Esc 与点外部等同取消：收起 + 回滚 + 不回发", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onChange = vi.fn();
    const cal = new Calendar(mount(), { mode: "popover", selected: "2026-08-01", onChange });
    cal.open();
    const input = document.querySelector<HTMLInputElement>(".qw-cal-input")!;

    document
      .querySelector(".qw-cal-grid")!
      .querySelector<HTMLElement>('[data-date="2026-08-15"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    /* Esc */
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const overlay = document.querySelector(".qw-cal-overlay--popover") as HTMLElement;
    expect(overlay.classList.contains("is-open")).toBe(false);
    expect(input.value).toBe("2026-08-01 00:00:00");
    expect(onChange).not.toHaveBeenCalled();

    /* 再开，点外部 mousedown 同样回滚 */
    cal.open();
    document
      .querySelector(".qw-cal-grid")!
      .querySelector<HTMLElement>('[data-date="2026-08-20"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(overlay.classList.contains("is-open")).toBe(false);
    expect(input.value).toBe("2026-08-01 00:00:00");
    expect(onChange).not.toHaveBeenCalled();
    cal.destroy();
  });

  it("Enter 等同确认（焦点不在按钮上时）", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onChange = vi.fn();
    const cal = new Calendar(mount(), { mode: "popover", selected: "2026-08-01", onChange });
    cal.open();
    document
      .querySelector(".qw-cal-grid")!
      .querySelector<HTMLElement>('[data-date="2026-08-15"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-08-15 00:00:00");
    cal.destroy();
  });
});

describe("Calendar · popover 视口钳制（溢出可滚）", () => {
  /** 输入框视口位置 */
  function stubInputRect(input: HTMLElement, top: number, bottom: number): void {
    input.getBoundingClientRect = () =>
      ({ top, bottom, left: 40, right: 360, width: 320, height: bottom - top }) as DOMRect;
  }
  /** 面板自然高 naturalH；施加 max-height 后实际高度跟随钳制值 */
  function stubPanelHeight(panel: HTMLElement, naturalH: number): void {
    Object.defineProperty(panel, "offsetHeight", {
      configurable: true,
      get() {
        const mh = parseInt(this.style.maxHeight, 10);
        return Number.isFinite(mh) && mh > 0 ? Math.min(naturalH, mh) : naturalH;
      },
    });
  }
  function setup(vh: number, top: number, bottom: number, naturalH: number) {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal("innerHeight", vh);
    const cal = new Calendar(mount(), { mode: "popover", selected: "2026-08-01" });
    const input = document.querySelector<HTMLElement>(".qw-cal-input")!;
    const panel = document.querySelector<HTMLElement>(".qw-cal-panel")!;
    stubInputRect(input, top, bottom);
    stubPanelHeight(panel, naturalH);
    return { cal, panel, overlay: document.querySelector<HTMLElement>(".qw-cal-overlay--popover")! };
  }

  it("下方空间充足：不钳制，锚定输入框下方", () => {
    const { cal, panel, overlay } = setup(800, 100, 142, 500);
    cal.open();
    expect(panel.style.maxHeight).toBe("");
    expect(overlay.style.top).toBe("150px"); /* 142 + 8 */
    cal.destroy();
  });

  it("下方不足而上方充足：上翻且不钳制", () => {
    const { cal, panel, overlay } = setup(700, 550, 592, 500);
    cal.open();
    expect(overlay.classList.contains("is-flip")).toBe(true);
    expect(panel.style.maxHeight).toBe("");
    expect(overlay.style.top).toBe("42px"); /* 550 - 500 - 8 */
    cal.destroy();
  });

  it("两侧都放不下：留在空间更大的下方并钳制高度", () => {
    const { cal, panel, overlay } = setup(500, 200, 242, 500);
    cal.open();
    expect(overlay.classList.contains("is-flip")).toBe(false);
    expect(panel.style.maxHeight).toBe("242px"); /* 500 - 242 - 16 */
    expect(overlay.style.top).toBe("250px"); /* 242 + 8 */
    cal.destroy();
  });

  it("两侧都放不下且上方更大：上翻并钳制高度", () => {
    const { cal, panel, overlay } = setup(500, 300, 342, 500);
    cal.open();
    expect(overlay.classList.contains("is-flip")).toBe(true);
    expect(panel.style.maxHeight).toBe("284px"); /* 300 - 16 */
    expect(overlay.style.top).toBe("8px"); /* 300 - 284 - 8，钳制底部 */
    cal.destroy();
  });
});

describe("Calendar · modal 提交制", () => {
  it("modal 点日期不回发；确认回发完整 datetime 并收起", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onChange = vi.fn();
    const cal = new Calendar(mount(), { selected: "2026-08-01", onChange });
    cal.open();

    document
      .querySelector(".qw-cal-grid")!
      .querySelector<HTMLElement>('[data-date="2026-08-15"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();

    document
      .querySelector<HTMLButtonElement>(".qw-cal-confirm-btn")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-08-15 00:00:00");
    const overlay = document.querySelector(".qw-cal-overlay") as HTMLElement;
    expect(overlay.classList.contains("is-open")).toBe(false);
    cal.destroy();
  });
});

describe("Calendar · dateOnly 模式", () => {
  it("隐藏时分秒时间行", () => {
    const cal = new Calendar(mount(), { dateOnly: true, selected: "2026-08-01" });
    cal.open();
    const time = document.querySelector<HTMLElement>(".qw-cal-time");
    expect(time).not.toBeNull();
    expect(time?.hidden).toBe(true);
    cal.destroy();
  });

  it("非 dateOnly 仍显示时间行", () => {
    const cal = new Calendar(mount(), { selected: "2026-08-01" });
    cal.open();
    const time = document.querySelector<HTMLElement>(".qw-cal-time");
    expect(time?.hidden).toBe(false);
    cal.destroy();
  });

  it("dateOnly 输入框与 onChange 均回 YYYY-MM-DD（确认回发）", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onChange = vi.fn();
    const cal = new Calendar(mount(), {
      mode: "popover",
      dateOnly: true,
      selected: "2026-08-01",
      onChange,
    });
    cal.open();
    const input = document.querySelector<HTMLInputElement>(".qw-cal-input")!;
    expect(input.value).toBe("2026-08-01");

    document
      .querySelector(".qw-cal-grid")!
      .querySelector<HTMLElement>('[data-date="2026-08-15"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    /* 提交制：点日期不回发，但输入框实时更新为 date-only */
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("2026-08-15");

    document
      .querySelector<HTMLButtonElement>(".qw-cal-confirm-btn")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2026-08-15");
    cal.destroy();
  });

  it("dateOnly 取消回滚到打开前 date-only 值且不回发", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onChange = vi.fn();
    const cal = new Calendar(mount(), {
      mode: "popover",
      dateOnly: true,
      selected: "2026-08-01",
      onChange,
    });
    cal.open();
    const input = document.querySelector<HTMLInputElement>(".qw-cal-input")!;

    document
      .querySelector(".qw-cal-grid")!
      .querySelector<HTMLElement>('[data-date="2026-08-20"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(input.value).toBe("2026-08-20");

    document
      .querySelector<HTMLButtonElement>(".qw-cal-cancel-btn")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("2026-08-01");
    cal.destroy();
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

describe("Calendar · 详情悬浮方向 detailPosition", () => {
  it("默认 right：overlay 带 is-detail-right", () => {
    const cal = new Calendar(mount(), { mode: "popover", selected: "2026-08-01" });
    cal.open();
    const overlay = document.querySelector(".qw-cal-overlay--popover")!;
    expect(overlay.classList.contains("is-detail-right")).toBe(true);
    expect(overlay.classList.contains("is-detail-inside")).toBe(false);
    cal.destroy();
  });

  it("inside：overlay 带 is-detail-inside，点击日期后详情侧栏仍激活", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const cal = new Calendar(mount(), {
      mode: "popover",
      detailPosition: "inside",
      selected: "2026-08-01",
    });
    cal.open();
    const overlay = document.querySelector(".qw-cal-overlay--popover")!;
    expect(overlay.classList.contains("is-detail-inside")).toBe(true);

    const grid = document.querySelector(".qw-cal-grid")!;
    const cell = grid.querySelector<HTMLElement>('[data-date="2026-08-15"]');
    cell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const side = document.querySelector(".qw-cal-side")!;
    expect(side.classList.contains("is-active")).toBe(true);
    expect(overlay.classList.contains("is-open")).toBe(true);
    cal.destroy();
  });

  it("left：overlay 带 is-detail-left，面板行反向（侧栏在左）", () => {
    const cal = new Calendar(mount(), {
      mode: "popover",
      detailPosition: "left",
      selected: "2026-08-01",
    });
    cal.open();
    const overlay = document.querySelector(".qw-cal-overlay--popover")!;
    expect(overlay.classList.contains("is-detail-left")).toBe(true);
    cal.destroy();
  });
});
