"use client";

import { Carousel, type CarouselOptions } from "@qingwu-ui/carousel";
import { useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { ITEMS } from "./data";
import { CAROUSEL_FIELDS, carouselToCode, createCarousel } from "./playground.config";

/* ---- 静态卡通用挂载 ---- */
function StaticCarousel({ options }: { options: Partial<CarouselOptions> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const carousel = new Carousel(ref.current, { items: ITEMS, ...options });
    return () => carousel.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} />;
}

/* ---- 场景卡代码：手写实例化语句，框架外壳由 codegen 统一产出 ---- */
const snippet = (stmt: string) => genAll({ meta: PKG.carousel, symbol: "Carousel", stmt });

export default function CarouselPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="Carousel 轮播图"
        desc="左侧大图 + 右侧卡片文案 + 底部缩略图（右对齐至左图右缘）；背景从左往右滑入、角色随后淡入上移，文案逐行从右往左滑入；移动端支持触屏横滑切换。自动播放、循环、箭头、缩略图、速度与间隔均实时生效。"
        fields={CAROUSEL_FIELDS}
        create={createCarousel}
        toCode={carouselToCode}
        log
        hostStyle={{ width: "100%" }}
      />

      <DemoCard
        title="手动切换 · 关闭自动播放"
        desc="autoplay: false，由左右箭头与底部缩略图驱动；手动切换后不再自动计时。"
        snippets={snippet(`const carousel = new Carousel(el, {
  items: ITEMS,
  defaultValue: "01",
  autoplay: false
});`)}
      >
        <StaticCarousel options={{ defaultValue: "01", autoplay: false }} />
      </DemoCard>

      <DemoCard
        title="极简 · 无箭头无缩略图"
        desc="showArrows / showThumbs 均关闭，只保留大图与文案，适合嵌入式纯展示。"
        snippets={snippet(`const carousel = new Carousel(el, {
  items: ITEMS,
  showArrows: false,
  showThumbs: false
});`)}
      >
        <StaticCarousel options={{ showArrows: false, showThumbs: false }} />
      </DemoCard>

      <DemoCard
        title="悬浮缩略图（≤560px）"
        desc="加 .qcar--thumbs-float 后，缩略图在窄屏变为悬浮胶囊（宽屏不生效）。这是根节点样式变体而非组件 prop，下面用本地开关运行时切换根类。"
        snippets={snippet(`// 通过 className 写入悬浮缩略图变体（仅 ≤560px 生效）
const carousel = new Carousel(el, {
  items: ITEMS,
  className: "qcar--thumbs-float"
});`)}
      >
        <FloatThumbsDemo />
      </DemoCard>
    </div>
  );
}

/* ---- 悬浮缩略图变体：本地开关运行时切换根类 ---- */
function FloatThumbsDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [float, setFloat] = useState(false);

  useEffect(() => {
    if (!rootRef.current) return;
    const carousel = new Carousel(rootRef.current, {
      items: ITEMS,
      defaultValue: "01",
      ariaLabel: "悬浮缩略图轮播",
    });
    return () => carousel.destroy();
  }, []);

  useEffect(() => {
    rootRef.current?.classList.toggle("qcar--thumbs-float", float);
  }, [float]);

  return (
    <div>
      <div ref={rootRef} />
      <label
        className="tl-range-label"
        style={{ fontSize: 14, color: "#1d2b2c", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <input type="checkbox" checked={float} onChange={(e) => setFloat(e.target.checked)} />
        悬浮缩略图（仅 ≤560px 可见效果）
      </label>
    </div>
  );
}
