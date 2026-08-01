"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findPrevNext } from "@/docs.config";
import { ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT } from "@icon/icons";

function SvgHtml({ html, size = 15 }: { html: string; size?: number }) {
  const sized = html.replace(/width="[^"]*"/, `width="${size}"`).replace(/height="[^"]*"/, `height="${size}"`);
  return <span dangerouslySetInnerHTML={{ __html: sized }} />;
}

/** 页面底部：上一页 / 下一页（依据 docs.config 全站顺序） */
export default function PrevNext() {
  const pathname = usePathname();
  const { prev, next } = findPrevNext(pathname);
  if (!prev && !next) return null;

  return (
    <nav className="doc-prevnext" aria-label="页面导航">
      {prev ? (
        <Link href={prev.href} className="doc-pn doc-pn-prev">
          <span className="doc-pn-label"><SvgHtml html={ICON_CHEVRON_LEFT} size={13} /> 上一页</span>
          <strong>{prev.title}</strong>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="doc-pn doc-pn-next">
          <span className="doc-pn-label">下一页 <SvgHtml html={ICON_CHEVRON_RIGHT} size={13} /></span>
          <strong>{next.title}</strong>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
