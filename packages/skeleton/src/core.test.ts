import { afterEach, describe, expect, it } from "vitest";
import { extractElementInfo, isLeafElement, structureSignature } from "./core";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isLeafElement", () => {
  it("ALWAYS_LEAF 标签（img）", () => {
    document.body.innerHTML = '<img src="x" />';
    expect(isLeafElement(document.querySelector("img")!)).toBe(true);
  });

  it("含真实元素子节点不是叶子", () => {
    document.body.innerHTML = "<div><span>a</span></div>";
    expect(isLeafElement(document.querySelector("div")!)).toBe(false);
  });

  it("仅文本是叶子", () => {
    document.body.innerHTML = "<div>hello</div>";
    expect(isLeafElement(document.querySelector("div")!)).toBe(true);
  });

  it("仅 br 等 void 元素是叶子", () => {
    document.body.innerHTML = "<div>a<br>b</div>";
    expect(isLeafElement(document.querySelector("div")!)).toBe(true);
  });
});

describe("extractElementInfo", () => {
  const real = Element.prototype.getBoundingClientRect;
  const rects = new WeakMap<Element, DOMRect>();

  function mockRects(rootId: string) {
    Element.prototype.getBoundingClientRect = function (this: Element) {
      return rects.get(this) ?? ({ left: 0, top: 0, width: 0, height: 0 } as DOMRect);
    };
    return document.getElementById(rootId)!;
  }

  afterEach(() => {
    Element.prototype.getBoundingClientRect = real;
  });

  it("收集叶子几何（相对根容器偏移）", () => {
    document.body.innerHTML = `
      <div id="root">
        <img src="x" />
        <span>text</span>
      </div>
    `;
    const root = mockRects("root");
    rects.set(root, { left: 10, top: 20, width: 200, height: 100 } as DOMRect);
    rects.set(document.querySelector("img")!, {
      left: 10,
      top: 20,
      width: 50,
      height: 40,
    } as DOMRect);
    rects.set(document.querySelector("span")!, {
      left: 70,
      top: 30,
      width: 30,
      height: 16,
    } as DOMRect);

    const result = extractElementInfo(root);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ x: 0, y: 0, width: 50, height: 40 });
    expect(result[1]).toMatchObject({ x: 60, y: 10, width: 30, height: 16 });
  });

  it("data-skeleton-ignore 跳过整棵子树", () => {
    document.body.innerHTML = `
      <div id="root">
        <div data-skeleton-ignore><span>skip</span></div>
        <span>keep</span>
      </div>
    `;
    const root = mockRects("root");
    rects.set(root, { left: 0, top: 0, width: 200, height: 100 } as DOMRect);
    rects.set(document.querySelector("div > span")!, {
      left: 0,
      top: 0,
      width: 50,
      height: 20,
    } as DOMRect);

    const result = extractElementInfo(root);
    expect(result).toHaveLength(1);
    expect(result[0]!.width).toBe(50);
  });

  it("data-skeleton-no-children 整体作为叶子，子元素不收集", () => {
    document.body.innerHTML = `
      <div id="root">
        <div data-skeleton-no-children><span>inner</span></div>
      </div>
    `;
    const root = mockRects("root");
    rects.set(root, { left: 0, top: 0, width: 200, height: 100 } as DOMRect);
    const noChildren = document.querySelector("[data-skeleton-no-children]")!;
    rects.set(noChildren, { left: 0, top: 0, width: 120, height: 40 } as DOMRect);

    const result = extractElementInfo(root);
    expect(result).toHaveLength(1);
    expect(result[0]!.width).toBe(120);
  });

  it("maxElements 截断", () => {
    document.body.innerHTML = `
      <div id="root">
        <span>a</span><span>b</span><span>c</span>
      </div>
    `;
    const root = mockRects("root");
    rects.set(root, { left: 0, top: 0, width: 200, height: 100 } as DOMRect);
    for (const span of root.querySelectorAll("span")) {
      rects.set(span, { left: 0, top: 0, width: 50, height: 20 } as DOMRect);
    }

    const result = extractElementInfo(root, 2);
    expect(result).toHaveLength(2);
  });

  it("零尺寸元素被过滤", () => {
    document.body.innerHTML = `
      <div id="root">
        <span>zero</span>
      </div>
    `;
    const root = mockRects("root");
    rects.set(root, { left: 0, top: 0, width: 200, height: 100 } as DOMRect);
    // span 无 mock rect → 返回零尺寸，被过滤

    const result = extractElementInfo(root);
    expect(result).toHaveLength(0);
  });
});

describe("structureSignature（refetch 预筛哈希）", () => {
  it("相同结构 → 相同签名；重复调用稳定", () => {
    document.body.innerHTML = `
      <div id="root"><span>hello</span><img src="x" /><div><b>deep</b></div></div>
    `;
    const root = document.getElementById("root")!;
    expect(structureSignature(root)).toBe(structureSignature(root));
  });

  it("文本长度变化 → 签名变化（换行数可能变，必须触发重测）", () => {
    document.body.innerHTML = `<div id="root"><span>ab</span></div>`;
    const root = document.getElementById("root")!;
    const before = structureSignature(root);
    root.querySelector("span")!.textContent = "abcdef";
    expect(structureSignature(root)).not.toBe(before);
  });

  it("同长文本内容变化 → 签名不变（不影响几何）", () => {
    document.body.innerHTML = `<div id="root"><span>ab</span></div>`;
    const root = document.getElementById("root")!;
    const before = structureSignature(root);
    root.querySelector("span")!.textContent = "cd";
    expect(structureSignature(root)).toBe(before);
  });

  it("class/style 变化 → 签名变化（可能改布局）", () => {
    document.body.innerHTML = `<div id="root"><span>a</span></div>`;
    const root = document.getElementById("root")!;
    const before = structureSignature(root);
    root.querySelector("span")!.className = "wide";
    expect(structureSignature(root)).not.toBe(before);
  });

  it("非几何属性（data-id）变化 → 签名不变（不误触发）", () => {
    document.body.innerHTML = `<div id="root"><span>a</span></div>`;
    const root = document.getElementById("root")!;
    const before = structureSignature(root);
    root.querySelector("span")!.setAttribute("data-id", "42");
    expect(structureSignature(root)).toBe(before);
  });

  it("data-skeleton-ignore 子树内容变化 → 签名不变（不影响测量几何）", () => {
    document.body.innerHTML = `
      <div id="root"><div data-skeleton-ignore><span>skip</span></div></div>
    `;
    const root = document.getElementById("root")!;
    const before = structureSignature(root);
    root.querySelector("[data-skeleton-ignore]")!.textContent = "changed content";
    expect(structureSignature(root)).toBe(before);
  });

  it("元素增删 → 签名变化", () => {
    document.body.innerHTML = `<div id="root"><span>a</span></div>`;
    const root = document.getElementById("root")!;
    const before = structureSignature(root);
    const span = document.createElement("span");
    span.textContent = "new";
    root.appendChild(span);
    expect(structureSignature(root)).not.toBe(before);
  });
});
