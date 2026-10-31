import { Extension } from "@tiptap/core";

interface InlineState {
  src: string;
  __qingwuChineseEmphasis?: boolean;
  scanDelims(
    start: number,
    canSplitWord: boolean,
  ): {
    length: number;
    can_open: boolean;
    can_close: boolean;
  };
}

interface MarkdownParser {
  __qingwuChineseEmphasis?: boolean;
  inline: {
    ruler: {
      before(before: string, name: string, rule: (state: InlineState) => boolean): void;
    };
  };
}

/** 只放宽中文与全角标点相邻的双星号，仍由 Markdown 原有规则处理嵌套、转义和代码。 */
export function configureChineseEmphasis(md: MarkdownParser) {
  if (md.__qingwuChineseEmphasis) return;
  md.__qingwuChineseEmphasis = true;
  md.inline.ruler.before("emphasis", "qingwu_chinese_emphasis", (state: InlineState) => {
    if (state.__qingwuChineseEmphasis) return false;
    state.__qingwuChineseEmphasis = true;
    const scanDelims = state.scanDelims;
    state.scanDelims = function (start: number, canSplitWord: boolean) {
      const result = scanDelims.call(this, start, canSplitWord);
      if (this.src[start] !== "*" || result.length !== 2) return result;
      const before = this.src[start - 1] ?? "";
      const after = this.src[start + 2] ?? "";
      const chinese = /\p{Script=Han}/u;
      const punctuation = /[\u3001-\u303f\uff01-\uff65]/u;
      if (chinese.test(before) && punctuation.test(after)) result.can_open = true;
      if (punctuation.test(before) && chinese.test(after)) result.can_close = true;
      return result;
    };
    return false;
  });
}

export const ChineseEmphasis = Extension.create({
  name: "chineseEmphasis",
  addStorage() {
    return { markdown: { parse: { setup: configureChineseEmphasis } } };
  },
});
