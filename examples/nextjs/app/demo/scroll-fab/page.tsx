"use client";

import { ScrollFab } from "@qingwu-ui/scroll-fab";
import "@qingwu-ui/scroll-fab/style.css";
import { useEffect, useRef } from "react";
import DemoCard from "@/components/DemoCard";

function Article({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <p key={i} style={{ margin: "0 0 14px", lineHeight: 1.8 }}>
          第 {i + 1} 段 · 青梧 UI 悬浮滚动栏演示正文：点击（轻点）恒直接执行当前模式动作（滚动到底部
          / 返回顶部，按箭头方向）；
          鼠标悬停（触屏按住）时描边推进，绕满一圈翻转为另一模式（纯切换不附带滚动）；未绕满移开/松手，描边衰减倒转；
          按住期间滑动超过阈值即放弃描边并放行页面手势。
        </p>
      ))}
    </>
  );
}

export default function ScrollFabPage() {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = new ScrollFab();
    const box = boxRef.current;
    const container = box
      ? new ScrollFab({ target: box, position: { right: 96, bottom: 24 } })
      : null;
    return () => {
      page.destroy();
      container?.destroy();
    };
  }, []);

  return (
    <div className="demo-stack">
      <DemoCard
        title="整页滚动（window 默认）"
        desc="本页面即为滚动目标：点击滚到底；鼠标悬停绕满一圈 → 翻转为“返回顶部”（纯切换、不滚动），再点击即回顶部。触屏长按绕圈同样翻转，轻点执行动作。"
        code={`new ScrollFab();`}
      >
        <Article n={10} />
        <p style={{ color: "#68706c", fontSize: 14, margin: 0 }}>
          向下滚动让整页超过一屏，右下角悬浮栏即可交互。
        </p>
      </DemoCard>

      <DemoCard
        title="容器滚动（target 指定）"
        desc="传入固定高度容器，悬浮栏只跟随该容器的滚动位置，与页面滚动互不干扰。"
        code={`new ScrollFab({
  target: box,
  position: { right: 96, bottom: 24 },
  ringDuration: 800, // 绕圈时长 ms
});`}
      >
        <div
          ref={boxRef}
          style={{
            height: 320,
            overflow: "auto",
            border: "1px solid #dcdfd6",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <Article n={16} />
        </div>
      </DemoCard>

      <DemoCard
        title="移动端真机手测清单"
        desc="自动化覆盖 Pointer 状态机（vitest）与桌面端交互（Playwright）；三家手势引擎差异需真机验证。"
      >
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2, fontSize: 14 }}>
          <li>
            iOS Safari：长按不弹系统呼出菜单（-webkit-touch-callout
            已禁）；按住绕圈时手指静止不触发选择。
          </li>
          <li>
            微信内嵌浏览器：合成点击无双触发（ghost click 已抑制）；300ms
            延迟环境短按动作只执行一次。
          </li>
          <li>
            安卓 Chrome：从悬浮栏上滑动手势放行页面滚动（touch-action: manipulation +
            阈值放弃描边）。
          </li>
          <li>带 home indicator 机型：bottom 已叠加 env(safe-area-inset-bottom) 不被遮挡。</li>
        </ul>
      </DemoCard>
    </div>
  );
}
