/**
 * 文本段类型
 * - cjk: 中日韩字符，可前后断行
 * - latin: 拉丁/阿拉伯等，只能在单词边界断行
 * - space: 空白字符（软断点）
 * - break: 强制换行（\n）
 * - punct: CJK 标点，不应出现在行首
 */
export type SegmentType = "cjk" | "latin" | "space" | "break" | "punct";

/** 排版后的文本段，含测量宽度 */
export interface Segment {
  text: string;
  width: number;
  type: SegmentType;
}

/** 排版参数 */
export interface LayoutOptions {
  /** 容器宽度 (px) */
  maxWidth: number;
  /** 行高 (px) */
  lineHeight: number;
  /** 最大行数，超出后截断 */
  maxLines?: number;
  /** 溢出换行策略 */
  overflowWrap?: "normal" | "break-word";
}

/** 单行排版结果 */
export interface LayoutLine {
  text: string;
  width: number;
}

/** 排版结果 */
export interface LayoutResult {
  lines: LayoutLine[];
  totalHeight: number;
  lineCount: number;
  truncated: boolean;
}

/** 虚拟滚动列表项 */
export interface VirtualItem {
  id: string;
  text: string;
}

/** 虚拟滚动高度计算结果 */
export interface VirtualHeightResult {
  /** id → 高度 映射 */
  heights: Map<string, number>;
  /** 累计高度数组（用于 offset 定位） */
  offsets: number[];
  /** 所有项总高度 */
  totalHeight: number;
}

/** 截断结果 */
export interface TruncateResult {
  text: string;
  truncated: boolean;
  lineCount: number;
  fullLineCount: number;
}

/** 芯片流布局项 */
export interface ChipItem {
  type: "text" | "chip";
  text: string;
  /** chip 元素的额外宽度（边框/内边距/关闭按钮等） */
  extraWidth?: number;
}

/** 芯片流单行结果 */
export interface ChipLine {
  items: Array<{ type: "text" | "chip"; text: string; x: number; width: number }>;
  width: number;
}

/** 芯片流布局结果 */
export interface ChipLayoutResult {
  lines: ChipLine[];
  totalHeight: number;
}

/** 表格列宽计算结果 */
export interface ColumnWidthResult {
  /** 每列分配宽度 */
  widths: number[];
  /** 总分配宽度 */
  total: number;
  /** 是否有列被截断 */
  truncated: boolean[];
}
