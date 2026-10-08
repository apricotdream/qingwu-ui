"use client";

import { AvatarEditor, type AvatarEditorResult } from "@qingwu-ui/avatar";
import "@qingwu-ui/avatar/style.css";
import { useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { asset } from "@/lib/assets";
import { AVATAR_FIELDS, avatarToCode, createAvatar } from "./playground.config";

/* ---- 场景卡代码：手写实例化语句，框架外壳由 codegen 统一产出 ---- */
const snippet = (stmt: string) =>
  genAll({ meta: PKG.avatar, symbol: "AvatarEditor", stmt, destroy: "editor.destroy()" });

/* ---- 点击头像编辑：卡内挂载一个默认配置编辑器，确认结果上抛给页面 ---- */
function ClickToEdit({ onConfirm }: { onConfirm: (result: AvatarEditorResult) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const editor = new AvatarEditor(ref.current, {
      initialUrl: asset("/logo.png"),
      outputSize: 256,
      onConfirm,
    });
    return () => editor.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} style={{ display: "grid", placeItems: "center", minHeight: 240 }} />;
}

export default function AvatarPage() {
  const [result, setResult] = useState<AvatarEditorResult | null>(null);

  return (
    <div className="demo-grid">
      <Playground
        title="AvatarEditor 头像编辑器"
        desc="支持选择/拖入图片、拖动定位、缩放、左右 90° 旋转与圆角率调节；确认后本地导出 Blob 和 dataURL。调整属性后点「应用」。"
        fields={AVATAR_FIELDS}
        create={createAvatar}
        toCode={avatarToCode}
        log
      />

      <DemoCard
        title="点击头像编辑"
        desc="点击头像打开编辑层：选图、拖拽定位、缩放、旋转、调圆角；确认后本地导出 Blob 和 dataURL。"
        snippets={snippet(`const editor = new AvatarEditor(el, {
  initialUrl: "/logo.png",
  outputSize: 256,
  onConfirm(result) {
    console.log(result.blob, result.dataUrl, result.width, result.height);
  }
});`)}
      >
        <ClickToEdit onConfirm={setResult} />
      </DemoCard>

      <DemoCard
        title="导出结果"
        desc="确认后展示输出尺寸、圆角与 dataURL 前缀，Blob 可直接交给宿主上传。"
        snippets={snippet(`const editor = new AvatarEditor(el, {
  initialUrl: "/logo.png",
  onConfirm({ blob, dataUrl, width, height, radius }) {
    preview.src = dataUrl;                 // dataURL 本地预览
    const data = new FormData();
    data.append("avatar", blob);           // Blob 直接交给上传接口
    fetch("/api/avatar", { method: "POST", body: data });
  }
});`)}
      >
        {result ? (
          <dl style={{ display: "grid", gap: 6, margin: 0, fontSize: 14 }}>
            <dt>尺寸</dt>
            <dd style={{ margin: 0 }}>{`${result.width}×${result.height}`}</dd>
            <dt>圆角</dt>
            <dd style={{ margin: 0 }}>{`${result.radius}px`}</dd>
            <dt>dataURL</dt>
            <dd style={{ margin: 0, wordBreak: "break-all" }}>{result.dataUrl.slice(0, 64)}</dd>
            <dt>Blob</dt>
            <dd style={{ margin: 0 }}>{`${result.blob.size} bytes / ${result.blob.type}`}</dd>
          </dl>
        ) : (
          <p style={{ margin: 0, color: "#68706c" }}>先点击头像并确认一次编辑。</p>
        )}
      </DemoCard>
    </div>
  );
}
