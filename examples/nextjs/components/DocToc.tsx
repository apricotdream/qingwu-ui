"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { findPage } from "@/docs.config";

interface TocEntry {
  text: string;
  el: HTMLElement;
}

/** 本页目录（右侧栏）：组件页扫描 DemoCard 标题，指南页扫描文章 h2 */
export default function DocToc() {
  const pathname = usePathname();
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const isGuide = pathname.startsWith("/guide");
    const els = isGuide
      ? Array.from(document.querySelectorAll<HTMLElement>(".docs-article h2[id]"))
      : Array.from(document.querySelectorAll<HTMLElement>(".demo-card-header h4"));
    const next = els.map((el) => ({ text: el.textContent?.trim() ?? "", el }));
    setEntries(next);
    setActive("");
  }, [pathname]);

  /* 滚动监听：高亮当前阅读到的章节 */
  useEffect(() => {
    if (entries.length === 0) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const offset = 120;
        let current = "";
        for (const e of entries) {
          if (e.el.getBoundingClientRect().top <= offset) current = e.text;
        }
        setActive(current);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [entries]);

  const page = findPage(pathname);
  if (!page || entries.length === 0) return null;

  return (
    <nav className="qw-toc" aria-label="本页目录">
      <div className="qw-toc-title">本页目录</div>
      <ul className="qw-toc-list">
        {entries.map((e, i) => (
          <li key={e.text}>
            <a
              className={`qw-toc-link${active === e.text ? " is-active" : ""}`}
              href={`#${i}`}
              onClick={(ev) => {
                ev.preventDefault();
                e.el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
