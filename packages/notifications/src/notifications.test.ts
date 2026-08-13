import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Notifications } from "./notifications";
import type { NotificationItem } from "./types";

function makeContainer(): HTMLElement {
  const div = document.createElement("div");
  document.body.append(div);
  return div;
}

function qsPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".qntf-panel");
}

function qsItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".qntf-item"));
}

const BASE: NotificationItem[] = [
  { id: 1, title: "第一条消息", sub: "摘要 A" },
  { id: 2, title: "第二条消息", unread: true },
  { id: 3, title: "第三条消息", sub: "摘要 C", glyph: "三" },
];

describe("Notifications", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = makeContainer();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("构造后创建触发器并挂载红点徽标", () => {
    new Notifications(root, { items: BASE, unreadCount: 2 });
    const trigger = document.querySelector<HTMLButtonElement>(".qntf-trigger");
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger!.getAttribute("aria-expanded")).toBe("false");
    expect(trigger!.getAttribute("aria-label")).toBe("消息");
    const badge = document.querySelector<HTMLElement>(".qntf-badge");
    expect(badge!.classList.contains("is-visible")).toBe(true);
  });

  test("unreadCount 为 0 时红点隐藏", () => {
    new Notifications(root, { items: BASE, unreadCount: 0 });
    const badge = document.querySelector<HTMLElement>(".qntf-badge");
    expect(badge!.classList.contains("is-visible")).toBe(false);
  });

  test("面板挂到 body，打开后渲染全部条目与错峰类", async () => {
    const bell = new Notifications(root, { items: BASE });
    const panel = qsPanel();
    expect(panel).toBeTruthy();
    expect(panel!.hidden).toBe(true);

    bell.open();
    expect(panel!.hidden).toBe(false);
    // is-open 经 requestAnimationFrame 加入，等一帧
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(panel!.classList.contains("is-open")).toBe(true);
    const items = qsItems();
    expect(items.length).toBe(3);
    // 默认布局：glyph / title / sub
    expect(items[0]!.querySelector(".qntf-item-title")!.textContent).toBe("第一条消息");
    expect(items[0]!.querySelector(".qntf-item-sub")!.textContent).toBe("摘要 A");
    // 未读圆点
    expect(items[1]!.classList.contains("is-unread")).toBe(true);
  });

  test("onOpenChange 回调触发，打开即清红点场景可落地", () => {
    const onOpenChange = vi.fn();
    const bell = new Notifications(root, { items: BASE, unreadCount: 3, onOpenChange });
    bell.open();
    expect(onOpenChange).toHaveBeenCalledWith(true);
    bell.update({ unreadCount: 0 });
    expect(document.querySelector<HTMLElement>(".qntf-badge")!.classList.contains("is-visible")).toBe(false);
    bell.close();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("点击条目触发 onItemClick 并收起面板", () => {
    const onItemClick = vi.fn();
    const bell = new Notifications(root, { items: BASE, onItemClick });
    bell.open();
    const items = qsItems();
    items[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onItemClick).toHaveBeenCalledWith(expect.objectContaining({ id: 2, title: "第二条消息" }));
    expect(bell.expanded).toBe(false);
  });

  test("空列表显示 emptyText 空态", () => {
    const bell = new Notifications(root, { items: [], emptyText: "还没有消息" });
    bell.open();
    const empty = document.querySelector<HTMLElement>(".qntf-empty");
    expect(empty).toBeTruthy();
    expect(empty!.textContent).toBe("还没有消息");
  });

  test("点外部关闭面板", () => {
    const bell = new Notifications(root, { items: BASE });
    bell.open();
    expect(bell.expanded).toBe(true);
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(bell.expanded).toBe(false);
  });

  test("update 同步条目与未读数", () => {
    const bell = new Notifications(root, { items: BASE, unreadCount: 1 });
    bell.update({ items: [BASE[0]!], unreadCount: 0 });
    expect(qsItems().length).toBe(1);
    const badge = document.querySelector<HTMLElement>(".qntf-badge");
    expect(badge!.classList.contains("is-visible")).toBe(false);
  });

  test("destroy 移除面板并清空宿主", () => {
    const bell = new Notifications(root, { items: BASE });
    bell.destroy();
    expect(document.querySelector<HTMLElement>(".qntf-panel")).toBeNull();
    expect(root.textContent).toBe("");
    expect(root.classList.contains("qntf")).toBe(false);
  });
});
