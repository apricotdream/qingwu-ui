import { Editor } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setStorageProvider } from "../src/editor/storage";
import { collectLocalMediaRefs } from "../src/editor/utils/local-media";
import {
  groupRefsByFile,
  processResolvedFile,
  processResolvedFileGroup,
} from "../src/editor/utils/resolve-local-media";

// jsdom 的 Image 永不触发 load/error（真实探针会 8s 超时判 false）→ 可控 mock
const probe = vi.hoisted(() => ({ ok: true }));
vi.mock("../src/editor/utils/render-probe", () => ({
  verifyImageRenderable: () => Promise.resolve(probe.ok),
}));

// jsdom 没有 URL.createObjectURL / revokeObjectURL
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = (() => `blob:mock-${Math.random().toString(36).slice(2)}`) as never;
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = (() => {}) as never;
}

const DATA_URL = "data:image/jpeg;base64,dGVzdA==";

beforeEach(() => {
  probe.ok = true;
  setStorageProvider({
    name: "测试存储",
    type: "local",
    async upload(file: File) {
      void file;
      return DATA_URL;
    },
    async remove() {},
  });
});

function makeEditor(html: string): Editor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return new Editor({
    element: el,
    extensions: [StarterKit, Image, Link],
    content: html,
  });
}

function imageSrc(editor: Editor): string | undefined {
  let src: string | undefined;
  editor.state.doc.descendants((n) => {
    if (n.type.name === "image") src = n.attrs.src;
  });
  return src;
}

describe("本地媒体解析管线（processResolvedFile）", () => {
  let editor: Editor;
  afterEach(() => {
    editor?.destroy();
    document.body.innerHTML = "";
  });

  it("媒体节点：限额内文件 → 换链为存储 URL，DOM 同步刷新", async () => {
    editor = makeEditor('<img src="c9794a39add8edfd15a32bd8610cf682_MD5.jpeg">');
    const refs = collectLocalMediaRefs(editor.state.doc);
    expect(refs).toHaveLength(1);

    const file = new File(["x"], "c9794a39add8edfd15a32bd8610cf682_MD5.jpeg", {
      type: "image/jpeg",
    });
    const outcome = await processResolvedFile(editor.view, editor, refs[0], file);

    expect(outcome).toBe("uploaded");
    expect(imageSrc(editor)).toBe(DATA_URL);
    expect(editor.view.dom.querySelector("img")?.getAttribute("src")).toBe(DATA_URL);
  });

  it("链接型附件：href 换成存储 URL", async () => {
    editor = makeEditor('<p><a href="files/x.pdf">x.pdf</a></p>');
    const refs = collectLocalMediaRefs(editor.state.doc);
    expect(refs).toHaveLength(1);
    expect(refs[0].isLink).toBe(true);

    const file = new File(["x"], "x.pdf", { type: "application/pdf" });
    const outcome = await processResolvedFile(editor.view, editor, refs[0], file);

    expect(outcome).toBe("uploaded");
    let href: string | undefined;
    editor.state.doc.descendants((n) => {
      if (n.isText) {
        for (const m of n.marks) if (m.type.name === "link") href = m.attrs.href;
      }
    });
    expect(href).toBe(DATA_URL);
  });

  it("换链成功但浏览器渲染失败：计 renderFailed 而非 uploaded（诚实计数）", async () => {
    probe.ok = false;
    editor = makeEditor('<img src="c9794a39add8edfd15a32bd8610cf682_MD5.jpeg">');
    const refs = collectLocalMediaRefs(editor.state.doc);
    expect(refs).toHaveLength(1);

    const file = new File(["x"], "c9794a39add8edfd15a32bd8610cf682_MD5.jpeg", {
      type: "image/jpeg",
    });
    const outcome = await processResolvedFile(editor.view, editor, refs[0], file);

    expect(outcome).toBe("renderFailed");
    // 文档确实换链了（字节真实上传），只是不宣称"已上传成功"
    expect(imageSrc(editor)).toBe(DATA_URL);
  });

  it("同一文件的图片节点 + 同路径 Open: 链接：只上传一次、计一次、都换链", async () => {
    let uploadCount = 0;
    setStorageProvider({
      name: "测试存储",
      type: "local",
      async upload() {
        uploadCount++;
        return DATA_URL;
      },
      async remove() {},
    });
    // Obsidian 导出常见形状：每张图同时有 <img> 节点与 [Open: x.png](x.jpeg) 链接
    editor = makeEditor('<p><a href="a.jpeg">Open: a.png</a></p><img src="a.jpeg">');
    const refs = collectLocalMediaRefs(editor.state.doc);
    expect(refs).toHaveLength(2); // 节点型 + 链接型两条引用
    const groups = groupRefsByFile(refs);
    expect(groups).toHaveLength(1); // 同一文件只归一组（5 张图 → 5 组，不会变 10）

    const file = new File(["x"], "a.jpeg", { type: "image/jpeg" });
    const outcome = await processResolvedFileGroup(editor.view, editor, groups[0], file);

    expect(outcome).toBe("uploaded"); // 结果只计一次
    expect(uploadCount).toBe(1); // 字节只上传一次
    expect(imageSrc(editor)).toBe(DATA_URL); // 图片节点换链
    let href: string | undefined;
    editor.state.doc.descendants((n) => {
      if (n.isText) {
        for (const m of n.marks) if (m.type.name === "link") href = m.attrs.href;
      }
    });
    expect(href).toBe(DATA_URL); // 链接共享同一存储 URL
  });

  it("链接已被删除：不计 uploaded", async () => {
    editor = makeEditor('<p><a href="files/x.pdf">x.pdf</a></p>');
    const refs = collectLocalMediaRefs(editor.state.doc);
    // 先删掉链接，模拟用户在解析期间删除
    editor.commands.selectAll();
    editor.commands.deleteSelection();

    const file = new File(["x"], "x.pdf", { type: "application/pdf" });
    const outcome = await processResolvedFile(editor.view, editor, refs[0], file);
    expect(outcome).toBe("sessionOnly");
  });
});
