import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Select } from "./select";
import type { SelectOption } from "./types";

function makeContainer(): HTMLElement {
  const div = document.createElement("div");
  document.body.append(div);
  return div;
}

function qsPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".qsel-panel");
}

function qsOptions(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".qsel-opt"));
}

const BASE: SelectOption[] = [
  { value: "a", label: "选项 A" },
  { value: "b", label: "选项 B" },
  { value: "c", label: "选项 C", disabled: true },
  { value: "d", label: "选项 D" },
];

describe("Select", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = makeContainer();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("构造后创建触发器并挂载 combobox 语义", () => {
    new Select(root, { options: BASE });
    const trigger = document.querySelector<HTMLButtonElement>(".qsel-trigger");
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute("role")).toBe("combobox");
    expect(trigger!.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger!.getAttribute("aria-expanded")).toBe("false");
    expect(trigger!.getAttribute("aria-label")).toBe("请选择");
    expect(document.querySelector<HTMLElement>(".qsel-value")!.textContent).toBe("");
  });

  test("未选中时显示占位符", () => {
    new Select(root, { options: BASE, placeholder: "请选择框架" });
    const value = document.querySelector<HTMLElement>(".qsel-value");
    expect(value!.textContent).toBe("请选择框架");
    expect(value!.classList.contains("is-placeholder")).toBe(true);
  });

  test("defaultValue 预选并渲染 label", () => {
    new Select(root, { options: BASE, defaultValue: "b" });
    const value = document.querySelector<HTMLElement>(".qsel-value");
    expect(value!.textContent).toBe("选项 B");
    expect(value!.classList.contains("is-placeholder")).toBe(false);
  });

  test("open() 显示面板并同步 aria-expanded", () => {
    const sel = new Select(root, { options: BASE });
    expect(qsPanel()!.hidden).toBe(true);
    sel.open();
    expect(qsPanel()!.hidden).toBe(false);
    expect(document.querySelector(".qsel-trigger")!.getAttribute("aria-expanded")).toBe("true");
  });

  test("open/close 触发 onOpenChange 回调", () => {
    const onOpenChange = vi.fn();
    const sel = new Select(root, { options: BASE, onOpenChange });
    sel.open();
    expect(onOpenChange).toHaveBeenCalledWith(true);
    sel.close();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("点击选项选中：onChange 回调 + 非受控更新 + 面板关闭", () => {
    const onChange = vi.fn();
    const sel = new Select(root, { options: BASE, onChange });
    sel.open();
    qsOptions()[1]!.click();
    expect(onChange).toHaveBeenCalledWith("b", { value: "b", label: "选项 B" });
    expect(sel.value).toBe("b");
    expect(sel.expanded).toBe(false);
    expect(document.querySelector(".qsel-trigger")!.getAttribute("aria-expanded")).toBe("false");
  });

  test("禁用选项点击不触发选中", () => {
    const onChange = vi.fn();
    const sel = new Select(root, { options: BASE, onChange });
    sel.open();
    const opt = qsOptions()[2]!;
    expect(opt.getAttribute("aria-disabled")).toBe("true");
    opt.click();
    expect(onChange).not.toHaveBeenCalled();
    expect(sel.value).toBeNull();
  });

  test("受控模式：用户选择仅回调，显示值由 update 同步", () => {
    const onChange = vi.fn();
    const sel = new Select(root, { options: BASE, value: "a", onChange });
    sel.open();
    qsOptions()[1]!.click();
    expect(onChange).toHaveBeenCalledWith("b", expect.objectContaining({ value: "b" }));
    expect(sel.value).toBe("a"); // 受控：内部不改
    sel.update({ value: "b" });
    expect(sel.value).toBe("b");
    expect(document.querySelector<HTMLElement>(".qsel-value")!.textContent).toBe("选项 B");
  });

  test("键盘：ArrowDown 跳过禁用项，Enter 选中", () => {
    const onChange = vi.fn();
    const sel = new Select(root, { options: BASE, onChange });
    sel.open();
    const trigger = document.querySelector<HTMLButtonElement>(".qsel-trigger")!;
    // 初始高亮 A(0)，向下跳过 B? A->B 可用 -> 1；再向下跳过 C -> 3
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onChange).toHaveBeenCalledWith("d", expect.objectContaining({ value: "d" }));
  });

  test("键盘：ArrowUp 从底部回绕，禁用项被跳过", () => {
    const onChange = vi.fn();
    const sel = new Select(root, { options: BASE, onChange });
    sel.open();
    const trigger = document.querySelector<HTMLButtonElement>(".qsel-trigger")!;
    // 初始 A(0)，向上回绕到最后一个启用项 D(3)
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onChange).toHaveBeenCalledWith("d", expect.objectContaining({ value: "d" }));
  });

  test("悬浮不写死 is-active：焦点态仅由键盘 / 打开驱动（跟手）", () => {
    const sel = new Select(root, { options: BASE });
    sel.open();
    const opts = qsOptions();
    // 打开时高亮当前值 A(0)
    expect(opts[0]!.classList.contains("is-active")).toBe(true);
    // 模拟悬浮到 D(3)，不应把 is-active 写死到 D
    opts[3]!.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(opts[3]!.classList.contains("is-active")).toBe(false);
    expect(opts[0]!.classList.contains("is-active")).toBe(true);
  });

  test("Escape 关闭面板", () => {
    const sel = new Select(root, { options: BASE });
    sel.open();
    const trigger = document.querySelector<HTMLButtonElement>(".qsel-trigger")!;
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(sel.expanded).toBe(false);
  });

  test("点击外部关闭面板", () => {
    const sel = new Select(root, { options: BASE });
    sel.open();
    expect(sel.expanded).toBe(true);
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(sel.expanded).toBe(false);
  });

  test("整体禁用时 open() 无效", () => {
    const sel = new Select(root, { options: BASE, disabled: true });
    expect(sel.expanded).toBe(false);
    sel.open();
    expect(sel.expanded).toBe(false);
    expect(document.querySelector<HTMLButtonElement>(".qsel-trigger")!.disabled).toBe(true);
  });

  test("setDisabled 动态禁用并关闭已打开面板", () => {
    const sel = new Select(root, { options: BASE });
    sel.open();
    expect(sel.expanded).toBe(true);
    sel.setDisabled(true);
    expect(sel.expanded).toBe(false);
    expect(document.querySelector<HTMLButtonElement>(".qsel-trigger")!.disabled).toBe(true);
    sel.open();
    expect(sel.expanded).toBe(false);
  });

  test("update 同步 value / placeholder / options", () => {
    const sel = new Select(root, { options: BASE, defaultValue: "a" });
    sel.update({ value: "d" });
    expect(document.querySelector<HTMLElement>(".qsel-value")!.textContent).toBe("选项 D");
    sel.update({ placeholder: "新占位" });
    sel.update({ value: null });
    expect(document.querySelector<HTMLElement>(".qsel-value")!.textContent).toBe("新占位");
    sel.update({ options: [{ value: "x", label: "新选项" }] });
    expect(sel.value).toBeNull();
  });

  test("destroy 清空根元素并移除 body 面板", () => {
    const sel = new Select(root, { options: BASE });
    sel.open();
    sel.destroy();
    expect(root.children.length).toBe(0);
    expect(document.querySelector(".qsel-panel")).toBeNull();
  });

  test("小数据量选项带 is-enter 手风琴动画，超过 maxStagger 降级", () => {
    const small = new Select(root, { options: BASE });
    small.open();
    expect(qsOptions().length).toBe(4);
    expect(qsOptions()[0]!.classList.contains("is-enter")).toBe(true);
    small.destroy();

    const big = new Select(document.createElement("div"), {
      options: Array.from({ length: 20 }, (_, i) => ({ value: String(i), label: `项 ${i}` })),
      maxStagger: 12,
    });
    big.open();
    const opts = document.querySelectorAll<HTMLElement>(".qsel-opt");
    expect(opts.length).toBe(20);
    opts.forEach((o) => {
      expect(o.classList.contains("is-enter")).toBe(false);
    });
    big.destroy();
  });

  test("animate: false 时无错峰动画", () => {
    const sel = new Select(root, { options: BASE, animate: false });
    sel.open();
    qsOptions().forEach((o) => {
      expect(o.classList.contains("is-enter")).toBe(false);
    });
  });

  test("宽度模式不影响功能：width auto 渲染面板", () => {
    const sel = new Select(root, { options: BASE, width: "auto" });
    sel.open();
    expect(qsPanel()!.hidden).toBe(false);
  });
});
