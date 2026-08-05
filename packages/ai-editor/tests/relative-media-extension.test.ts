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
    consentReturn: "pick" as "pick" | "cancel",
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
      return h.consentReturn;
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

function imageSrcs(editor: Editor): string[] {
  const srcs: string[] = [];
  editor.state.doc.descendants((n) => {
    if (n.type.name === "image") srcs.push(n.attrs.src);
  });
  return srcs;
}

function relStorage(editor: Editor): { pausedUntilPaste: boolean } {
  return (editor.storage as any).relativeMedia;
}

describe("RelativeMedia 扩展编排", () => {
  let editor: Editor;

  beforeEach(() => {
    h.consentCalls = 0;
    h.pickFileCalls = 0;
    h.consentReturn = "pick";
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

  function makeEditor(): Editor {
    const el = document.createElement("div");
    document.body.appendChild(el);
    return new Editor({
      element: el,
      extensions: [StarterKit, Image, Link, RelativeMedia],
    });
  }

  it("多图粘贴：一轮授权弹窗解析全部引用，不弹第二次", async () => {
    editor = makeEditor();
    // 模拟粘贴落文档：走事务，触发 appendTransaction
    editor.commands.setContent('<img src="a.png"><img src="b.png">');

    // 等两张图都换链为存储 URL
    await vi.waitFor(() => expect(imageSrcs(editor)).toEqual([DATA_URL, DATA_URL]), {
      timeout: 3000,
    });

    // 关键回归点：只允许一轮授权弹窗
    expect(h.consentCalls).toBe(1);
    expect(h.pickFileCalls).toBe(0);
  });

  it("同路径链接与图片节点共存：两类引用都解析换链（去重不跨类型吞引用）", async () => {
    editor = makeEditor();
    // 用户真实文档形状：[Open: x.png](a.png) 链接 + ![](a.png) 图片节点指向同一文件
    editor.commands.setContent('<p><a href="a.png">Open: a.png</a></p><img src="a.png">');

    await vi.waitFor(
      () => {
        expect(imageSrcs(editor)).toEqual([DATA_URL]);
        let href: string | undefined;
        editor.state.doc.descendants((n) => {
          if (n.isText) {
            for (const m of n.marks) if (m.type.name === "link") href = m.attrs.href;
          }
        });
        expect(href).toBe(DATA_URL);
      },
      { timeout: 3000 },
    );
    expect(h.consentCalls).toBe(1);
  });

  it("同 src 再次出现（重粘/撤销回滚）不被永久豁免：重新解析并换链", async () => {
    editor = makeEditor();
    editor.commands.setContent('<img src="a.png">');
    await vi.waitFor(() => expect(imageSrcs(editor)).toEqual([DATA_URL]), { timeout: 3000 });
    expect(h.consentCalls).toBe(1);

    // 同一本地 src 再次进入文档（重新粘贴 / Ctrl+Z 回滚换链后的状态）：
    // 必须再走一轮解析，而不是被"已成功过"永久跳过、留下无声占位
    editor.commands.setContent('<img src="a.png">');
    await vi.waitFor(() => expect(imageSrcs(editor)).toEqual([DATA_URL]), { timeout: 3000 });
    expect(h.consentCalls).toBe(2);
  });

  it("取消后暂停探测：击键不重复弹窗，下一次粘贴才重试", async () => {
    editor = makeEditor();
    h.consentReturn = "cancel";
    // 末尾带段落，避免单节点文档的 NodeSelection 被后续 insertContent 替换掉
    editor.commands.setContent('<img src="a.png"><p></p>');
    await vi.waitFor(() => expect(h.consentCalls).toBe(1));
    // 等编排收尾：仍有未解析引用 → 暂停探测
    await vi.waitFor(() => expect(relStorage(editor).pausedUntilPaste).toBe(true));

    // 暂停期间的文档变化（击键等）不应再次弹窗
    editor.commands.insertContent("x");
    await new Promise((r) => setTimeout(r, 50));
    expect(h.consentCalls).toBe(1);
    expect(imageSrcs(editor)).toEqual(["a.png"]);

    // 模拟下一次粘贴（粘贴路径会清除暂停标记），恢复解析
    relStorage(editor).pausedUntilPaste = false;
    h.consentReturn = "pick";
    editor.commands.insertContent('<img src="b.png">');
    await vi.waitFor(() => expect(imageSrcs(editor)).toEqual([DATA_URL, DATA_URL]), {
      timeout: 3000,
    });
    expect(h.consentCalls).toBe(2);
  });
});
