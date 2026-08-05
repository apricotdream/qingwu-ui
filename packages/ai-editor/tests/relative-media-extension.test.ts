import { Editor } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelativeMedia } from "../src/editor/extensions/relative-media";
import { setStorageProvider } from "../src/editor/storage";

// 共享的运行时探针与假目录句柄（vi.mock 工厂里也要用，需 hoisted）
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
  return {
    consentCalls: 0,
    pickFileCalls: 0,
    dir: null as any,
    buildHandle,
  };
});

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
    openDirectoryConsentDialog: async (_n: number) => {
      h.consentCalls++;
      return "pick" as const;
    },
    openPickFilesDialog: async (_names: string[]) => {
      h.pickFileCalls++;
      return "cancel" as const;
    },
    openDragHintDialog: () => {},
  };
});

if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = (() => `blob:mock-${Math.random().toString(36).slice(2)}`) as never;
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = (() => {}) as never;
}

const DATA_URL = "data:image/png;base64,dGVzdA==";

describe("RelativeMedia 扩展编排", () => {
  let editor: Editor;

  beforeEach(() => {
    h.consentCalls = 0;
    h.pickFileCalls = 0;
    h.dir = h.buildHandle({
      name: "vault",
      children: [
        { name: "a.png", file: new File(["a"], "a.png", { type: "image/png" }) },
        { name: "b.png", file: new File(["b"], "b.png", { type: "image/png" }) },
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

  it("多图粘贴：一轮授权弹窗解析全部引用，不弹第二次", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    editor = new Editor({
      element: el,
      extensions: [StarterKit, Image, Link, RelativeMedia],
    });
    // 模拟粘贴落文档：走事务，触发 appendTransaction
    editor.commands.setContent('<img src="a.png"><img src="b.png">');

    // 等两张图都换链为存储 URL
    await vi.waitFor(
      () => {
        const srcs: string[] = [];
        editor.state.doc.descendants((n) => {
          if (n.type.name === "image") srcs.push(n.attrs.src);
        });
        expect(srcs).toHaveLength(2);
        for (const s of srcs) expect(s).toBe(DATA_URL);
      },
      { timeout: 3000 },
    );

    // 关键回归点：只允许一轮授权弹窗
    expect(h.consentCalls).toBe(1);
    expect(h.pickFileCalls).toBe(0);
  });
});
