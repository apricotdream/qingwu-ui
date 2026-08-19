/** MD 导入选择弹窗（纯 DOM）：window.confirm 的替代，拖入 MD 时选「渲染 / 附加 / 取消」；全 textContent 防 XSS */

export type MdImportChoice = "render" | "attach" | null;

export function openImportChoiceDialog(filename: string): Promise<MdImportChoice> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className =
      "fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm select-none";

    const panel = document.createElement("div");
    panel.className =
      "bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-xl max-w-sm w-full mx-4 border border-default-200 relative overflow-hidden";

    const title = document.createElement("div");
    title.className = "text-sm font-medium text-default-800 dark:text-zinc-100 mb-2";
    title.textContent = "导入 Markdown";

    const msg = document.createElement("div");
    msg.className = "text-xs text-default-500 dark:text-zinc-400 mb-4 whitespace-pre-line";
    msg.textContent = `将 "${filename}" 渲染到编辑器，还是作为附件附加？`;

    const btnRow = document.createElement("div");
    btnRow.className = "flex justify-end gap-2";

    const close = (value: MdImportChoice) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(value);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(null);
    };
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close(null);
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className =
      "px-3 py-1.5 text-xs rounded-lg border border-default-200 hover:bg-default-100 transition-colors";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => close(null));

    const attachBtn = document.createElement("button");
    attachBtn.type = "button";
    attachBtn.className =
      "px-3 py-1.5 text-xs rounded-lg border border-default-200 hover:bg-default-100 transition-colors";
    attachBtn.textContent = "附加";
    attachBtn.addEventListener("click", () => close("attach"));

    const renderBtn = document.createElement("button");
    renderBtn.type = "button";
    renderBtn.className =
      "px-3 py-1.5 text-xs rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors";
    renderBtn.textContent = "渲染";
    renderBtn.addEventListener("click", () => close("render"));

    btnRow.append(cancelBtn, attachBtn, renderBtn);
    panel.append(title, msg, btnRow);
    overlay.appendChild(panel);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  });
}
