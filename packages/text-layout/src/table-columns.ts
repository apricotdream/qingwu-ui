/**
 * 表格列宽自动计算：按自然宽度比例分配，受最小/最大宽度约束，溢出列截断。
 * 测量阶段与渲染分离，避免浏览器 table-layout 需完整渲染的性能问题。
 */

import { layout } from "./engine";
import type { ColumnWidthResult } from "./types";

/** 计算表格列的最佳宽度分配 */
export function computeColumnWidths(
  rows: string[][],
  availableWidth: number,
  font: string = "16px system-ui",
  minColumnWidth: number = 60,
  maxColumnWidth?: number,
): ColumnWidthResult {
  if (rows.length === 0) {
    return { widths: [], total: 0, truncated: [] };
  }

  const colCount = Math.max(...rows.map((r) => r.length));
  if (colCount === 0) {
    return { widths: [], total: 0, truncated: [] };
  }

  // 1. 计算每列的"自然宽度"（该列所有单元格中最大者）
  const naturalWidths: number[] = new Array(colCount).fill(0);

  for (const row of rows) {
    for (let c = 0; c < colCount; c++) {
      const cellText = row[c] ?? "";
      const result = layout(cellText, { maxWidth: Infinity, lineHeight: 1 }, font);
      const cellWidth = result.lines.length > 0 ? (result.lines[0]?.width ?? 0) : 0;
      naturalWidths[c] = Math.max(naturalWidths[c] ?? 0, cellWidth);
    }
  }

  // 2. 比例分配
  const totalNatural = naturalWidths.reduce((s, w) => s + w, 0);
  const widths: number[] = [];
  const truncated: boolean[] = [];

  if (totalNatural <= availableWidth) {
    // 有剩余空间，按比例放大
    const scale = availableWidth / Math.max(totalNatural, 1);
    for (let c = 0; c < colCount; c++) {
      const w = Math.round((naturalWidths[c] ?? 0) * scale);
      widths.push(Math.max(w, minColumnWidth));
      truncated.push(false);
    }
  } else {
    // 空间不足，按比例压缩
    // 首先确保每列不小于最小宽度
    let remaining = availableWidth;
    const allocated: number[] = new Array(colCount).fill(0);

    // 第一轮：分配最小宽度
    for (let c = 0; c < colCount; c++) {
      allocated[c] = minColumnWidth;
      remaining -= minColumnWidth;
    }

    // 第二轮：剩余空间按自然宽度比例分配
    if (remaining > 0) {
      const extraNatural = naturalWidths.map((w) => Math.max(0, w - minColumnWidth));
      const totalExtra = extraNatural.reduce((s, w) => s + w, 0);

      if (totalExtra > 0) {
        for (let c = 0; c < colCount; c++) {
          const extra = Math.round(((extraNatural[c] ?? 0) / totalExtra) * remaining);
          allocated[c] = (allocated[c] ?? 0) + extra;
        }
      }
    }

    // 应用最大宽度约束
    for (let c = 0; c < colCount; c++) {
      let w = allocated[c] ?? minColumnWidth;
      const maxW = maxColumnWidth ?? Infinity;
      if (w > maxW) w = maxW;
      widths.push(w);
      truncated.push(w < (naturalWidths[c] ?? 0));
    }
  }

  const total = widths.reduce((s, w) => s + w, 0);

  return { widths, total, truncated };
}

/** 截断单行数据，使每个单元格适配其列宽 */
export function fitRowToColumns(
  row: string[],
  columnWidths: number[],
  font: string = "16px system-ui",
): string[] {
  return row.map((cell, i) => {
    const w = columnWidths[i];
    if (w === undefined) return cell;
    const result = layout(cell, { maxWidth: w, lineHeight: 1, maxLines: 1 }, font);
    if (result.truncated || result.lineCount > 1) {
      // 简单截断：取第一行 + 省略号
      const firstLine = result.lines[0]?.text ?? "";
      return firstLine.length < cell.length ? firstLine.trimEnd() + "…" : firstLine;
    }
    return cell;
  });
}
