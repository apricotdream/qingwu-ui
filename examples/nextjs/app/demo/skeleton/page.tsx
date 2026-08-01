"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AutoSkeleton, createSSRSkeleton } from "@qingwu/skeleton";
import DemoCard from "@/components/DemoCard";

/* ── 产品卡片 HTML 模板 ── */
function buildProductCardHTML(): string {
  return `
    <div class="sk-card" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:#fff;border:1px solid #e5e5e5;border-radius:12px;max-width:360px;font-family:system-ui,-apple-system,sans-serif">
      <div class="sk-card-img" style="height:200px;background:linear-gradient(135deg,#d4e0f0,#e8d4f0);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:48px;color:#fff">图</div>
      <h3 style="margin:0;font-size:16px;font-weight:600;line-height:1.5;color:#1a1a1a">2025 春季新款女士连衣裙 优雅气质中长款法式收腰显瘦</h3>
      <div style="font-size:20px;font-weight:700;color:#e8453c">¥299.00</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="sk-tag" style="display:inline-block;padding:2px 8px;background:#fff0f0;color:#e8453c;border-radius:4px;font-size:12px">限时特惠</span>
        <span class="sk-tag" style="display:inline-block;padding:2px 8px;background:#f0f7ff;color:#3b82f6;border-radius:4px;font-size:12px">包邮</span>
        <span class="sk-tag" style="display:inline-block;padding:2px 8px;background:#f0fff4;color:#22c55e;border-radius:4px;font-size:12px">7天无理由</span>
      </div>
      <button class="sk-btn" style="width:100%;padding:10px 0;background:#1a1a1a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">加入购物车</button>
    </div>
  `;
}

/* ── 表单 HTML 模板 ── */
function buildFormHTML(): string {
  const inputStyle = "width:100%;padding:8px 12px;border:1px solid #d4d4d4;border-radius:6px;font-size:14px;box-sizing:border-box";
  const labelStyle = "display:block;font-size:14px;font-weight:500;color:#333;margin-bottom:4px";
  return `
    <form class="sk-form" style="display:flex;flex-direction:column;gap:16px;padding:20px;background:#fff;border:1px solid #e5e5e5;border-radius:12px;max-width:420px;font-family:system-ui,-apple-system,sans-serif">
      <div>
        <label style="${labelStyle}">姓名</label>
        <input style="${inputStyle}" placeholder="请输入姓名" />
      </div>
      <div>
        <label style="${labelStyle}">手机号</label>
        <input style="${inputStyle}" placeholder="请输入手机号" />
      </div>
      <div>
        <label style="${labelStyle}">邮箱</label>
        <input style="${inputStyle}" placeholder="请输入邮箱地址" />
      </div>
      <div>
        <label style="${labelStyle}">性别</label>
        <select style="${inputStyle}">
          <option>请选择</option>
          <option>男</option>
          <option>女</option>
        </select>
      </div>
      <div>
        <label style="${labelStyle}">个人简介</label>
        <textarea style="${inputStyle};min-height:80px;resize:vertical" placeholder="请介绍一下自己"></textarea>
      </div>
      <button type="button" style="width:100%;padding:10px 0;background:#1a1a1a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">提交</button>
    </form>
  `;
}

/* ── SSR 骨架 HTML 模板 ── */
function buildSSRSkeletonDemo(): string {
  return createSSRSkeleton({
    width: 360,
    textLines: [
      {
        text: "2025 春季新款女士连衣裙 优雅气质中长款法式收腰显瘦",
        font: "16px system-ui",
        maxLines: 2,
        lineHeight: 22,
        gap: 6,
      },
      {
        text: "¥299.00",
        font: "20px system-ui",
        maxLines: 1,
        lineHeight: 28,
      },
    ],
    rects: [
      { width: "100%", height: 200, borderRadius: 8, marginBottom: 0 },
      { width: "100%", height: 40, borderRadius: 8, marginBottom: 0 },
    ],
  });
}

