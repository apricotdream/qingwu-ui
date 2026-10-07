import { describe, expect, it } from "vitest";
import { escapeHtml, sanitizeHtml, sanitizeSvg } from "../src/editor/utils/sanitize";

describe("sanitizeHtml (DOMPurify)", () => {
  it("strips <script> tags and content", () => {
    const result = sanitizeHtml("<p>hi</p><script>alert(1)</script>");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("hi");
  });

  it("strips on* event handlers", () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert(1)");
  });

  it("neutralizes javascript: protocol in href", () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain("javascript:alert");
    expect(result).toContain("click");
  });

  it("preserves data-* attributes for editor custom nodes", () => {
    const result = sanitizeHtml(
      '<div data-video-embed="bilibili" src="https://bilibili.com/BV1234567890">x</div>',
    );
    expect(result).toContain('data-video-embed="bilibili"');
    expect(result).toContain("bilibili.com");
  });

  it("strips iframe but keeps parent div data (videoEmbed survives)", () => {
    const result = sanitizeHtml(
      '<div data-video-embed="bilibili" src="https://b.com/BV1"><iframe src="https://player.bilibili.com/"></iframe></div>',
    );
    expect(result).not.toContain("<iframe");
    expect(result).toContain("data-video-embed");
  });

  it("preserves class and safe style", () => {
    const result = sanitizeHtml('<p class="foo" style="color:red">x</p>');
    expect(result).toContain('class="foo"');
    expect(result.toLowerCase()).toContain("color");
  });

  it("strips <style> tags", () => {
    const result = sanitizeHtml("<style>body{color:red}</style><p>x</p>");
    expect(result).not.toContain("<style");
    expect(result).toContain("<p>x</p>");
  });

  it("strips nested <svg> with onload", () => {
    const result = sanitizeHtml('<svg onload="alert(1)"><circle/></svg>');
    expect(result).not.toContain("onload");
    expect(result).not.toContain("alert(1)");
  });
});

describe("escapeHtml", () => {
  it("escapes special chars", () => {
    expect(escapeHtml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
  it("leaves safe text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("sanitizeSvg", () => {
  it("strips <script> from svg but keeps svg structure", () => {
    const result = sanitizeSvg("<svg><script>alert(1)</script><circle/></svg>");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("<svg");
    expect(result).toContain("circle");
  });
  it("strips foreignObject", () => {
    const result = sanitizeSvg("<svg><foreignObject><div>x</div></foreignObject><circle/></svg>");
    expect(result).not.toContain("foreignObject");
    expect(result).not.toContain("<div");
  });
});
