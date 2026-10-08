import { ScrollFab, type ScrollFabMode } from "@qingwu-ui/scroll-fab";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";

export const SCROLL_FAB_FIELDS: FieldDef[] = [
  {
    key: "size",
    label: "按钮直径",
    type: "select",
    defaultValue: "56",
    options: [
      { label: "44px", value: "44" },
      { label: "56px", value: "56" },
      { label: "64px", value: "64" },
    ],
  },
  {
    key: "modes",
    label: "模式集合",
    type: "select",
    defaultValue: "both",
    options: [
      { label: "仅返回顶部", value: "to-top" },
      { label: "双模式 + 进度回调", value: "scroll-progress" },
      { label: "双模式（默认）", value: "both" },
    ],
  },
  {
    key: "showThreshold",
    label: "显隐阈值",
    type: "select",
    defaultValue: "200",
    options: [
      { label: "100px", value: "100" },
      { label: "200px", value: "200" },
      { label: "400px", value: "400" },
    ],
  },
  {
    key: "animate",
    label: "动画开关",
    type: "boolean",
    defaultValue: "true",
    options: [
      { label: "开启", value: "true" },
      { label: "关闭（瞬切）", value: "false" },
    ],
  },
];

const FILLER =
  "青梧 UI 悬浮滚动栏演示正文：轻点恒直接执行当前模式动作；悬停（触屏按住）描边推进，绕满一圈翻转为另一模式。";

/** 在实验台内构建一个可滚动容器，让 fixed 定位的 FAB 落在舞台范围内、且有真实滚动可跟 */
export function createScrollFab(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  const box = document.createElement("div");
  Object.assign(box.style, {
    height: "220px",
    overflow: "auto",
    border: "1px solid #dcdfd6",
    borderRadius: "14px",
    padding: "16px",
  });
  for (let i = 0; i < 16; i++) {
    const p = document.createElement("p");
    p.textContent = `第 ${i + 1} 段 · ${FILLER}`;
    p.style.cssText = "margin:0 0 14px;line-height:1.8;";
    box.append(p);
  }
  host.append(box);

  const modes: ScrollFabMode[] =
    v.modes === "to-top" ? ["to-top"] : ["to-bottom", "to-top"];

  // 以容器当前视口位置反算 right/bottom，使 FAB 视觉上贴在容器右下角内
  const rect = box.getBoundingClientRect();
  const position = {
    right: Math.max(8, Math.round(window.innerWidth - rect.right) + 12),
    bottom: Math.max(8, Math.round(window.innerHeight - rect.bottom) + 12),
  };

  const fab = new ScrollFab({
    target: box,
    size: Number(v.size),
    modes,
    showThreshold: Number(v.showThreshold),
    animate: v.animate !== false,
    position,
    onModeChange: (mode) => log(`模式切换为：${mode}`),
    ...(v.modes === "scroll-progress"
      ? { onScroll: (pct: number) => log(`滚动进度：${Math.round(pct * 100)}%`) }
      : {}),
  });
  log("ScrollFab 挂载完成，滚动容器内正文让按钮出现");

  return {
    destroy: () => {
      fab.destroy();
      box.remove();
    },
  };
}

export function scrollFabToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = [`  size: ${v.size},`];
  if (v.modes === "to-top") lines.push('  modes: ["to-top"],');
  lines.push(`  showThreshold: ${v.showThreshold},`);
  if (v.animate === false) lines.push("  animate: false,");
  if (v.modes === "scroll-progress")
    lines.push("  onScroll: (pct) => console.log(`滚动进度 ${Math.round(pct * 100)}%`),");

  const stmt = `const fab = new ScrollFab({
${lines.join("\n")}
});`;

  return { meta: PKG.scrollFab, symbol: "ScrollFab", stmt, destroy: "fab.destroy()" };
}
