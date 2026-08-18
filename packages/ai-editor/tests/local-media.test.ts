import { describe, expect, it, vi } from "vitest";
import {
  basenameOf,
  collectLocalMediaRefs,
  type FsDirectoryHandle,
  filePickerSupported,
  findFileInDirectory,
  isLocalMediaSrc,
  type LocalMediaRef,
  normalizeLocalSrc,
  pickLocalFiles,
  textHasLocalMediaRefs,
} from "../src/editor/utils/local-media";

describe("isLocalMediaSrc", () => {
  it("识别相对路径与本地协议", () => {
    expect(isLocalMediaSrc("./img/a.png")).toBe(true);
    expect(isLocalMediaSrc("img/a.png")).toBe(true);
    expect(isLocalMediaSrc("../assets/a.png")).toBe(true);
    expect(isLocalMediaSrc("C:\\Users\\x\\a.png")).toBe(true);
    expect(isLocalMediaSrc("file:///C:/vault/a.png")).toBe(true);
    expect(isLocalMediaSrc("app://obsidian.md/a.png")).toBe(true);
  });

  it("排除已可加载的来源", () => {
    expect(isLocalMediaSrc("https://cdn.example.com/a.png")).toBe(false);
    expect(isLocalMediaSrc("http://cdn.example.com/a.png")).toBe(false);
    expect(isLocalMediaSrc("//cdn.example.com/a.png")).toBe(false);
    expect(isLocalMediaSrc("data:image/png;base64,AAA")).toBe(false);
    expect(isLocalMediaSrc("blob:https://site/uuid")).toBe(false);
    expect(isLocalMediaSrc("#锚点")).toBe(false);
    expect(isLocalMediaSrc("")).toBe(false);
    expect(isLocalMediaSrc(null)).toBe(false);
    expect(isLocalMediaSrc(undefined)).toBe(false);
  });
});

describe("normalizeLocalSrc / basenameOf", () => {
  it("剥离 file:// 前缀、解码并去掉盘符", () => {
    expect(normalizeLocalSrc("file:///C:/vault/img%20a.png")).toBe("vault/img a.png");
    expect(normalizeLocalSrc(".\\assets\\a.png")).toBe("assets/a.png");
    expect(normalizeLocalSrc("./a.png")).toBe("a.png");
  });

  it("basename 取末段并小写", () => {
    expect(basenameOf("./assets/Pasted image 20240101.PNG")).toBe("pasted image 20240101.png");
    expect(basenameOf("a.png")).toBe("a.png");
  });
});

describe("textHasLocalMediaRefs", () => {
  it("命中 wiki 链接 / 标准 md / HTML img 的本地引用", () => {
    expect(textHasLocalMediaRefs("![[img.png]]")).toBe(true);
    expect(textHasLocalMediaRefs("![图](./img/a.png)")).toBe(true);
    expect(textHasLocalMediaRefs("", '<img src="./a.png">')).toBe(true);
  });

  it("远程图片与无扩展名 wiki 链接不命中", () => {
    expect(textHasLocalMediaRefs("![图](https://x.com/a.png)")).toBe(false);
    expect(textHasLocalMediaRefs("[[某篇笔记]]")).toBe(false);
    expect(textHasLocalMediaRefs("普通文本")).toBe(false);
  });

  it("宿主 owns 命中的引用不参与分流判定", () => {
    const isOwned = (src: string) => src.startsWith("/api/assets/");
    expect(
      textHasLocalMediaRefs(`<img src="/api/assets/editor-assets/x.png">`, undefined, isOwned),
    ).toBe(false);
    expect(textHasLocalMediaRefs(`<img src="images/photo.png">`, undefined, isOwned)).toBe(true);
  });
});

// ---- 目录句柄 mock ----

interface FakeEntry {
  name: string;
  file?: File;
  /** 模拟云同步占位文件：句柄存在但 getFile() 抛错 */
  failRead?: boolean;
  children?: FakeEntry[];
}

function makeFileHandle(entry: FakeEntry): { getFile(): Promise<File> } {
  return {
    getFile: async () => {
      if (entry.failRead) throw new Error("cloud placeholder file");
      return entry.file as File;
    },
  };
}

function buildHandle(entry: FakeEntry): FsDirectoryHandle {
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
      return makeFileHandle(child);
    },
    values() {
      const items = children.map((c) =>
        c.file
          ? ({ kind: "file", name: c.name, ...makeFileHandle(c) } as const)
          : ({ kind: "directory", name: c.name } as const),
      );
      return (async function* () {
        for (const item of items) {
          if (item.kind === "directory") {
            const sub = children.find((c) => c.name === item.name) as FakeEntry;
            yield { ...item, ...buildHandle(sub) };
          } else {
            yield item;
          }
        }
      })();
    },
  };
}

const fileA = new File(["a"], "a.png", { type: "image/png" });
const fileB = new File(["b"], "b.pdf", { type: "application/pdf" });

/** 模拟 vault：根目录有 note.md，attachments/ 下有 a.png、b.pdf */
function vault(): FsDirectoryHandle {
  return buildHandle({
    name: "vault",
    children: [
      { name: "note.md", file: new File(["n"], "note.md") },
      {
        name: "attachments",
        children: [
          { name: "a.png", file: fileA },
          { name: "b.pdf", file: fileB },
        ],
      },
    ],
  });
}

