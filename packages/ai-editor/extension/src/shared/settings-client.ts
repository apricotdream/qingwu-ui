/**
 * 页面侧配置读取 —— 带冷启动重试。
 *
 * SW 冷启动/被回收的瞬间，settings:get 可能无应答（messaging 层会显式报错）。
 * 这里重试数次后再抛出，由页面决定错误态展示。
 * 禁止静默回退 defaultSettings()：若用户已有真实配置，回退后再保存会将其覆盖。
 */

import { send } from "./messaging";
import type { ClipperSettings } from "./types";

export async function getSettingsWithRetry(
  attempts = 3,
  delayMs = 300,
): Promise<ClipperSettings> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await send<ClipperSettings>("settings:get");
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
