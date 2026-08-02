/* ============================================================
   青梧 UI · 图标库
   ============================================================
   零依赖 · 纯字符串常量 · tree-shakeable named exports
   所有图标统一使用：viewBox="0 0 24 24", stroke="currentColor",
   stroke-width="2", stroke-linecap="round", stroke-linejoin="round".

   使用方式：
     import { ICON_CALENDAR, ICON_SEARCH } from "@/icon/icons";
     element.innerHTML = ICON_CALENDAR;
     或者通过 dangerouslySetInnerHTML 渲染。
   ============================================================ */

const S = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const S16 = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const S18 = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const S20 = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const S36 = (d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

/* ---- 通用 UI 图标 ---- */

export const ICON_CALENDAR = S(
  '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
);

export const ICON_CALENDAR_DOT = S(
  '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/>',
);

export const ICON_SEARCH = S('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>');

export const ICON_UPLOAD = S(
  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
);

export const ICON_UPLOAD_ARROW = S(
  '<path d="M12 16V4"/><path d="m6 9 6-5 6 5"/><path d="M4 20h16"/>',
);

export const ICON_MENU = S('<path d="M3 7h18M3 12h18M3 17h18"/>');

export const ICON_CLOSE = S(
  '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
);

export const ICON_CHECK = S('<polyline points="20 6 9 17 4 12"/>');

export const ICON_PLUS = S(
  '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
);

export const ICON_MINUS = S('<line x1="5" y1="12" x2="19" y2="12"/>');

export const ICON_BOX = S(
  '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
);

export const ICON_EDIT = S(
  '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
);

export const ICON_FILE = S(
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
);

export const ICON_FOLDER = S(
  '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
);

export const ICON_INFO = S(
  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
);

export const ICON_WARNING = S(
  '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
);

export const ICON_TRASH = S(
  '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
);

export const ICON_DOWNLOAD = S(
  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
);

export const ICON_COPY = S(
  '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
);

export const ICON_EYE = S(
  '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
);

export const ICON_STAR = S(
  '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
);

export const ICON_STAR_FILLED = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

export const ICON_BOOKMARK = S('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>');

export const ICON_EXTERNAL_LINK = S(
  '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
);
export const ICON_GITHUB = S(
  '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
);

/* ---- 导航箭头 ---- */

export const ICON_CHEVRON_LEFT = S16('<path d="m15 18-6-6 6-6"/>');
export const ICON_CHEVRON_RIGHT = S16('<path d="m9 18 6-6-6-6"/>');
export const ICON_CHEVRON_UP = S('<polyline points="18 15 12 9 6 15"/>');
export const ICON_CHEVRON_DOWN = S('<polyline points="6 9 12 15 18 9"/>');
export const ICON_CODE = S(
  '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
);

/* ---- 全屏 ---- */

export const ICON_FULLSCREEN = S(
  '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
);
export const ICON_FULLSCREEN_EXIT = S(
  '<polyline points="4 8 4 3 9 3"/><polyline points="20 16 20 21 15 21"/><line x1="4" y1="3" x2="11" y2="10"/><line x1="20" y1="21" x2="13" y2="14"/>',
);

/* ---- 功能图标 ---- */

export const ICON_CLOCK = S('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>');
export const ICON_TYPE = S(
  '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
);
export const ICON_USERS = S(
  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
);
export const ICON_MICROPHONE = S(
  '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
);
export const ICON_MUSIC = S(
  '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
);
export const ICON_VIDEO = S(
  '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
);
export const ICON_IMAGE = S(
  '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
);

/* ---- 主题 ---- */

export const ICON_SUN = S(
  '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
);
export const ICON_MOON = S('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>');

/* ---- 侧边栏 ---- */

export const ICON_SIDEBAR_TOGGLE = S(
  '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9-3 3 3 3"/>',
);

/* ---- 编辑器图标 ---- */

export const ICON_LIST = S(
  '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
);
export const ICON_AI = S(
  '<path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6.4-4.8-6.4 4.8 2.4-7.2-6-4.8h7.6z"/>',
);
export const ICON_BOLT = S('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>');
export const ICON_REFRESH = S(
  '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
);
export const ICON_RETRY = S(
  '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
);
export const ICON_SETTINGS = S(
  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
);
export const ICON_HISTORY = S(
  '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6.11 6.11L3 8"/><path d="M12 7v5l4 2"/>',
);
export const ICON_PUSH = S(
  '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
);
export const ICON_TRANSLATE = S(
  '<path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>',
);
export const ICON_SUMMARY = S(
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
);
export const ICON_RENAME = S('<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>');
export const ICON_SELECTION = S(
  '<circle cx="12" cy="12" r="1"/><path d="M20 12a8 8 0 1 1-8-8"/><path d="m16 2 4 4-4 4"/>',
);
export const ICON_TAG = S(
  '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
);
export const ICON_GRIP = S(
  '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
);
export const ICON_DIAGRAM = S(
  '<rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/>',
);
export const ICON_LANGUAGE = S(
  '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
);
export const ICON_PAPERCLIP = S(
  '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
);
export const ICON_BROKEN_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M2 14l4-4 4 4 4-4 4 4 4-4"/><path d="M6 6h.01M18 6h.01"/></svg>';

/* ---- 包级别图标（用于 upload/search/calendar 包） ---- */

export const ICO_UPLOAD = S36('<path d="M12 16V4"/><path d="m6 9 6-5 6 5"/><path d="M4 20h16"/>');
const S18c = (d: string) =>
  `<svg class="qs-ico" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const S20c = (d: string) =>
  `<svg class="qw-cal-svg" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICO_SEARCH = S18c('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>');
export const ICO_MENU = S18('<path d="M4 7h16M4 12h16M4 17h16"/>');
export const ICO_CALENDAR = S20c(
  '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
);
export const ICO_ARROW_LEFT = S16('<path d="m15 18-6-6 6-6"/>');
export const ICO_ARROW_RIGHT = S16('<path d="m9 18 6-6-6-6"/>');

/* ---- 搜索插图（大尺寸 art） ---- */

export const SEARCH_ART =
  '<svg viewBox="0 0 160 140" role="img" aria-label="Search illustration">' +
  '<ellipse class="qs-art-shadow" cx="80" cy="124" rx="46" ry="6"/>' +
  '<g class="qs-art-float">' +
  '<rect class="qs-art-paper" x="40" y="20" width="80" height="82" rx="13"/>' +
  '<line class="qs-art-row-accent" x1="54" y1="42" x2="92" y2="42"/>' +
  '<line class="qs-art-row" x1="54" y1="56" x2="106" y2="56"/>' +
  '<line class="qs-art-row" x1="54" y1="70" x2="84" y2="70"/>' +
  '<circle class="qs-art-glass" cx="96" cy="86" r="23"/>' +
  '<line class="qs-art-handle" x1="113" y1="103" x2="129" y2="119"/>' +
  '<text class="qs-art-seal" x="96" y="94" text-anchor="middle" font-size="24">寻</text>' +
  "</g>" +
  '<circle class="qs-art-dot-a qs-art-twinkle" cx="34" cy="32" r="3"/>' +
  '<circle class="qs-art-dot-b qs-art-twinkle" cx="126" cy="40" r="2.6" style="animation-delay:.8s"/>' +
  '<circle class="qs-art-dot-c qs-art-twinkle" cx="30" cy="98" r="2.4" style="animation-delay:1.5s"/>' +
  "</svg>";
