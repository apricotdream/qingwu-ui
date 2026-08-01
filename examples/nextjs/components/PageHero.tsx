"use client";

import { usePathname } from "next/navigation";
import { findPage } from "@/docs.config";

/** 页面标题区（Element Plus 风格）：中文名 + 英文名 + 一句话描述 */
export default function PageHero() {
  const pathname = usePathname();
  const page = findPage(pathname);
  if (!page) return null;

  const showEn = !page.title.includes(page.en);

  return (
    <section className="doc-hero">
      <h1 className="doc-hero-title">
        {page.title}
        {showEn && <span className="doc-hero-en">{page.en}</span>}
      </h1>
      <p className="doc-hero-desc">{page.desc}</p>
    </section>
  );
}