/* ── 工具：防抖 ── */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ════════════════════════════════════════════════
 * Demo 1：商品卡片骨架
 * ════════════════════════════════════════════════ */
function ProductCardDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const skRef = useRef<AutoSkeleton | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasContent, setHasContent] = useState(false);

  const toggleLoading = useCallback(() => {
    if (loading) {
      // 模拟数据加载中 -> 完成
      setLoading(false);
      setHasContent(true);
    } else {
      setLoading(true);
      setHasContent(true);
    }
  }, [loading]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 首次渲染内容
    container.innerHTML = buildProductCardHTML();

    // 创建骨架
    skRef.current = new AutoSkeleton(container, { loading: true });

    return () => {
      skRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    // 如果是 false 且已有内容，切换骨架到真实内容
    if (!loading && hasContent && skRef.current) {
      // 执行退出动画
      const container = containerRef.current;
      if (container) {
        const wrapper = container.querySelector(".qs-skeleton-wrapper");
        if (wrapper) {
          wrapper.classList.add("is-exiting");
          setTimeout(() => {
            skRef.current?.update({ loading: false });
          }, 300);
          return;
        }
      }
      skRef.current.update({ loading: false });
    } else if (loading && hasContent && skRef.current) {
      // 重新进入加载态：先重置内容，再创建新骨架
      const container = containerRef.current;
      if (container) {
        container.innerHTML = buildProductCardHTML();
      }
      skRef.current.destroy();
      if (containerRef.current) {
        skRef.current = new AutoSkeleton(containerRef.current, { loading: true });
      }
    }
  }, [loading, hasContent]);

  return (
    <DemoCard
      title="商品卡片骨架"
      desc="自动测量 DOM 生成精准骨架，无需手写第二套布局。点击按钮切换加载/完成态，骨架与真实内容像素级对齐。"
      snippets={{
        html: "<!-- 只需写一次真实布局 -->\n<div class=\"product-card\">\n  <img ... />\n  <h3>2025 春季新款连衣裙</h3>\n  <span>¥299</span>\n</div>",
        react: "import { AutoSkeleton } from \"@qingwu/skeleton\";\nimport \"@qingwu/skeleton/style.css\";\n\nuseEffect(() => {\n  const el = document.getElementById(\"card\")!;\n  el.innerHTML = cardHTML;\n  const sk = new AutoSkeleton(el, { loading: true });\n  // 数据加载完成后\n  sk.update({ loading: false });\n  return () => sk.destroy();\n}, []);",
        vue: "<script setup>\nimport { ref, onMounted, onUnmounted } from \"vue\";\nimport { AutoSkeleton } from \"@qingwu/skeleton\";\nimport \"@qingwu/skeleton/style.css\";\n\nconst cardRef = ref<HTMLElement>();\nlet sk: AutoSkeleton | null = null;\n\nonMounted(() => {\n  if (!cardRef.value) return;\n  cardRef.value.innerHTML = cardHTML;\n  sk = new AutoSkeleton(cardRef.value, { loading: true });\n  // 数据加载完成后\n  sk.update({ loading: false });\n});\n\nonUnmounted(() => sk?.destroy());\n</script>\n\n<template>\n  <div ref=\"cardRef\" />\n</template>",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={toggleLoading}
            style={{
              padding: "6px 20px",
              background: loading ? "#e8453c" : "#22c55e",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {loading ? "▼ 加载完成" : "▲ 重新加载"}
          </button>
          <span style={{ fontSize: 12, color: "#888", alignSelf: "center" }}>
            {loading ? "加载中..." : "已加载"}
          </span>
        </div>
        <div ref={containerRef} />
      </div>
    </DemoCard>
  );
}

/* ════════════════════════════════════════════════
 * Demo 2：表单骨架
 * ════════════════════════════════════════════════ */
function FormDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const skRef = useRef<AutoSkeleton | null>(null);
  const [loading, setLoading] = useState(true);

  const toggle = useCallback(() => {
    setLoading((s) => !s);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = buildFormHTML();
    skRef.current = new AutoSkeleton(container, { loading: true });
    return () => skRef.current?.destroy();
  }, []);

  useEffect(() => {
    skRef.current?.update({ loading });
  }, [loading]);

  return (
    <DemoCard
      title="表单骨架"
      desc="表单含输入框、下拉选择、文本域等多种控件。骨架自动识别各类元素，精确匹配每个控件的尺寸和位置。"
      snippets={{
        html: "<form>\n  <input placeholder=\"姓名\" />\n  <select>...</select>\n  <textarea />\n  <button>提交</button>\n</form>",
        react: "import { AutoSkeleton } from \"@qingwu/skeleton\";\n\nuseEffect(() => {\n  const el = document.getElementById(\"form\")!;\n  el.innerHTML = formHTML;\n  const sk = new AutoSkeleton(el, { loading: true });\n  return () => sk.destroy();\n}, []);\n\n// 数据就绪\nsk.update({ loading: false });",
        vue: "<script setup>\nimport { ref, onMounted, onUnmounted } from \"vue\";\nimport { AutoSkeleton } from \"@qingwu/skeleton\";\nimport \"@qingwu/skeleton/style.css\";\n\nconst formRef = ref<HTMLElement>();\nconst sk = ref<AutoSkeleton>();\n\nonMounted(() => {\n  formRef.value!.innerHTML = formHTML;\n  sk.value = new AutoSkeleton(formRef.value!, { loading: true });\n});\n\n// 数据就绪后\n// sk.value?.update({ loading: false });\n\nonUnmounted(() => sk.value?.destroy());\n</script>\n\n<template>\n  <div ref=\"formRef\" />\n</template>",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <button
          type="button"
          onClick={toggle}
          style={{
            padding: "6px 20px",
            background: loading ? "#e8453c" : "#22c55e",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {loading ? "▼ 加载完成" : "▲ 重新加载"}
        </button>
        <div ref={containerRef} />
      </div>
    </DemoCard>
  );
}

/* ════════════════════════════════════════════════
 * Demo 3：骨架与内容过渡动画
 * ════════════════════════════════════════════════ */
function TransitionDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const skRef = useRef<AutoSkeleton | null>(null);
  const [loading, setLoading] = useState(true);
  const debouncedLoading = useDebounce(loading, 0);

  const toggleWithDelay = useCallback(() => {
    if (loading) {
      // 加载 -> 完成：先添加退出动画，再移除骨架
      const container = containerRef.current;
      if (container) {
        const wrapper = container.querySelector(".qs-skeleton-wrapper");
        if (wrapper) {
          wrapper.classList.add("is-exiting");
        }
      }
      setTimeout(() => {
        skRef.current?.update({ loading: false });
      }, 350);
      setLoading(false);
    } else {
      // 完成 -> 加载：重新创建骨架
      setLoading(true);
    }
  }, [loading]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = buildProductCardHTML();
    skRef.current = new AutoSkeleton(container, {
      loading: true,
      shimmerColor: "#e8e8f0",
      backgroundColor: "#d4d4e0",
      duration: 1800,
      fallbackBorderRadius: 6,
    });
    return () => skRef.current?.destroy();
  }, []);

  // 当 loading 变回 true 时，重新创建骨架
  useEffect(() => {
    if (loading && containerRef.current && skRef.current) {
      const container = containerRef.current;
      container.innerHTML = buildProductCardHTML();
      skRef.current = new AutoSkeleton(container, {
        loading: true,
        shimmerColor: "#e8e8f0",
        backgroundColor: "#d4d4e0",
      });
    }
  }, [debouncedLoading]);

  return (
    <DemoCard
      title="过渡动画"
      desc="骨架与真实内容之间的平滑切换。退出时骨架覆盖层逐渐透明，内容文字同步恢复可见，300ms 过渡动画。"
      snippets={{
        html: `<div class="qs-skeleton-wrapper is-exiting">\n  <div class="qs-skeleton-overlay">...</div>\n</div>`,
        react: "// 退出时添加 .is-exiting 类触发 CSS 过渡\nconst wrapper = container.querySelector(\".qs-skeleton-wrapper\");\nwrapper?.classList.add(\"is-exiting\");\nsetTimeout(() => sk.update({ loading: false }), 250);",
        vue: "// 退出时添加 .is-exiting 类触发 CSS 过渡\nconst wrapper = formRef.value!.querySelector(\".qs-skeleton-wrapper\");\nwrapper?.classList.add(\"is-exiting\");\nsetTimeout(() => sk.value?.update({ loading: false }), 250);",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <button
          type="button"
          onClick={toggleWithDelay}
          style={{
            padding: "8px 24px",
            background: loading ? "#6366f1" : "#f59e0b",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {loading ? "✦ 加载完成" : "✧ 重新加载"}
        </button>
        <div ref={containerRef} />
      </div>
    </DemoCard>
  );
}

/* ════════════════════════════════════════════════
 * Demo 4：SSR 骨架（无 JavaScript）
 * ════════════════════════════════════════════════ */
function SSRDemo() {
  const [ssrHTML, setSSRHTML] = useState("");

  useEffect(() => {
    setSSRHTML(buildSSRSkeletonDemo());
  }, []);

  return (
    <DemoCard
      title="SSR 骨架（无 JS 预览）"
      desc="使用 createSSRSkeleton() 生成纯 CSS 骨架 HTML。无需 JavaScript 即可展示，SSR 环境开箱即用。传入文本内容 + 矩形区域配置即可。"
      snippets={{
        html: `<div style="position:relative;width:360px;height:328px">\n  <!-- 骨架块由 createSSRSkeleton() 生成 -->\n  <div class="qs-ssr-skel-block" style="...流光动画..."></div>\n</div>`,
        react: "import { createSSRSkeleton } from \"@qingwu/skeleton\";\n\nconst html = createSSRSkeleton({\n  width: 360,\n  textLines: [\n    { text: \"商品标题文案\", font: \"16px\", maxLines: 2 },\n    { text: \"¥299.00\", font: \"20px\", maxLines: 1 },\n  ],\n  rects: [\n    { width: \"100%\", height: 200, borderRadius: 8 },\n  ],\n});\n// 返回完整 CSS 骨架 HTML 字符串",
        vue: "<!-- Nuxt / Vue SSR 中使用 -->\n<script setup lang=\"ts\">\nimport { createSSRSkeleton } from \"@qingwu/skeleton\";\n\nconst skeletonHTML = createSSRSkeleton({\n  width: 360,\n  textLines: [\n    { text: \"商品标题文案\", font: \"16px\", maxLines: 2 },\n    { text: \"¥299.00\", font: \"20px\", maxLines: 1 },\n  ],\n  rects: [\n    { width: \"100%\", height: 200, borderRadius: 8 },\n  ],\n});\n</script>\n\n<template>\n  <div v-html=\"skeletonHTML\" />\n</template>",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          // biome-ignore lint/security/noDangerouslySetInnerHTML: SSR skeleton demo
          dangerouslySetInnerHTML={{ __html: ssrHTML }}
        />
      </div>
    </DemoCard>
  );
}

/* ════════════════════════════════════════════════
 * 骨架屏演示页
 * ════════════════════════════════════════════════ */
export default function SkeletonDemoPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, paddingBottom: 40 }}>
      <div className="section-header">
        <h2>Skeleton 骨架屏</h2>
        <p className="section-desc">
          自动骨架加载组件。在加载态自动测量 DOM 结构，生成像素级对齐的流光骨架覆盖层。
          参考 shimmer-from-structure 算法 + Pretext 文本测量思想，融合青梧组件库的框架无关设计。
        </p>
      </div>

      <div className="demo-grid">
        <ProductCardDemo />
        <FormDemo />
        <TransitionDemo />
        <SSRDemo />
      </div>
    </div>
  );
}
