"use client";

import {
  ICON_CALENDAR,
  ICON_CLOCK,
  ICON_COPY,
  ICON_EDIT,
  ICON_STAR,
  ICON_TAG,
  ICON_TRASH,
  ICON_UPLOAD,
} from "@icon/icons";
import type { ActionMenuItem, ActionMenuOptions } from "@qingwu/action-menu";
import { ActionMenu } from "@qingwu/action-menu";
import "@qingwu/action-menu/style.css";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import DemoCard from "@/components/DemoCard";

/* ---- 图标池 ---- */
const ICON_POOL: (ActionMenuItem & { disabled?: boolean })[] = [
  { id: "copy", icon: ICON_COPY, label: "复制" },
  { id: "edit", icon: ICON_EDIT, label: "编辑" },
  { id: "tag", icon: ICON_TAG, label: "加标签" },
  { id: "clock", icon: ICON_CLOCK, label: "待办" },
  { id: "upload", icon: ICON_UPLOAD, label: "上传" },
  { id: "calendar", icon: ICON_CALENDAR, label: "排期" },
  { id: "star", icon: ICON_STAR, label: "收藏" },
  { id: "trash", icon: ICON_TRASH, label: "删除", disabled: true },
];

function buildItems(count: number): ActionMenuItem[] {
  return ICON_POOL.slice(0, count).map(({ disabled, ...it }) => ({ ...it, disabled }));
}

/* ---- 静态挂载宿主：外部 trigger 模式 ---- */
function StaticHost({
  items,
  triggerLabel = "✦",
  triggerStyle,
  ...opts
}: {
  items: ActionMenuItem[];
  triggerLabel?: string;
  triggerStyle?: CSSProperties;
} & Partial<ActionMenuOptions>) {
  const boxRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const btn = btnRef.current;
    if (!box || !btn) return;
    const menu = new ActionMenu(box, { items, trigger: btn, ...opts });
    return () => menu.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={boxRef}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={triggerLabel}
        style={{
          display: "grid",
          placeItems: "center",
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "1px solid var(--line, #dcdfd6)",
          background: "var(--card, #fdfdfb)",
          color: "var(--teal, #1e605a)",
          boxShadow: "0 12px 30px -14px rgba(29,43,44,.4)",
          cursor: "pointer",
          fontSize: 20,
          ...triggerStyle,
        }}
      >
        {triggerLabel}
      </button>
    </div>
  );
}

/* ---- props 面板字段 ---- */
interface FieldDef {
  key: string;
  label: string;
  type: "select";
  options: { label: string; value: string }[];
}

const FIELDS: FieldDef[] = [
  {
    key: "mode",
    label: "触发方式",
    type: "select",
    options: [
      { label: "外部 trigger", value: "external" },
      { label: "内置 FAB 悬浮球", value: "fab" },
    ],
  },
  {
    key: "direction",
    label: "展开方向",
    type: "select",
    options: [
      { label: "向右 →", value: "right" },
      { label: "向左 ←", value: "left" },
    ],
  },
  {
    key: "spread",
    label: "扇形张角",
    type: "select",
    options: [
      { label: "120°", value: "120" },
      { label: "180°", value: "180" },
      { label: "240°", value: "240" },
    ],
  },
  {
    key: "radius",
    label: "弧半径",
    type: "select",
    options: [
      { label: "48px（紧凑）", value: "48" },
      { label: "56px（默认）", value: "56" },
      { label: "72px（舒展）", value: "72" },
    ],
  },
  {
    key: "count",
    label: "菜单项数",
    type: "select",
    options: [
      { label: "3 项", value: "3" },
      { label: "5 项", value: "5" },
      { label: "7 项", value: "7" },
    ],
  },
];

