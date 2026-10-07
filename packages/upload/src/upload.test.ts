import { beforeEach, describe, expect, test, vi } from "vitest";
import { compressImage, resolveMime } from "./compress";
import { ImageUpload, validateFile } from "./upload";

/* 多格式用例：jsdom 无 canvas 编码能力，mock compressImage 产出多份 */
vi.mock("./compress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./compress")>();
  return { ...actual, compressImage: vi.fn() };
});

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

  test("trigger: button 模式进度内嵌按钮、成功后点击移除复位", async () => {
    const progressCb: { current: ((p: number) => void) | null } = { current: null };
    const uploader = new ImageUpload(root, {
      compress: false,
      trigger: "button",
      uploadFn: (_file, onProgress) => {
        progressCb.current = onProgress;
        return new Promise<void>(() => {}); // 测试外驱动进度，永不自行结束
      },
    });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));

    const btn = root.querySelector<HTMLButtonElement>("button.qw-btn")!;
    expect(btn.textContent).toContain("上传中");
    expect(btn.disabled).toBe(true);

    progressCb.current?.(42);
    expect(btn.textContent).toContain("42%");
    const bar = btn.querySelector<HTMLElement>(".qw-upload-btn-progress")!;
    expect(bar.style.width).toBe("42%");
    uploader.destroy();
  });

  test("trigger: button 模式成功态按钮文字与点击移除", async () => {
    const uploader = new ImageUpload(root, {
      compress: false,
      trigger: "button",
    });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));

    const btn = root.querySelector<HTMLButtonElement>("button.qw-btn")!;
    expect(btn.textContent).toContain("已上传");
    expect(uploader.getItems()).toHaveLength(1);

    // 成功态点击 = 移除该上传项，按钮复位
    btn.click();
    expect(uploader.getItems()).toHaveLength(0);
    expect(btn.textContent).toBe("选择图片");
    uploader.destroy();
  });

  test("initialUrls 编辑态回显：渲染成功项并计入数量上限", () => {
    const onChange = vi.fn();
    const uploader = new ImageUpload(root, {
      compress: false,
      maxCount: 1,
      initialUrls: ["/uploads/cover.webp"],
      onChange,
    });

    const items = uploader.getItems();
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe("success");
    expect(items[0]?.source).toBe("remote");
    expect(items[0]?.remoteUrl).toBe("/uploads/cover.webp");
    expect(onChange).toHaveBeenCalledTimes(1); // 构造后同步通知宿主

    // 单文件模式：回显项在容器大图中（列表隐藏），右上角有移除按钮
    const thumb = root.querySelector<HTMLImageElement>(
      ".qw-upload-dropzone img.qw-upload-dropzone-preview",
    );
    expect(thumb?.src).toContain("/uploads/cover.webp");
    expect(root.querySelector<HTMLElement>(".qw-upload-list")?.hidden).toBe(true);
    expect(root.querySelector(".qw-upload-dropzone-remove")).toBeTruthy();
    uploader.destroy();
  });

  test("initialUrls 回显项删除走 remove 并通知 onChange", () => {
    const onChange = vi.fn();
    const uploader = new ImageUpload(root, {
      compress: false,
      initialUrls: ["/uploads/cover.webp"],
      onChange,
    });
    const id = uploader.getItems()[0]!.id;

    uploader.remove(id);
    expect(uploader.getItems()).toHaveLength(0);
    expect(onChange).toHaveBeenCalledTimes(2); // 构造 1 次 + 删除 1 次
    expect(onChange.mock.calls[1]?.[0]).toHaveLength(0);
    uploader.destroy();
  });

  test("单文件模式：上传成功后容器展示大图并隐藏列表", async () => {
    vi.useFakeTimers();
    try {
      const uploader = new ImageUpload(root, {
        compress: false,
        maxCount: 1,
        supportedFormats: ["png"],
      });
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
      input.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(0);

      // 大图在容器内，列表隐藏（视觉保底窗口内为上传中态）
      const img = root.querySelector<HTMLImageElement>(
        ".qw-upload-dropzone img.qw-upload-dropzone-preview",
      );
      expect(img).toBeTruthy();
      expect(root.querySelector<HTMLElement>(".qw-upload-list")?.hidden).toBe(true);

      // 保底窗口过后显示「点击预览」
      await vi.advanceTimersByTimeAsync(400);
      const dropzone = root.querySelector<HTMLElement>(".qw-upload-dropzone")!;
      expect(dropzone.textContent).toContain("点击预览");

      // 点击容器 = 打开预览（lightbox），再点关闭
      dropzone.click();
      expect(document.querySelector(".qw-upload-lightbox img")).toBeTruthy();
      document.querySelector<HTMLElement>(".qw-upload-lightbox")!.click();
      expect(document.querySelector(".qw-upload-lightbox")).toBeNull();

      // 右上角 X = 移除，容器恢复默认提示
      root.querySelector<HTMLElement>(".qw-upload-dropzone-remove")!.click();
      expect(uploader.getItems()).toHaveLength(0);
      expect(dropzone.textContent).toContain("拖拽图片到此处");
      uploader.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  test("单文件模式：URL 导入入口在图片框内，大图态隐藏、恢复默认后重现", async () => {
    vi.useFakeTimers();
    try {
      const uploader = new ImageUpload(root, {
        compress: false,
        maxCount: 1,
        supportedFormats: ["png"],
      });
      // 入口在容器内
      const urlBtn = root.querySelector<HTMLElement>(".qw-upload-dropzone .qw-upload-urlbtn");
      expect(urlBtn?.textContent).toBe("从 URL 导入");
      expect(urlBtn?.parentElement?.classList.contains("qw-upload-urlbar")).toBe(true);

      // 上传成功 → 大图模式：URL 入口隐藏
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
      input.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(0);
      const urlBar = root.querySelector<HTMLElement>(".qw-upload-urlbar")!;
      expect(urlBar.hidden).toBe(true);

      // 右上角 X 移除大图 → 恢复默认提示，URL 入口重现
      root.querySelector<HTMLElement>(".qw-upload-dropzone-remove")!.click();
      expect(urlBar.hidden).toBe(false);
      uploader.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  test("单文件模式：快速上传时「上传中」态视觉保底 350ms", async () => {
    vi.useFakeTimers();
    try {
      const uploader = new ImageUpload(root, {
        compress: false,
        maxCount: 1,
        supportedFormats: ["png"],
      });
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
      input.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(0);

      // 保底窗口内仍显示「上传中」
      const dropzone = root.querySelector<HTMLElement>(".qw-upload-dropzone")!;
      expect(dropzone.textContent).toContain("上传中");

      // 保底窗口过后切「点击预览」
      await vi.advanceTimersByTimeAsync(400);
      expect(dropzone.textContent).toContain("点击预览");
      uploader.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  test("单文件模式：previewFit auto 初始保守 contain（图片加载完成后按尺寸切换）", async () => {
    vi.useFakeTimers();
    try {
      const uploader = new ImageUpload(root, {
        compress: false,
        maxCount: 1,
        previewFit: "auto",
        supportedFormats: ["png"],
      });
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
      input.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(0);

      const img = root.querySelector<HTMLImageElement>(".qw-upload-dropzone-preview");
      expect(img?.classList.contains("is-contain")).toBe(true); // 初始保守 contain
      uploader.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  test("单文件模式：previewFit contain 时大图等比例完整显示", async () => {
    vi.useFakeTimers();
    try {
      const uploader = new ImageUpload(root, {
        compress: false,
        maxCount: 1,
        previewFit: "contain",
        supportedFormats: ["png"],
      });
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
      input.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(0);

      const img = root.querySelector<HTMLImageElement>(".qw-upload-dropzone-preview");
      expect(img?.classList.contains("is-contain")).toBe(true);
      uploader.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  test("单文件模式：容器右上角 ✕ 一键清空全部格式项（clear 语义）", async () => {
    vi.useFakeTimers();
    try {
      // 一张图 = 原图 + webp + avif 三项（mock 压缩产物）
      vi.mocked(compressImage).mockResolvedValue([
        {
          format: "webp",
          mime: "image/webp",
          blob: new File([new Uint8Array(1)], "a.webp", { type: "image/webp" }),
        },
        {
          format: "avif",
          mime: "image/avif",
          blob: new File([new Uint8Array(1)], "a.avif", { type: "image/avif" }),
        },
      ]);
      const onChange = vi.fn();
      const uploader = new ImageUpload(root, {
        maxCount: 1,
        formats: ["original", "webp", "avif"],
        onChange,
      });
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
      input.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(0);
      expect(uploader.getItems()).toHaveLength(3);

      // 点一次 ✕：三项全清，容器恢复默认提示
      root.querySelector<HTMLElement>(".qw-upload-dropzone-remove")!.click();
      expect(uploader.getItems()).toHaveLength(0);
      expect(root.querySelector<HTMLElement>(".qw-upload-dropzone")!.textContent).toContain(
        "拖拽图片到此处",
      );
      expect(onChange).toHaveBeenLastCalledWith([]);
      uploader.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  test("按钮形态单文件：已上传后点击 = 清空全部格式项", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(compressImage).mockResolvedValue([
        {
          format: "webp",
          mime: "image/webp",
          blob: new File([new Uint8Array(1)], "a.webp", { type: "image/webp" }),
        },
        {
          format: "avif",
          mime: "image/avif",
          blob: new File([new Uint8Array(1)], "a.avif", { type: "image/avif" }),
        },
      ]);
      const onChange = vi.fn();
      const uploader = new ImageUpload(root, {
        trigger: "button",
        maxCount: 1,
        formats: ["original", "webp", "avif"],
        onChange,
      });
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
      input.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(0);
      expect(uploader.getItems()).toHaveLength(3);

      // done 态点击按钮：三项全清，按钮复位为「选择图片」
      const btn = root.querySelector<HTMLElement>("button.qw-btn")!;
      btn.click();
      expect(uploader.getItems()).toHaveLength(0);
      expect(btn.textContent).toContain("选择图片");
      expect(onChange).toHaveBeenLastCalledWith([]);
      uploader.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  test("单文件模式：失败项不占容器，列表展示失败态", async () => {
    const uploader = new ImageUpload(root, {
      compress: false,
      maxCount: 1,
      uploadFn: () => Promise.reject(new Error("mock fail")),
    });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));

    expect(root.querySelector<HTMLElement>(".qw-upload-dropzone")?.textContent).toContain(
      "拖拽图片到此处",
    );
    expect(root.querySelector(".qw-upload-list")?.querySelector(".qw-upload-item")).toBeTruthy();
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

  test("persist: session 未完成项持久化，新实例恢复并自动重传，成功项出库", async () => {
    vi.useFakeTimers();
    try {
      const resolveUpload: { current: (() => void) | null } = { current: null };
      const uploadFn = () =>
        new Promise<void>((resolve) => {
          resolveUpload.current = resolve;
        });

      // 实例 1：添加文件后挂起（uploading 未完成）
      const u1 = new ImageUpload(root, { compress: false, persist: "session", uploadFn });
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
      input.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(0);
      expect(u1.getItems()[0]?.status).toBe("uploading");

      // 实例 2（模拟刷新重开）：恢复未完成项并自动重传
      const root2 = document.createElement("div");
      document.body.append(root2);
      const u2 = new ImageUpload(root2, { compress: false, persist: "session", uploadFn });
      await vi.advanceTimersByTimeAsync(0);
      expect(u2.getItems()).toHaveLength(1);
      expect(u2.getItems()[0]?.status).toBe("uploading");

      // 完成上传 → 成功项出库（再开实例不再恢复）
      resolveUpload.current?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(u2.getItems()[0]?.status).toBe("success");
      u2.destroy();
      const root3 = document.createElement("div");
      document.body.append(root3);
      const u3 = new ImageUpload(root3, { compress: false, persist: "session", uploadFn });
      await vi.advanceTimersByTimeAsync(0);
      expect(u3.getItems()).toHaveLength(0);

      u3.destroy();
      u1.destroy();
      root2.remove();
      root3.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  test("destroy 静默：不触发 onChange（宿主差集不误判已成功项为移除）", async () => {
    const onChange = vi.fn();
    const uploader = new ImageUpload(root, { compress: false, onChange });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
    input.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 0));
    expect(uploader.getItems()[0]?.status).toBe("success");

    const callsBeforeDestroy = onChange.mock.calls.length; // 添加时 1 次
    uploader.destroy();
    expect(onChange.mock.calls.length).toBe(callsBeforeDestroy); // destroy 不再通知
  });

  test("persist: off 默认不持久化", async () => {
    vi.useFakeTimers();
    try {
      const uploadFn = () => new Promise<void>(() => {});
      const u1 = new ImageUpload(root, { compress: false, uploadFn });
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: [makeFile("image/png")] });
      input.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(0);
      u1.destroy();

      const root2 = document.createElement("div");
      document.body.append(root2);
      const u2 = new ImageUpload(root2, { compress: false, persist: "session", uploadFn });
      await vi.advanceTimersByTimeAsync(0);
      expect(u2.getItems()).toHaveLength(0);
      u2.destroy();
      root2.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});
