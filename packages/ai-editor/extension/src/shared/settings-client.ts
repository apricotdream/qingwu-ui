/** 页面侧配置读取 - settings:get 带冷启动重试；禁止静默回退默认值，否则会覆盖用户真实配置 */

import { send } from "./messaging";
import { defaultSettings } from "./storage/db";
import type { ClipperSettings } from "./types";

export async function getSettingsWithRetry(attempts = 3, delayMs = 300): Promise<ClipperSettings> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await send<ClipperSettings>("settings:get");
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  try {
    const cached = await chrome.storage.local.get<{ settings?: ClipperSettings }>("settings");
    if (cached.settings) return cached.settings;
  } catch {
    // ignore: fallback to defaults when extension storage is unavailable
  }
  const fallback = defaultSettings();
  if (fallback.ai?.kind === "deepseek") {
    fallback.ai = { ...fallback.ai, model: "deepseek-v4-flash" };
  }
  return fallback;
}
