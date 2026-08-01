/**
 * 青梧图标 - 基于青梧品牌真实 PNG
 */

import type { SVGProps, ImgHTMLAttributes } from "react";

export function QingWuLogo({ size = 24, style, ...rest }: {
  size?: number;
  style?: React.CSSProperties;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height" | "style">) {
  return (
    <img
      src={QW_LOGO_BASE64}
      alt="青梧"
      width={size}
      height={size}
      style={{ borderRadius: size / 8, ...style }}
      {...rest}
    />
  );
}

const QW_LOGO_BASE64 =
  "data:image/png;base64,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";

export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const path = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {path}
    </svg>
  );
}

export type IconName =
  | "clip"
  | "selection"
  | "bookmark"
  | "panel"
  | "settings"
  | "history"
  | "push"
  | "download"
  | "copy"
  | "refresh"
  | "retry"
  | "trash"
  | "edit"
  | "eye"
  | "search"
  | "star"
  | "star-filled"
  | "tag"
  | "folder"
  | "ai"
  | "translate"
  | "summary"
  | "rename"
  | "sun"
  | "moon"
  | "auto"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "x"
  | "warning"
  | "info"
  | "external"
  | "menu"
  | "plus"
  | "grip";

const ICONS: Record<IconName, React.ReactNode> = {
  clip: (
    <>
      <path d="M4 4h16v4H4z" />
      <path d="M6 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
      <path d="M9 12h6" />
    </>
  ),
  selection: (
    <>
      <path d="M5 3a2 2 0 0 0-2 2v2" />
      <path d="M19 3a2 2 0 0 1 2 2v2" />
      <path d="M5 21a2 2 0 0 1-2-2v-2" />
      <path d="M19 21a2 2 0 0 0 2-2v-2" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </>
  ),
  bookmark: (
    <>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  history: (
    <>
      <path d="M3 3v6h6" />
      <path d="M3.51 9a9 9 0 1 0 2.13-9.36L3 3" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  push: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="8 11 12 7 16 11" />
      <line x1="12" y1="7" x2="12" y2="19" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  refresh: (
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  retry: (
    <>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </>
  ),
  trash: (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  star: (
    <>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </>
  ),
  "star-filled": (
    <>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" />
    </>
  ),
  tag: (
    <>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </>
  ),
  folder: (
    <>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </>
  ),
  ai: (
    <>
      <path d="M12 2a3 3 0 0 0-3 3v1H7a3 3 0 0 0-3 3v1H3v2h1v1a3 3 0 0 0 3 3h2v1a3 3 0 0 0 3 3 3 3 0 0 0 3-3v-1h2a3 3 0 0 0 3-3v-1h1v-2h-1V9a3 3 0 0 0-3-3h-2V5a3 3 0 0 0-3-3z" />
      <circle cx="9.5" cy="11" r="1" fill="currentColor" />
      <circle cx="14.5" cy="11" r="1" fill="currentColor" />
    </>
  ),
  translate: (
    <>
      <path d="M3 5h12M9 3v2c0 4.418-2.686 8-6 8" />
      <path d="M5 9c0 2.144 2.952 3.908 6.7 4" />
      <path d="M12 20l4-9 4 9M14.5 16h3" />
    </>
  ),
  summary: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="14" y2="12" />
      <line x1="4" y1="18" x2="18" y2="18" />
    </>
  ),
  rename: (
    <>
      <path d="M3 7h10M9 17h10" />
      <circle cx="6" cy="7" r="2" />
      <circle cx="18" cy="17" r="2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  auto: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  "chevron-down": <polyline points="6 9 12 15 18 9" />,
  "chevron-right": <polyline points="9 18 15 12 9 6" />,
  x: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  warning: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  external: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  menu: (
    <>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="19" r="1" />
    </>
  ),
};
