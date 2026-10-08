"use client";

import Playground from "@/components/Playground";
import { INPUT_FIELDS, createInput, inputToCode } from "./playground.config";

export default function InputPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="Input 输入框"
        desc="纯 CSS 输入框：流光边框 / 简约经典两种样式，通过 className 切换；无 JS 类，所有属性改动实时作用于原生 input。"
        fields={INPUT_FIELDS}
        create={createInput}
        toCode={inputToCode}
      />
    </div>
  );
}
