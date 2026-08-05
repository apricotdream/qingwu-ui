import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEditorExtensions } from "../src/editor/extensions";
import { setStorageProvider } from "../src/editor/storage";

// 与 relative-media-extension.test.ts 同款的假目录句柄
const h = vi.hoisted(() => {
  interface FakeEntry {
    name: string;
    file?: File;
    children?: FakeEntry[];
  }
  function buildHandle(entry: FakeEntry): any {
    const children = entry.children ?? [];
    return {
      name: entry.name,
      async getDirectoryHandle(name: string) {
        const child = children.find((c) => c.children && c.name === name);
        if (!child) throw new Error("NotFoundError");
        return buildHandle(child);
      },
      async getFileHandle(name: string) {
        const child = children.find((c) => c.file && c.name === name);
        if (!child || !child.file) throw new Error("NotFoundError");
        const file = child.file;
        return { getFile: async () => file };
      },
      values() {
        const items = children.map((c) =>
          c.file
            ? ({ kind: "file", name: c.name, getFile: async () => c.file as File } as const)
            : ({ kind: "directory", name: c.name } as const),
        );
        return (async function* () {
          for (const item of items) yield item;
        })();
      },
    };
  }
  return { consentCalls: 0, consentArg: 0, dir: null as any, buildHandle };
});

// jsdom 的 Image 永不触发 load/error（真实探针会超时判 false）→ 固定通过
vi.mock("../src/editor/utils/render-probe", () => ({
  verifyImageRenderable: () => Promise.resolve(true),
}));

vi.mock("../src/editor/utils/local-media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/editor/utils/local-media")>();
  return {
    ...actual,
    fsAccessSupported: () => true,
    filePickerSupported: () => false,
    pickDirectory: async () => h.dir,
  };
});

vi.mock("../src/editor/utils/resolve-local-media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/editor/utils/resolve-local-media")>();
  return {
    ...actual,
    openDirectoryConsentDialog: async (n: number) => {
      h.consentCalls++;
      h.consentArg = n; // 面向用户的数量：必须按文件数（非引用条数）
      return "pick" as const;
    },
    openPickFilesDialog: async () => "cancel" as const,
    openDragHintDialog: () => {},
  };
});

if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = (() => `blob:mock-${Math.random().toString(36).slice(2)}`) as never;
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = (() => {}) as never;
}

const DATA_URL = "data:image/jpeg;base64,dGVzdA==";

describe("全栈：真实扩展（含 React ImageView）下本地图片换链后占位必须消失", () => {
  let editor: Editor;

  beforeEach(() => {
    h.consentCalls = 0;
    h.consentArg = 0;
    h.dir = h.buildHandle({
      name: "vault",
      children: [
        { name: "a.jpeg", file: new File(["a"], "a.jpeg", { type: "image/jpeg" }) },
        { name: "b.jpeg", file: new File(["b"], "b.jpeg", { type: "image/jpeg" }) },
      ],
    });
    setStorageProvider({
      name: "测试存储",
      type: "local",
      async upload() {
        return DATA_URL;
      },
      async remove() {},
    });
  });

  afterEach(() => {
    editor?.destroy();
    document.body.innerHTML = "";
  });

  it("多图粘贴：文档换链且 DOM 占位消失、<img> 指向存储 URL", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    editor = new Editor({ element: el, extensions: getEditorExtensions() });

    // 复刻用户真实文档形状：[Open: x.png](a.jpeg) 链接 + 同路径图片节点
    editor.commands.setContent(
      '<p><a href="a.jpeg">Open: Pasted image 20250810232353.png</a></p><img src="a.jpeg"><p>技巧：</p><p><a href="b.jpeg">Open: Pasted image 20250810232428.png</a></p><img src="b.jpeg">',
    );

    // 文档层：两个 image 节点与两个同路径链接都换链
    await vi.waitFor(
      () => {
        const srcs: string[] = [];
        const hrefs: string[] = [];
        editor.state.doc.descendants((n) => {
          if (n.type.name === "image") srcs.push(n.attrs.src);
          if (n.isText) {
            for (const m of n.marks) if (m.type.name === "link") hrefs.push(m.attrs.href);
          }
        });
        expect(srcs).toEqual([DATA_URL, DATA_URL]);
        expect(hrefs).toEqual([DATA_URL, DATA_URL]);
      },
      { timeout: 3000 },
    );
    expect(h.consentCalls).toBe(1);
    // 授权弹窗报"文件数"而非"引用条数"：2 个文件（各含节点+链接共 4 条引用）→ 报 2
    expect(h.consentArg).toBe(2);

    // 渲染层说明：jsdom 下 ReactNodeViewRenderer 不挂载 React 节点视图
    // （DOM 为 ProseMirror 默认 <img> 渲染），React 视图的跟进无法在此验证；
    // 此处只断言默认渲染已指向存储 URL（即占位语义消失）
    const imgs = el.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThanOrEqual(2);
    for (const img of Array.from(imgs)) {
      expect(img.getAttribute("src")).toBe(DATA_URL);
    }
  });
});