export default function ActionMenuPage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<ActionMenu | null>(null);

  const [props, setProps] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, f.options[0]?.value ?? ""])),
  );
  const [log, setLog] = useState<string[]>([]);
  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const render = useCallback(
    (p: Record<string, string>) => {
      const stage = stageRef.current;
      const btn = btnRef.current;
      if (!stage || !btn) return;

      if (menuRef.current) {
        menuRef.current.destroy();
        menuRef.current = null;
      }

      const isFab = p.mode === "fab";
      btn.style.display = isFab ? "none" : "grid";

      const opts: ActionMenuOptions = {
        items: buildItems(Number(p.count)),
        direction: p.direction === "left" ? "left" : "right",
        spread: Number(p.spread),
        radius: Number(p.radius),
        onAction: (item) => addLog(`触发「${item.label}」`),
        onOpenChange: (open) => addLog(open ? "菜单展开" : "菜单收起"),
      };
      if (isFab) {
        opts.position = { right: 24, bottom: 24 };
      } else {
        opts.trigger = btn;
      }

      menuRef.current = new ActionMenu(stage, opts);
      addLog(
        `已渲染：${isFab ? "FAB 悬浮球" : "外部 trigger"} · ${p.direction === "left" ? "向左" : "向右"} · ${p.spread}° · ${p.radius}px · ${p.count} 项`,
      );
    },
    [addLog],
  );

  useEffect(() => {
    render(props);
    return () => {
      if (menuRef.current) menuRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = () => render(props);

  const snippets = {
    react: [
      'import { ActionMenu } from "@qingwu/action-menu";',
      'import "@qingwu/action-menu/style.css";',
      "",
      "const items = [",
      '  { id: "copy", icon: ICON_COPY, label: "复制", onClick: () => copy() },',
      '  { id: "edit", icon: ICON_EDIT, label: "编辑" },',
      '  { id: "trash", icon: ICON_TRASH, label: "删除", disabled: true },',
      "];",
      "",
      "// 外部触发：锚定任意元素",
      "const menu = new ActionMenu(container, {",
      "  items,",
      `  direction: "${props.direction === "left" ? "left" : "right"}",`,
      `  spread: ${props.spread},`,
      `  radius: ${props.radius},`,
      "  trigger: myButton, // 缺省则内置 FAB 悬浮球",
      "});",
      "menu.destroy(); // 卸载时销毁",
    ].join("\n"),
    html: [
      "<!DOCTYPE html>",
      '<html lang="zh-CN">',
      "<head>",
      '  <link rel="stylesheet" href="https://unpkg.com/@qingwu/action-menu/style.css" />',
      "</head>",
      "<body>",
      '  <div id="root"></div>',
      '  <script type="module">',
      '    import { ActionMenu } from "https://unpkg.com/@qingwu/action-menu";',
      `    const menu = new ActionMenu(document.querySelector("#root"), { items, direction: "${props.direction}" });`,
      "  </script>",
      "</body>",
      "</html>",
    ].join("\n"),
  };

  return (
    <div className="demo-grid">
      <DemoCard
        title="ActionMenu 扇形动作菜单"
        desc="悬浮展开的扇形快捷菜单：两段式披露——打开仅图标，hover 扇区沿切向伸出该扇区 label（旋转钳制 ±45°），hover 不收起、点击触发动作后收起；外部 trigger 与内置 FAB 悬浮球双模式，键盘方向键导航。"
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
                  onChange={(e) => setProps((p) => ({ ...p, [field.key]: e.target.value }))}
                >
                  {field.options.map((opt) => (
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

        {/* 挂载点 + 日志 */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div
            style={{
              width: 320,
              maxWidth: "100%",
              minHeight: 260,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* 菜单宿主：destroy 会清空该容器，故触发按钮作为兄弟节点由 React 管理 */}
            <div ref={stageRef} style={{ display: "contents" }} />
            <button
              ref={btnRef}
              type="button"
              aria-label="打开操作菜单"
              style={{
                display: "grid",
                placeItems: "center",
                width: 52,
                height: 52,
                borderRadius: "50%",
                border: "1px solid var(--line, #dcdfd6)",
                background: "var(--card, #fdfdfb)",
                color: "var(--teal, #1e605a)",
                boxShadow: "0 12px 30px -14px rgba(29,43,44,.4)",
                cursor: "pointer",
                fontSize: 20,
              }}
            >
              ✦
            </button>
          </div>
          <div className="cal-log-panel">
            <div className="cal-log-title">操作日志</div>
            <div className="cal-log-list">
              {log.length === 0 ? (
                <div className="cal-log-empty">暂无日志：悬浮按钮展开扇形，点击扇区触发动作</div>
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

      <DemoCard
        title="基础：右侧 180°"
        desc="默认 direction=right，五等分半圆；打开仅图标，hover 扇区沿切向伸出该扇区 label，点击才收起。"
      >
        <StaticHost items={buildItems(5)} />
      </DemoCard>

      <DemoCard title="向左展开" desc="direction=left：扇形在触发器左侧打开，label 同步向左铺。">
        <StaticHost items={buildItems(5)} direction="left" />
      </DemoCard>

      <DemoCard
        title="大张角 + 禁用项"
        desc="spread=220°，七项舒展排布；末项「删除」置灰不可触发，键盘自动跳过。"
      >
        <StaticHost items={buildItems(7)} spread={220} />
      </DemoCard>

      <DemoCard title="紧凑半径" desc="radius=44 + spread=120°，三项紧贴触发点，适合角落触发。">
        <StaticHost items={buildItems(3)} radius={44} spread={120} triggerLabel="＋" />
      </DemoCard>
    </div>
  );
}
