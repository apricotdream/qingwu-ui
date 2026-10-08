"use client";

import { ImageUpload, type UploadOptions } from "@qingwu-ui/upload";
import { useEffect, useRef } from "react";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { asset } from "@/lib/assets";
import { COMPONENT_SECTIONS } from "@/docs.config";
import { UPLOAD_FIELDS, createUpload, uploadToCode } from "./playground.config";

/* ---- 静态卡通用挂载 ---- */
function StaticUpload({ options }: { options: Partial<UploadOptions> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const uploader = new ImageUpload(ref.current, options);
    return () => uploader.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} />;
}

/* ---- 场景卡代码：手写实例化语句，框架外壳由 codegen 统一产出 ---- */
const snippet = (stmt: string) => genAll({ meta: PKG.upload, symbol: "ImageUpload", stmt });

/* ---- API 属性表（数据源：docs.config.ts → upload.api） ---- */
const UPLOAD_API =
  COMPONENT_SECTIONS.find((s) => s.id === "form")?.pages.find((p) => p.href === "/demo/upload")
    ?.api ?? [];

export default function UploadPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="Upload 图片上传"
        desc="拖拽区 / 按钮两种触发形态，客户端压缩为原图 / WebP / AVIF 多份输出，内置 XHR 字节级真实上传进度，onProgress 实时回调。单文件限制（maxCount: 1）时拖拽容器承载大图预览，URL 导入入口在图片框内，右上角 ✕ 一键清空全部上传项。调整属性后点「应用」。"
        fields={UPLOAD_FIELDS}
        create={createUpload}
        toCode={uploadToCode}
        log
        hostStyle={{ width: "auto", minWidth: 320, flex: "1 1 320px" }}
      />

      <DemoCard
        title="编辑态回显"
        desc="initialUrls 传入已存在封面，渲染为成功项；删除走 remove → onChange 差集，适合编辑表单首屏。"
        snippets={snippet(`const uploader = new ImageUpload(el, {
  url: "/api/upload",
  initialUrls: ["/logo.png"]   // 已存在封面渲染为成功项
});`)}
      >
        <StaticUpload options={{ url: "/api/upload", initialUrls: [asset("/logo.png")] }} />
      </DemoCard>

      <DemoCard
        title="多图上传"
        desc="maxCount: 0 不限数量（默认），拖拽与点选均可多选，列表按行展示多格式产物。"
        snippets={snippet(`const uploader = new ImageUpload(el, {
  url: "/api/upload",
  maxCount: 0        // 0 = 不限数量，允许多选/多拖
});`)}
      >
        <StaticUpload options={{ url: "/api/upload", maxCount: 0 }} />
      </DemoCard>

      <DemoCard
        title="按钮形态 · 关闭压缩"
        desc="trigger: button 复用 @qingwu-ui/button 渲染小按钮；compress: false 时按原图直传，不生成 WebP/AVIF。"
        snippets={snippet(`const uploader = new ImageUpload(el, {
  trigger: "button",   // 复用 @qingwu-ui/button
  compress: false,     // 关闭压缩，按原图上传
  url: "/api/upload"
});`)}
      >
        <StaticUpload options={{ trigger: "button", compress: false, url: "/api/upload" }} />
      </DemoCard>

      <DemoCard
        title="仅压缩 · 不上传"
        desc="不传 url 也不传 uploadFn：只在本地跑压缩管线产出原图 / WebP / AVIF，不发起任何请求，可用于前置处理。"
        snippets={snippet(`// 不传 url / uploadFn：仅本地压缩，产物保留在列表中
const uploader = new ImageUpload(el, {
  formats: ["original", "webp", "avif"]
});`)}
      >
        <StaticUpload options={{ formats: ["original", "webp", "avif"] }} />
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
