"use client";

import { Carousel } from "../../../../../packages/carousel/src/carousel";
import type { CarouselItem } from "../../../../../packages/carousel/src/types";
import "../../../../../packages/carousel/src/style.css";
import { useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";

function backgroundSvg(label: string, accent: string, base: string, note: string): string {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" role="img" aria-label="${label} 背景">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${base}"/>
        <stop offset="100%" stop-color="${accent}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="760" fill="url(#g)"/>
    <circle cx="220" cy="150" r="104" fill="rgba(255,255,255,0.22)"/>
    <circle cx="975" cy="610" r="190" fill="rgba(255,255,255,0.14)"/>
    <circle cx="730" cy="210" r="146" fill="rgba(255,255,255,0.12)"/>
    <path d="M0 552 C210 470, 332 510, 492 450 C636 397, 782 374, 1200 444" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="18" stroke-linecap="round"/>
    <path d="M80 656 C250 604, 426 668, 582 620 C756 566, 946 486, 1120 548" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="10" stroke-linecap="round"/>
    <text x="72" y="116" fill="rgba(255,255,255,0.92)" font-size="56" font-family="Arial, sans-serif" font-weight="800">${label}</text>
    <text x="72" y="198" fill="rgba(255,255,255,0.72)" font-size="26" font-family="Arial, sans-serif">${note}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function characterSvg(label: string, accent: string, base: string, note: string): string {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 1120" role="img" aria-label="${label} 主体视觉">
    <rect width="880" height="1120" fill="transparent"/>
    <circle cx="640" cy="220" r="176" fill="${accent}" fill-opacity="0.18"/>
    <circle cx="176" cy="820" r="230" fill="${accent}" fill-opacity="0.12"/>
    <circle cx="440" cy="300" r="118" fill="${base}" fill-opacity="0.94"/>
    <circle cx="392" cy="286" r="19" fill="${accent}"/>
    <circle cx="490" cy="286" r="19" fill="${accent}"/>
    <path d="M304 632 C356 474, 526 474, 580 632 L626 896 H254 Z" fill="${base}" fill-opacity="0.9"/>
    <path d="M318 556 L214 282 L322 154 L432 302 Z" fill="${accent}" fill-opacity="0.9"/>
    <path d="M564 556 L668 292 L560 164 L450 306 Z" fill="${accent}" fill-opacity="0.9"/>
    <path d="M318 906 C376 814, 506 814, 564 906" fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="20" stroke-linecap="round"/>
    <text x="70" y="112" fill="rgba(255,255,255,0.94)" font-size="54" font-family="Arial, sans-serif" font-weight="800">${label}</text>
    <text x="72" y="190" fill="rgba(255,255,255,0.76)" font-size="25" font-family="Arial, sans-serif">${note}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const ITEMS: CarouselItem[] = [
  {
    value: "01",
    title: "晨光",
    subtitle: "Morning Light",
    eyebrow: "OPENING SCENE",
    description: "背景、主体图与文案分层入场，先建立舞台，再交代信息。",
    background: backgroundSvg("01", "#f4d9de", "#f7f8fb", "先背景，后角色"),
    image: characterSvg("01", "#ff7fa8", "#2d2f39", "角色层前置进入"),
    thumbnail: backgroundSvg("01", "#f4d9de", "#eef1f9", "A"),
    href: "#",
    linkLabel: "INTRO",
  },
  {
    value: "02",
    title: "港湾",
    subtitle: "Harbor",
    eyebrow: "CITY FRAME",
    description: "背景先滑入、角色随后淡入上移，切换干净利落。",
    background: backgroundSvg("02", "#f1d59b", "#fff5de", "城市背景层"),
    image: characterSvg("02", "#9e6c25", "#3d3427", "人物角色层"),
    thumbnail: backgroundSvg("02", "#f1d59b", "#fff0cf", "B"),
    href: "#",
    linkLabel: "DETAILS",
  },
  {
    value: "03",
    title: "回声",
    subtitle: "Echo",
    eyebrow: "SPOTLIGHT",
    description: "标题、简介、链接按 0.3 到 0.9 秒节奏逐层出现。",
    background: backgroundSvg("03", "#d6d0ff", "#f3f0ff", "浅紫背景层"),
    image: characterSvg("03", "#7b4dde", "#2d254f", "人物角色层"),
    thumbnail: backgroundSvg("03", "#d6d0ff", "#ece7ff", "C"),
    href: "#",
    linkLabel: "VIEW",
  },
  {
    value: "04",
    title: "节奏",
    subtitle: "Motion Loop",
    eyebrow: "ACTION FEEDBACK",
    description: "底部缩略图保持可见，手动切换后自动播放重新计时。",
    background: backgroundSvg("04", "#b5efe3", "#effbf7", "节奏背景层"),
    image: characterSvg("04", "#1b9f88", "#123f38", "动作角色层"),
    thumbnail: backgroundSvg("04", "#b5efe3", "#daf5ef", "D"),
    href: "#",
    linkLabel: "PLAY",
  },
  {
    value: "05",
    title: "纸面",
    subtitle: "Paper Tone",
    eyebrow: "VISUAL CLEANUP",
    description: "最后一张回到轻色块，检查小屏与大屏都不乱。",
    background: backgroundSvg("05", "#f6d5e2", "#fff2f7", "纸感背景层"),
    image: characterSvg("05", "#d86d96", "#3f2430", "收尾角色层"),
    thumbnail: backgroundSvg("05", "#f6d5e2", "#ffe8f0", "E"),
    href: "#",
    linkLabel: "EXPLORE",
  },
];

const SPEED_OPTIONS = [0.5, 1, 2, 4];

export default function CarouselPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<Carousel | null>(null);

  const [autoplay, setAutoplay] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [intervalMs, setIntervalMs] = useState(3800);
  const [loop, setLoop] = useState(true);
  const [showArrows, setShowArrows] = useState(true);
  const [showThumbs, setShowThumbs] = useState(true);
  const [floatThumbs, setFloatThumbs] = useState(false);

  useEffect(() => {
    if (!rootRef.current) return;
    const carousel = new Carousel(rootRef.current, {
      items: ITEMS,
      defaultValue: "01",
      autoplay: true,
      interval: 3800,
      speed: 1,
      loop: true,
      showArrows: true,
      showThumbs: true,
      ariaLabel: "卡片式轮播图",
    });
    carouselRef.current = carousel;
    return () => {
      carousel.destroy();
      carouselRef.current = null;
    };
  }, []);

  useEffect(() => {
    carouselRef.current?.update({
      autoplay,
      speed,
      interval: intervalMs,
      loop,
      showArrows,
      showThumbs,
    });
  }, [autoplay, speed, intervalMs, loop, showArrows, showThumbs]);

  /* 悬浮缩略图变体（仅 ≤560px 生效）：className 只在创建时写入，运行时直接切换根类 */
  useEffect(() => {
    rootRef.current?.classList.toggle("qcar--thumbs-float", floatThumbs);
  }, [floatThumbs]);

  const effectiveMs = Math.max(intervalMs / speed, 250);

  return (
    <div className="demo-grid">
      <DemoCard
        title="Carousel 轮播图"
        desc="左侧大图 + 右侧卡片文案 + 底部缩略图（右对齐至左图右缘）；背景从左往右滑入、角色随后淡入上移，文案逐行从右往左滑入；移动端支持触屏横滑切换，缩略图可切换为悬浮胶囊。"
        full
        snippets={{
          react: `import { Carousel, type CarouselItem } from "@qingwu-ui/carousel";
import "@qingwu-ui/carousel/style.css";
import { useEffect, useRef } from "react";

const ITEMS: CarouselItem[] = [
  { value: "01", title: "晨光", image: "/hero.png" },
  // ...
];

export default function HeroCarousel() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const carousel = new Carousel(rootRef.current, {
      items: ITEMS,
      defaultValue: "01",
      autoplay: true,
      interval: 3800,
      speed: 1, // 倍速：实际间隔 = interval / speed（下限 250ms）
      loop: true,
      showArrows: true,
      showThumbs: true,
    });
    return () => carousel.destroy();
  }, []);

  return <div ref={rootRef} />;
}`,
          html: `<link rel="stylesheet" href="https://unpkg.com/@qingwu-ui/carousel/style.css" />

<div id="hero"></div>

<script type="module">
  import { Carousel } from "https://unpkg.com/@qingwu-ui/carousel";

  const carousel = new Carousel(document.querySelector("#hero"), {
    items: [
      { value: "01", title: "晨光", image: "/hero.png" },
      // ...
    ],
    autoplay: true,
    interval: 3800,
    speed: 1,
    loop: true,
    showArrows: true,
    showThumbs: true,
  });
</script>`,
          vue: `<template>
  <div ref="root" />
</template>

<script setup>
import { Carousel } from "@qingwu-ui/carousel";
import "@qingwu-ui/carousel/style.css";
import { onBeforeUnmount, onMounted, ref } from "vue";

const root = ref(null);
let carousel = null;

onMounted(() => {
  carousel = new Carousel(root.value, {
    items: ITEMS,
    autoplay: true,
    interval: 3800,
    speed: 1,
    loop: true,
    showArrows: true,
    showThumbs: true,
  });
});

onBeforeUnmount(() => carousel?.destroy());
</script>`,
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div ref={rootRef} />
        </div>

        <div
          className="tl-controls"
          style={{
            maxWidth: 1400,
            margin: "16px auto 0",
            padding: "14px 18px",
            border: "1px solid #dcdfd6",
            borderRadius: 12,
            background: "#fdfdfb",
            alignItems: "center",
          }}
        >
          <label className="tl-range-label" style={{ fontSize: 14, color: "#1d2b2c" }}>
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
            />
            自动播放
          </label>

          <span className="tl-range-label" style={{ fontSize: 14, color: "#1d2b2c" }}>
            速度
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                style={{
                  marginLeft: 6,
                  padding: "4px 12px",
                  borderRadius: 999,
                  border: "1px solid #c9d0d8",
                  background: s === speed ? "#2f7de1" : "#fff",
                  color: s === speed ? "#fff" : "#333",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {s}×
              </button>
            ))}
          </span>

          <label className="tl-range-label" style={{ fontSize: 14, color: "#1d2b2c" }}>
            间隔 {intervalMs}ms
            <input
              type="range"
              min={1000}
              max={8000}
              step={500}
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
            />
          </label>

          <label className="tl-range-label" style={{ fontSize: 14, color: "#1d2b2c" }}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            循环
          </label>
          <label className="tl-range-label" style={{ fontSize: 14, color: "#1d2b2c" }}>
            <input
              type="checkbox"
              checked={showArrows}
              onChange={(e) => setShowArrows(e.target.checked)}
            />
            左右箭头
          </label>
          <label className="tl-range-label" style={{ fontSize: 14, color: "#1d2b2c" }}>
            <input
              type="checkbox"
              checked={showThumbs}
              onChange={(e) => setShowThumbs(e.target.checked)}
            />
            缩略图
          </label>
          <label
            className="tl-range-label"
            style={{ fontSize: 14, color: "#1d2b2c", opacity: showThumbs ? 1 : 0.4 }}
          >
            <input
              type="checkbox"
              checked={floatThumbs}
              disabled={!showThumbs}
              onChange={(e) => setFloatThumbs(e.target.checked)}
            />
            悬浮缩略图（≤560px）
          </label>

          <span className="tl-hint" style={{ width: "100%", marginTop: 4 }}>
            实际播放间隔 = {intervalMs}ms ÷ {speed}× = {effectiveMs}ms（下限 250ms）
          </span>
        </div>
      </DemoCard>
    </div>
  );
}
