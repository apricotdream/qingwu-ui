import { afterEach, describe, expect, test, vi } from "vitest";
import { ConfirmDialog, confirm } from "./index";
import type { ConfirmOptions } from "./types";

/* ============================================================
   Confirm 确认框测试
   - 三态返回值 / Esc / 遮罩 / dismiss / 互斥替换 / 异步 loading
   - 焦点回归 / 焦点陷阱 / morph 测量 / 降级兜底
   ============================================================ */

function makeTrigger(): HTMLElement {
  const b = document.createElement("button");
  b.type = "button";
  b.id = "trig";
  document.body.append(b);
  return b;
}

function qsPanel(): HTMLElement | null {
  return document.querySelector(".qc-panel");
}

function qsBackdrop(): HTMLElement | null {
  return document.querySelector(".qc-backdrop");
}

function qsConfirmBtn(): HTMLButtonElement | null {
  return qsPanel()?.querySelector<HTMLButtonElement>(".qc-confirm") ?? null;
}

function qsCancelBtn(): HTMLButtonElement | null {
  return qsPanel()?.querySelector<HTMLButtonElement>(".qc-cancel") ?? null;
}

function clickConfirm(): void {
  qsConfirmBtn()!.click();
}

function clickCancel(): void {
  qsCancelBtn()!.click();
}

/** 触发退场：派发 transitionend（happy-dom 不自动触发 CSS 过渡事件） */
function finishExit(): void {
  document.querySelector(".qc-panel.qc-exit")?.dispatchEvent(new Event("transitionend"));
}

/** 冲刷微任务 + 宏任务，等异步链走完 */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

const open = (btn: HTMLElement, options?: ConfirmOptions) =>
  confirm(btn, { title: "确认", ...options });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Confirm 三态返回值", () => {
  test("点确认 → resolve 'confirm'", async () => {
    const btn = makeTrigger();
    const p = open(btn);
    clickConfirm();
    finishExit();
    expect(await p).toBe("confirm");
  });

  test("点取消 → resolve 'cancel'", async () => {
    const btn = makeTrigger();
    const p = open(btn);
    clickCancel();
    finishExit();
    expect(await p).toBe("cancel");
  });

  test("Esc → resolve 'dismiss'", async () => {
    const btn = makeTrigger();
    const p = open(btn);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    finishExit();
    expect(await p).toBe("dismiss");
  });

  test("closeOnEsc:false 时 Esc 不关闭", async () => {
    const btn = makeTrigger();
    const p = open(btn, { closeOnEsc: false });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(qsPanel()).toBeTruthy();
    clickCancel();
    finishExit();
    expect(await p).toBe("cancel");
  });

  test("dismiss() → resolve 'dismiss'", async () => {
    const btn = makeTrigger();
    const p = open(btn);
    confirm.dismiss();
    finishExit();
    expect(await p).toBe("dismiss");
  });
});

describe("遮罩行为", () => {
  test("默认 dismiss：点击遮罩 resolve 'dismiss'", async () => {
    const btn = makeTrigger();
    const p = open(btn);
    qsBackdrop()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    finishExit();
    expect(await p).toBe("dismiss");
  });

  test("backdrop:'cancel' 时点击遮罩 resolve 'cancel'", async () => {
    const btn = makeTrigger();
    const p = open(btn, { backdrop: "cancel" });
    qsBackdrop()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    finishExit();
    expect(await p).toBe("cancel");
  });

  test("backdrop:'ignore' 时点击遮罩不关闭", async () => {
    const btn = makeTrigger();
    const p = open(btn, { backdrop: "ignore" });
    qsBackdrop()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(qsPanel()).toBeTruthy();
    clickCancel();
    finishExit();
    expect(await p).toBe("cancel");
  });
});

describe("互斥替换", () => {
  test("开着旧框再调用：旧框 resolve 'dismiss'，新框正常显示", async () => {
    const b1 = makeTrigger();
    const b2 = makeTrigger();
    const p1 = open(b1, { title: "旧" });
    const p2 = open(b2, { title: "新" });
    expect(await p1).toBe("dismiss");
    expect(qsPanel()!.querySelector(".qc-title")!.textContent).toBe("新");
    clickConfirm();
    finishExit();
    expect(await p2).toBe("confirm");
  });

  test("ConfirmDialog 实例：替换后旧 promise settle", async () => {
    const dlg = new ConfirmDialog();
    const b1 = makeTrigger();
    const b2 = makeTrigger();
    const p1 = dlg.confirm(b1, { title: "一" });
    const p2 = dlg.confirm(b2, { title: "二" });
    expect(await p1).toBe("dismiss");
    clickCancel();
    finishExit();
    expect(await p2).toBe("cancel");
  });
});

