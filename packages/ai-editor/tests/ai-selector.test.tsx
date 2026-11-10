import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { Editor as TiptapEditor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { afterEach, expect, it } from "vitest";
import { setAIProvider } from "../src/editor/ai";
import { AISelector } from "../src/editor/ai/components/ai-selector";

afterEach(cleanup);

it("自定义 provider 返回空流时保留错误提示，返回后可以重试", async () => {
  setAIProvider({
    async *stream() {},
    async generate() {
      return "";
    },
  });
  const editor = {
    getText: () => "待改写正文",
    state: {
      selection: { from: 1, to: 1, empty: true },
      doc: { textContent: "待改写正文" },
    },
  } as unknown as Editor;
  render(<AISelector editor={editor} onClose={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /自定义指令/ }));
  fireEvent.change(screen.getByPlaceholderText("例如：把这段内容改写成小红书风格"), {
    target: { value: "添加年份" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确定", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "生成失败：AI 未返回正文，请重试或切换模型。",
  );
  expect(screen.queryByRole("button", { name: "确定", exact: true })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "返回", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: /自定义指令/ }));
  expect(screen.getByPlaceholderText("例如：把这段内容改写成小红书风格")).toHaveValue("添加年份");
});

it("实时展示思考，正文单独标注生成结果和完成状态", async () => {
  let finishThinking!: () => void;
  const thinking = new Promise<void>((resolve) => {
    finishThinking = resolve;
  });
  setAIProvider({
    async *stream(req) {
      req.onReasoning?.("正在确认电影年份");
      await thinking;
      yield "功夫(2004)";
    },
    async generate() {
      return "功夫(2004)";
    },
  });
  const editor = {
    getText: () => "功夫",
    state: {
      selection: { from: 1, to: 1, empty: true },
      doc: { textContent: "功夫" },
    },
  } as unknown as Editor;
  render(<AISelector editor={editor} onClose={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /自定义指令/ }));
  fireEvent.change(screen.getByPlaceholderText("例如：把这段内容改写成小红书风格"), {
    target: { value: "添加年份" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确定", exact: true }));
  expect(await screen.findByText("正在确认电影年份")).toBeVisible();
  expect(screen.queryByText("生成结果")).toBeNull();
  expect(screen.queryByRole("button", { name: "全文替换", exact: true })).toBeNull();
  await act(async () => finishThinking());
  expect(await screen.findByText("功夫(2004)")).toBeVisible();
  expect(screen.getByText("生成结果")).toBeVisible();
  expect(screen.getByText("生成完成")).toBeVisible();
  expect(screen.getByText("思考已结束")).toBeVisible();
  expect(screen.getByText("正在确认电影年份")).toBeVisible();
  expect(screen.getByText("正在确认电影年份").closest("details")).toHaveAttribute("open");
});

it.each([false, true])(
  "选区存在=%s：无选区发送全文 Markdown，有选区只发送选中文本",
  async (hasSelection) => {
    const editor = new TiptapEditor({
      extensions: [StarterKit, Markdown],
      content: "<h2>功夫</h2><p>电影正文</p><h2>另一部电影</h2><p>第二段正文</p>",
    });
    if (hasSelection) editor.commands.setTextSelection({ from: 1, to: 3 });
    let context = "";
    setAIProvider({
      async *stream(req) {
        context = req.context;
        yield "处理完成";
      },
      async generate() {
        return "处理完成";
      },
    });
    try {
      render(<AISelector editor={editor} onClose={() => {}} />);
      fireEvent.click(screen.getByRole("button", { name: /自定义指令/ }));
      fireEvent.change(screen.getByPlaceholderText("例如：把这段内容改写成小红书风格"), {
        target: { value: "添加年份" },
      });
      fireEvent.click(screen.getByRole("button", { name: "确定", exact: true }));
      await screen.findByText("处理完成");
      if (hasSelection) {
        expect(context).toBe("功夫");
        expect(screen.getByRole("button", { name: "替换选中", exact: true })).toBeVisible();
      } else {
        expect(context).toBe("## 功夫\n\n电影正文\n\n## 另一部电影\n\n第二段正文");
        expect(screen.getByRole("button", { name: "全文替换", exact: true })).toBeVisible();
      }
    } finally {
      editor.destroy();
    }
  },
);
