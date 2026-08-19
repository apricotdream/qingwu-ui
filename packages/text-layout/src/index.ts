/** @qingwu-ui/text-layout — Pretext 启发，prepare/layout 两阶段文本排版引擎 */

export { layoutChips } from "./chip-flow";
export { clearCache, layout, layoutSegments, measure, measureWidth, prepare } from "./engine";
export { computeColumnWidths, fitRowToColumns } from "./table-columns";

export { truncateToHeight, truncateToLines } from "./truncate";
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
export { computeVirtualHeights, findVisibleRange } from "./virtual-scroll";
