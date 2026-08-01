import { describe, it, expect, afterEach } from "vitest";
import { AutoSkeleton } from "./auto-skeleton";

function setup(): HTMLElement {
  document.body.innerHTML = `
    <div id="root">
      <div class="card"><img src="x" /><span>Hello</span></div>
    </div>
  `;
  return document.getElementById("root")!;
}

function injectedStyle(): HTMLStyleElement | null {
  return (
    Array.from(document.head.querySelectorAll("style")).find((s) =>
      s.textContent?.includes("qs-skeleton-measuring"),
    ) ?? null
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("AutoSkeleton 原地测量", () => {
  it("加载态：portal overlay 挂到 body、root 加测量类、子节点原地不动", () => {
    const root = setup();
    const childrenBefore = Array.from(root.childNodes);

    const skeleton = new AutoSkeleton(root, { loading: true });

    expect(document.querySelector(".qs-skeleton-overlays")).not.toBeNull();
    expect(root.classList.contains("qs-skeleton-measuring")).toBe(true);
    // 原地测量：子节点从未被移动/包裹
    expect(Array.from(root.childNodes)).toEqual(childrenBefore);
    expect(injectedStyle()).not.toBeNull();

    skeleton.destroy();
  });

  it("destroy：移除 overlay、测量类、注入样式，子节点不变（无泄漏残留）", () => {
    const root = setup();
    const childrenBefore = Array.from(root.childNodes);

    const skeleton = new AutoSkeleton(root, { loading: true });
    skeleton.destroy();

    expect(document.querySelector(".qs-skeleton-overlays")).toBeNull();
    expect(root.classList.contains("qs-skeleton-measuring")).toBe(false);
    expect(injectedStyle()).toBeNull();
    expect(Array.from(root.childNodes)).toEqual(childrenBefore);
  });

  it("update({loading:false}) 退出加载态，恢复真实内容", () => {
    const root = setup();
    const childrenBefore = Array.from(root.childNodes);

    const skeleton = new AutoSkeleton(root, { loading: true });
    skeleton.update({ loading: false });

    expect(document.querySelector(".qs-skeleton-overlays")).toBeNull();
    expect(root.classList.contains("qs-skeleton-measuring")).toBe(false);
    expect(Array.from(root.childNodes)).toEqual(childrenBefore);
  });

  it("loading 状态可反复切换", () => {
    const root = setup();

    const skeleton = new AutoSkeleton(root, { loading: true });
    skeleton.update({ loading: false });
    skeleton.update({ loading: true });

    expect(document.querySelector(".qs-skeleton-overlays")).not.toBeNull();
    expect(root.classList.contains("qs-skeleton-measuring")).toBe(true);

    skeleton.destroy();
  });

  it("destroy 后 update 为 no-op（已销毁保护）", () => {
    const root = setup();
    const skeleton = new AutoSkeleton(root, { loading: true });
    skeleton.destroy();

    skeleton.update({ loading: true });
    expect(document.querySelector(".qs-skeleton-overlays")).toBeNull();
  });
});

describe("AutoSkeleton 动画样式按容器", () => {
  it("多容器并存：各自 overlay 上的 CSS 变量互不覆盖", () => {
    document.body.innerHTML = `
      <div id="a"><span>a</span></div>
      <div id="b"><span>b</span></div>
    `;
    const rootA = document.getElementById("a")!;
    const rootB = document.getElementById("b")!;

    const skA = new AutoSkeleton(rootA, {
      loading: true,
      shimmerColor: "#ff0000",
      backgroundColor: "#00ff00",
      duration: 800,
      timingFunction: "linear",
    });
    const skB = new AutoSkeleton(rootB, {
      loading: true,
      shimmerColor: "#0000ff",
      duration: 2500,
    });

    const varsA = skA.overlay!.style;
    const varsB = skB.overlay!.style;
    expect(varsA.getPropertyValue("--qs-sk-shimmer")).toBe("#ff0000");
    expect(varsA.getPropertyValue("--qs-sk-bg")).toBe("#00ff00");
    expect(varsA.getPropertyValue("--qs-sk-duration")).toBe("800ms");
    expect(varsA.getPropertyValue("--qs-sk-timing")).toBe("linear");
    expect(varsB.getPropertyValue("--qs-sk-shimmer")).toBe("#0000ff");
    expect(varsB.getPropertyValue("--qs-sk-duration")).toBe("2500ms");
    // 互不覆盖
    expect(varsA.getPropertyValue("--qs-sk-shimmer")).toBe("#ff0000");

    skA.destroy();
    skB.destroy();
  });

  it("zIndex 选项写入覆盖层（默认 9999，可调低让页面 chrome 在上）", () => {
    const root = setup();
    const skeleton = new AutoSkeleton(root, { loading: true });
    expect(skeleton.overlay!.style.zIndex).toBe("9999");
    skeleton.destroy();

    const skeleton2 = new AutoSkeleton(root, { loading: true, zIndex: 90 });
    expect(skeleton2.overlay!.style.zIndex).toBe("90");
    skeleton2.destroy();
  });

  it("样式单例注入：多实例共享一个 style 节点，全部销毁后移除", () => {
    document.body.innerHTML = `
      <div id="a"><span>a</span></div>
      <div id="b"><span>b</span></div>
    `;

    const skA = new AutoSkeleton(document.getElementById("a")!, { loading: true });
    expect(injectedStyle()).not.toBeNull();
    const styleCount = Array.from(document.head.querySelectorAll("style")).filter((s) =>
      s.textContent?.includes("qs-skeleton-measuring"),
    ).length;

    const skB = new AutoSkeleton(document.getElementById("b")!, { loading: true });
    const styleCount2 = Array.from(document.head.querySelectorAll("style")).filter((s) =>
      s.textContent?.includes("qs-skeleton-measuring"),
    ).length;
    expect(styleCount2).toBe(styleCount); // 未新增 style 节点

    skA.destroy();
    expect(injectedStyle()).not.toBeNull(); // B 仍在，样式保留
    skB.destroy();
    expect(injectedStyle()).toBeNull(); // 最后一个销毁，样式移除
  });

  it("reducedMotion：overlay 带 is-static 类，无动画块", () => {
    const root = setup();
    const skeleton = new AutoSkeleton(root, {
      loading: true,
      reducedMotion: true,
    });

    expect(skeleton.overlay!.classList.contains("is-static")).toBe(true);
    expect(skeleton.overlay!.querySelectorAll(".qs-skeleton-overlay.is-shimmer").length).toBe(0);

    skeleton.destroy();
  });
});

describe("AutoSkeleton refetch 自适应（结构签名 + MutationObserver）", () => {
  const original = HTMLElement.prototype.getBoundingClientRect;

  function mockRects() {
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const w = Number(this.getAttribute?.("data-w") ?? 0);
      const h = Number(this.getAttribute?.("data-h") ?? 0);
      const y = Number(this.getAttribute?.("data-y") ?? 0);
      return {
        x: 0,
        y,
        top: y,
        left: 0,
        right: w,
        bottom: y + h,
        width: w,
        height: h,
        toJSON: () => ({}),
      } as DOMRect;
    };
  }

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = original;
  });

  async function flush() {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
  }

  it("结构变化（新增行）→ 重测重渲，覆盖层新增块", async () => {
    document.body.innerHTML = `
      <div id="root">
        <div data-w="100" data-h="20" data-y="0">first</div>
      </div>
    `;
    mockRects();
    const skeleton = new AutoSkeleton(document.getElementById("root")!, {
      loading: true,
    });
    expect(skeleton.overlay!.querySelectorAll(".qs-skeleton-overlay").length).toBe(1);

    const row = document.createElement("div");
    row.setAttribute("data-w", "100");
    row.setAttribute("data-h", "20");
    row.setAttribute("data-y", "40");
    row.textContent = "second";
    document.getElementById("root")!.appendChild(row);

    await flush();
    expect(skeleton.overlay!.querySelectorAll(".qs-skeleton-overlay").length).toBe(2);

    skeleton.destroy();
  });

  it("同长文本变化 → 签名不变，覆盖层原节点不动", async () => {
    document.body.innerHTML = `
      <div id="root"><div data-w="100" data-h="20" data-y="0">ab</div></div>
    `;
    mockRects();
    const skeleton = new AutoSkeleton(document.getElementById("root")!, {
      loading: true,
    });
    const blockBefore = skeleton.overlay!.querySelector(".qs-skeleton-overlay");

    (document.querySelector("[data-w]") as HTMLElement).textContent = "cd";

    await flush();
    expect(skeleton.overlay!.querySelector(".qs-skeleton-overlay")).toBe(blockBefore);

    skeleton.destroy();
  });

  it("文本变长 → 签名变化，覆盖层重渲染（节点被替换）", async () => {
    document.body.innerHTML = `
      <div id="root"><div data-w="100" data-h="20" data-y="0">ab</div></div>
    `;
    mockRects();
    const skeleton = new AutoSkeleton(document.getElementById("root")!, {
      loading: true,
    });
    const blockBefore = skeleton.overlay!.querySelector(".qs-skeleton-overlay");

    (document.querySelector("[data-w]") as HTMLElement).textContent = "abcdef";

    await flush();
    expect(skeleton.overlay!.querySelector(".qs-skeleton-overlay")).not.toBe(blockBefore);

    skeleton.destroy();
  });

  it("根容器脱离文档（消费端未 destroy）→ 滚动触发自毁，无孤儿覆盖层", async () => {
    const root = setup();
    const skeleton = new AutoSkeleton(root, { loading: true });
    expect(document.querySelector(".qs-skeleton-overlays")).not.toBeNull();

    root.remove(); // 卸载根容器（模拟消费端泄漏场景）
    window.dispatchEvent(new Event("scroll"));
    await flush();

    // 自毁：覆盖层移除、样式单例释放、后续 update 为 no-op
    expect(document.querySelector(".qs-skeleton-overlays")).toBeNull();
    expect(injectedStyle()).toBeNull();
    skeleton.update({ loading: false });
    expect(document.querySelector(".qs-skeleton-overlays")).toBeNull();
  });
});

