import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Typewriter } from "./typewriter";

describe("Typewriter", () => {
  let target: HTMLElement;

  beforeEach(() => {
    target = document.createElement("span");
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("默认构造：空词列表降级为空字符串", () => {
    const tw = new Typewriter(target, []);
    expect(target.textContent).toBe("");
    tw.destroy();
  });

  test("默认配置：未启动时不写文本", () => {
    const tw = new Typewriter(target, ["你好"]);
    expect(target.textContent).toBe("");
    tw.destroy();
  });

  test("还原模式：直接显示首词，无定时器", () => {
    const tw = new Typewriter(target, ["你好", "世界"], { reduced: true });
    tw.start();
    expect(target.textContent).toBe("你好");
    expect(vi.getTimerCount()).toBe(0);
    tw.destroy();
  });

  test("正常模式：逐字打入首词", () => {
    const tw = new Typewriter(target, ["Hi"], {
      typeMs: 10,
      delMs: 5,
      holdFull: 100,
      holdEmpty: 50,
    });
    tw.start();

    // 先触发 schedule(0) 的初始 tick
    vi.advanceTimersByTime(1);
    expect(target.textContent).toBe("H");

    // typeMs(10) + random(0.5) * 55 = 37.5ms
    vi.advanceTimersByTime(37.5);
    expect(target.textContent).toBe("Hi");

    tw.destroy();
  });

  test("start() 幂等", () => {
    const tw = new Typewriter(target, ["Hi"], { typeMs: 10 });
    tw.start();
    vi.advanceTimersByTime(1);
    expect(target.textContent).toBe("H");
    tw.start(); // 第二次调用无效果
    vi.advanceTimersByTime(37.5);
    expect(target.textContent).toBe("Hi");
    tw.destroy();
  });

  test("stop() 暂停并清除定时器", () => {
    const tw = new Typewriter(target, ["Hello"], { typeMs: 10 });
    tw.start();
    vi.advanceTimersByTime(10);
    tw.stop();
    const afterStop = target.textContent;
    vi.advanceTimersByTime(100);
    expect(target.textContent).toBe(afterStop); // 文本不再变化
    tw.destroy();
  });

  test("destroy() 清理后停止输出", () => {
    const tw = new Typewriter(target, ["Hello"], { typeMs: 10 });
    tw.start();
    tw.destroy();
    vi.advanceTimersByTime(100);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("完整轮播周期：多词切换", () => {
    const tw = new Typewriter(target, ["A", "B"], {
      typeMs: 5,
      delMs: 5,
      holdFull: 100,
      holdEmpty: 50,
    });
    tw.start();

    // 打字 "A"（1 字符，最多 60ms）
    vi.advanceTimersByTime(60);
    expect(target.textContent).toBe("A");

    // hold 阶段
    vi.advanceTimersByTime(100);

    // 删除阶段（1 字符，最多 5ms）
    vi.advanceTimersByTime(10);
    expect(target.textContent).toBe("");

    // holdEmpty 阶段
    vi.advanceTimersByTime(50);

    // 切换到 "B" 开始打字
    vi.advanceTimersByTime(60);
    expect(target.textContent).toBe("B");

    tw.destroy();
  });

  test("自定义定时参数生效", () => {
    const tw = new Typewriter(target, ["Test"], {
      typeMs: 200,
      delMs: 100,
      holdFull: 3000,
      holdEmpty: 500,
    });
    tw.start();

    // 先触发初始 tick
    vi.advanceTimersByTime(1);
    expect(target.textContent).toBe("T");

    tw.destroy();
  });
});