describe("异步确认", () => {
  test("onConfirm 返回 Promise：loading 后成功 → resolve 'confirm'", async () => {
    const btn = makeTrigger();
    let resolveFn!: () => void;
    const p = open(btn, {
      onConfirm: () => new Promise<void>((r) => (resolveFn = r)),
    });
    clickConfirm();

    const panel = qsPanel()!;
    expect(panel.classList.contains("qc-loading")).toBe(true);
    expect(qsConfirmBtn()!.disabled).toBe(true);
    expect(qsCancelBtn()!.disabled).toBe(true);

    await flush(); // 等 onConfirm 执行，resolveFn 被赋值
    resolveFn();
    await flush();
    expect(panel.classList.contains("qc-loading")).toBe(false);
    finishExit();
    expect(await p).toBe("confirm");
  });

  test("onConfirm reject：对话框保持打开，promise reject", async () => {
    const btn = makeTrigger();
    const p = open(btn, {
      onConfirm: () => Promise.reject(new Error("boom")),
    });
    clickConfirm();

    await expect(p).rejects.toThrow("boom");
    // 对话框仍在，loading 还原，按钮可用
    const panel = qsPanel()!;
    expect(panel).toBeTruthy();
    expect(panel.classList.contains("qc-loading")).toBe(false);
    expect(qsConfirmBtn()!.disabled).toBe(false);

    // 仍可取消关闭（promise 已 settle，不会二次 resolve）
    clickCancel();
    finishExit();
    await flush();
    expect(qsPanel()).toBeNull();
  });

  test("loading 期间 Esc 被忽略", async () => {
    const btn = makeTrigger();
    let resolveFn!: () => void;
    const p = open(btn, { onConfirm: () => new Promise<void>((r) => (resolveFn = r)) });
    clickConfirm();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(qsPanel()).toBeTruthy();
    await flush(); // 等 onConfirm 执行
    resolveFn();
    await flush();
    finishExit();
    expect(await p).toBe("confirm");
  });
});

describe("a11y 与结构", () => {
  test("role / aria-modal / aria-labelledby 内建", async () => {
    const btn = makeTrigger();
    const p = open(btn, { title: "删除文件", message: "不可撤销" });
    const panel = qsPanel()!;
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("true");
    const labelledby = panel.getAttribute("aria-labelledby")!;
    expect(panel.querySelector(`#${labelledby}`)!.textContent).toBe("删除文件");
    const describedby = panel.getAttribute("aria-describedby")!;
    expect(panel.querySelector(`#${describedby}`)!.textContent).toBe("不可撤销");
    clickCancel();
    finishExit();
    await p;
  });

  test("danger 变体：面板加 qc-danger，确认按钮文案可配", async () => {
    const btn = makeTrigger();
    const p = open(btn, { danger: true, confirmText: "删除", cancelText: "留着" });
    const panel = qsPanel()!;
    expect(panel.classList.contains("qc-danger")).toBe(true);
    expect(qsConfirmBtn()!.textContent).toBe("删除");
    expect(qsCancelBtn()!.textContent).toBe("留着");
    clickCancel();
    finishExit();
    await p;
  });

  test("关闭后焦点回归触发按钮；打开时聚焦确认按钮", async () => {
    const btn = makeTrigger();
    const p = open(btn);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    expect(document.activeElement).toBe(qsConfirmBtn());
    clickCancel();
    finishExit();
    await p;
    expect(document.activeElement).toBe(btn);
  });

  test("焦点陷阱：从确认按钮 Tab 回到取消按钮", async () => {
    const btn = makeTrigger();
    const p = open(btn);
    qsConfirmBtn()!.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(qsCancelBtn());
    clickCancel();
    finishExit();
    await p;
  });

  test("**关键词** 解析为强调节点", async () => {
    const btn = makeTrigger();
    const p = open(btn, { message: "删除后 **无法恢复**" });
    const msg = qsPanel()!.querySelector(".qc-msg")!;
    expect(msg.querySelector(".qc-mark")!.textContent).toBe("无法恢复");
    clickCancel();
    finishExit();
    await p;
  });
});

describe("morph 与兜底", () => {
  test("触发元素可测时注入 --qc-tx/--qc-ty", async () => {
    const btn = makeTrigger();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    vi.spyOn(btn, "getBoundingClientRect").mockReturnValue({
      left: 40,
      top: 60,
      width: 120,
      height: 40,
      right: 160,
      bottom: 100,
      x: 40,
      y: 60,
      toJSON: () => ({}),
    } as DOMRect);

    const p = open(btn);
    const panel = qsPanel()!;
    expect(panel.style.getPropertyValue("--qc-tx")).toBe(`${40 + 60 - vw / 2}px`);
    expect(panel.style.getPropertyValue("--qc-ty")).toBe(`${60 + 20 - vh / 2}px`);
    clickCancel();
    finishExit();
    await p;
  });

  test("detached 触发元素：降级纯居中，不注入 --qc-tx", async () => {
    const detached = document.createElement("button");
    const p = open(detached);
    const panel = qsPanel()!;
    expect(panel.style.getPropertyValue("--qc-tx")).toBe("");
    clickConfirm();
    finishExit();
    expect(await p).toBe("confirm");
  });

  test("selector 字符串触发：找不到元素也正常弹出（降级）", async () => {
    const p = confirm("#not-exist", { title: "t" });
    expect(qsPanel()).toBeTruthy();
    clickConfirm();
    finishExit();
    expect(await p).toBe("confirm");
  });
});

describe("配置", () => {
  test("configure 注入全局默认文案", async () => {
    confirm.configure({ confirmText: "是", cancelText: "否" });
    try {
      const btn = makeTrigger();
      const p = open(btn);
      expect(qsConfirmBtn()!.textContent).toBe("是");
      expect(qsCancelBtn()!.textContent).toBe("否");
      clickCancel();
      finishExit();
      await p;
    } finally {
      confirm.configure({ confirmText: "确认", cancelText: "取消" });
    }
  });
});
