import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * 搜狗/QQ 拼音「空格选词」会先上屏候选词（compositionend），紧接着在**同一按键**里
 * 再派发一次 `beforeinput insertText " "`（isComposing=false），把空格当普通输入
 * 插入文档。段落里 white-space:normal 会折叠这个尾随空格所以看不出来，代码块是
 * pre-wrap 全量保留 → 用户报告的「代码块里按空格出现空位」。
 * 守卫：compositionend 后 100ms 内的 insertText 空格一律吞掉；用户真要输空格
 * 间隔 100ms 后再按即可（或组合结束后再按一次）。
 */
const GUARD_WINDOW_MS = 100;

export const ImeCommitSpaceGuard = Extension.create({
  name: "imeCommitSpaceGuard",

  addProseMirrorPlugins() {
    let lastCompositionEnd = 0;
    return [
      new Plugin({
        key: new PluginKey("imeCommitSpaceGuard"),
        props: {
          handleDOMEvents: {
            compositionend() {
              lastCompositionEnd = performance.now();
              return false;
            },
            // 部分引擎/模拟路径（如 CDP imeSetComposition 提交）不发 compositionend，
            // 但会先发一个 isComposing=true 的 input 上屏——同样作为「刚结束组合」的标记。
            input(_view, event) {
              const ie = event as InputEvent;
              if (ie.isComposing) lastCompositionEnd = performance.now();
              return false;
            },
            beforeinput(_view, event) {
              const ie = event as InputEvent;
              if (ie.inputType !== "insertText" || ie.data !== " ") return false;
              // 组合进行中的空格不拦（由输入法自行消费）；只拦「组合刚结束」的尾巴空格
              if (ie.isComposing || performance.now() - lastCompositionEnd > GUARD_WINDOW_MS) {
                return false;
              }
              ie.preventDefault();
              return true;
            },
          },
        },
      }),
    ];
  },
});
