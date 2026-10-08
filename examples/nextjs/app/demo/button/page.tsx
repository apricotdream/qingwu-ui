"use client";

import { Button } from "@qingwu-ui/button";
import { useEffect, useRef } from "react";
import "@qingwu-ui/button/style.css";
import DemoCard from "@/components/DemoCard";
import Playground from "@/components/Playground";
import { genAll } from "@/lib/codegen";
import { PKG } from "@/lib/pkg-meta";
import { BUTTON_FIELDS, buttonToCode, createButton } from "./playground.config";

function StaticButton(opts: ConstructorParameters<typeof Button>[0]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const btn = new Button(opts);
    ref.current?.append(btn.el);
    return () => btn.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} />;
}

const snippet = (stmt: string) => genAll({ meta: PKG.button, symbol: "Button", stmt });

export default function ButtonPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="Button 按钮"
        desc="调整文本、变体、type、禁用状态后点「应用」；Button 不挂载到容器，构造后手动 append(btn.el)。"
        fields={BUTTON_FIELDS}
        create={createButton}
        toCode={buttonToCode}
        hostStyle={{ width: "auto" }}
      />

      <DemoCard
        title="默认 / 主色 / 琥珀"
        desc="variant：default（描边）、primary（实心主色）、amber（琥珀强调）。"
        snippets={snippet(`const btn = new Button({ text: "主要", variant: "primary" });
el.append(btn.el);`)}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <StaticButton text="默认" />
          <StaticButton text="主要" variant="primary" />
          <StaticButton text="琥珀" variant="amber" />
        </div>
      </DemoCard>

      <DemoCard
        title="图标按钮"
        desc="variant: icon —— 方形等宽，适合放单字符或符号。"
        snippets={snippet(`const btn = new Button({ text: "‹", variant: "icon" });
el.append(btn.el);`)}
      >
        <StaticButton text="‹" variant="icon" />
      </DemoCard>

      <DemoCard
        title="禁用状态"
        desc="disabled: true，按钮置灰且不可点击。"
        snippets={snippet(`const btn = new Button({ text: "已提交", disabled: true });
el.append(btn.el);`)}
      >
        <StaticButton text="已提交" disabled />
      </DemoCard>
    </div>
  );
}
