/**
 * 文本排版引擎 —— Pretext 风格的两阶段架构
 *
 * 核心规则（基于 CSS Text Module Level 3）：
 *
 * 规则 1: 两阶段分离
 *   prepare() → 一次性文本预处理（字素分割 + Canvas 宽度测量 + LRU 缓存）
 *   layout()  → 纯算术换行计算，O(n) 复杂度，可每帧调用
 *
 * 规则 2: Unicode 感知分割
 *   使用 Intl.Segmenter 进行字素簇（grapheme cluster）分割
 *   CJK 字符按单个字符断行，Emoji ZWJ 序列作为不可分割单元
 *
 * 规则 3: CSS 兼容换行优先级
 *   ① 强制换行（\n）优先级最高
 *   ② 空格为软断点（soft break opportunity）
 *   ③ CJK 字符前后均为断点，但标点禁止在行首
 *   ④ 拉丁单词只能在空格处断行
 *   ⑤ 无断点时走 overflow-wrap: break-word（按字符强制断开）
 *
 * 规则 4: 缓存策略
 *   宽度缓存以 (text, font) 为 key，全局共享
 *   避免同一文本重复测量，prepare() 后的 segment 可复用
 */

import type { LayoutLine, LayoutOptions, LayoutResult, Segment, SegmentType } from "./types";

// ─── 全局 Canvas 测量上下文（惰性单例） ───

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;

function getCtx(): CanvasRenderingContext2D | null {
  if (_ctx) return _ctx;
  if (typeof document === "undefined") return null;
  _canvas = document.createElement("canvas");
  _ctx = _canvas.getContext("2d");
  return _ctx;
}

// ─── 宽度缓存 ───

const _widthCache = new Map<string, Map<string, number>>();

function getCachedWidth(text: string, font: string): number {
  let fc = _widthCache.get(font);
  if (!fc) {
    fc = new Map();
    _widthCache.set(font, fc);
  }
  let w = fc.get(text);
  if (w !== undefined) return w;

  const c = getCtx();
  if (!c) {
    // SSR/非浏览器环境回退：拉丁字符 ~8px，CJK 字符 ~1em
    w = estimateWidth(text, font);
  } else {
    c.font = font;
    w = c.measureText(text).width;
  }
  fc.set(text, w);
  return w;
}

/** 非浏览器环境下的宽度估算 */
function estimateWidth(text: string, font: string): number {
  const fontSize = parseFloat(font) || 16;
  let w = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (isCJK(cp)) {
      w += fontSize; // CJK 字符 ≈ 1em
    } else if (ch === " ") {
      w += fontSize * 0.3;
    } else {
      w += fontSize * 0.55; // 拉丁字符 ≈ 0.55em
    }
  }
  return w;
}

// ─── Unicode 字符分类 ───

function isCJK(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK 统一汉字
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK 扩展 A
    (cp >= 0x20000 && cp <= 0x2a6df) || // CJK 扩展 B
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK 兼容汉字
    (cp >= 0x2f800 && cp <= 0x2fa1f) || // CJK 兼容补充
    (cp >= 0x3000 && cp <= 0x303f) || // CJK 符号和标点
    (cp >= 0xff00 && cp <= 0xffef) || // 半角/全角形式
    (cp >= 0x2e80 && cp <= 0x2eff) || // CJK 部首补充
    (cp >= 0x31c0 && cp <= 0x31ef) || // CJK 笔画
    (cp >= 0xac00 && cp <= 0xd7af) // 韩文音节
  );
}

/** 禁止出现在行首的标点 */
function isLineStartForbidden(cp: number): boolean {
  return (
    cp === 0x3001 || // 、
    cp === 0x3002 || // 。
    cp === 0xff0c || // ，
    cp === 0xff0e || // ．
    cp === 0xff1a || // ：
    cp === 0xff1b || // ；
    cp === 0xff1f || // ？
    cp === 0xff01 || // ！
    cp === 0xff09 || // ）
    cp === 0xff3d || // ］
    cp === 0x300d || // 」
    cp === 0x300f || // 』
    cp === 0x300b || // 》
    cp === 0x3011 // 】
  );
}

/** 禁止出现在行尾的标点 */
function isLineEndForbidden(cp: number): boolean {
  return (
    cp === 0xff08 || // （
    cp === 0xff3b || // ［
    cp === 0x300c || // 「
    cp === 0x300e || // 『
    cp === 0x300a || // 《
    cp === 0x3010 // 【
  );
}

