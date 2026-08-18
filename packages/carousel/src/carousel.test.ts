import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Carousel } from "./carousel";
import type { CarouselItem } from "./types";

const ITEMS: CarouselItem[] = [
  { value: "a", title: "青", image: "/a.png" },
  { value: "b", title: "梧", image: "/b.png", thumbnail: "/bt.png" },
  { value: "c", title: "轮播", image: "/c.png" },
];

let root: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  root = document.createElement("div");
  document.body.append(root);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("Carousel", () => {
  test("渲染默认项和缩略图", () => {
    const car = new Carousel(root, { items: ITEMS });
    expect(root.classList.contains("qcar")).toBe(true);
    expect(root.querySelector<HTMLImageElement>(".qcar-figure")!.getAttribute("src")).toBe(
      "/a.png",
    );
    expect(root.querySelector(".qcar-title")!.textContent).toBe("青");
    expect(root.querySelectorAll(".qcar-thumb")).toHaveLength(3);
    expect(car.value).toBe("a");
  });

  test("next / prev 循环切换", () => {
    const car = new Carousel(root, { items: ITEMS });
    car.next();
    expect(car.value).toBe("b");
    car.prev();
    expect(car.value).toBe("a");
    car.prev();
    expect(car.value).toBe("c");
  });

  test("非循环模式禁用边界箭头", () => {
    const car = new Carousel(root, { items: ITEMS, loop: false });
    expect(root.querySelector<HTMLButtonElement>(".qcar-prev")!.disabled).toBe(true);
    car.goTo(2);
    expect(root.querySelector<HTMLButtonElement>(".qcar-next")!.disabled).toBe(true);
  });

  test("受控模式只回调不改内部值", () => {
    const onChange = vi.fn();
    const car = new Carousel(root, { items: ITEMS, value: "a", onChange });
    car.next();
    expect(onChange).toHaveBeenCalledWith("b", ITEMS[1], 1);
    expect(car.value).toBe("a");
    car.update({ value: "b" });
    expect(car.value).toBe("b");
  });

  test("键盘左右切换", () => {
    const car = new Carousel(root, { items: ITEMS });
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(car.value).toBe("b");
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(car.value).toBe("a");
  });

  test("自动播放和销毁", () => {
    const car = new Carousel(root, { items: ITEMS, autoplay: true, interval: 1000 });
    vi.advanceTimersByTime(1000);
    expect(car.value).toBe("b");
    car.destroy();
    expect(root.children).toHaveLength(0);
  });

  test("speed 倍率缩短实际间隔", () => {
    const car = new Carousel(root, { items: ITEMS, autoplay: true, interval: 1000, speed: 2 });
    vi.advanceTimersByTime(500);
    expect(car.value).toBe("b");
  });

  test("实际间隔钳制到 250ms", () => {
    const car = new Carousel(root, { items: ITEMS, autoplay: true, interval: 300, speed: 4 });
    vi.advanceTimersByTime(250);
    expect(car.value).toBe("b");
  });

  test("update 关闭自动播放后不再轮播", () => {
    const car = new Carousel(root, { items: ITEMS, autoplay: true, interval: 1000 });
    vi.advanceTimersByTime(1000);
    expect(car.value).toBe("b");
    car.update({ autoplay: false });
    vi.advanceTimersByTime(3000);
    expect(car.value).toBe("b");
  });

  test("update 开启自动播放后按新间隔轮播", () => {
    const car = new Carousel(root, { items: ITEMS });
    expect(car.value).toBe("a");
    car.update({ autoplay: true, interval: 1000 });
    vi.advanceTimersByTime(1000);
    expect(car.value).toBe("b");
  });

  test("update interval 即时重排计时", () => {
    const car = new Carousel(root, { items: ITEMS, autoplay: true, interval: 2000 });
    car.update({ interval: 1000 });
    vi.advanceTimersByTime(1000);
    expect(car.value).toBe("b");
  });

  test("update speed 即时重排计时", () => {
    const car = new Carousel(root, { items: ITEMS, autoplay: true, interval: 2000 });
    car.update({ speed: 2 });
    vi.advanceTimersByTime(1000);
    expect(car.value).toBe("b");
  });

  test("update showArrows 运行时增删箭头", () => {
    const car = new Carousel(root, { items: ITEMS });
    expect(root.querySelectorAll(".qcar-arrow")).toHaveLength(2);
    car.update({ showArrows: false });
    expect(root.querySelectorAll(".qcar-arrow")).toHaveLength(0);
    car.update({ showArrows: true });
    expect(root.querySelectorAll(".qcar-arrow")).toHaveLength(2);
  });

  test("update showThumbs 运行时增删缩略图", () => {
    const car = new Carousel(root, { items: ITEMS });
    expect(root.querySelectorAll(".qcar-thumb")).toHaveLength(3);
    car.update({ showThumbs: false });
    expect(root.querySelectorAll(".qcar-thumb")).toHaveLength(0);
    car.update({ showThumbs: true });
    expect(root.querySelectorAll(".qcar-thumb")).toHaveLength(3);
  });

  test("update loop 运行时更新边界禁用", () => {
    const car = new Carousel(root, { items: ITEMS, loop: false });
    expect(root.querySelector<HTMLButtonElement>(".qcar-prev")!.disabled).toBe(true);
    car.update({ loop: true });
    expect(root.querySelector<HTMLButtonElement>(".qcar-prev")!.disabled).toBe(false);
    car.update({ loop: false });
    car.goTo(2);
    expect(root.querySelector<HTMLButtonElement>(".qcar-next")!.disabled).toBe(true);
    car.update({ loop: true });
    expect(root.querySelector<HTMLButtonElement>(".qcar-next")!.disabled).toBe(false);
  });

  test("speed 非正数时回退为按 interval 播放", () => {
    const car = new Carousel(root, { items: ITEMS, autoplay: true, interval: 1000 });
    car.update({ speed: 0 });
    vi.advanceTimersByTime(1000);
    expect(car.value).toBe("b");
  });
});
