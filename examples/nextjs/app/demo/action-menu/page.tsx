"use client";

import type { ActionMenuItem, ActionMenuOptions } from "@qingwu-ui/action-menu";
import { ActionMenu } from "@qingwu-ui/action-menu";
import "@qingwu-ui/action-menu/style.css";
import { type CSSProperties, useEffect, useRef } from "react";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import {
  ACTION_MENU_FIELDS,
  actionMenuToCode,
  buildItems,
  createActionMenu,
} from "./playground.config";

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

/* ---- 场景卡代码：手写实例化语句，框架外壳由 codegen 统一产出 ---- */
const snippet = (stmt: string) => genAll({ meta: PKG.actionMenu, symbol: "ActionMenu", stmt });

export default function ActionMenuPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="ActionMenu 扇形动作菜单"
        desc="悬浮展开的扇形快捷菜单：两段式披露——打开仅图标，hover 扇区沿切向伸出该扇区 label（旋转钳制 ±45°），hover 不收起、点击触发动作后收起；外部 trigger 与内置 FAB 悬浮球双模式，键盘方向键导航。调整属性后点「应用」。"
        fields={ACTION_MENU_FIELDS}
        create={createActionMenu}
        toCode={actionMenuToCode}
        log
        minHeight={260}
      />

      <DemoCard
        title="基础：右侧 180°"
        desc="默认 direction=right，五等分半圆；打开仅图标，hover 扇区沿切向伸出该扇区 label，点击才收起。"
        snippets={snippet(`const items = [
  { id: "copy", icon: ICON_COPY, label: "复制" },
  { id: "edit", icon: ICON_EDIT, label: "编辑" },
  { id: "tag", icon: ICON_TAG, label: "加标签" },
  { id: "clock", icon: ICON_CLOCK, label: "待办" },
  { id: "upload", icon: ICON_UPLOAD, label: "上传" }
];

const menu = new ActionMenu(el, {
  items,
  trigger: myButton
});`)}
      >
        <StaticHost items={buildItems(5)} />
      </DemoCard>

      <DemoCard
        title="向左展开"
        desc="direction=left：扇形在触发器左侧打开，label 同步向左铺。"
        snippets={snippet(`const menu = new ActionMenu(el, {
  items,
  direction: "left",
  trigger: myButton
});`)}
      >
        <StaticHost items={buildItems(5)} direction="left" />
      </DemoCard>

      <DemoCard
        title="大张角 + 禁用项"
        desc="spread=220°，七项舒展排布；末项「删除」置灰不可触发，键盘自动跳过。"
        snippets={snippet(`// 数据项中 disabled: true 即禁用该扇区
const items = [
  { id: "copy", icon: ICON_COPY, label: "复制" },
  { id: "edit", icon: ICON_EDIT, label: "编辑" },
  { id: "tag", icon: ICON_TAG, label: "加标签" },
  { id: "clock", icon: ICON_CLOCK, label: "待办" },
  { id: "upload", icon: ICON_UPLOAD, label: "上传" },
  { id: "calendar", icon: ICON_CALENDAR, label: "排期" },
  { id: "trash", icon: ICON_TRASH, label: "删除", disabled: true }
];

const menu = new ActionMenu(el, {
  items,
  spread: 220,
  trigger: myButton
});`)}
      >
        <StaticHost items={buildItems(7)} spread={220} />
      </DemoCard>

      <DemoCard
        title="紧凑半径"
        desc="radius=44 + spread=120°，三项紧贴触发点，适合角落触发。"
        snippets={snippet(`const menu = new ActionMenu(el, {
  items,
  spread: 120,
  radius: 44,
  trigger: myButton
});`)}
      >
        <StaticHost items={buildItems(3)} radius={44} spread={120} triggerLabel="＋" />
      </DemoCard>
    </div>
  );
}