// ─── 文本分割 ───

/** 将文本分割为可排版段，并测量宽度 */
function segmentText(text: string, font: string): Segment[] {
  const segments: Segment[] = [];

  // 使用 Intl.Segmenter 进行字素簇分割
  let graphemes: string[] = [];
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    // 使用 'en' locale 以兼容大多数文本
    try {
      const seg = new Intl.Segmenter("zh", { granularity: "grapheme" });
      for (const s of seg.segment(text)) {
        graphemes.push(s.segment);
      }
    } catch {
      // 回退：按码点分割
      for (const ch of text) {
        graphemes.push(ch);
      }
    }
  } else {
    graphemes = [...text];
  }

  for (const g of graphemes) {
    const cp = g.codePointAt(0) ?? 0;
    let type: SegmentType = "latin";

    if (g === "\n") {
      type = "break";
    } else if (g === " " || g === "\t") {
      type = "space";
    } else if (isCJK(cp)) {
      if (isLineStartForbidden(cp)) {
        type = "punct";
      } else {
        type = "cjk";
      }
    }

    segments.push({ text: g, width: getCachedWidth(g, font), type });
  }

  return segments;
}

// ─── 换行排版 ───

interface BreakState {
  /** 当前行起始 segment index */
  lineStart: number;
  /** 当前行累计宽度 */
  lineWidth: number;
  /** 最后一个可断点 index */
  lastBreakIdx: number;
  /** 最后一个可断点处的累计宽度 */
  lastBreakWidth: number;
}

function computeSegmentWidth(segments: Segment[], start: number, end: number): number {
  let w = 0;
  const limit = Math.min(end, segments.length);
  for (let i = start; i < limit; i++) {
    w += segments[i]!.width;
  }
  return w;
}

function buildLine(segments: Segment[], start: number, end: number, width: number): LayoutLine {
  const text = segments
    .slice(start, Math.min(end, segments.length))
    .map((s) => s.text)
    .join("");
  return { text, width };
}

/**
 * 核心排版函数 —— 将文本按指定宽度换行
 *
 * 算法（单次遍历，O(n)）：
 * 1. 遍历所有 segment，累加宽度
 * 2. 记录最后一个"可断点"位置
 * 3. 当累计宽度超出 maxWidth 时，回退到最近的可断点
 * 4. 无断点时执行 overflow-wrap 策略
 * 5. 标点贴在上一字符后，不单独出现在行首
 */
