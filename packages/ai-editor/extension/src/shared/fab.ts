/**
 * 剪藏悬浮球全局状态 - content script 与选项页共享的存储键与读写封装。
 *
 * - 总开关（qingwuFabEnabled）：全局启用/禁用，默认启用
 * - 位置（qingwuFabPosition）：全局同一位置，最后拖拽的页面获胜
 * - 隐藏列表（qingwuFabHiddenHosts）：按网站（hostname）记录右键隐藏
 */

export interface FabPosition {
  /** 悬浮球中心点相对视口的 CSS 坐标（fixed 定位锚点） */
  x: number;
  y: number;
}

export const FAB_STORAGE_KEYS = {
  enabled: "qingwuFabEnabled",
  position: "qingwuFabPosition",
  hiddenHosts: "qingwuFabHiddenHosts",
} as const;

export interface FabConfig {
  enabled: boolean;
  position: FabPosition | null;
  hiddenHosts: string[];
}

function isFabPosition(v: unknown): v is FabPosition {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as FabPosition).x === "number" &&
    typeof (v as FabPosition).y === "number" &&
    Number.isFinite((v as FabPosition).x) &&
    Number.isFinite((v as FabPosition).y)
  );
}

export async function getFabConfig(): Promise<FabConfig> {
  try {
    // @types/chrome 0.2.x 的 storage.get 默认返回 Record<string, unknown>，
    // 显式给出值类型避免逐处断言
    const raw = await chrome.storage.local.get<{
      [FAB_STORAGE_KEYS.enabled]?: boolean;
      [FAB_STORAGE_KEYS.position]?: FabPosition;
      [FAB_STORAGE_KEYS.hiddenHosts]?: string[];
    }>([FAB_STORAGE_KEYS.enabled, FAB_STORAGE_KEYS.position, FAB_STORAGE_KEYS.hiddenHosts]);
    // 解构到局部变量：TS 对 computed key（FAB_STORAGE_KEYS.x）属性访问不做类型收窄
    const enabled = raw[FAB_STORAGE_KEYS.enabled];
    const position = raw[FAB_STORAGE_KEYS.position];
    const hiddenHosts = raw[FAB_STORAGE_KEYS.hiddenHosts];
    return {
      enabled: enabled !== false,
      position: isFabPosition(position) ? position : null,
      hiddenHosts: Array.isArray(hiddenHosts)
        ? hiddenHosts.filter((h: unknown): h is string => typeof h === "string")
        : [],
    };
  } catch {
    return { enabled: true, position: null, hiddenHosts: [] };
  }
}

export async function setFabPosition(position: FabPosition): Promise<void> {
  try {
    await chrome.storage.local.set({ [FAB_STORAGE_KEYS.position]: position });
  } catch {
    /* ignore */
  }
}

export async function setFabEnabled(enabled: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ [FAB_STORAGE_KEYS.enabled]: enabled });
  } catch {
    /* ignore */
  }
}

export async function hideFabOnHost(hostname: string): Promise<void> {
  const cfg = await getFabConfig();
  if (cfg.hiddenHosts.includes(hostname)) return;
  try {
    await chrome.storage.local.set({
      [FAB_STORAGE_KEYS.hiddenHosts]: [...cfg.hiddenHosts, hostname],
    });
  } catch {
    /* ignore */
  }
}

export async function showFabOnHost(hostname: string): Promise<void> {
  const cfg = await getFabConfig();
  const next = cfg.hiddenHosts.filter((h) => h !== hostname);
  try {
    await chrome.storage.local.set({ [FAB_STORAGE_KEYS.hiddenHosts]: next });
  } catch {
    /* ignore */
  }
}

export async function clearHiddenHosts(): Promise<void> {
  try {
    await chrome.storage.local.set({ [FAB_STORAGE_KEYS.hiddenHosts]: [] });
  } catch {
    /* ignore */
  }
}

export async function resetFabPosition(): Promise<void> {
  try {
    await chrome.storage.local.remove([FAB_STORAGE_KEYS.position]);
  } catch {
    /* ignore */
  }
}
