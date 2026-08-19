"use client";

import { AvatarEditor, type AvatarEditorResult } from "@qingwu-ui/avatar";
import "@qingwu-ui/avatar/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";
import { asset } from "@/lib/assets";

export default function AvatarPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<AvatarEditorResult | null>(null);
  const onConfirm = useCallback((next: AvatarEditorResult) => setResult(next), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const editor = new AvatarEditor(host, {
      initialUrl: asset("/logo.png"),
      outputSize: 256,
      onConfirm,
    });
    return () => editor.destroy();
  }, [onConfirm]);

  return (
    <div className="demo-stack">
      <DemoCard
        title="点击头像编辑"
        desc="支持选择/拖入图片、拖动定位、缩放、左右 90° 旋转与圆角率调节；确认后本地导出 Blob 和 dataURL。"
        code={`new AvatarEditor(host, {
  initialUrl: "/logo.png",
  outputSize: 256,
  onConfirm({ blob, dataUrl, width, height }) {
    console.log(blob, dataUrl, width, height);
  },
});`}
      >
        <div ref={hostRef} style={{ display: "grid", placeItems: "center", minHeight: 240 }} />
      </DemoCard>

      <DemoCard
        title="导出结果"
        desc="确认后展示输出尺寸、圆角与 dataURL 前缀，Blob 可直接交给宿主上传。"
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
