import "@testing-library/jest-dom";

// jsdom 未实现 ResizeObserver，代码块视图依赖它测量行高
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

// jsdom 未实现 matchMedia，部分 UI 依赖它做媒体查询
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom 未实现 Range/Text 的 getClientRects 与 getBoundingClientRect，
// prosemirror-view 的 scrollToSelection → coordsAtPos → singleRect 依赖它们
// （代码块删除确认等触发 dispatch 后滚动选择区时会调用，缺失会在测试后抛未处理异常）
const emptyRectList: DOMRectList = [] as unknown as DOMRectList;
const emptyDomRect = () =>
  ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  }) as DOMRect;

if (typeof Range !== "undefined") {
  if (typeof Range.prototype.getClientRects !== "function") {
    Range.prototype.getClientRects = () => emptyRectList;
  }
  if (typeof Range.prototype.getBoundingClientRect !== "function") {
    Range.prototype.getBoundingClientRect = emptyDomRect;
  }
}

if (typeof Text !== "undefined") {
  if (typeof Text.prototype.getClientRects !== "function") {
    Text.prototype.getClientRects = () => emptyRectList;
  }
  if (typeof Text.prototype.getBoundingClientRect !== "function") {
    Text.prototype.getBoundingClientRect = emptyDomRect;
  }
}
