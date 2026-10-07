import { Extension, markInputRule } from "@tiptap/core";

/**
 * 手写 `` `code` `` 行内代码：ProseMirror 自带的 codeInRule 正则带 `(?=.)` 前瞻，
 * 要求闭合反引号后还有一个字符，导致在行尾（无后续字符）敲完闭合反引号不触发，
 * 用户常见的「敲 `xxx` 后直接回车」场景得不到行内代码。
 * 此处补一个去掉前瞻的规则：闭合反引号位于文本块结尾也能转换。
 */
export const InlineCodeEnd = Extension.create({
  name: "inlineCodeEnd",
  addInputRules() {
    const type = this.editor.schema.marks.code;
    if (!type) return [];
    return [markInputRule({ find: /`([^`]+)`$/, type })];
  },
});
