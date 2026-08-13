/**
 * @apricotdream/text-layout
 *
 * Pretext 启发的文本排版引擎 —— 两阶段 prepare/layout 架构
 *
 * 核心能力：
 *   - prepare() + layout() — 文本预处理 + 纯算术换行
 *   - 虚拟滚动高度预计算
 *   - 多行文本截断（精确到字符）
 *   - 芯片流（Chip Flow）inline 排版
 *   - 表格列宽自动分配
 */

// ─── 芯片流布局 ───
export { layoutChips } from "./chip-flow";
// ─── 核心引擎 ───
export { clearCache, layout, layoutSegments, measure, measureWidth, prepare } from "./engine";
// ─── 表格列宽 ───
export { computeColumnWidths, fitRowToColumns } from "./table-columns";

// ─── 多行截断 ───
export { truncateToHeight, truncateToLines } from "./truncate";
// ─── 类型 ───
export type {
  ChipItem,
  ChipLayoutResult,
  ChipLine,
  ColumnWidthResult,
  LayoutLine,
  LayoutOptions,
  LayoutResult,
  Segment,
  SegmentType,
  TruncateResult,
  VirtualHeightResult,
  VirtualItem,
} from "./types";
// ─── 虚拟滚动 ───
export { computeVirtualHeights, findVisibleRange } from "./virtual-scroll";
