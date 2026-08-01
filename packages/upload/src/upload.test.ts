import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveMime } from "./compress";
import { ImageUpload, validateFile } from "./upload";

function makeFile(type: string, size = 1024, name = "a.png"): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateFile 准入校验", () => {
  const accept = ["image/*"];

  test("类型不匹配返回 type", () => {
    expect(validateFile(makeFile("text/plain"), accept, 10, 0, 0)).toBe("type");
    expect(validateFile(makeFile("image/png"), accept, 10, 0, 0)).toBeNull();
  });

  test("超过大小上限返回 size", () => {
    expect(validateFile(makeFile("image/png", 11 * 1024 * 1024), accept, 10, 0, 0)).toBe("size");
  });

  test("达到数量上限返回 count", () => {
    expect(validateFile(makeFile("image/png"), accept, 10, 2, 2)).toBe("count");
    expect(validateFile(makeFile("image/png"), accept, 10, 1, 2)).toBeNull();
  });
});

describe("resolveMime 格式降级链", () => {
  const both = new Set(["image/webp", "image/avif"]);
  const webpOnly = new Set(["image/webp"]);
  const pngOnly = new Set(["image/png"]);

  test("avif 可用时直接用 avif", () => {
    expect(resolveMime("avif", both)).toBe("image/avif");
  });

  test("avif 不可用时降级 webp", () => {
    expect(resolveMime("avif", webpOnly)).toBe("image/webp");
  });

  test("avif 与 webp 均不可用时降级 png", () => {
    expect(resolveMime("avif", pngOnly)).toBe("image/png");
  });

  test("全部不可用返回 null", () => {
    expect(resolveMime("webp", new Set(["image/jpeg"]))).toBeNull();
  });
});

describe("ImageUpload 组件", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
  });

  test("构造后渲染拖拽区与隐藏文件输入框", () => {
    const uploader = new ImageUpload(root, { compress: false });
    const zone = root.querySelector<HTMLElement>(".qw-upload-dropzone");
    expect(zone).toBeTruthy();
    const input = root.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    expect(input!.multiple).toBe(true);
    expect(input!.accept).toBe("image/*");
    uploader.destroy();
  });

  test("supportedFormats 白名单映射 accept 并驱动提示文案", () => {
    const uploader = new ImageUpload(root, {
      compress: false,
      supportedFormats: ["jpg", "png"],
    });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input!.accept).toBe("image/jpeg,image/png");
    expect(root.querySelector(".qw-upload-dropzone")!.textContent).toContain("支持 JPG/PNG");
    uploader.destroy();
  });

  test("supportedFormats 白名单拒绝白名单外文件", async () => {
    const uploader = new ImageUpload(root, { compress: false, supportedFormats: ["png"] });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [makeFile("image/gif", 1024, "a.gif")],
    });
    input.dispatchEvent(new Event("change"));

    await new Promise((r) => setTimeout(r, 0));
    expect(uploader.getItems()).toHaveLength(0);
    uploader.destroy();
  });

  test("trigger: button 模式渲染按钮而非拖拽区", () => {
    const uploader = new ImageUpload(root, { compress: false, trigger: "button" });
    expect(root.querySelector(".qw-upload-dropzone")).toBeNull();
    const btn = root.querySelector<HTMLButtonElement>("button.qw-btn");
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toBe("选择图片");
    uploader.destroy();
    expect(root.querySelector(".qw-upload")).toBeNull();
  });

  test("trigger: button 模式添加文件后直接成功", async () => {
    const onSuccess = vi.fn();
    const uploader = new ImageUpload(root, {
      compress: false,
      trigger: "button",
      onSuccess,
    });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
    input.dispatchEvent(new Event("change"));

    await new Promise((r) => setTimeout(r, 0));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    uploader.destroy();
  });

  test("无 url 无 uploadFn 时，添加文件后直接成功", async () => {
    const onSuccess = vi.fn();
    const uploader = new ImageUpload(root, {
      compress: false,
      onSuccess,
    });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
    input.dispatchEvent(new Event("change"));

    await new Promise((r) => setTimeout(r, 0));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(uploader.getItems()[0]?.status).toBe("success");
    uploader.destroy();
  });

  test("拒绝非图片文件", async () => {
    const uploader = new ImageUpload(root, { compress: false });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [makeFile("text/plain", 10, "a.txt")],
    });
    input.dispatchEvent(new Event("change"));

    await new Promise((r) => setTimeout(r, 0));
    expect(uploader.getItems()).toHaveLength(0);
    uploader.destroy();
  });

  test("maxCount 限制生效", async () => {
    const uploader = new ImageUpload(root, { compress: false, maxCount: 1 });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [makeFile("image/png"), makeFile("image/png")],
    });
    input.dispatchEvent(new Event("change"));

    await new Promise((r) => setTimeout(r, 0));
    expect(uploader.getItems()).toHaveLength(1);
    uploader.destroy();
  });

  test("remove 与 destroy 不抛错", () => {
    const uploader = new ImageUpload(root, { compress: false });
    uploader.remove("不存在的 id");
    uploader.clear();
    uploader.destroy();
    expect(root.querySelector(".qw-upload")).toBeNull();
  });
});