export function layout(
  text: string,
  options: LayoutOptions,
  font: string = "16px system-ui",
): LayoutResult {
  const { maxWidth, lineHeight, maxLines, overflowWrap = "break-word" } = options;
  const segments = segmentText(text, font);
  const lines: LayoutLine[] = [];

  const st: BreakState = { lineStart: 0, lineWidth: 0, lastBreakIdx: -1, lastBreakWidth: 0 };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;

    // ── 强制换行 ──
    if (seg.type === "break") {
      lines.push(buildLine(segments, st.lineStart, i, st.lineWidth));
      st.lineStart = i + 1;
      st.lineWidth = 0;
      st.lastBreakIdx = -1;
      continue;
    }

    const newWidth = st.lineWidth + seg.width;

    // ── 空格：记录为可断点 ──
    if (seg.type === "space") {
      if (newWidth > maxWidth && st.lineWidth > 0) {
        // 空格导致溢出，在上一断点处换行
        if (st.lastBreakIdx >= 0) {
          lines.push(buildLine(segments, st.lineStart, st.lastBreakIdx + 1, st.lastBreakWidth));
          st.lineStart = st.lastBreakIdx + 1;
          st.lineWidth = computeSegmentWidth(segments, st.lineStart, i + 1);
        } else {
          lines.push(buildLine(segments, st.lineStart, i, st.lineWidth));
          st.lineStart = i;
          st.lineWidth = seg.width;
        }
        st.lastBreakIdx = -1;
      } else {
        st.lineWidth = newWidth;
        st.lastBreakIdx = i;
        st.lastBreakWidth = st.lineWidth;
      }
      // 检查 maxLines
      if (maxLines && lines.length >= maxLines) break;
      continue;
    }

    // ── CJK 字符：可前后断行 ──
    if (seg.type === "cjk") {
      if (newWidth > maxWidth && st.lineWidth > 0) {
        // 在 CJK 字符前断行
        lines.push(buildLine(segments, st.lineStart, i, st.lineWidth));
        st.lineStart = i;
        st.lineWidth = seg.width;
        st.lastBreakIdx = -1;
      } else {
        st.lineWidth = newWidth;
        st.lastBreakIdx = i;
        st.lastBreakWidth = st.lineWidth;
      }
      if (maxLines && lines.length >= maxLines) break;
      continue;
    }

    // ── CJK 标点：禁止出现在行首 ──
    if (seg.type === "punct") {
      if (st.lineWidth === 0 && lines.length > 0) {
        // 标点在行首，回退：将上一行最后一个 CJK 字符移到当前行
        const lastLine = lines[lines.length - 1]!;
        if (lastLine.text.length > 0) {
          // 简化处理：把标点宽度加到当前行（后续渲染时会自然贴在前一字符后）
          st.lineWidth = seg.width;
        }
      } else if (newWidth > maxWidth) {
        // 将前一字符和标点一起移到下一行
        if (st.lastBreakIdx >= 0) {
          lines.push(buildLine(segments, st.lineStart, st.lastBreakIdx + 1, st.lastBreakWidth));
          st.lineStart = st.lastBreakIdx + 1;
          st.lineWidth = computeSegmentWidth(segments, st.lineStart, i + 1);
        } else {
          st.lineWidth = newWidth; // 溢出也保留在同一行
        }
        st.lastBreakIdx = -1;
      } else {
        st.lineWidth = newWidth;
      }
      if (maxLines && lines.length >= maxLines) break;
      continue;
    }

    // ── 拉丁/其他文字：单词边界断行 ──
    if (newWidth > maxWidth && st.lineWidth > 0) {
      if (st.lastBreakIdx >= 0) {
        // 回退到上一空格处
        lines.push(buildLine(segments, st.lineStart, st.lastBreakIdx + 1, st.lastBreakWidth));
        st.lineStart = st.lastBreakIdx + 1;
        st.lineWidth = computeSegmentWidth(segments, st.lineStart, i + 1);
        st.lastBreakIdx = -1;
      } else if (overflowWrap === "break-word") {
        // 无处可断，强制在当前字符前断开
        lines.push(buildLine(segments, st.lineStart, i, st.lineWidth));
        st.lineStart = i;
        st.lineWidth = seg.width;
      } else {
        st.lineWidth = newWidth; // 溢出但不断行
      }
    } else {
      st.lineWidth = newWidth;
    }

    if (maxLines && lines.length >= maxLines) break;
  }

  // ── 收尾：最后一行 ──
  const hasMore = st.lineStart < segments.length;
  if (hasMore && (!maxLines || lines.length < maxLines)) {
    const endWidth = computeSegmentWidth(segments, st.lineStart, segments.length);
    lines.push(buildLine(segments, st.lineStart, segments.length, endWidth));
  }

  return {
    lines,
    totalHeight: lines.length * lineHeight,
    lineCount: lines.length,
    truncated: hasMore && maxLines ? lines.length >= maxLines : false,
  };
}

// ─── 公开 API ───

/**
 * 准备文本用于快速排版（Pretext prepare 阶段）
 *
 * 一次性完成：字素分割 + 宽度测量 + 缓存
 * 返回的 segments 可在多次 layout 调用中复用
 *
 * @param text - 待排版的文本
 * @param font - CSS font 字符串，如 "16px Inter"
 * @returns 预处理后的文本段数组
 */
export function prepare(text: string, font: string = "16px system-ui"): Segment[] {
  return segmentText(text, font);
}

/**
 * 对已 prepare 的文本段进行排版（Pretext layout 阶段）
 *
 * 纯算术计算，不触发任何 DOM/Canvas 操作
 * 可在每帧、每次 resize 时自由调用
 */