describe("pickLocalFiles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("选中文件后返回真实 File 列表", async () => {
    const files = [new File(["a"], "a.png"), new File(["b"], "b.png")];
    vi.stubGlobal("window", {
      isSecureContext: true,
      showOpenFilePicker: async () => files.map((f) => ({ getFile: async () => f })),
    });
    expect(await pickLocalFiles()).toEqual(files);
  });

  it("用户取消（AbortError）返回 null", async () => {
    vi.stubGlobal("window", {
      isSecureContext: true,
      showOpenFilePicker: async () => {
        throw new Error("AbortError");
      },
    });
    expect(await pickLocalFiles()).toBeNull();
  });

  it("非安全上下文不支持文件选择器", () => {
    vi.stubGlobal("window", { isSecureContext: false });
    expect(filePickerSupported()).toBe(false);
    expect(pickLocalFiles()).resolves.toBeNull();
  });
});

describe("findFileInDirectory", () => {
  it("精确相对路径命中", async () => {
    const { file } = await findFileInDirectory(vault(), "./attachments/a.png");
    expect(file).toBe(fileA);
  });

  it("完整路径去掉开头段后命中（用户授权的是子目录）", async () => {
    const { file } = await findFileInDirectory(vault(), "/Users/x/vault/attachments/b.pdf");
    expect(file).toBe(fileB);
  });

  it("basename 兜底查找（Obsidian 最短路径写法）", async () => {
    const { file } = await findFileInDirectory(vault(), "a.png");
    expect(file).toBe(fileA);
  });

  it("找不到返回 null 且无 readError", async () => {
    const { file, readError } = await findFileInDirectory(vault(), "not-exist.png");
    expect(file).toBeNull();
    expect(readError).toBeUndefined();
  });

  it("找到但读取失败（云同步占位文件）返回 readError", async () => {
    const dir = buildHandle({
      name: "onedrive",
      children: [{ name: "cloud.png", file: fileA, failRead: true }],
    });
    const { file, readError } = await findFileInDirectory(dir, "cloud.png");
    expect(file).toBeNull();
    expect(readError).toBeDefined();
  });
});

describe("collectLocalMediaRefs", () => {
  function fakeDoc(nodes: Array<Record<string, unknown>>) {
    return {
      descendants(fn: (node: any, pos: number) => boolean | undefined) {
        nodes.forEach((node, i) => fn(node, i));
      },
    };
  }

  it("收集本地 src 的媒体节点，忽略远程与 blob", () => {
    const doc = fakeDoc([
      { type: { name: "image" }, attrs: { src: "./img/a.png" } },
      { type: { name: "image" }, attrs: { src: "https://cdn.com/x.png" } },
      { type: { name: "videoEmbed" }, attrs: { src: "blob:http://site/u" } },
      { type: { name: "attachmentEmbed" }, attrs: { src: "files/x.pdf" } },
      { type: { name: "paragraph" }, attrs: {} },
    ]);
    const refs = collectLocalMediaRefs(doc);
    expect(refs.map((r) => `${r.kind}:${r.src}`)).toEqual([
      "image:./img/a.png",
      "attachment:files/x.pdf",
    ]);
  });

  it("收集链接型附件，忽略锚点与无扩展名链接", () => {
    const linkMark = (href: string) => ({ type: { name: "link" }, attrs: { href } });
    const doc = fakeDoc([
      { isText: true, marks: [linkMark("./files/b.pdf")] },
      { isText: true, marks: [linkMark("#锚点")] },
      { isText: true, marks: [linkMark("[[笔记]]")] },
      { isText: true, marks: [] },
    ]);
    const refs: LocalMediaRef[] = collectLocalMediaRefs(doc);
    expect(refs).toHaveLength(1);
    expect(refs[0].isLink).toBe(true);
    expect(refs[0].basename).toBe("b.pdf");
  });

  it("按 src 去重", () => {
    const doc = fakeDoc([
      { type: { name: "image" }, attrs: { src: "a.png" } },
      { type: { name: "image" }, attrs: { src: "a.png" } },
    ]);
    expect(collectLocalMediaRefs(doc)).toHaveLength(1);
  });

  it("宿主 owns 命中的站内相对路径（/api/assets/、/uploads/）不算本地引用", () => {
    const isOwned = (src: string) => src.startsWith("/api/assets/") || src.startsWith("/uploads/");
    const doc = fakeDoc([
      { type: { name: "image" }, attrs: { src: "/api/assets/editor-assets/x.png" } },
      { type: { name: "image" }, attrs: { src: "/uploads/20260807_a.png" } },
      { type: { name: "image" }, attrs: { src: "images/photo.png" } },
    ]);
    // 无 owns：/ 开头相对路径会被判为本地引用（历史行为，勿回归为期望值）
    expect(collectLocalMediaRefs(doc)).toHaveLength(3);
    // 有 owns：仅剩真正的本地引用
    const refs = collectLocalMediaRefs(doc, isOwned);
    expect(refs.map((r) => r.src)).toEqual(["images/photo.png"]);
  });

  it("链接型附件同样受 owns 过滤", () => {
    const isOwned = (src: string) => src.startsWith("/uploads/");
    const linkMark = (href: string) => ({ type: { name: "link" }, attrs: { href } });
    const doc = fakeDoc([
      { isText: true, marks: [linkMark("/uploads/a.pdf")] },
      { isText: true, marks: [linkMark("files/b.pdf")] },
    ]);
    const refs: LocalMediaRef[] = collectLocalMediaRefs(doc, isOwned);
    expect(refs.map((r) => r.basename)).toEqual(["b.pdf"]);
  });
});
