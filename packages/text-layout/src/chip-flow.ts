/** 芯片流（Chip Flow）布局：chip 为不可断行原子元素，与文本混合 inline 排版 */

import { measureWidth } from "./engine";
import type { ChipItem, ChipLayoutResult, ChipLine } from "./types";

/** 对芯片+文本混合内容进行 inline 排版 */
export function layoutChips(
  items: ChipItem[],
  maxWidth: number,
  font: string = "16px system-ui",
  chipPaddingX: number = 16,
  lineHeight: number = 24,
): ChipLayoutResult {
  const lines: ChipLine[] = [];
  let currentLine: ChipLine = { items: [], width: 0 };
  let cursorX = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]!;

    if (item.type === "chip") {
      const chipWidth = measureWidth(item.text, font) + (item.extraWidth ?? chipPaddingX);

      // chip 是不可断元素，整体放不下就换行
      if (cursorX + chipWidth > maxWidth && currentLine.items.length > 0) {
        lines.push(currentLine);
        currentLine = { items: [], width: 0 };
        cursorX = 0;
      }

      currentLine.items.push({
        type: "chip",
        text: item.text,
        x: cursorX,
        width: chipWidth,
      });
      cursorX += chipWidth;
      currentLine.width = cursorX;

      // chip 间间距
      const next = items[idx + 1];
      if (next && next.type === "chip") {
        const gap = 8;
        if (cursorX + gap <= maxWidth) {
          cursorX += gap;
          currentLine.width += gap;
        }
      }
    } else {
      // 文本按单词换行（简化：按空格分割）
      const words = item.text.split(/(?<=\s)/);
      for (const word of words) {
        const wordWidth = measureWidth(word, font);

        if (cursorX + wordWidth > maxWidth && currentLine.items.length > 0) {
          lines.push(currentLine);
          currentLine = { items: [], width: 0 };
          cursorX = 0;
        }

        currentLine.items.push({
          type: "text",
          text: word,
          x: cursorX,
          width: wordWidth,
        });
        cursorX += wordWidth;
        currentLine.width = cursorX;
      }
    }
  }

  if (currentLine.items.length > 0) {
    lines.push(currentLine);
  }

  return {
    lines,
    totalHeight: lines.length * lineHeight,
  };
}
