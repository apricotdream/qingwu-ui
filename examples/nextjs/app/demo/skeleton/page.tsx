"use client";

import { AutoSkeleton, extractElementInfo, renderSkeletonSnapshot } from "@qingwu-ui/skeleton";
import "@qingwu-ui/skeleton/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { COMPONENT_SECTIONS } from "@/docs.config";
import { buildFormHTML, buildMiniCardHTML, buildProductCardHTML } from "./templates";
import { SKELETON_FIELDS, createSkeleton, skeletonToCode } from "./playground.config";

/* ============================================================
   API 属性表（数据源：docs.config.ts → skeleton.api）
   ============================================================ */

const SKELETON_API =
  COMPONENT_SECTIONS.find((s) => s.id === "data")?.pages.find((p) => p.href === "/demo/skeleton")
    ?.api ?? [];

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

    // 创建骨架（zIndex 低于站点 sticky 头部，滚动时骨架不遮挡头部）
    skRef.current = new AutoSkeleton(container, { loading: true, zIndex: 90 });

    return () => {
      skRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    // 如果是 false 且已有内容，切换骨架到真实内容
    if (!loading && hasContent && skRef.current) {
      // 执行退出动画：覆盖层淡出后移除骨架
      const sk = skRef.current;
      const overlay = sk.overlay;
      if (overlay) {
        overlay.classList.add("is-exiting");
        // 捕获实例引用：定时器触发时 skRef.current 可能已被替换，
        // 仍更新正确实例（已销毁实例的 update 为 no-op）
        setTimeout(() => {
          sk.update({ loading: false });
        }, 300);
        return;
      }
      sk.update({ loading: false });
    } else if (loading && hasContent && skRef.current) {
      // 重新进入加载态：先重置内容，再创建新骨架
      const container = containerRef.current;
      if (container) {
        container.innerHTML = buildProductCardHTML();
      }
      skRef.current.destroy();
      if (containerRef.current) {
        skRef.current = new AutoSkeleton(containerRef.current, { loading: true, zIndex: 90 });
      }
    }
  }, [loading, hasContent]);

  return (
    <DemoCard
      title="商品卡片骨架"
      desc="自动测量 DOM 生成精准骨架，无需手写第二套布局。点击按钮切换加载/完成态，骨架与真实内容像素级对齐。"
      snippets={genAll({
        meta: PKG.skeleton,
        symbol: "AutoSkeleton",
        stmt: `// 只写一次真实布局并注入容器
el.innerHTML = productCardHTML;

const sk = new AutoSkeleton(el, { loading: true, zIndex: 90 });

// 数据加载完成：先让覆盖层淡出，300ms 后再退出骨架
sk.overlay?.classList.add("is-exiting");
setTimeout(() => sk.update({ loading: false }), 300);`,
      })}
    >
      <div className="sk-stage">
        <div className="sk-toggle-row">
          <button
            type="button"
            className={loading ? "sk-toggle is-loading" : "sk-toggle is-ready"}
            onClick={toggleLoading}
          >
            {loading ? "▼ 加载完成" : "▲ 重新加载"}
          </button>
          <span className="sk-state">{loading ? "加载中..." : "已加载"}</span>
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
    skRef.current = new AutoSkeleton(container, { loading: true, zIndex: 90 });
    return () => skRef.current?.destroy();
  }, []);

  useEffect(() => {
    skRef.current?.update({ loading });
  }, [loading]);

  return (
    <DemoCard
      title="表单骨架"
      desc="表单含输入框、下拉选择、文本域等多种控件。骨架自动识别各类元素，精确匹配每个控件的尺寸和位置。"
      snippets={genAll({
        meta: PKG.skeleton,
        symbol: "AutoSkeleton",
        stmt: `// 真实表单只写一次
el.innerHTML = formHTML;

const sk = new AutoSkeleton(el, { loading: true, zIndex: 90 });

// 数据就绪：切换为真实内容
sk.update({ loading: false });`,
      })}
    >
      <div className="sk-stage">
        <button
          type="button"
          className={loading ? "sk-toggle is-loading" : "sk-toggle is-ready"}
          onClick={toggle}
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
      const sk = skRef.current;
      const overlay = sk?.overlay;
      if (overlay) {
        overlay.classList.add("is-exiting");
      }
      // 捕获实例引用：350ms 后 skRef.current 可能已被重建
      setTimeout(() => {
        sk?.update({ loading: false });
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
      zIndex: 90,
    });
    return () => skRef.current?.destroy();
  }, []);

  // 当 loading 变回 true 时，重新创建骨架
  useEffect(() => {
    if (loading && containerRef.current && skRef.current) {
      const container = containerRef.current;
      container.innerHTML = buildProductCardHTML();
      // 覆盖前先销毁旧实例：否则旧覆盖层永远留在 body 上
      // （每次访问本页累计一个孤儿覆盖层 + 一组监听器）
      skRef.current.destroy();
      skRef.current = new AutoSkeleton(container, {
        loading: true,
        shimmerColor: "#e8e8f0",
        backgroundColor: "#d4d4e0",
        zIndex: 90,
      });
    }
  }, [debouncedLoading]);

  return (
    <DemoCard
      title="过渡动画"
      desc="骨架与真实内容之间的平滑切换。退出时骨架覆盖层逐渐透明，内容文字同步恢复可见，350ms 过渡动画。"
      snippets={genAll({
        meta: PKG.skeleton,
        symbol: "AutoSkeleton",
        stmt: `const sk = new AutoSkeleton(el, {
  loading: true,
  shimmerColor: "#e8e8f0",
  backgroundColor: "#d4d4e0",
  duration: 1800,
  fallbackBorderRadius: 6,
  zIndex: 90,
});

// 退出：覆盖层先播放淡出，350ms 后再更新加载态
sk.overlay?.classList.add("is-exiting");
setTimeout(() => sk.update({ loading: false }), 350);`,
      })}
    >
      <div className="sk-stage">
        <button
          type="button"
          className={loading ? "sk-toggle is-loading" : "sk-toggle is-ready"}
          onClick={toggleWithDelay}
        >
          {loading ? "✦ 加载完成" : "✧ 重新加载"}
        </button>
        <div ref={containerRef} />
      </div>
    </DemoCard>
  );
}

