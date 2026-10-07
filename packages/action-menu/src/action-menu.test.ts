import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ActionMenu } from "./action-menu";
import type { ActionMenuItem } from "./types";

function makeContainer(): HTMLElement {
  const div = document.createElement("div");
  document.body.append(div);
  return div;
}

function qsFan(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".qam-fan");
}

function qsItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".qam-item"));
}

function qsTrigger(): HTMLElement {
  const t = document.querySelector<HTMLElement>(".qam-trigger");
  if (!t) throw new Error("trigger not found");
  return t;
}

function key(trigger: HTMLElement, k: string): void {
  trigger.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
}

const BASE: ActionMenuItem[] = [
  { id: "copy", icon: "<svg><circle/></svg>", label: "复制", onClick: () => {} },
  { id: "edit", icon: "<svg><circle/></svg>", label: "编辑" },
  { id: "trash", icon: "<svg><circle/></svg>", label: "删除", disabled: true },
  { id: "share", icon: "<svg><circle/></svg>", label: "分享" },
];

describe("ActionMenu", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = makeContainer();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("构造后创建 FAB 触发器与 hidden 面板，并挂载 menu 语义", () => {
    new ActionMenu(root, { items: BASE });
    const trigger = document.querySelector<HTMLElement>(".qam-trigger-fab");
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger!.getAttribute("aria-expanded")).toBe("false");
    expect(trigger!.getAttribute("aria-label")).toBe("快捷操作");
    const fan = qsFan();
    expect(fan).toBeTruthy();
    expect(fan!.hidden).toBe(true);
    expect(fan!.getAttribute("role")).toBe("menu");
  });

  test("hover 触发器展开，aria-expanded 同步；离开命中圆收起", () => {
    vi.useFakeTimers();
    try {
      const menu = new ActionMenu(root, { items: BASE });
      const trigger = qsTrigger();
      trigger.dispatchEvent(new MouseEvent("mouseenter"));
      expect(menu.expanded).toBe(true);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(qsFan()!.hidden).toBe(false);
      // 移出触发器但仍在命中圆内 → 不收起
      trigger.dispatchEvent(new MouseEvent("mouseleave"));
      expect(menu.expanded).toBe(true);
      // 移出整个扇区热区 → 延迟后收起
      const items = document.querySelector<HTMLElement>(".qam-items");
      items!.dispatchEvent(new MouseEvent("mouseleave"));
      vi.advanceTimersByTime(200);
      expect(menu.expanded).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("点击触发器切换展开/收起", () => {
    const menu = new ActionMenu(root, { items: BASE });
    const trigger = qsTrigger();
    trigger.click();
    expect(menu.expanded).toBe(true);
    trigger.click();
    expect(menu.expanded).toBe(false);
  });

  test("hover 扇区并移出触发器时菜单保持展开，点击后才收起", () => {
    vi.useFakeTimers();
    try {
      const menu = new ActionMenu(root, { items: BASE });
      const trigger = qsTrigger();
      trigger.dispatchEvent(new MouseEvent("mouseenter"));
      // 指针从触发器移向扇区：离开触发器 + 进入扇区热区
      trigger.dispatchEvent(new MouseEvent("mouseleave"));
      const items = qsItems();
      items[1]!.querySelector(".qam-item-ico")!.dispatchEvent(new MouseEvent("mouseenter"));
      vi.advanceTimersByTime(300);
      expect(menu.expanded).toBe(true);
      // 所有扇区的 label 都渲染在 DOM（两段式：仅 hover 项显示，其余隐藏由 CSS 控制）
      expect(items[0]!.querySelector(".qam-item-label")).toBeTruthy();
      expect(items[2]!.querySelector(".qam-item-label")).toBeTruthy();
      // 点击扇区 → 触发并收起
      items[1]!
        .querySelector(".qam-item-ico")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(menu.expanded).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("点击扇区触发 onAction + item.onClick 并收起", () => {
    const onClick = vi.fn();
    const onAction = vi.fn();
    const items = BASE.map((it, i) => (i === 0 ? { ...it, onClick } : it));
    const menu = new ActionMenu(root, { items, onAction });
    menu.open();
    qsItems()[0]!
      .querySelector(".qam-item-ico")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "copy" }), 0);
    expect(menu.expanded).toBe(false);
  });

  test("禁用扇区点击不触发", () => {
    const onAction = vi.fn();
    const menu = new ActionMenu(root, { items: BASE, onAction });
    menu.open();
    qsItems()[2]!
      .querySelector(".qam-item-ico")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).not.toHaveBeenCalled();
    expect(menu.expanded).toBe(true);
  });

  test("两段式披露：打开无 label，hover 扇区仅该项 is-active；移出图标不闪断，移出热区才清除", () => {
    vi.useFakeTimers();
    try {
      const menu = new ActionMenu(root, { items: BASE });
      menu.open();
      const items = qsItems();
      // 打开时无任何 is-active（label 全部隐藏）
      items.forEach((it) => {
        expect(it.classList.contains("is-active")).toBe(false);
      });
      // hover 扇区 1 → 仅 1 高亮
      items[1]!.querySelector(".qam-item-ico")!.dispatchEvent(new MouseEvent("mouseenter"));
      expect(items[1]!.classList.contains("is-active")).toBe(true);
      expect(items[0]!.classList.contains("is-active")).toBe(false);
      // 移出图标但仍在扇区热区：保持高亮，label 不闪断
      items[1]!.querySelector(".qam-item-ico")!.dispatchEvent(new MouseEvent("mouseleave"));
      expect(items[1]!.classList.contains("is-active")).toBe(true);
      // hover label 本身也能保持高亮
      items[1]!.querySelector(".qam-item-label")!.dispatchEvent(new MouseEvent("mouseenter"));
      expect(items[1]!.classList.contains("is-active")).toBe(true);
      // 移出整个扇区热区 → 收起并清除高亮
      document
        .querySelector<HTMLElement>(".qam-items")!
        .dispatchEvent(new MouseEvent("mouseleave"));
      vi.advanceTimersByTime(200);
      expect(menu.expanded).toBe(false);
      expect(items[1]!.classList.contains("is-active")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test("几何：direction=right 时首个扇区在顶部（x≈0, y<0），中部扇区 label 钳制 45°", () => {
    new ActionMenu(root, { items: BASE, spread: 180, radius: 56 });
    const items = qsItems();
    // 顶部扇区
    const m = items[0]!.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
    expect(Number(m![1])).toBeCloseTo(0, 1);
    expect(Number(m![2])).toBeLessThan(0);
    // 中部扇区 label 旋转 clamp 到 45°
    const rot = items[1]!
      .querySelector<HTMLElement>(".qam-item-label")!
      .style.getPropertyValue("--qam-rot");
    expect(rot).toBe("45.0deg");
  });

  test("几何：direction=left 时图标在触发器左侧（x<0）", () => {
    new ActionMenu(root, { items: BASE, direction: "left", spread: 180, radius: 56 });
    const m = qsItems()[1]!.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
    expect(Number(m![1])).toBeLessThan(0);
  });

  test("键盘：ArrowDown 展开并高亮首个启用项，跳过禁用项，Enter 触发", () => {
    const onClick = vi.fn();
    const items = BASE.map((it, i) => (i === 0 ? { ...it, onClick } : it));
    const menu = new ActionMenu(root, { items });
    const trigger = qsTrigger();
    key(trigger, "ArrowDown");
    expect(menu.expanded).toBe(true);
    expect(menu.activeIndex).toBe(0);
    key(trigger, "ArrowDown");
    // 0 → 1（跳过禁用 2）
    expect(menu.activeIndex).toBe(1);
    key(trigger, "ArrowDown");
    expect(menu.activeIndex).toBe(3);
    key(trigger, "Enter");
    expect(onClick).not.toHaveBeenCalled(); // 当前高亮 3 无 onClick
    expect(menu.expanded).toBe(false);
  });

  test("键盘：Enter 展开并高亮首个启用项，再次 Enter 触发", () => {
    const onClick = vi.fn();
    const items = BASE.map((it, i) => (i === 1 ? { ...it, onClick } : it));
    const menu = new ActionMenu(root, { items });
    const trigger = qsTrigger();
    key(trigger, "Enter"); // 展开 + 高亮首个启用项 0
    expect(menu.expanded).toBe(true);
    expect(menu.activeIndex).toBe(0);
    key(trigger, "ArrowDown"); // 高亮 1
    expect(menu.activeIndex).toBe(1);
    key(trigger, "Enter");
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(menu.expanded).toBe(false);
  });

  test("键盘：ArrowUp 回绕到底部，跳过禁用项", () => {
    const menu = new ActionMenu(root, { items: BASE });
    const trigger = qsTrigger();
    key(trigger, "ArrowUp");
    expect(menu.activeIndex).toBe(3); // 从顶部回绕到最后一个启用项
  });

  test("Escape 关闭", () => {
    const menu = new ActionMenu(root, { items: BASE });
    menu.open();
    key(qsTrigger(), "Escape");
    expect(menu.expanded).toBe(false);
  });

  test("点击外部关闭", () => {
    const menu = new ActionMenu(root, { items: BASE });
    menu.open();
    expect(menu.expanded).toBe(true);
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(menu.expanded).toBe(false);
  });

  test("open/close 触发 onOpenChange", () => {
    const onOpenChange = vi.fn();
    const menu = new ActionMenu(root, { items: BASE, onOpenChange });
    menu.open();
    expect(onOpenChange).toHaveBeenCalledWith(true);
    menu.close();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("外部 trigger 模式：使用传入元素，hover 展开", () => {
    const custom = document.createElement("button");
    root.append(custom);
    const menu = new ActionMenu(root, { items: BASE, trigger: custom });
    custom.dispatchEvent(new MouseEvent("mouseenter"));
    expect(menu.expanded).toBe(true);
    expect(document.querySelector(".qam-trigger-fab")).toBeNull();
  });

  test("无菜单项时 open 无效", () => {
    const menu = new ActionMenu(root, { items: [] });
    menu.open();
    expect(menu.expanded).toBe(false);
  });

  test("update 换 items / 换方向后重新布局", () => {
    const menu = new ActionMenu(root, { items: BASE });
    const before = qsItems()[0]!.style.transform;
    menu.update({ items: [{ id: "only", icon: "<i/>", label: "仅一个" }] });
    expect(qsItems().length).toBe(1);
    expect(qsItems()[0]!.style.transform).not.toBe(before);
    menu.update({ direction: "left" });
    const m = qsItems()[0]!.style.transform.match(/translate\(([-\d.]+)px, /);
    expect(Number(m![1])).toBeLessThan(0);
  });

  test("destroy 移除 body 面板并清空根容器", () => {
    const menu = new ActionMenu(root, { items: BASE });
    menu.open();
    menu.destroy();
    expect(document.querySelector(".qam-fan")).toBeNull();
    expect(root.children.length).toBe(0);
  });
});
