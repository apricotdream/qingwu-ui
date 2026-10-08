import { Carousel, type CarouselOptions } from "@qingwu-ui/carousel";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";
import { ITEMS } from "./data";

/** 生成代码用的精简自包含数据：简单 SVG data URI，避免引用外部变量（抄走即跑） */
function tile(bg: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760"><rect width="1200" height="760" fill="${bg}"/><circle cx="220" cy="180" r="120" fill="rgba(255,255,255,0.25)"/><text x="72" y="120" fill="rgba(255,255,255,0.95)" font-size="64" font-family="Arial" font-weight="800">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
const CODE_ITEMS = [
  {
    value: "01",
    title: "晨光",
    subtitle: "Morning Light",
    description: "背景、主体图与文案分层入场。",
    background: tile("#f4d9de", "01"),
    image: tile("#2d2f39", "01"),
    thumbnail: tile("#f4d9de", "01"),
  },
  {
    value: "02",
    title: "港湾",
    subtitle: "Harbor",
    description: "背景先滑入、角色随后淡入上移。",
    background: tile("#f1d59b", "02"),
    image: tile("#3d3427", "02"),
    thumbnail: tile("#f1d59b", "02"),
  },
  {
    value: "03",
    title: "回声",
    subtitle: "Echo",
    description: "标题、简介、链接逐层出现。",
    background: tile("#d6d0ff", "03"),
    image: tile("#2d254f", "03"),
    thumbnail: tile("#d6d0ff", "03"),
  },
];
const CODE_ITEMS_LITERAL = JSON.stringify(CODE_ITEMS, null, 2)
  .split("\n")
  .map((l, i) => (i === 0 ? l : `  ${l}`))
  .join("\n");

export const CAROUSEL_FIELDS: FieldDef[] = [
  {
    key: "autoplay",
    label: "自动播放",
    type: "boolean",
    defaultValue: "true",
    live: true,
  },
  {
    key: "loop",
    label: "循环",
    type: "boolean",
    defaultValue: "true",
    live: true,
  },
  {
    key: "showArrows",
    label: "左右箭头",
    type: "boolean",
    defaultValue: "true",
    live: true,
  },
  {
    key: "showThumbs",
    label: "缩略图",
    type: "boolean",
    defaultValue: "true",
    live: true,
  },
  {
    key: "speed",
    label: "播放速度",
    type: "select",
    defaultValue: "1",
    live: true,
    options: [
      { label: "0.5×（慢）", value: "0.5" },
      { label: "1×（正常）", value: "1" },
      { label: "2×（快）", value: "2" },
      { label: "4×（极快）", value: "4" },
    ],
  },
  {
    key: "interval",
    label: "播放间隔",
    type: "select",
    defaultValue: "3800",
    live: true,
    options: [
      { label: "1000ms", value: "1000" },
      { label: "2000ms", value: "2000" },
      { label: "3800ms", value: "3800" },
      { label: "5000ms", value: "5000" },
      { label: "6500ms", value: "6500" },
      { label: "8000ms", value: "8000" },
    ],
  },
];

export function createCarousel(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  const opts: Partial<CarouselOptions> = {
    items: ITEMS,
    defaultValue: "01",
    autoplay: v.autoplay !== false,
    loop: v.loop !== false,
    showArrows: v.showArrows !== false,
    showThumbs: v.showThumbs !== false,
    speed: Number(v.speed),
    interval: Number(v.interval),
    ariaLabel: "卡片式轮播图",
    onChange: (value, item) => log(`切换到「${item.title}」= ${value}`),
  };

  const carousel = new Carousel(host, opts);
  log("Carousel 渲染完成");

  return {
    destroy: () => carousel.destroy(),
    update: (values, changedKey) => {
      carousel.update({
        autoplay: values.autoplay as boolean,
        loop: values.loop as boolean,
        showArrows: values.showArrows as boolean,
        showThumbs: values.showThumbs as boolean,
        speed: Number(values.speed),
        interval: Number(values.interval),
      });
      const field = CAROUSEL_FIELDS.find((f) => f.key === changedKey);
      log(`实时更新 ${field?.label ?? changedKey} → ${String(values[changedKey])}`);
    },
  };
}

export function carouselToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = [`  items: ${CODE_ITEMS_LITERAL},`, '  defaultValue: "01",'];
  if (v.autoplay === false) lines.push("  autoplay: false,");
  if (v.loop === false) lines.push("  loop: false,");
  if (v.showArrows === false) lines.push("  showArrows: false,");
  if (v.showThumbs === false) lines.push("  showThumbs: false,");
  if (Number(v.speed) !== 1)
    lines.push(`  speed: ${v.speed}, // 实际间隔 = interval / speed（下限 250ms）`);
  if (Number(v.interval) !== 3800) lines.push(`  interval: ${v.interval},`);

  const stmt = `const carousel = new Carousel(el, {
${lines.join("\n")}
});`;

  return { meta: PKG.carousel, symbol: "Carousel", stmt };
}