/* ════════════════════════════════════════════════
 * Demo 4：动画样式按容器
 * ════════════════════════════════════════════════ */
function PerContainerDemo() {
  const refs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];
  const skRefs = useRef<(AutoSkeleton | null)[]>([]);
  const [loading, setLoading] = useState(true);

  // 每个容器独立的动画配置：颜色 / 时长 / 时序函数
  const containerConfigs = [
    {
      tint: "#fdecec",
      shimmerColor: "#ffb3b3",
      backgroundColor: "#f5a3a3",
      duration: 600,
      timingFunction: "linear",
    },
    {
      tint: "#e9f1fd",
      shimmerColor: "#b3d1ff",
      backgroundColor: "#9dbcf5",
      duration: 2600,
      timingFunction: "ease-out",
    },
    { tint: "#f3ecfd", shimmerColor: "#e3c8ff", backgroundColor: "#cfa6f5", duration: 1500 },
  ];

  useEffect(() => {
    refs.forEach((ref, i) => {
      const el = ref.current;
      if (!el) return;
      const { tint, ...skOptions } = containerConfigs[i]!;
      el.innerHTML = buildMiniCardHTML(tint);
      skRefs.current[i] = new AutoSkeleton(el, { loading: true, zIndex: 90, ...skOptions });
    });
    return () => skRefs.current.forEach((sk) => sk?.destroy());
  }, [refs]);

  useEffect(() => {
    skRefs.current.forEach((sk) => sk?.update({ loading }));
  }, [loading]);

  return (
    <DemoCard
      title="动画样式按容器"
      desc="每个容器独立的流光颜色、时长、时序函数，互不覆盖。红色 600ms linear 快扫、蓝色 2600ms ease-out 缓扫、紫色默认配置。"
      snippets={genAll({
        meta: PKG.skeleton,
        symbol: "AutoSkeleton",
        destroy: "instances.forEach((sk) => sk.destroy())",
        stmt: `// 三个容器各自独立配置，流光样式互不覆盖
const configs = [
  { tint: "#fdecec", shimmerColor: "#ffb3b3", backgroundColor: "#f5a3a3", duration: 600, timingFunction: "linear" },
  { tint: "#e9f1fd", shimmerColor: "#b3d1ff", backgroundColor: "#9dbcf5", duration: 2600, timingFunction: "ease-out" },
  { tint: "#f3ecfd", shimmerColor: "#e3c8ff", backgroundColor: "#cfa6f5", duration: 1500 }
];

const instances = els.map((el, i) => {
  el.innerHTML = miniCardHTML(configs[i].tint);
  const { tint, ...opts } = configs[i];
  return new AutoSkeleton(el, { loading: true, zIndex: 90, ...opts });
});`,
      })}
    >
      <div className="sk-stage">
        <button
          type="button"
          className={loading ? "sk-toggle is-loading" : "sk-toggle is-ready"}
          onClick={() => setLoading((s) => !s)}
        >
          {loading ? "▼ 加载完成" : "▲ 重新加载"}
        </button>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {refs.map((ref, i) => (
            <div key={i} style={{ width: 180 }}>
              <div
                ref={ref}
                style={{
                  outline: `2px solid ${containerConfigs[i]!.backgroundColor}`,
                  borderRadius: 12,
                }}
              />
              <div style={{ fontSize: 11, color: "#888", marginTop: 6, textAlign: "center" }}>
                {containerConfigs[i]!.duration}ms ·{" "}
                {containerConfigs[i]!.timingFunction ?? "ease-in-out"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DemoCard>
  );
}

/* ════════════════════════════════════════════════
 * Demo 5：SSR 骨架（构建时测量管线 · 无运行时实例）
 * 三框架代码均为「静态字符串渲染」，诚实呈现而非运行时挂载外壳
 * ════════════════════════════════════════════════ */
const SSR_SNIPPETS: Record<string, string> = {
  react: `// 服务端组件 / 构建期：产出的是 HTML 字符串，无需浏览器实例
import { extractElementInfo, renderSkeletonSnapshot } from "${PKG.skeleton.pkg}";
// 注意：extractElementInfo 需要真实 DOM，应在 Node 端用 jsdom 等
// 先渲染卡片再测量；纯浏览器构建步骤里可直接对卡片节点测量。
import "${PKG.skeleton.css}";

function measure() {
  const card = document.querySelector(".product-card");
  const snapshot = extractElementInfo(card);
  const width = Math.max(...snapshot.map((b) => b.x + b.width));
  return renderSkeletonSnapshot(snapshot, { width });
}

// 服务端直接把字符串作为初始 HTML 下发（dangerouslySetInnerHTML）
export default function Page() {
  return <div dangerouslySetInnerHTML={{ __html: measure() }} />;
}`,
  html: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <!-- 骨架动画样式 -->
  <link rel="stylesheet" href="${PKG.skeleton.cdnCssUrl}" />
</head>
<body>
  <!-- 这里插入的是 renderSkeletonSnapshot() 返回的静态字符串：
       纯 CSS 骨架，无任何运行时 JS 实例 -->
  <div id="skeleton">
    <div class="qs-skel-container" style="position:relative;width:360px;...">
      <div class="qs-skel-block is-shimmer" style="position:absolute;..."></div>
      <!-- 其余骨架块 -->
    </div>
  </div>

  <script type="module">
    // 构建期生成（Node）：
    // import { extractElementInfo, renderSkeletonSnapshot } from "@qingwu-ui/skeleton";
    // const snapshot = extractElementInfo(renderedCardDom);
    // const html = renderSkeletonSnapshot(snapshot, { width: 360 });
    // 再把 html 字符串写入上方 #skeleton，浏览器端无需再执行
  </script>
</body>
</html>`,
  vue: `<script setup lang="ts">
// Nuxt / Vue SSR：构建或服务端测量后得到静态骨架字符串
import { extractElementInfo, renderSkeletonSnapshot } from "${PKG.skeleton.pkg}";
import "${PKG.skeleton.css}";

// snapshot 来自服务端对真实卡片的 extractElementInfo 测量
const skeletonHTML = renderSkeletonSnapshot(snapshot, {
  width: 360,
});
</script>

<template>
  <!-- v-html 直接渲染静态字符串，无运行时组件实例 -->
  <div v-html="skeletonHTML" />
</template>`,
};

function SSRDemo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState("");

  // 模拟构建时测量管线：渲染真实卡片 → extractElementInfo 测量 → 静态骨架
  const buildSkeleton = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return "";
    stage.innerHTML = buildProductCardHTML();
    const snapshot = extractElementInfo(stage);
    // 容器宽度取内容实际宽度（构建时快照的真实语义）
    const width = Math.max(...snapshot.map((b) => b.x + b.width));
    return renderSkeletonSnapshot(snapshot, { width });
  }, []);

  useEffect(() => {
    setHtml(buildSkeleton());
  }, [buildSkeleton]);

  const toggle = useCallback(() => {
    // 数据就绪：真实内容替换静态骨架；重新加载：重建骨架
    setHtml((prev) =>
      prev.includes("qs-skel-container") ? buildProductCardHTML() : buildSkeleton(),
    );
  }, [buildSkeleton]);

  return (
    <DemoCard
      title="SSR 骨架（无 JS 预览）"
      desc="完整管线演示：渲染真实卡片 → extractElementInfo 测量 → renderSkeletonSnapshot 生成纯 CSS 骨架。骨架几何来自真实测量，与内容像素级对齐（同一测量引擎，按构造相等）。"
      snippets={SSR_SNIPPETS}
    >
      <div className="sk-stage">
        <button
          type="button"
          className={
            html.includes("qs-skel-container") ? "sk-toggle is-loading" : "sk-toggle is-ready"
          }
          onClick={toggle}
        >
          {html.includes("qs-skel-container") ? "▼ 数据就绪" : "▲ 重新加载"}
        </button>
        <div
          id="ssr-demo-stage"
          ref={stageRef}
          style={{ minWidth: 360 }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: SSR skeleton demo
          dangerouslySetInnerHTML={{ __html: html }}
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
    <div className="demo-grid">
      <Playground
        title="Skeleton 骨架屏"
        desc="自动测量真实 DOM 生成像素级骨架，零布局重复。调整流光时长、时序函数与颜色后点「应用」；加载态开关实时生效。"
        fields={SKELETON_FIELDS}
        create={createSkeleton}
        toCode={skeletonToCode}
        log
      />

      <ProductCardDemo />
      <FormDemo />
      <TransitionDemo />
      <PerContainerDemo />
      <SSRDemo />

      {/* API 属性表 */}
      <div className="api-section">
        {SKELETON_API.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <table className="api-table">
              <thead>
                <tr>
                  <th>属性</th>
                  <th>说明</th>
                  <th>类型</th>
                  <th>默认值</th>
                </tr>
              </thead>
              <tbody>
                {group.props.map((p) => (
                  <tr key={p.name}>
                    <td>
                      <code>{p.name}</code>
                    </td>
                    <td>{p.desc}</td>
                    <td>
                      <code>{p.type}</code>
                    </td>
                    <td>
                      <code>{p.default}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
