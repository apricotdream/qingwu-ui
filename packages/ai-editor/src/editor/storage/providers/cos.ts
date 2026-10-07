import type { StorageProvider } from "../index";
import { createS3Storage } from "./s3";

interface COSConfig {
  region: string;
  bucket: string;
  secretId: string;
  secretKey: string;
  customDomain?: string;
  uploadPrefix?: string;
  nameTemplate?: string;
}

/**
 * 腾讯云 COS 存储提供商
 *
 * @deprecated 腾讯云 COS 完整兼容 S3 协议，请直接使用 `createS3Storage`：
 *
 * ```ts
 * createS3Storage({
 *   endpoint: `https://cos.${region}.myqcloud.com`,
 *   bucket, region, accessKeyId: secretId, secretAccessKey: secretKey,
 *   customDomain, uploadPrefix, nameTemplate,
 * })
 * ```
 *
 * 兼容旧 API 保留，内部转调 createS3Storage；历史实现无鉴权头，私有桶返回 403。
 * 注意：bucket 需含 `<name>-<appid>` 后缀。
 */
export function createCOSStorage(config: COSConfig): StorageProvider {
  return createS3Storage({
    endpoint: `https://cos.${config.region}.myqcloud.com`,
    bucket: config.bucket,
    region: config.region,
    accessKeyId: config.secretId,
    secretAccessKey: config.secretKey,
    customDomain: config.customDomain,
    uploadPrefix: config.uploadPrefix,
    nameTemplate: config.nameTemplate,
  });
}
