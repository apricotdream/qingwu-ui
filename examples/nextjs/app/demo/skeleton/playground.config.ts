import { AutoSkeleton, type AutoSkeletonOptions } from "@qingwu-ui/skeleton";
import type { CodegenInput } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import type { FieldDef, LogFn, PlaygroundHandle } from "@/components/Playground";
import { buildProductCardHTML } from "./templates";

export const SKELETON_FIELDS: FieldDef[] = [
  {
    key: "timingFunction",
    label: "时序函数",
    type: "select",
    defaultValue: "ease-in-out",
    options: [
      { label: "ease-in-out（默认）", value: "ease-in-out" },
      { label: "linear 线性", value: "linear" },
      { label: "ease-out 缓出", value: "ease-out" },
      { label: "cubic-bezier 顺滑", value: "cubic-bezier(0.22, 1, 0.36, 1)" },
    ],
  },
  {
    key: "duration",
    label: "流光时长",
    type: "select",
    defaultValue: "1500",
    options: [
      { label: "1000ms（快）", value: "1000" },
      { label: "1500ms（默认）", value: "1500" },
      { label: "2000ms（缓）", value: "2000" },
    ],
  },
  {
    key: "shimmerColor",
    label: "流光颜色",
    type: "select",
    defaultValue: "#f0f0f0",
    options: [
      { label: "浅灰（默认）", value: "#f0f0f0" },
      { label: "月光白", value: "#ffffff" },
      { label: "淡靛蓝", value: "#e8e8f0" },
      { label: "暖杏色", value: "#ffe9d6" },
    ],
  },
  {
    key: "loading",
    label: "加载态",
    type: "boolean",
    defaultValue: "true",
    live: true,
    options: [
      { label: "加载中", value: "true" },
      { label: "已完成", value: "false" },
    ],
  },
];

export function createSkeleton(
  host: HTMLElement,
  v: Record<string, unknown>,
  log: LogFn,
): PlaygroundHandle {
  // 只需注入一次真实布局：骨架自动测量该 DOM，无需第二套骨架布局
  host.innerHTML = buildProductCardHTML();

  const options: AutoSkeletonOptions = {
    loading: v.loading !== false,
    timingFunction: v.timingFunction as string,
    duration: Number(v.duration),
    shimmerColor: v.shimmerColor as string,
    zIndex: 90,
  };

  const sk = new AutoSkeleton(host, options);
  log(
    `AutoSkeleton 挂载：${v.duration}ms · ${v.timingFunction} · ${v.loading !== false ? "加载中" : "已完成"}`,
  );

  return {
    destroy: () => sk.destroy(),
    update: (values, changedKey) => {
      if (changedKey === "loading") {
        sk.update({ loading: values.loading === true });
        log(values.loading === true ? "实时进入加载态" : "实时退出加载态，显露真实内容");
      }
    },
  };
}

export function skeletonToCode(v: Record<string, unknown>): CodegenInput {
  const lines: string[] = ["  loading: " + (v.loading !== false ? "true," : "false,")];
  if (v.timingFunction !== "ease-in-out")
    lines.push(`  timingFunction: "${v.timingFunction}",`);
  if (Number(v.duration) !== 1500) lines.push(`  duration: ${v.duration},`);
  if (v.shimmerColor !== "#f0f0f0") lines.push(`  shimmerColor: "${v.shimmerColor}",`);

  // 自包含真实布局字符串，禁止引用外部 productCardHTML
  const cardLiteral = JSON.stringify(buildProductCardHTML().trim());

  const stmt = `// 只写一次真实布局并注入容器
el.innerHTML = ${cardLiteral};

const sk = new AutoSkeleton(el, {
${lines.join("\n")}
});`;

  return { meta: PKG.skeleton, symbol: "AutoSkeleton", stmt };
}
