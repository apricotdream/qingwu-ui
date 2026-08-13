"use client";

import { AutoSkeleton, extractElementInfo, renderSkeletonSnapshot } from "@qingwu-ui/skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";
import { COMPONENT_SECTIONS } from "@/docs.config";

/* ============================================================
   API 属性表（数据源：docs.config.ts → skeleton.api）
   ============================================================ */

const SKELETON_API =
  COMPONENT_SECTIONS.find((s) => s.id === "data")?.pages.find((p) => p.href === "/demo/skeleton")
    ?.api ?? [];

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
  const inputStyle =
    "width:100%;padding:8px 12px;border:1px solid #d4d4d4;border-radius:6px;font-size:14px;box-sizing:border-box";
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

/* ── 静态骨架 HTML 模板（快照渲染器） ── */
function buildSSRSkeletonDemo(): string {
  // 构建时对真实卡片 DOM 测量（extractElementInfo）得到的快照，
  // 此处为演示手工构造等价数据
  const snapshot = [
    { x: 0, y: 0, width: 360, height: 200, borderRadius: "8px" }, // 图片区
    { x: 0, y: 216, width: 340, height: 22, borderRadius: "4px" }, // 标题行 1
    { x: 0, y: 244, width: 250, height: 22, borderRadius: "4px" }, // 标题行 2
    { x: 0, y: 282, width: 120, height: 28, borderRadius: "4px" }, // 价格
    { x: 0, y: 326, width: 90, height: 24, borderRadius: "12px" }, // 标签 1
    { x: 102, y: 326, width: 60, height: 24, borderRadius: "12px" }, // 标签 2
    { x: 0, y: 366, width: 360, height: 40, borderRadius: "8px" }, // 按钮
  ];
  return renderSkeletonSnapshot(snapshot, {
    width: 360,
    shimmerColor: "#f0f0f0",
    backgroundColor: "#e0e0e0",
    duration: 1500,
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
      snippets={{
        html: '<!-- 只需写一次真实布局 -->\n<div class="product-card">\n  <img ... />\n  <h3>2025 春季新款连衣裙</h3>\n  <span>¥299</span>\n</div>',
        react:
          'import { AutoSkeleton } from "@qingwu-ui/skeleton";\nimport "@qingwu-ui/skeleton/style.css";\n\nuseEffect(() => {\n  const el = document.getElementById("card")!;\n  el.innerHTML = cardHTML;\n  const sk = new AutoSkeleton(el, { loading: true });\n  // 数据加载完成后\n  sk.update({ loading: false });\n  return () => sk.destroy();\n}, []);',
        vue: '<script setup>\nimport { ref, onMounted, onUnmounted } from "vue";\nimport { AutoSkeleton } from "@qingwu-ui/skeleton";\nimport "@qingwu-ui/skeleton/style.css";\n\nconst cardRef = ref<HTMLElement>();\nlet sk: AutoSkeleton | null = null;\n\nonMounted(() => {\n  if (!cardRef.value) return;\n  cardRef.value.innerHTML = cardHTML;\n  sk = new AutoSkeleton(cardRef.value, { loading: true });\n  // 数据加载完成后\n  sk.update({ loading: false });\n});\n\nonUnmounted(() => sk?.destroy());\n</script>\n\n<template>\n  <div ref="cardRef" />\n</template>',
      }}
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
      snippets={{
        html: '<form>\n  <input placeholder="姓名" />\n  <select>...</select>\n  <textarea />\n  <button>提交</button>\n</form>',
        react:
          'import { AutoSkeleton } from "@qingwu-ui/skeleton";\n\nuseEffect(() => {\n  const el = document.getElementById("form")!;\n  el.innerHTML = formHTML;\n  const sk = new AutoSkeleton(el, { loading: true });\n  return () => sk.destroy();\n}, []);\n\n// 数据就绪\nsk.update({ loading: false });',
        vue: '<script setup>\nimport { ref, onMounted, onUnmounted } from "vue";\nimport { AutoSkeleton } from "@qingwu-ui/skeleton";\nimport "@qingwu-ui/skeleton/style.css";\n\nconst formRef = ref<HTMLElement>();\nconst sk = ref<AutoSkeleton>();\n\nonMounted(() => {\n  formRef.value!.innerHTML = formHTML;\n  sk.value = new AutoSkeleton(formRef.value!, { loading: true });\n});\n\n// 数据就绪后\n// sk.value?.update({ loading: false });\n\nonUnmounted(() => sk.value?.destroy());\n</script>\n\n<template>\n  <div ref="formRef" />\n</template>',
      }}
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
      desc="骨架与真实内容之间的平滑切换。退出时骨架覆盖层逐渐透明，内容文字同步恢复可见，300ms 过渡动画。"
      snippets={{
        html: `<div class="qs-skeleton-overlays is-exiting">...</div>`,
        react:
          '// 退出时给覆盖层添加 .is-exiting 类触发 CSS 过渡\nconst overlay = sk.overlay;\noverlay?.classList.add("is-exiting");\nsetTimeout(() => sk.update({ loading: false }), 250);',
        vue: '// 退出时给覆盖层添加 .is-exiting 类触发 CSS 过渡\nconst overlay = sk.value?.overlay;\noverlay?.classList.add("is-exiting");\nsetTimeout(() => sk.value?.update({ loading: false }), 250);',
      }}
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
 * Demo 4：SSR 骨架（构建时测量管线）
 * ════════════════════════════════════════════════ */
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
      snippets={{
        html: `<div class="qs-skel-container" style="...">\n  <!-- 骨架块由 renderSkeletonSnapshot() 生成 -->\n  <div class="qs-skel-block" style="..."></div>\n</div>`,
        react:
          'import { extractElementInfo, renderSkeletonSnapshot } from "@qingwu-ui/skeleton";\n\n// 构建时：渲染真实页面后测量\nconst snapshot = extractElementInfo(document.querySelector(".card")!);\n\nconst html = renderSkeletonSnapshot(snapshot, {\n  width: snapshot[0].x + snapshot[0].width,\n  shimmerColor: "#f0f0f0",\n  backgroundColor: "#e0e0e0",\n  duration: 1500,\n});\n// 返回完整 CSS 骨架 HTML 字符串',
        vue: '<!-- Nuxt / Vue SSR 中使用 -->\n<script setup lang="ts">\nimport { renderSkeletonSnapshot } from "@qingwu-ui/skeleton";\n\nconst skeletonHTML = renderSkeletonSnapshot(snapshot, {\n  width: 360,\n});\n</script>\n\n<template>\n  <div v-html="skeletonHTML" />\n</template>',
      }}
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

/* ── 迷你卡片 HTML 模板（多容器动画演示用） ── */
function buildMiniCardHTML(tint: string): string {
  return `
    <div style="display:flex;flex-direction:column;gap:8px;padding:12px;background:${tint};border-radius:10px;font-family:system-ui">
      <div style="height:80px;background:rgba(255,255,255,0.75);border-radius:8px"></div>
      <div style="height:14px;background:rgba(255,255,255,0.75);border-radius:4px"></div>
      <div style="height:14px;width:70%;background:rgba(255,255,255,0.75);border-radius:4px"></div>
      <div style="height:28px;background:rgba(255,255,255,0.75);border-radius:6px"></div>
    </div>
  `;
}

/* ════════════════════════════════════════════════
 * Demo 5：动画样式按容器
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
      snippets={{
        react:
          'import { AutoSkeleton } from "@qingwu-ui/skeleton";\n\nconst sk = new AutoSkeleton(el, {\n  loading: true,\n  shimmerColor: "#ffb3b3",\n  backgroundColor: "#f5a3a3",\n  duration: 600,\n  timingFunction: "linear",\n});\n// 多个容器并存：各自动画样式独立生效',
        vue: '<script setup>\nimport { onMounted, onUnmounted } from "vue";\nimport { AutoSkeleton } from "@qingwu-ui/skeleton";\n\nonMounted(() => {\n  sk.value = new AutoSkeleton(el.value!, {\n    loading: true,\n    shimmerColor: "#ffb3b3",\n    duration: 600,\n    timingFunction: "linear",\n  });\n});\nonUnmounted(() => sk.value?.destroy());\n</script>',
      }}
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
 * 骨架屏演示页
 * ════════════════════════════════════════════════ */
export default function SkeletonDemoPage() {
  return (
    <div className="demo-grid">
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
