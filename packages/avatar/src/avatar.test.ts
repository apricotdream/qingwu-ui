import { beforeEach, describe, expect, test } from "vitest";
import { AvatarEditor } from "./avatar";

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  document.body.append(root);
});

describe("AvatarEditor", () => {
  test("渲染可点击头像触发器", () => {
    const editor = new AvatarEditor(root, { ariaLabel: "修改我的头像" });
    expect(editor.el.classList.contains("qav-root")).toBe(true);
    expect(editor.el.querySelector("button")?.getAttribute("aria-label")).toBe("修改我的头像");
    editor.destroy();
  });

  test("点击头像打开编辑层，空图时确认禁用", () => {
    const editor = new AvatarEditor(root);
    editor.el.querySelector<HTMLButtonElement>(".qav-trigger")!.click();
    const dialog = document.body.querySelector<HTMLElement>(".qav-dialog")!;
    expect(dialog.hidden).toBe(false);
    expect(dialog.querySelector<HTMLButtonElement>(".qav-primary")!.disabled).toBe(true);
    editor.destroy();
  });

  test("旋转投影决定最小覆盖缩放", () => {
    const editor = new AvatarEditor(root, { outputSize: 256 }) as never as {
      minScale: (w: number, h: number, angle: number) => number;
    };
    expect(editor.minScale(800, 400, 0)).toBeCloseTo(0.64);
    expect(editor.minScale(800, 400, 45)).toBeCloseTo(
      256 / (800 * Math.SQRT1_2 + 400 * Math.SQRT1_2),
    );
  });

  test("圆角拉满使用原生 roundRect，半径 = size/2（正圆）", () => {
    const editor = new AvatarEditor(root, { outputSize: 256 }) as never as {
      radius: number;
      draw: (ctx: Record<string, unknown>) => void;
      destroy: () => void;
    };
    const calls: string[] = [];
    const ctx: Record<string, unknown> = {
      calls,
      clearRect: () => calls.push("clearRect"),
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      clip: () => calls.push("clip"),
      translate: () => calls.push("translate"),
      rotate: () => calls.push("rotate"),
      scale: () => calls.push("scale"),
      drawImage: () => calls.push("drawImage"),
      beginPath: () => calls.push("beginPath"),
      stroke: () => calls.push("stroke"),
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      closePath: () => calls.push("closePath"),
      quadraticCurveTo: () => calls.push("quadraticCurveTo"),
      roundRect: (...args: number[]) => calls.push(`roundRect(${args.join(",")})`),
    };
    editor.radius = 50;
    editor.draw(ctx);
    expect(calls).toContain("roundRect(0,0,256,256,128)");
    expect(calls).not.toContain("quadraticCurveTo");
    editor.destroy();
  });

  test("圆角半径钳制在 size/2 以内", () => {
    const editor = new AvatarEditor(root, { outputSize: 256 }) as never as {
      radius: number;
      draw: (ctx: Record<string, unknown>) => void;
      destroy: () => void;
    };
    const calls: string[] = [];
    const ctx: Record<string, unknown> = {
      calls,
      clearRect: () => calls.push("clearRect"),
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      clip: () => calls.push("clip"),
      translate: () => calls.push("translate"),
      rotate: () => calls.push("rotate"),
      scale: () => calls.push("scale"),
      drawImage: () => calls.push("drawImage"),
      beginPath: () => calls.push("beginPath"),
      stroke: () => calls.push("stroke"),
      quadraticCurveTo: () => calls.push("quadraticCurveTo"),
      roundRect: (...args: number[]) => calls.push(`roundRect(${args.join(",")})`),
    };
    editor.radius = 100;
    editor.draw(ctx);
    expect(calls).toContain("roundRect(0,0,256,256,128)");
    expect(calls).not.toContain("roundRect(0,0,256,256,256)");
    editor.destroy();
  });

  test("无原生 roundRect 时回退到二次贝塞尔路径", () => {
    const editor = new AvatarEditor(root, { outputSize: 256 }) as never as {
      radius: number;
      draw: (ctx: Record<string, unknown>) => void;
      destroy: () => void;
    };
    const calls: string[] = [];
    const ctx: Record<string, unknown> = {
      calls,
      clearRect: () => calls.push("clearRect"),
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      clip: () => calls.push("clip"),
      translate: () => calls.push("translate"),
      rotate: () => calls.push("rotate"),
      scale: () => calls.push("scale"),
      drawImage: () => calls.push("drawImage"),
      beginPath: () => calls.push("beginPath"),
      stroke: () => calls.push("stroke"),
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      closePath: () => calls.push("closePath"),
      quadraticCurveTo: () => calls.push("quadraticCurveTo"),
    };
    editor.radius = 50;
    editor.draw(ctx);
    expect(calls).toContain("quadraticCurveTo");
    editor.destroy();
  });

  test("jpeg 格式未传底色时兜底白色（防透明像素编码成黑角）", () => {
    const editor = new AvatarEditor(root, { outputFormat: "jpeg" }) as never as {
      outputFormat: string;
      backgroundColor: string | undefined;
      quality: number;
      destroy: () => void;
    };
    expect(editor.outputFormat).toBe("jpeg");
    expect(editor.quality).toBeCloseTo(0.92);
    expect(editor.backgroundColor).toBe("#ffffff");
    editor.destroy();
  });

  test("png 格式保持透明圆角（默认无底色）", () => {
    const editor = new AvatarEditor(root, {}) as never as {
      outputFormat: string;
      backgroundColor: string | undefined;
      destroy: () => void;
    };
    expect(editor.outputFormat).toBe("png");
    expect(editor.backgroundColor).toBeUndefined();
    editor.destroy();
  });

  test("显式底色在绘制时先铺底后裁剪", () => {
    const editor = new AvatarEditor(root, { backgroundColor: "#123456" }) as never as {
      backgroundColor: string | undefined;
      draw: (ctx: Record<string, unknown>) => void;
      destroy: () => void;
    };
    const calls: string[] = [];
    const ctx: Record<string, unknown> = {
      calls,
      clearRect: () => calls.push("clearRect"),
      fillRect: () => calls.push("fillRect"),
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      clip: () => calls.push("clip"),
      translate: () => calls.push("translate"),
      rotate: () => calls.push("rotate"),
      scale: () => calls.push("scale"),
      drawImage: () => calls.push("drawImage"),
      beginPath: () => calls.push("beginPath"),
      stroke: () => calls.push("stroke"),
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      closePath: () => calls.push("closePath"),
      quadraticCurveTo: () => calls.push("quadraticCurveTo"),
      roundRect: () => calls.push("roundRect"),
    };
    editor.draw(ctx);
    expect(calls.indexOf("clearRect")).toBeLessThan(calls.indexOf("fillRect"));
    expect(calls.indexOf("fillRect")).toBeLessThan(calls.indexOf("clip"));
    editor.destroy();
  });

  test("编辑层挂 data-lenis-prevent（防宿主 Lenis 劫持滚轮）", () => {
    const editor = new AvatarEditor(root);
    const dialog = document.body.querySelector<HTMLElement>(".qav-dialog")!;
    expect(dialog.hasAttribute("data-lenis-prevent")).toBe(true);
    editor.destroy();
  });
});
