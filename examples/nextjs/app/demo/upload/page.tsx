"use client";

import type { OutputFormat, UploadItem } from "@qingwu/upload";
import { ImageUpload } from "@qingwu/upload";
import { useCallback, useEffect, useRef, useState } from "react";
import "@qingwu/upload/style.css";
import DemoCard from "@/components/DemoCard";
import { COMPONENT_SECTIONS } from "@/docs.config";

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
    // 默认单文件：容器承载大图预览（URL 导入入口在图片框内），多图能力可选
    defaultValue: "1",
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
    key: "initial",
    label: "编辑态回显",
    type: "select",
    defaultValue: "false",
    options: [
      { label: "关闭（新建场景）", value: "false" },
      { label: "开启（回显已存在封面）", value: "true" },
    ],
  },
  {
    key: "persist",
    label: "持久化",
    type: "select",
    // 默认不开启：未完成的上传项（File）存 IndexedDB，刷新后恢复列表并自动重传
    defaultValue: "off",
    options: [
      { label: "关闭", value: "off" },
      { label: "标签页级（session）", value: "session" },
      { label: "跨会话（local）", value: "local" },
    ],
  },
  {
    key: "previewFit",
    label: "大图适配",
    type: "select",
    defaultValue: "cover",
    options: [
      { label: "铺满（裁切）", value: "cover" },
      { label: "等比例缩小（完整显示）", value: "contain" },
      { label: "自动（按尺寸选择）", value: "auto" },
    ],
  },
];

/* ============================================================
   API 属性表（数据源：docs.config.ts → upload.api）
   ============================================================ */

const UPLOAD_API =
  COMPONENT_SECTIONS.find((s) => s.id === "form")?.pages.find((p) => p.href === "/demo/upload")
    ?.api ?? [];

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

  /** onProgress 日志节流：每 10% 记一条，附字节量证明为 XHR 真实进度 */
  const lastLoggedRef = useRef<Map<string, number>>(new Map());
  const handleProgress = useCallback(
    (item: UploadItem) => {
      if (item.progress >= 100) return; // 完成交给 onSuccess
      const last = lastLoggedRef.current.get(item.id) ?? 0;
      if (item.progress - last < 10) return;
      lastLoggedRef.current.set(item.id, item.progress);
      const sent = (item.size * item.progress) / 100;
      const fmtBytes = (b: number) =>
        b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(1)} KB`;
      addLog(
        `进度 ${item.progress}% · ${fmtBytes(sent)} / ${fmtBytes(item.size)} ← ${item.name}（${item.format}）`,
      );
    },
    [addLog],
  );

  /* 当前配置 → 组件选项（内置 XHR 上传，onProgress 为字节级真实进度） */
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
      url: "/api/upload",
      initialUrls: current.initial === "true" ? ["/logo.png"] : undefined, // 编辑态回显演示
      persist: (current.persist === "off" ? "off" : current.persist) as "off" | "session" | "local",
      previewFit: (current.previewFit === "contain" || current.previewFit === "auto"
        ? current.previewFit
        : "cover") as "cover" | "contain" | "auto",
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
        onProgress: handleProgress,
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
      lines.push(
        `  supportedFormats: ["${props.supportedFormats.split(",").join('", "')}"], // 图片格式白名单`,
      );
    if (props.initial === "true")
      lines.push('  initialUrls: ["/logo.png"],  // 编辑态回显：已存在封面渲染为成功项');
    if (props.persist !== "off")
      lines.push(`  persist: "${props.persist}",  // 未完成项持久化（刷新恢复并自动重传）`);
    if (props.previewFit !== "cover")
      lines.push(
        `  previewFit: "${props.previewFit}",   // 大图适配：contain 完整显示 / auto 按尺寸自动选择（默认 cover 铺满）`,
      );
    lines.push('  url: "/api/upload",        // 内置 XHR 上传（字节级真实进度）');
    lines.push("  onProgress: (item) => console.log(item.progress), // 每项上传进度回调");
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
        desc="拖拽区 / 按钮两种触发形态，客户端压缩为原图 / WebP / AVIF 多份输出，内置 XHR 字节级真实上传进度，onProgress 实时回调。单文件限制（maxCount: 1）时拖拽容器承载大图预览，URL 导入入口在图片框内，右上角 ✕ 一键清空全部上传项。"
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

      {/* API 属性表 */}
      <div className="api-section">
        {UPLOAD_API.map((group) => (
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
