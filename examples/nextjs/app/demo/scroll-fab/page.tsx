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

// 银杏叶双 path：fill 为叶片实体，outline 同形外扩 1.13 倍让进度描边完全包裹叶片外缘
const LEAF =
  "M24 46 L23.2 34 C16 33 9 28 7 20 C6.5 15 9 11 13 10 C12 13.5 14 16 17 15.5 C15.5 12.5 17.5 8.5 21 7.5 C22.4 7 23.4 8.5 24 10 C24.6 8.5 25.6 7 27 7.5 C30.5 8.5 32.5 12.5 31 15.5 C34 16 36 13.5 35 10 C39 11 41.5 15 41 20 C39 28 32 33 24.8 34 Z";

export default function ScrollFabPage() {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = new ScrollFab();
    const box = boxRef.current;
    const container = box
      ? new ScrollFab({ target: box, position: { right: 96, bottom: 24 } })
      : null;
    // 银杏叶异形 + 自建 Lenis（未安装 lenis 时静默回退内置 rAF）
    const leaf = new ScrollFab({
      lenis: true,
      position: { left: 24, bottom: 24 },
      shape: {
        fill: LEAF,
        outline: LEAF,
        outlineTransform: "translate(24 24) scale(1.13) translate(-24 -24)",
      },
    });
    return () => {
      page.destroy();
      container?.destroy();
      leaf.destroy();
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
        title="异形 + Lenis（银杏叶）"
        desc="左下角悬浮栏为银杏叶异形：进度描边沿外扩轮廓完全包裹叶片（双 path，单 path 描边居中会有一半压进形状内部）；圆形外壳退场，阴影改用 drop-shadow 跟随叶片真实形状。lenis: true 时点击滚动由 Lenis 驱动（未安装 lenis 静默回退内置 rAF），自建实例 smoothWheel:false，只驱动按钮程序滚动、不劫持页面滚轮。绕圈翻转、轻点执行等交互与圆形模式完全一致。"
        code={`new ScrollFab({
  lenis: true, // 也可传 Lenis 配置或宿主已有实例
  position: { left: 24, bottom: 24 },
  shape: {
    fill: LEAF,
    outline: LEAF,
    outlineTransform:
      "translate(24 24) scale(1.13) translate(-24 -24)",
  },
});`}
      >
        <p style={{ color: "#68706c", fontSize: 14, margin: 0 }}>
          观察左下角银杏叶悬浮栏：悬停绕圈、轻点滚动、翻转后描边变琥珀色；翻回本页底部再返回顶部即可验证全程。
        </p>
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
