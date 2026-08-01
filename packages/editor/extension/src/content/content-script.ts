/** 内容脚本：注入网页，提供选区获取、悬浮球与剪藏消息处理（含防重复注入）。 */
const FAB_ICON = chrome.runtime.getURL("icons/icon-32.png");
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
  let hideTimer: number | null = null;
  let toastEl: HTMLDivElement | null = null;
  let toastTimer: number | null = null;

  type ToastType = "info" | "success" | "error";

  function showToast(
    message: string,
    type: ToastType = "info",
    duration = 3000,
    action?: { label: string; onClick: () => void },
  ) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      document.documentElement.appendChild(toastEl);
    }
    toastEl.className = `qingwu-clipper-toast qingwu-clipper-toast--${type} qingwu-clipper-toast--visible`;
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

    if (toastTimer !== null) clearTimeout(toastTimer);
    if (duration > 0) {
      toastTimer = window.setTimeout(() => {
        toastEl?.classList.remove("qingwu-clipper-toast--visible");
      }, duration);
    }
  }

  function ensureFab() {
    if (fab) return;
    document.querySelectorAll(".qingwu-clipper-fab").forEach((el) => el.remove());
    document.querySelectorAll(".qingwu-clipper-toast").forEach((el) => el.remove());

    fab = document.createElement("button");
    fab.type = "button";
    fab.title = "青梧 Web Clipper · 剪藏当前页面 (Alt+Shift+C)";
    fab.setAttribute("aria-label", "青梧 Web Clipper");
    fab.className = "qingwu-clipper-fab";
    fab.innerHTML = `<img src="${FAB_ICON}" alt="青梧" />`;
    fab.addEventListener("click", () => {
      chrome.runtime
        .sendMessage({
          id: crypto.randomUUID(),
          kind: "tab:open-sidepanel",
          payload: null,
        })
        .catch(() => {});
      void clipPageWithToast();
    });
    document.documentElement.appendChild(fab);
  }

  async function clipPageWithToast() {
    showToast("正在剪藏…", "info", 0);
    try {
      const resp = (await chrome.runtime.sendMessage({
        id: crypto.randomUUID(),
        kind: "clip:extract",
        payload: { mode: "page" },
      })) as { ok?: boolean; data?: { title?: string; markdown?: string }; error?: { message?: string; retryable?: boolean } } | undefined;

      if (resp?.ok && resp.data) {
        const title = resp.data.title ? `：${resp.data.title}` : "";
        const md = resp.data.markdown ?? "";
        showToast(`已剪藏${title}，按 Alt+Shift+P 打开侧边栏`, "success", 6000, {
          label: "复制",
          onClick: () => {
            void navigator.clipboard.writeText(md).then(
              () => showToast("已复制 Markdown", "success", 2000),
              () => showToast("复制失败", "error", 2000),
            );
          },
        });
      } else if (resp?.error) {
        const retryHint = resp.error.retryable ? "，可重试" : "";
        showToast(`剪藏失败：${resp.error.message}${retryHint}`, "error", 3000);
      } else {
        showToast("剪藏失败：未收到响应", "error", 3000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "扩展连接异常";
      showToast(`剪藏失败：${message}`, "error", 3000);
    }
  }

  function showFab() {
    ensureFab();
    if (!fab) return;
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    fab.classList.add("qingwu-clipper-fab--visible");
  }

  function hideFabSoon(delay = 1200) {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      fab?.classList.remove("qingwu-clipper-fab--visible");
    }, delay);
  }

  function setupTriggers() {
    document.addEventListener("mousemove", (event) => {
      if (event.clientX > window.innerWidth - 80) {
        showFab();
        hideFabSoon();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.altKey && event.shiftKey && (event.key === "C" || event.key === "c")) {
        showFab();
        hideFabSoon(3000);
      }
    });
  }

  if (document.readyState === "complete") {
    setTimeout(setupTriggers, 300);
  } else {
    window.addEventListener("load", () => setTimeout(setupTriggers, 300));
  }
})();
