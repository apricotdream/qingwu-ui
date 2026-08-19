import type { StorageProvider } from "../index";
import { createS3Storage } from "./s3";

interface OSSConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  customDomain?: string;
  uploadPrefix?: string;
  nameTemplate?: string;
}

/**
 * 阿里云 OSS 存储提供商
 *
 * @deprecated 阿里云 OSS 完整兼容 S3 协议，请直接使用 `createS3Storage`：
 *
 * ```ts
 * createS3Storage({
 *   endpoint: `https://${bucket}.${region}.aliyuncs.com`,
 *   bucket, region, accessKeyId, secretAccessKey: accessKeySecret,
 *   customDomain, uploadPrefix, nameTemplate,
 * })
 * ```
 *
 * 兼容旧 API 保留，内部转调 createS3Storage；历史实现仅设 `x-oss-access-key-id` 头而无签名，私有桶返回 403。
 */
export function createOSSStorage(config: OSSConfig): StorageProvider {
  return createS3Storage({
    endpoint: `https://${config.bucket}.${config.region}.aliyuncs.com`,
    bucket: config.bucket,
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.accessKeySecret,
    customDomain: config.customDomain,
    uploadPrefix: config.uploadPrefix,
    nameTemplate: config.nameTemplate,
  });
}
