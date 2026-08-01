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
