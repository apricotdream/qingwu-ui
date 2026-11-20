export function createTextNoteMarker(doc: Document, text: string, index: number, label: string) {
  const sup = doc.createElement("sup");
  sup.className = "qw-text-note-sup";
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "qw-text-note-marker";
  button.dataset.note = text;
  button.textContent = String(index);
  button.setAttribute("aria-label", `${label} ${index}`);
  button.setAttribute("aria-expanded", "false");
  sup.append(button);
  return sup;
}

// 此函数也由独立 HTML 导出调用，依赖限于参数和浏览器 DOM API。
export function bindTextNotePreviews(root: HTMLElement, label: string) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win) return () => {};
  const abort = new AbortController();
  const { signal } = abort;
  const bubble = doc.createElement("div");
  bubble.className = "qw-text-note-preview";
  bubble.id = `qw-note-preview-${Math.random().toString(36).slice(2)}`;
  bubble.setAttribute("role", "tooltip");
  bubble.hidden = true;
  const title = doc.createElement("strong");
  const content = doc.createElement("div");
  bubble.append(title, content);
  let marker: HTMLButtonElement | null = null;
  let pinned = false;

  function hide() {
    marker?.setAttribute("aria-expanded", "false");
    marker?.removeAttribute("aria-describedby");
    marker = null;
    pinned = false;
    bubble.hidden = true;
  }

  function position() {
    if (!marker) return;
    if (!root.contains(marker)) {
      hide();
      return;
    }
    const anchor = marker.getBoundingClientRect();
    const bounds = root.getBoundingClientRect();
    const viewport = win?.visualViewport;
    const screenLeft = viewport?.offsetLeft ?? 0;
    const screenTop = viewport?.offsetTop ?? 0;
    const screenRight = screenLeft + (viewport?.width ?? win?.innerWidth ?? 0);
    const screenBottom = screenTop + (viewport?.height ?? win?.innerHeight ?? 0);
    const left = Math.max(bounds.left, screenLeft) + 8;
    const right = Math.min(bounds.right, screenRight) - 8;
    bubble.style.width = `${Math.min(260, Math.max(0, right - left))}px`;
    const center = anchor.left + anchor.width / 2;
    const x = Math.max(left, Math.min(center - 16, right - bubble.offsetWidth));
    const above = anchor.top - screenTop - 18;
    const below = screenBottom - anchor.bottom - 18;
    content.style.maxHeight = "";
    const flip = above < bubble.offsetHeight && below > above;
    content.style.maxHeight = `${Math.max(30, (flip ? below : above) - 45)}px`;
    const y = flip ? anchor.bottom + 10 : anchor.top - bubble.offsetHeight - 10;
    bubble.style.left = `${x}px`;
    bubble.style.top = `${Math.max(screenTop + 8, y)}px`;
    bubble.style.setProperty(
      "--note-tail",
      `${Math.max(8, Math.min(center - x, bubble.offsetWidth - 8))}px`,
    );
    bubble.classList.toggle("qw-text-note-preview--below", flip);
  }

  function show(button: HTMLButtonElement, pin = false) {
    hide();
    marker = button;
    pinned = pin;
    marker.setAttribute("aria-expanded", "true");
    marker.setAttribute("aria-describedby", bubble.id);
    title.textContent = `${label} ${button.textContent}`;
    content.textContent = button.dataset.note ?? "";
    bubble.classList.toggle(
      "qw-text-note-preview--dark",
      !!root.closest(".dark, [data-theme='dark']"),
    );
    bubble.hidden = false;
    if (!bubble.isConnected) doc.body.append(bubble);
    position();
  }

  function target(event: Event) {
    const button = (event.target as Element | null)?.closest?.<HTMLButtonElement>(
      ".qw-text-note-marker",
    );
    return button && root.contains(button) ? button : null;
  }
  root.addEventListener(
    "pointerover",
    (event) => {
      const button = target(event);
      if (button && event.pointerType !== "touch" && !pinned) show(button);
    },
    { signal },
  );
  root.addEventListener(
    "pointerout",
    (event) => {
      if (
        !pinned &&
        marker &&
        target(event) === marker &&
        !bubble.contains(event.relatedTarget as Node | null) &&
        !marker.contains(event.relatedTarget as Node | null)
      )
        hide();
    },
    { signal },
  );
  bubble.addEventListener(
    "pointerleave",
    () => {
      if (!pinned) hide();
    },
    { signal },
  );
  root.addEventListener(
    "focusin",
    (event) => {
      const button = target(event);
      if (button && !pinned) show(button);
    },
    { signal },
  );
  root.addEventListener(
    "focusout",
    (event) => {
      if (!pinned && marker && target(event) === marker) hide();
    },
    { signal },
  );
  root.addEventListener(
    "click",
    (event) => {
      const button = target(event);
      if (!button) return;
      event.preventDefault();
      if (marker === button && pinned) hide();
      else show(button, true);
    },
    { signal },
  );
  doc.addEventListener(
    "pointerdown",
    (event) => {
      if (marker && !target(event) && !bubble.contains(event.target as Node)) hide();
    },
    { signal },
  );
  doc.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") hide();
    },
    { signal },
  );
  win.addEventListener("scroll", position, { capture: true, signal });
  win.addEventListener("resize", position, { signal });
  win.visualViewport?.addEventListener("resize", position, { signal });
  win.visualViewport?.addEventListener("scroll", position, { signal });
  return () => {
    abort.abort();
    hide();
    bubble.remove();
  };
}
