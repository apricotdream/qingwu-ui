"use client";

import type { OutputFormat, UploadFn } from "@qingwu/upload";
import { ImageUpload } from "@qingwu/upload";
import { useCallback, useEffect, useRef, useState } from "react";
import "@qingwu/upload/style.css";
import DemoCard from "@/components/DemoCard";

/* ============================================================
   props 面板字段定义
   ============================================================ */

interface FieldDef {
  key: string;
  label: string;
  type: "select" | "boolean";
  defaultValue: string;
  options?: { label: string; value: string }[];
}

const FIELDS: FieldDef[] = [
  {
    key: "trigger",
    label: "触发形态",
    type: "select",
    defaultValue: "dropzone",
    options: [
      { label: "拖拽区", value: "dropzone" },
      { label: "按钮（复用 @qingwu/button）", value: "button" },
    ],
  },
  {
    key: "compress",
    label: "压缩",
    type: "boolean",
    defaultValue: "true",
    options: [
      { label: "开启", value: "true" },
      { label: "关闭", value: "false" },
    ],
  },
  {
    key: "formats",
    label: "输出格式",
    type: "select",
    defaultValue: "all",
    options: [
      { label: "原图 + WebP + AVIF", value: "all" },
      { label: "原图 + WebP", value: "webp" },
      { label: "原图 + AVIF", value: "avif" },
      { label: "仅原图", value: "original" },
    ],
  },
  {
    key: "quality",
    label: "压缩质量",
    type: "select",
    defaultValue: "0.8",
    options: [
      { label: "0.5", value: "0.5" },
      { label: "0.8", value: "0.8" },
      { label: "1.0", value: "1" },
    ],
  },
  {
    key: "maxSizeMB",
    label: "单张限制",
    type: "select",
    defaultValue: "10",
    options: [
      { label: "1 MB", value: "1" },
      { label: "5 MB", value: "5" },
      { label: "10 MB", value: "10" },
      { label: "20 MB", value: "20" },
    ],
  },
  {
    key: "maxCount",
    label: "数量上限",
    type: "select",
    defaultValue: "0",
    options: [
      { label: "不限", value: "0" },
      { label: "1 张", value: "1" },
      { label: "3 张", value: "3" },
    ],
  },
  {
    key: "supportedFormats",
    label: "支持格式",
    type: "select",
    defaultValue: "all",
    options: [
      { label: "全部（JPG/PNG/WebP/GIF/AVIF）", value: "all" },
      { label: "JPG / PNG", value: "jpg,png" },
      { label: "JPG / PNG / WebP", value: "jpg,png,webp" },
      { label: "JPG / PNG / WebP / AVIF", value: "jpg,png,webp,avif" },
      { label: "仅 JPG", value: "jpg" },
    ],
  },
  {
    key: "mode",
    label: "上传方式",
    type: "select",
    defaultValue: "mock",
    options: [
      { label: "模拟进度（演示）", value: "mock" },
      { label: "真实上传 /api/upload", value: "real" },
    ],
  },
];

/** 模拟上传：演示进度条动画（组件同样支持真实 XHR 进度） */
const mockUpload: UploadFn = async (_file, onProgress) => {
  for (let p = 0; p <= 100; p += 8 + Math.random() * 20) {
    await new Promise((r) => setTimeout(r, 90 + Math.random() * 140));
    onProgress(Math.min(100, Math.round(p)));
  }
};

/* ============================================================ */

