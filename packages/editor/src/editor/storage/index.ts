export interface StorageProvider {
  readonly name: string;
  readonly type: StorageProviderType;
  upload(file: File): Promise<string>;
  remove(url: string): Promise<void>;
}

export type StorageProviderType = "local" | "oss" | "cos" | "s3" | "custom";

// ---- 存储配置持久化 ----

export interface LocalStorageConfig {
  type: "local";
  /** 本地存储的描述 */
  location: string;
}

export interface OSSStorageConfig {
  type: "oss";
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  customDomain?: string;
  uploadPrefix?: string;
  nameTemplate?: string;
}

export interface COSStorageConfig {
  type: "cos";
  region: string;
  bucket: string;
  secretId: string;
  secretKey: string;
  customDomain?: string;
  uploadPrefix?: string;
  nameTemplate?: string;
}

export interface S3StorageConfig {
  type: "s3";
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  customDomain?: string;
  uploadPrefix?: string;
  nameTemplate?: string;
}

export type StorageConfig =
  | LocalStorageConfig
  | OSSStorageConfig
  | COSStorageConfig
  | S3StorageConfig;

const STORAGE_CONFIG_KEY = "qingwu_storage_config";
// 安全增强：密钥不再长期持久化到 localStorage，改用 sessionStorage
// 关闭标签页后自动清除，降低 XSS 窃取密钥的窗口期
const STORAGE_CONFIG_SESSION_KEY = "qingwu_storage_config_session";

// ---- 单例管理 ----

let currentProvider: StorageProvider | null = null;
let currentConfig: StorageConfig | null = null;

/** 设置存储提供商 */
export function setStorageProvider(provider: StorageProvider, config?: StorageConfig) {
  currentProvider = provider;
  if (config) {
    currentConfig = config;
    try {
      sessionStorage.setItem(STORAGE_CONFIG_SESSION_KEY, JSON.stringify(config));
    } catch {
      // sessionStorage 不可用时忽略
    }
  }
}

/** 获取存储提供商 */
export function getStorageProvider(): StorageProvider {
  if (!currentProvider) {
    throw new Error(
      "未配置存储服务。请调用 setStorageProvider() 设置。\n" +
        "支持: 本地存储 / 阿里云 OSS / 腾讯云 COS",
    );
  }
  return currentProvider;
}

/** 获取当前存储信息 */
export function getStorageInfo(): {
  name: string;
  type: StorageProviderType;
  config: StorageConfig | null;
} | null {
  if (!currentProvider) return null;
  return {
    name: currentProvider.name,
    type: currentProvider.type,
    config: currentConfig,
  };
}

/**
 * 从 sessionStorage 恢复上次的存储配置
 * 兼容旧 localStorage 配置：首次读取时自动迁移到 sessionStorage 并删除 localStorage 中的副本
 */
export function loadStorageConfig(): StorageConfig | null {
  try {
    const sessionRaw = sessionStorage.getItem(STORAGE_CONFIG_SESSION_KEY);
    if (sessionRaw) return JSON.parse(sessionRaw) as StorageConfig;
    // 旧 localStorage 配置迁移：读到 sessionStorage 后立即删除
    const localRaw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (localRaw) {
      try {
        sessionStorage.setItem(STORAGE_CONFIG_SESSION_KEY, localRaw);
      } catch {
        /* sessionStorage 不可用，继续返回配置 */
      }
      localStorage.removeItem(STORAGE_CONFIG_KEY);
      return JSON.parse(localRaw) as StorageConfig;
    }
  } catch {
    // ignore
  }
  return null;
}

export {
  registerS3PreviewConfig,
  signPreviewUrl,
  signPreviewUrlHeaders,
  signUrl,
} from "./signed-fetch";
export { currentConfig };
