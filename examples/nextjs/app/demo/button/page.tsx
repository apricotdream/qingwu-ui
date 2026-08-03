"use client";

import { Button } from "@qingwu/button";
import { useEffect, useRef } from "react";
import "@qingwu/button/style.css";
import DemoCard from "@/components/DemoCard";

export default function ButtonPage() {
  const defaultRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const amberRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const btn1 = new Button({ text: "默认" });
    const btn2 = new Button({ text: "主要", variant: "primary" });
    const btn3 = new Button({ text: "琥珀", variant: "amber" });
    const btn4 = new Button({ text: "‹", variant: "icon" });

    defaultRef.current?.append(btn1.el);
    primaryRef.current?.append(btn2.el);
    amberRef.current?.append(btn3.el);
    iconRef.current?.append(btn4.el);

    return () => {
      btn1.destroy();
      btn2.destroy();
      btn3.destroy();
      btn4.destroy();
    };
  }, []);

  return (
    <div className="demo-grid">
      <DemoCard
        title="Button 按钮"
        desc="按钮变体：默认、主色、琥珀色、图标按钮"
        full
        code={`import { Button } from "@qingwu/button";
import "@qingwu/button/style.css";

const btn = new Button({ text: "确认", variant: "primary" });
container.append(btn.el);`}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div ref={defaultRef} />
          <div ref={primaryRef} />
          <div ref={amberRef} />
          <div ref={iconRef} />
        </div>
      </DemoCard>
    </div>
  );
}