export default function UploadPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const uploaderRef = useRef<ImageUpload | null>(null);

  const [props, setProps] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, f.defaultValue])),
  );
  const [log, setLog] = useState<string[]>([]);
  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  /* 当前配置 → 组件选项 */
  const buildOptions = (current: Record<string, string>) => {
    const formatMap: Record<string, OutputFormat[]> = {
      all: ["original", "webp", "avif"],
      webp: ["original", "webp"],
      avif: ["original", "avif"],
      original: ["original"],
    };
    return {
      trigger: (current.trigger === "button" ? "button" : "dropzone") as "dropzone" | "button",
      compress: current.compress === "true",
      formats: formatMap[current.formats] ?? ["original", "webp", "avif"],
      quality: Number(current.quality),
      maxSizeMB: Number(current.maxSizeMB),
      maxCount: Number(current.maxCount) > 0 ? Number(current.maxCount) : undefined,
      supportedFormats:
        current.supportedFormats === "all" ? undefined : current.supportedFormats.split(","),
      url: current.mode === "real" ? "/api/upload" : undefined,
      uploadFn: current.mode === "mock" ? mockUpload : undefined,
    };
  };

  const renderUploader = useCallback(
    (currentProps: Record<string, string>) => {
      const el = rootRef.current;
      if (!el) return;

      if (uploaderRef.current) {
        uploaderRef.current.destroy();
        uploaderRef.current = null;
      }
      el.textContent = "";

      const opts = buildOptions(currentProps);
      uploaderRef.current = new ImageUpload(el, {
        ...opts,
        onStart: (item) => addLog(`开始上传 → ${item.name}（${item.format}）`),
        onSuccess: (item) =>
          addLog(`完成 → ${item.name}（${item.format}，${(item.size / 1024).toFixed(1)} KB）`),
        onError: (item, e) => addLog(`失败 → ${item.name}（${item.format}）：${e.message}`),
      });
      addLog(`上传组件渲染完成（trigger: ${opts.trigger}）`);
    },
    [addLog],
  );

  /* 首次加载 */
  useEffect(() => {
    renderUploader(props);
    return () => {
      if (uploaderRef.current) uploaderRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = () => {
    renderUploader(props);
  };

  const setProp = (key: string, val: string) => setProps((p) => ({ ...p, [key]: val }));

  /* 构建 opts 代码行 */
  const buildOptsLines = () => {
    const lines: string[] = [];
    if (props.trigger === "button")
      lines.push('  trigger: "button",            // 按钮形态，复用 @qingwu/button');
    if (props.compress === "false")
      lines.push("  compress: false,             // 关闭压缩，按原图上传");
    const formatMap: Record<string, string> = {
      all: '["original", "webp", "avif"]',
      webp: '["original", "webp"]',
      avif: '["original", "avif"]',
      original: '["original"]',
    };
    const fmtLine = formatMap[props.formats];
    if (props.formats !== "all" && fmtLine) lines.push(`  formats: ${fmtLine},`);
    if (props.quality !== "0.8") lines.push(`  quality: ${props.quality},`);
    if (props.maxSizeMB !== "10")
      lines.push(`  maxSizeMB: ${props.maxSizeMB},        // 单张大小上限（MB）`);
    if (props.maxCount !== "0") lines.push(`  maxCount: ${props.maxCount},       // 数量上限`);
    if (props.supportedFormats !== "all")
      lines.push(`  supportedFormats: ["${props.supportedFormats.split(",").join('", "')}"], // 图片格式白名单`);
    if (props.mode === "real")
      lines.push('  url: "/api/upload",        // 内置 XHR 上传（真实进度）');
    else lines.push("  // uploadFn: 自定义上传函数（未传 url 时仅压缩不上传）");
    return lines;
  };

  /* React / HTML / Vue 三格式代码 */
  const snippets = (() => {
    const optsLines = buildOptsLines();

    const react = [
      'import { ImageUpload } from "@qingwu/upload";',
      'import "@qingwu/upload/style.css";   // 按钮形态样式已内置',
      "",
      "useEffect(() => {",
      "  const el = rootRef.current;",
      "  if (!el) return;",
      `  uploaderRef.current = new ImageUpload(el, ${optsLines.length > 0 ? "{" : ""}`,
      ...optsLines,
      optsLines.length > 0 ? "  });" : "  {});",
      "  return () => uploaderRef.current?.destroy();",
      "}, []);",
      "",
      "return <div ref={rootRef} />;",
    ].filter((l) => l !== "");

    const html = [
      "<!DOCTYPE html>",
      '<html lang="zh-CN">',
      "<head>",
      '  <meta charset="utf-8" />',
      '  <link rel="stylesheet" href="https://unpkg.com/@qingwu/upload/style.css" />',
      "</head>",
      "<body>",
      '  <div id="root"></div>',
      '  <script type="module">',
      '    import { ImageUpload } from "https://unpkg.com/@qingwu/upload";',
      `    const uploader = new ImageUpload(document.querySelector("#root"), ${optsLines.length > 0 ? "{" : ""}`,
      ...optsLines.map((l) => `    ${l}`),
      optsLines.length > 0 ? "    });" : "    {});",
      "  </script>",
      "</body>",
      "</html>",
    ].filter((l) => l !== "");

    const vue = [
      "<template>",
      '  <div ref="rootRef"></div>',
      "</template>",
      "",
      '<script setup lang="ts">',
      'import { ref, onMounted, onUnmounted } from "vue";',
      'import { ImageUpload } from "@qingwu/upload";',
      'import "@qingwu/upload/style.css";   // 按钮形态样式已内置',
      "",
      "const rootRef = ref<HTMLDivElement>();",
      "let uploader: ImageUpload | null = null;",
      "",
      "onMounted(() => {",
      "  if (!rootRef.value) return;",
      `  uploader = new ImageUpload(rootRef.value, ${optsLines.length > 0 ? "{" : ""}`,
      ...optsLines,
      optsLines.length > 0 ? "  });" : "  {});",
      "});",
      "",
      "onUnmounted(() => uploader?.destroy());",
      "</script>",
    ].filter((l) => l !== "");

    return { react: react.join("\n"), html: html.join("\n"), vue: vue.join("\n") };
  })();

  return (
    <div className="demo-grid">
      <DemoCard
        title="Upload 图片上传"
        desc="拖拽区 / 按钮两种触发形态，客户端压缩为原图 / WebP / AVIF 多份输出，每项独立进度条。"
        full
        snippets={snippets}
      >
        {/* props 面板 */}
        <div className="cal-props-panel">
          <div className="cal-props-grid">
            {FIELDS.map((field) => (
              <label key={field.key} className="cal-props-field">
                <span className="cal-props-label">{field.label}</span>
                <select
                  className="cal-props-input"
                  value={props[field.key]}
                  onChange={(e) => setProp(field.key, e.target.value)}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="cal-props-actions">
            <button className="qw-btn qw-btn-primary" type="button" onClick={handleConfirm}>
              应用配置
            </button>
          </div>
        </div>

        {/* 上传组件挂载点 + 日志 */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: 280 }} ref={rootRef} />
          <div className="cal-log-panel">
            <div className="cal-log-title">操作日志</div>
            <div className="cal-log-list">
              {log.length === 0 ? (
                <div className="cal-log-empty">暂无日志，上传图片后将在此显示</div>
              ) : (
                log.map((msg, i) => (
                  <div key={i} className="cal-log-item">
                    {msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DemoCard>
    </div>
  );
}
