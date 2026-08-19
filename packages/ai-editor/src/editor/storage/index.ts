export interface StorageProvider {
  readonly name: string;
  readonly type: StorageProviderType;
  /** 上传；source 默认 "editor"，可传业务语义，供 nameTemplate 的 {src} 占位符使用 */
  upload(file: File, source?: string): Promise<string>;
  remove(url: string): Promise<void>;
  /** 判断 URL 是否属宿主存储；实现后本地引用扫描视为"已上传站内资源"，避免相对路径契约误判 */
  owns?(url: string): boolean;
}

export type StorageProviderType = "local" | "oss" | "cos" | "s3" | "custom";

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
// 密钥只存 sessionStorage，关标签即清，降低 XSS 窃取窗口
const STORAGE_CONFIG_SESSION_KEY = "qingwu_storage_config_session";

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

/** 生成 URL 归属判定：提供商实现 owns 时返回其包装，否则恒 false（保持原判定行为） */
export function ownedUrlChecker(): (src: string) => boolean {
  const p = currentProvider;
  if (!p || typeof p.owns !== "function") return () => false;
  return (src: string) => p.owns!(src);
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

/** 从 sessionStorage 恢复配置；兼容旧 localStorage 配置并自动迁移 */
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