describe("AutoSkeleton 视口增量渲染", () => {
  const original = HTMLElement.prototype.getBoundingClientRect;

  // 滚动感知桩：viewport 坐标 = 文档坐标 - scrollY（与真实浏览器一致，
  // 保证位置守卫在纯滚动时文档坐标恒定、不误触发重测）
  function mockRects() {
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const w = Number(this.getAttribute?.("data-w") ?? 0);
      const h = Number(this.getAttribute?.("data-h") ?? 0);
      const x = Number(this.getAttribute?.("data-x") ?? 0);
      const y = Number(this.getAttribute?.("data-y") ?? 0);
      const top = y - window.scrollY;
      const left = x - window.scrollX;
      return {
        x: left,
        y: top,
        top,
        left,
        right: left + w,
        bottom: top + h,
        width: w,
        height: h,
        toJSON: () => ({}),
      } as DOMRect;
    };
  }

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = original;
  });

  async function flush() {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
  }

  it("视口外（±1 屏外）的块不渲染", () => {
    document.body.innerHTML = `
      <div id="root">
        <div data-w="100" data-h="20" data-y="0">visible</div>
        <div data-w="100" data-h="20" data-y="5000">far</div>
      </div>
    `;
    mockRects();
    const skeleton = new AutoSkeleton(document.getElementById("root")!, {
      loading: true,
    });

    // jsdom innerHeight=768：渲染区间 [0, 768+768=1536]，y=5000 超出
    expect(skeleton.overlay!.querySelectorAll(".qs-skeleton-overlay").length).toBe(1);

    skeleton.destroy();
  });

  it("滚动后增量补渲新进入视口的块", async () => {
    document.body.innerHTML = `
      <div id="root">
        <div data-w="100" data-h="20" data-y="0">visible</div>
        <div data-w="100" data-h="20" data-y="2000">below</div>
      </div>
    `;
    mockRects();
    const skeleton = new AutoSkeleton(document.getElementById("root")!, {
      loading: true,
    });
    expect(skeleton.overlay!.querySelectorAll(".qs-skeleton-overlay").length).toBe(1);

    Object.defineProperty(window, "scrollY", { value: 1500, configurable: true });
    window.dispatchEvent(new Event("scroll"));
    await flush();

    // 滚动后渲染区间 [1500-768, 1500+768+768=3036]，y=2000 进入
    expect(skeleton.overlay!.querySelectorAll(".qs-skeleton-overlay").length).toBe(2);

    skeleton.destroy();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("超过已渲染上限后淘汰视口外块（DOM 有界）", async () => {
    // 510 行 × 100px 间距的长页，逐屏滚过全部行
    const rows = Array.from(
      { length: 510 },
      (_, i) =>
        `<div data-w="100" data-h="20" data-y="${i * 100}">row ${i}</div>`,
    ).join("");
    document.body.innerHTML = `<div id="root">${rows}</div>`;
    mockRects();

    const skeleton = new AutoSkeleton(document.getElementById("root")!, {
      loading: true,
    });

    for (let step = 1; step <= 40; step++) {
      Object.defineProperty(window, "scrollY", {
        value: step * 1500,
        configurable: true,
      });
      window.dispatchEvent(new Event("scroll"));
      await flush();
    }

    // 全程渲染过 >500 块，但淘汰后 DOM 保持有界（≤ 视口窗口 + 上限）
    expect(skeleton.overlay!.querySelectorAll(".qs-skeleton-overlay").length).toBeLessThanOrEqual(
      600,
    );
    expect(skeleton.overlay!.querySelectorAll(".qs-skeleton-overlay").length).toBeGreaterThan(
      10,
    );

    skeleton.destroy();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("容器平移（无尺寸变化）→ 位置守卫跟随，覆盖层重新定位", async () => {
    document.body.innerHTML = `
      <div id="root" data-w="200" data-h="100">
        <div data-w="100" data-h="20" data-y="0">row</div>
      </div>
    `;
    mockRects();
    const root = document.getElementById("root")!;
    const skeleton = new AutoSkeleton(root, { loading: true });
    expect(skeleton.overlay!.style.left).toBe("0px");
    expect(skeleton.overlay!.style.top).toBe("0px");

    // 布局沉降：容器平移 (10,20)，尺寸不变——ResizeObserver 不触发，
    // 只有位置守卫能捕获
    root.setAttribute("data-x", "10");
    root.setAttribute("data-y", "20");
    await flush();

    expect(skeleton.overlay!.style.left).toBe("10px");
    expect(skeleton.overlay!.style.top).toBe("20px");

    skeleton.destroy();
  });
});

describe("AutoSkeleton 块级渐变位移门槛", () => {
  it("宽块加 is-shimmer 动画层，小块（头像/图标）静态", () => {
    document.body.innerHTML = `
      <div id="root">
        <div data-w="100" data-h="20">wide</div>
        <div data-w="30" data-h="30">small</div>
      </div>
    `;

    // jsdom 无布局：桩测 getBoundingClientRect，按 data-w/data-h 返回尺寸
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const w = Number(this.getAttribute?.("data-w") ?? 0);
      const h = Number(this.getAttribute?.("data-h") ?? 0);
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: w,
        bottom: h,
        width: w,
        height: h,
        toJSON: () => ({}),
      } as DOMRect;
    };

    try {
      const skeleton = new AutoSkeleton(document.getElementById("root")!, {
        loading: true,
      });
      const blocks = skeleton.overlay!.querySelectorAll(".qs-skeleton-overlay");

      expect(blocks.length).toBe(2);
      expect(blocks[0]!.classList.contains("is-shimmer")).toBe(true);
      expect(blocks[1]!.classList.contains("is-shimmer")).toBe(false);

      // 错峰：动画块带递增负延迟，静态块无延迟变量
      const style0 = (blocks[0] as HTMLElement).style;
      const style1 = (blocks[1] as HTMLElement).style;
      expect(style0.getPropertyValue("--qs-sk-delay")).toBe("-0ms");
      expect(style1.getPropertyValue("--qs-sk-delay")).toBe("");

      skeleton.destroy();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });
});
