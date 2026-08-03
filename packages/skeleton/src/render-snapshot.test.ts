import { afterEach, describe, expect, it } from "vitest";
import { renderSkeletonSnapshot } from "./ssr";

const snapshot = [
  { x: 0, y: 0, width: 100, height: 20, borderRadius: "4px" },
  { x: 10, y: 30, width: 80, height: 16, borderRadius: "0px" },
];

function blockCount(html: string): number {
  return html.match(/class="qs-skel-block( is-shimmer)?"/g)?.length ?? 0;
}

describe("renderSkeletonSnapshot", () => {
  it("输出完整结构：style + 容器 + 全部块 + 块级动画规则 + aria", () => {
    const html = renderSkeletonSnapshot(snapshot, { width: 200 });

    expect(html).toContain("<style>");
    expect(html).toContain("qs-shimmer-slide");
    expect(html).toContain(".qs-skel-block.is-shimmer::before");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="加载中"');
    expect(html).toContain("width:200px");
    expect(blockCount(html)).toBe(2);
  });

  it("块几何内联样式正确，borderRadius 0px 回退 4px", () => {
    const html = renderSkeletonSnapshot(snapshot, { width: 200 });

    expect(html).toContain("top:0px");
    expect(html).toContain("left:10px");
    expect(html).toContain("width:80px");
    expect(html).toContain("height:16px");
    expect(html).toContain("border-radius:4px");
  });

  it("高度未提供时按块几何自动计算", () => {
    const html = renderSkeletonSnapshot(snapshot, { width: 200 });
    expect(html).toContain("height:46px"); // max(0+20, 30+16) = 46
  });

  it("显式 height 优先", () => {
    const html = renderSkeletonSnapshot(snapshot, { width: 200, height: 300 });
    expect(html).toContain("height:300px");
  });

  it("块数超限按 maxBlocks 截断", () => {
    const many = Array.from({ length: 300 }, (_, i) => ({
      x: 0,
      y: i * 10,
      width: 50,
      height: 8,
      borderRadius: "2px",
    }));

    const html = renderSkeletonSnapshot(many, { width: 100, maxBlocks: 50 });
    expect(blockCount(html)).toBe(50);
  });

  it("默认块数上限 200", () => {
    const many = Array.from({ length: 300 }, (_, i) => ({
      x: 0,
      y: i * 10,
      width: 50,
      height: 8,
      borderRadius: "2px",
    }));

    const html = renderSkeletonSnapshot(many, { width: 100 });
    expect(blockCount(html)).toBe(200);
  });

  it("错峰：动画块按文档序递增负延迟，规则读 --qs-sk-delay", () => {
    const html = renderSkeletonSnapshot(snapshot, { width: 200 });

    // 两个块均 ≥48×8 → 动画：index 0 负零延迟、index 1 递增
    expect(html).toContain("--qs-sk-delay:-0ms");
    expect(html).toContain("--qs-sk-delay:-80ms");
    expect(html).toContain("animation-delay: var(--qs-sk-delay, 0ms)");
  });

  it("staggerDelay: 0 关闭错峰（块无内联负延迟）", () => {
    const html = renderSkeletonSnapshot(snapshot, { width: 200, staggerDelay: 0 });
    expect(html).not.toContain("--qs-sk-delay:-");
  });

  it("reducedMotion：动画层由 is-static 规则隐藏（块类不变）", () => {
    const html = renderSkeletonSnapshot(snapshot, { width: 200, reducedMotion: true });

    expect(html).toContain(".qs-skel-container.is-static .qs-skel-block.is-shimmer::before");
    expect(blockCount(html)).toBe(2);
  });

  it("门槛过滤：宽块带 is-shimmer 动画层，小块（头像/图标）静态", () => {
    const mixed = [
      { x: 0, y: 0, width: 100, height: 20, borderRadius: "4px" }, // ≥48×8 → 动画
      { x: 0, y: 30, width: 30, height: 30, borderRadius: "4px" }, // <48 → 静态
      { x: 0, y: 70, width: 60, height: 6, borderRadius: "2px" }, // 高 <8 → 静态
    ];
    const html = renderSkeletonSnapshot(mixed, { width: 200 });

    expect(blockCount(html)).toBe(3);
    expect((html.match(/qs-skel-block is-shimmer/g) ?? []).length).toBe(1);
    expect(html).toContain('class="qs-skel-block is-shimmer"');
    expect(html).toContain('class="qs-skel-block" style=');
  });

  it("空快照输出空容器", () => {
    const html = renderSkeletonSnapshot([], { width: 200 });
    expect(blockCount(html)).toBe(0);
    expect(html).toContain("height:0px");
  });

  it("自定义颜色与时长生效", () => {
    const html = renderSkeletonSnapshot(snapshot, {
      width: 200,
      shimmerColor: "#ff0000",
      backgroundColor: "#00ff00",
      duration: 800,
    });

    expect(html).toContain("#ff0000");
    expect(html).toContain("#00ff00");
    expect(html).toContain("800ms");
  });

  it("动画变量内联在容器 div 上（按容器定制）", () => {
    const html = renderSkeletonSnapshot(snapshot, {
      width: 200,
      shimmerColor: "#ff0000",
      backgroundColor: "#00ff00",
      duration: 800,
      timingFunction: "linear",
    });

    // 变量在容器 div 的 style 上，规则读变量
    expect(html).toContain("--qs-sk-shimmer:#ff0000");
    expect(html).toContain("--qs-sk-bg:#00ff00");
    expect(html).toContain("--qs-sk-duration:800ms");
    expect(html).toContain("--qs-sk-timing:linear");
    expect(html).toContain("var(--qs-sk-duration, 800ms)");
    expect(html).toContain("var(--qs-sk-timing, linear)");
  });

  it("默认时序函数为 ease-in-out", () => {
    const html = renderSkeletonSnapshot(snapshot, { width: 200 });
    expect(html).toContain("--qs-sk-timing:ease-in-out");
  });

  it("渐变层 z-index 在块背景之上（不被不透明块遮挡）", () => {
    const html = renderSkeletonSnapshot(snapshot, { width: 200 });
    expect(html).toContain("z-index: 1");
    // ::before 规则先于块元素渲染（CSS 先于 DOM 输出），z-index 保证层叠正确
    expect(html.indexOf(".qs-skel-block.is-shimmer::before")).toBeLessThan(
      html.indexOf("qs-skel-block is-shimmer"),
    );
  });

  it("reducedMotion：容器带 is-static 类", () => {
    const html = renderSkeletonSnapshot(snapshot, { width: 200, reducedMotion: true });
    expect(html).toContain('class="qs-skel-container is-static"');
  });
});
