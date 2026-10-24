import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportDialog } from "../src/components/export-dialog";
import * as exports from "../src/editor/utils/document-export";

vi.mock("../src/editor/utils/document-export", () => ({
  getExportContent: vi.fn(() => "正文"),
  createMarkdownDownload: vi.fn(),
  createPrintHtml: vi.fn(),
  waitForPrintImages: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

function openDialog() {
  const onClose = vi.fn();
  render(<ExportDialog open editor={{} as Editor} onClose={onClose} />);
  return onClose;
}

function download(label: string) {
  return within(screen.getByText(label).closest(".qed-row") as HTMLElement).getByRole("button", {
    name: "下载",
  });
}

describe("导出交互", () => {
  it("图片未就绪时禁用下载，完整解码后才调用打印", async () => {
    const doc = document.implementation.createHTMLDocument();
    const print = vi.fn();
    const focus = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({ document: doc, print, focus } as unknown as Window);
    vi.mocked(exports.createPrintHtml).mockResolvedValue("<html><body>预览</body></html>");
    let ready!: () => void;
    vi.mocked(exports.waitForPrintImages).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          ready = resolve;
        }),
    );
    const onClose = openDialog();
    fireEvent.click(download("PDF"));
    await vi.waitFor(() => expect(exports.waitForPrintImages).toHaveBeenCalledWith(doc));
    expect(print).not.toHaveBeenCalled();
    expect(download("Markdown")).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => ready());
    expect(print).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("图片读取失败时关闭空预览并允许重试", async () => {
    const close = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({
      document: document.implementation.createHTMLDocument(),
      close,
    } as unknown as Window);
    vi.mocked(exports.createPrintHtml).mockRejectedValue(new Error("图片读取失败"));
    const onClose = openDialog();
    fireEvent.click(download("PDF"));
    expect(await screen.findByRole("alert")).toHaveTextContent("图片读取失败");
    expect(close).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(download("PDF")).toBeEnabled();
  });

  it("Markdown 资源失败时显示错误，保留导出面板", async () => {
    vi.mocked(exports.createMarkdownDownload).mockRejectedValue(new Error("资源无法读取"));
    const onClose = openDialog();
    fireEvent.click(download("Markdown"));
    expect(await screen.findByRole("alert")).toHaveTextContent("资源无法读取");
    expect(onClose).not.toHaveBeenCalled();
    expect(download("Markdown")).toBeEnabled();
  });
});
