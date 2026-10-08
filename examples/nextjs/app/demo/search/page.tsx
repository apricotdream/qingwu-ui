"use client";

import "@qingwu-ui/search/style.css";
import "@qingwu-ui/button/style.css";
import Playground from "@/components/Playground";
import { SEARCH_FIELDS, createSearch, searchToCode } from "./playground.config";

export default function SearchPage() {
  return (
    <div className="demo-grid">
      <Playground
        title="Search 搜索"
        desc="打字机轮播占位提示 + @property 三色流光边框 + 类别筛选轮转 + 全键盘导航。按 / 或 Ctrl+K 打开面板；支持异步服务端搜索（search 选项：防抖 + 竞态取消 + 加载/错误态）。调整属性后点「应用」。"
        fields={SEARCH_FIELDS}
        create={createSearch}
        toCode={searchToCode}
        hostStyle={{ width: 460 }}
        log
      />
    </div>
  );
}
