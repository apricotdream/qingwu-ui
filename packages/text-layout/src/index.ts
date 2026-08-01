/**
 * @qingwu/text-layout
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

// ─── 核心引擎 ───
export { prepare, layout, layoutSegments, measure, measureWidth, clearCache } from "./engine";

// ─── 类型 ───
export type {
  SegmentType,
  Segment,
  LayoutOptions,
  LayoutLine,
  LayoutResult,
  VirtualItem,
  VirtualHeightResult,
  TruncateResult,
  ChipItem,
  ChipLine,
  ChipLayoutResult,
  ColumnWidthResult,
} from "./types";

// ─── 虚拟滚动 ───
export { computeVirtualHeights, findVisibleRange } from "./virtual-scroll";

// ─── 多行截断 ───
export { truncateToLines, truncateToHeight } from "./truncate";

// ─── 芯片流布局 ───
export { layoutChips } from "./chip-flow";

// ─── 表格列宽 ───
export { computeColumnWidths, fitRowToColumns } from "./table-columns";