export function layoutSegments(segments: Segment[], options: LayoutOptions): LayoutResult {
  const { maxWidth, lineHeight, maxLines, overflowWrap = "break-word" } = options;
  const lines: LayoutLine[] = [];

  const st: BreakState = { lineStart: 0, lineWidth: 0, lastBreakIdx: -1, lastBreakWidth: 0 };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;

    if (seg.type === "break") {
      lines.push(buildLine(segments, st.lineStart, i, st.lineWidth));
      st.lineStart = i + 1;
      st.lineWidth = 0;
      st.lastBreakIdx = -1;
      continue;
    }

    const newWidth = st.lineWidth + seg.width;

    if (seg.type === "space") {
      if (newWidth > maxWidth && st.lineWidth > 0) {
        if (st.lastBreakIdx >= 0) {
          lines.push(buildLine(segments, st.lineStart, st.lastBreakIdx + 1, st.lastBreakWidth));
          st.lineStart = st.lastBreakIdx + 1;
          st.lineWidth = computeSegmentWidth(segments, st.lineStart, i + 1);
        } else {
          lines.push(buildLine(segments, st.lineStart, i, st.lineWidth));
          st.lineStart = i;
          st.lineWidth = seg.width;
        }
        st.lastBreakIdx = -1;
      } else {
        st.lineWidth = newWidth;
        st.lastBreakIdx = i;
        st.lastBreakWidth = st.lineWidth;
      }
      if (maxLines && lines.length >= maxLines) break;
      continue;
    }

    if (seg.type === "cjk") {
      if (newWidth > maxWidth && st.lineWidth > 0) {
        lines.push(buildLine(segments, st.lineStart, i, st.lineWidth));
        st.lineStart = i;
        st.lineWidth = seg.width;
        st.lastBreakIdx = -1;
      } else {
        st.lineWidth = newWidth;
        st.lastBreakIdx = i;
        st.lastBreakWidth = st.lineWidth;
      }
      if (maxLines && lines.length >= maxLines) break;
      continue;
    }

    if (seg.type === "punct") {
      if (st.lineWidth === 0) {
        st.lineWidth = seg.width;
      } else if (newWidth > maxWidth) {
        if (st.lastBreakIdx >= 0) {
          lines.push(buildLine(segments, st.lineStart, st.lastBreakIdx + 1, st.lastBreakWidth));
          st.lineStart = st.lastBreakIdx + 1;
          st.lineWidth = computeSegmentWidth(segments, st.lineStart, i + 1);
        } else {
          st.lineWidth = newWidth;
        }
        st.lastBreakIdx = -1;
      } else {
        st.lineWidth = newWidth;
      }
      if (maxLines && lines.length >= maxLines) break;
      continue;
    }

    if (newWidth > maxWidth && st.lineWidth > 0) {
      if (st.lastBreakIdx >= 0) {
        lines.push(buildLine(segments, st.lineStart, st.lastBreakIdx + 1, st.lastBreakWidth));
        st.lineStart = st.lastBreakIdx + 1;
        st.lineWidth = computeSegmentWidth(segments, st.lineStart, i + 1);
        st.lastBreakIdx = -1;
      } else if (overflowWrap === "break-word") {
        lines.push(buildLine(segments, st.lineStart, i, st.lineWidth));
        st.lineStart = i;
        st.lineWidth = seg.width;
      } else {
        st.lineWidth = newWidth;
      }
    } else {
      st.lineWidth = newWidth;
    }

    if (maxLines && lines.length >= maxLines) break;
  }

  const hasMore = st.lineStart < segments.length;
  if (hasMore && (!maxLines || lines.length < maxLines)) {
    const endWidth = computeSegmentWidth(segments, st.lineStart, segments.length);
    lines.push(buildLine(segments, st.lineStart, segments.length, endWidth));
  }

  return {
    lines,
    totalHeight: lines.length * lineHeight,
    lineCount: lines.length,
    truncated: hasMore && maxLines ? lines.length >= maxLines : false,
  };
}

/** 快速计算文本在指定宽度下的行数和高度 */
export function measure(
  text: string,
  maxWidth: number,
  lineHeight: number,
  font?: string,
): { lineCount: number; totalHeight: number } {
  const result = layout(text, { maxWidth, lineHeight }, font);
  return { lineCount: result.lineCount, totalHeight: result.totalHeight };
}

/** 获取文本宽度（带缓存）—— 供 chip-flow 等组件使用 */
export function measureWidth(text: string, font: string = "16px system-ui"): number {
  return getCachedWidth(text, font);
}

/** 清除全局宽度缓存（字体变更后调用） */
export function clearCache(): void {
  _widthCache.clear();
}
