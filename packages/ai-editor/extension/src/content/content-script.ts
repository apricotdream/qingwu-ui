/**
 * 内容脚本：注入网页，提供选区获取、可拖拽常驻悬浮球与剪藏消息处理（含防重复注入）。
 *
 * 悬浮球交互：
 * - 页面加载即常驻显示（总开关开启且当前网站未隐藏时）
 * - 按住左键拖拽移动，松手后位置保存到 chrome.storage.local（全局共享）
 * - 拖拽移动超过阈值（5px）不触发剪藏点击
 * - 右键弹出菜单，可隐藏当前网站的悬浮球
 * - 剪藏 toast 跟随悬浮球弹出
 */
import { FAB_STORAGE_KEYS, getFabConfig, hideFabOnHost, setFabPosition } from "../shared/fab";
import { setLocale, t } from "../shared/i18n";

// 用 128 大图：42px 显示 + 高分屏 2x 都无需放大位图，避免模糊
const FAB_ICON = chrome.runtime.getURL("icons/icon-128.png");
const FAB_SIZE = 44;
const DRAG_THRESHOLD = 5;

(() => {
  const state = window as unknown as { __qingwuClipperInjected?: boolean };
  if (state.__qingwuClipperInjected) return;
  state.__qingwuClipperInjected = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.kind === "get-selection") {
      const selection = window.getSelection?.();
      const text = selection?.toString() ?? "";
      const html = text
        ? (() => {
            try {
              const range = selection?.getRangeAt(0);
              if (!range) return text;
              const div = document.createElement("div");
              div.appendChild(range.cloneContents());
              return div.innerHTML;
            } catch {
              return text;
            }
          })()
        : "";
      sendResponse({ text, html, hasSelection: text.length > 0 });
      return true;
    }
    if (msg.kind === "ping") {
      sendResponse({ ok: true, at: Date.now() });
      return true;
    }
  });

  let fab: HTMLButtonElement | null = null;
  /** 悬浮球当前锚点坐标（中心点，fixed 定位） */
  let fabPos: { x: number; y: number } = defaultFabPosition();
  let dragging = false;
  /** 本次指针序列是否构成拖拽（构成则抑制随后的 click） */
  let dragged = false;
  let dragStart: { x: number; y: number; left: number; top: number } | null = null;
  let toastEl: HTMLDivElement | null = null;
  let toastTimer: number | null = null;
  let menuEl: HTMLDivElement | null = null;

  type ToastType = "info" | "success" | "error";

  /** 默认位置：右侧垂直居中（与旧版固定位置一致） */
  function defaultFabPosition() {
    return {
      x: window.innerWidth - 20 - FAB_SIZE / 2,
      y: Math.round(window.innerHeight / 2),
    };
  }

  function clampToViewport(p: { x: number; y: number }): {
    x: number;
    y: number;
  } {
    const half = FAB_SIZE / 2;
    return {
      x: Math.min(Math.max(p.x, half), window.innerWidth - half),
      y: Math.min(Math.max(p.y, half), window.innerHeight - half),
    };
  }

  function showToast(
    message: string,
    type: ToastType = "info",
    duration = 3000,
    action?: { label: string; onClick: () => void },
  ) {
    if (!toastEl || !toastEl.isConnected) {
      // ensureFab 的防御清理可能摘除旧 toast，重新创建以保证可见
      toastEl = document.createElement("div");
      document.documentElement.appendChild(toastEl);
    }
    toastEl.className = `qingwu-clipper-toast qingwu-clipper-toast--${type}`;
    toastEl.replaceChildren();

    const text = document.createElement("span");
    text.textContent = message;
    toastEl.appendChild(text);

    if (action) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      btn.className = "qingwu-clipper-toast-action";
      btn.addEventListener("click", () => {
        action.onClick();
      });
      toastEl.appendChild(btn);
    }

    positionToastAboveFab();
    // 用 rAF 让位置布局完成后加入可见态，确保过渡动画生效
    requestAnimationFrame(() => {
      toastEl?.classList.add("qingwu-clipper-toast--visible");
    });

    if (toastTimer !== null) clearTimeout(toastTimer);
    if (duration > 0) {
      toastTimer = window.setTimeout(() => {
        toastEl?.classList.remove("qingwu-clipper-toast--visible");
      }, duration);
    }
  }

  /** toast 跟随悬浮球：优先显示在球上方，球贴近顶部时改到下方 */
  function positionToastAboveFab() {
    if (!toastEl || !fab) return;
    const r = fab.getBoundingClientRect();
    const tw = Math.min(toastEl.offsetWidth || 320, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 8));
    const above = r.top >= 96;
    toastEl.dataset.side = above ? "above" : "below";
    toastEl.style.left = `${Math.round(left)}px`;
    toastEl.style.top = `${Math.round(above ? r.top - 10 : r.bottom + 10)}px`;
  }

  function applyFabPosition(p: { x: number; y: number }) {
    if (!fab) return;
    fab.style.left = `${Math.round(p.x)}px`;
    fab.style.top = `${Math.round(p.y)}px`;
  }

  function removeFab() {
    fab?.remove();
    fab = null;
    closeFabMenu();
  }

  function ensureFab(position: { x: number; y: number } | null) {
    if (fab) return;
    // 防御：清理页面上残留的旧实例（多入口重复注入等）
    document.querySelectorAll(".qingwu-clipper-fab").forEach((el) => {
      el.remove();
    });
    document.querySelectorAll(".qingwu-clipper-toast").forEach((el) => {
      el.remove();
    });

    fab = document.createElement("button");
    fab.type = "button";
    fab.title = `${t("app.name")} · Alt+Shift+C`;
    fab.setAttribute("aria-label", t("app.name"));
    fab.className = "qingwu-clipper-fab";
    fab.innerHTML = `<img src="${FAB_ICON}" alt="青梧" />`;

    fabPos = clampToViewport(position ?? defaultFabPosition());
    applyFabPosition(fabPos);

    fab.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      dragged = false;
      dragStart = {
        x: e.clientX,
        y: e.clientY,
        left: fabPos.x,
        top: fabPos.y,
      };
      fab?.classList.add("is-dragging");
      try {
        fab?.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      e.preventDefault();
    });

    fab.addEventListener("pointermove", (e) => {
      if (!dragging || !dragStart) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) dragged = true;
      if (dragged) {
        fabPos = clampToViewport({
          x: dragStart.left + dx,
          y: dragStart.top + dy,
        });
        applyFabPosition(fabPos);
      }
    });

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      dragStart = null;
      fab?.classList.remove("is-dragging");
      try {
        fab?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (dragged) {
        // 全局同一位置：松手即保存（最后拖拽的页面获胜）
        void setFabPosition(fabPos);
      }
    };
    fab.addEventListener("pointerup", endDrag);
    fab.addEventListener("pointercancel", endDrag);

    fab.addEventListener("click", () => {
      // 拖拽序列的 click 需抑制，避免松手后误触发剪藏
      if (dragged) {
        dragged = false;
        return;
      }
      chrome.runtime
        .sendMessage({
          id: crypto.randomUUID(),
          kind: "tab:open-sidepanel",
          payload: null,
        })
        .catch(() => {});
      void clipPageWithToast();
    });

    fab.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showFabMenu(e.clientX, e.clientY);
    });

    document.documentElement.appendChild(fab);
  }

  async function clipPageWithToast() {
    showToast(t("fab.clipping"), "info", 0);
    try {
      const resp = (await chrome.runtime.sendMessage({
        id: crypto.randomUUID(),
        kind: "clip:extract",
        payload: { mode: "page" },
      })) as
        | {
            ok?: boolean;
            data?: { title?: string; markdown?: string };
            error?: { message?: string; retryable?: boolean };
          }
        | undefined;

      if (resp?.ok && resp.data) {
        const title = resp.data.title ? `：${resp.data.title}` : "";
        const md = resp.data.markdown ?? "";
        showToast(t("fab.clipped") + title, "success", 6000, {
          label: t("action.copyMd"),
          onClick: () => {
            void navigator.clipboard.writeText(md).then(
              () => showToast(t("toast.copy.ok"), "success", 2000),
              () => showToast(t("fab.copyFailed"), "error", 2000),
            );
          },
        });
      } else if (resp?.error) {
        const retryHint = resp.error.retryable ? `，${t("fab.retryHint")}` : "";
        showToast(`${t("fab.clipFailed")}：${resp.error.message}${retryHint}`, "error", 3000);
      } else {
        showToast(t("fab.noResponse"), "error", 3000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("fab.connError");
      showToast(`${t("fab.clipFailed")}：${message}`, "error", 3000);
    }
  }

  // ===== 右键菜单（隐藏当前网站的悬浮球）=====
  function showFabMenu(x: number, y: number) {
    const menu = ensureFabMenu();
    const menuW = 190;
    const menuH = 38;
    menu.style.left = `${Math.round(Math.min(x, window.innerWidth - menuW - 8))}px`;
    menu.style.top = `${Math.round(Math.min(y, window.innerHeight - menuH - 8))}px`;
    menu.classList.add("qingwu-clipper-menu--visible");
  }

  function closeFabMenu() {
    menuEl?.classList.remove("qingwu-clipper-menu--visible");
  }

  function ensureFabMenu(): HTMLDivElement {
    if (menuEl) return menuEl;

    menuEl = document.createElement("div");
    menuEl.className = "qingwu-clipper-menu";
    menuEl.setAttribute("role", "menu");

    const item = document.createElement("button");
    item.type = "button";
    item.className = "qingwu-clipper-menu-item";
    item.setAttribute("role", "menuitem");
    item.textContent = t("fab.menu.hide");
    item.addEventListener("click", () => {
      void (async () => {
        closeFabMenu();
        await hideFabOnHost(location.hostname || location.protocol);
        removeFab();
        showToast(t("fab.hiddenToast"), "info", 3000);
      })();
    });
    menuEl.appendChild(item);

    document.documentElement.appendChild(menuEl);

    // 点击别处 / 滚动 / 缩放 / Esc 关闭菜单
    const onOutside = (e: PointerEvent) => {
      if (menuEl?.contains(e.target as Node)) return;
      closeFabMenu();
    };
    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("resize", closeFabMenu);
    window.addEventListener("scroll", closeFabMenu, true);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeFabMenu();
    });
    return menuEl;
  }

  // ===== 初始化 =====
  async function init() {
    // 语言跟随扩展设置（设置经 settingsStore 镜像到 chrome.storage.local）
    try {
      const { settings } = await chrome.storage.local.get("settings");
      if (settings?.locale) setLocale(settings.locale);
    } catch {
      /* ignore */
    }

    const cfg = await getFabConfig();
    if (cfg.enabled && !cfg.hiddenHosts.includes(location.hostname)) {
      ensureFab(cfg.position);
    }
  }

  // 总开关 / 隐藏列表变化（来自选项页或其它页面）即时生效
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!changes[FAB_STORAGE_KEYS.enabled] && !changes[FAB_STORAGE_KEYS.hiddenHosts]) {
      return;
    }
    void (async () => {
      const cfg = await getFabConfig();
      const hidden = cfg.hiddenHosts.includes(location.hostname);
      if (!cfg.enabled || hidden) {
        removeFab();
      } else if (!fab) {
        ensureFab(cfg.position);
      }
    })();
  });

  // 窗口尺寸变化后把越界的悬浮球拉回视口内（本地修正，不覆盖全局存储）
  window.addEventListener("resize", () => {
    if (!fab) return;
    const clamped = clampToViewport(fabPos);
    if (clamped.x !== fabPos.x || clamped.y !== fabPos.y) {
      fabPos = clamped;
      applyFabPosition(fabPos);
    }
  });

  if (document.readyState === "complete") {
    setTimeout(init, 300);
  } else {
    window.addEventListener("load", () => setTimeout(init, 300));
  }
})();
