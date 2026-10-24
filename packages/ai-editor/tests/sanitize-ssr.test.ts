// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sanitizeHtml, sanitizeSvg } from "../src/editor/utils/sanitize";

describe("无 DOM 环境的安全回退", () => {
  it.each([sanitizeHtml, sanitizeSvg])(
    "实体编码和无引号事件不会在 SSR 输出中变成可执行标签",
    (sanitize) => {
      const result = sanitize("<a href=jav&#x61;script:alert(1)>x</a><svg/onload=alert(1)>");
      expect(result).not.toContain("<");
      expect(result).toContain("&lt;");
    },
  );
});
