import { type FC, useCallback, useEffect, useState } from "react";
import {
  getStorageInfo,
  loadStorageConfig,
  registerS3PreviewConfig,
  setStorageProvider,
} from "../editor/storage";
import { createLocalStorage } from "../editor/storage/providers/local";
import { createS3Storage } from "../editor/storage/providers/s3";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ProviderTab = "local" | "s3";

const PROVIDER_TABS: Array<{ key: ProviderTab; label: string; icon: string }> = [
  { key: "local", label: "本地", icon: "💻" },
  { key: "s3", label: "S3 对象存储", icon: "☁️" },
];

export const StorageSettingsDialog: FC<Props> = ({ open, onClose }) => {
  const info = getStorageInfo();
  const [tab, setTab] = useState<ProviderTab>(info?.type === "local" ? "local" : "s3");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testToast, setTestToast] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  // S3 表单
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Region, setS3Region] = useState("auto");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3Domain, setS3Domain] = useState("");
  const [s3UploadPrefix, setS3UploadPrefix] = useState("qingwu");
  const [s3NameTemplate, setS3NameTemplate] = useState("{timestamp}-{timezone}-{filename}.{ext}");

  // 恢复已保存的 S3 配置
  useEffect(() => {
    const saved = loadStorageConfig();
    if (saved?.type === "s3") {
      setS3Endpoint(saved.endpoint || "");
      setS3Bucket(saved.bucket || "");
      setS3Region(saved.region || "auto");
      setS3AccessKey(saved.accessKeyId || "");
      setS3SecretKey(saved.secretAccessKey || "");
      setS3Domain(saved.customDomain || "");
      setS3UploadPrefix(saved.uploadPrefix || "qingwu");
      setS3NameTemplate(saved.nameTemplate || "{timestamp}-{timezone}-{filename}.{ext}");
      setTab("s3");
    } else if (saved?.type === "oss") {
      // 兼容旧 OSS 配置 → 转为 S3 endpoint
      setS3Endpoint(`https://${saved.bucket}.${saved.region}.aliyuncs.com`);
      setS3Bucket(saved.bucket || "");
      setS3Region(saved.region || "oss-cn-hangzhou");
      setS3AccessKey(saved.accessKeyId || "");
      setS3SecretKey(saved.accessKeySecret || "");
      setS3Domain(saved.customDomain || "");
      setS3UploadPrefix(saved.uploadPrefix || "qingwu");
      setS3NameTemplate(saved.nameTemplate || "{timestamp}-{timezone}-{filename}.{ext}");
      setTab("s3");
    } else if (saved?.type === "cos") {
      // 兼容旧 COS 配置 → 转为 S3 endpoint
      setS3Endpoint(`https://${saved.bucket}.cos.${saved.region}.myqcloud.com`);
      setS3Bucket(saved.bucket || "");
      setS3Region(saved.region || "ap-guangzhou");
      setS3AccessKey(saved.secretId || "");
      setS3SecretKey(saved.secretKey || "");
      setS3Domain(saved.customDomain || "");
      setS3UploadPrefix(saved.uploadPrefix || "qingwu");
      setS3NameTemplate(saved.nameTemplate || "{timestamp}-{timezone}-{filename}.{ext}");
      setTab("s3");
    }
  }, []);

  useEffect(() => {
    if (!testToast) return;
    const timer = window.setTimeout(() => setTestToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [testToast]);

  const handleSaveLocal = useCallback(() => {
    setTestToast(null);
    const provider = createLocalStorage();
    setStorageProvider(provider, {
      type: "local",
      location: "浏览器内存 (Base64 编码)",
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  }, [onClose]);

  const handleTestLocal = useCallback(async () => {
    if (testing) return;
    setTesting(true);
    setTestToast(null);
    try {
      const provider = createLocalStorage();
      const file = new File(["qingwu storage test"], "qingwu-storage-test.txt", {
        type: "text/plain",
      });
      const url = await provider.upload(file);
      await provider.remove(url).catch(() => {});
      setTestToast({ type: "success", message: "本地存储可用" });
    } catch (e) {
      setTestToast({ type: "error", message: e instanceof Error ? e.message : "本地存储测试失败" });
    } finally {
      setTesting(false);
    }
  }, [testing]);

  const handleSaveS3 = useCallback(() => {
    if (!s3Endpoint || !s3Bucket || !s3AccessKey) return;
    setTestToast(null);
    const s3Opts = {
      endpoint: s3Endpoint,
      bucket: s3Bucket,
      region: s3Region,
      accessKeyId: s3AccessKey,
      secretAccessKey: s3SecretKey,
      customDomain: s3Domain || undefined,
      uploadPrefix: s3UploadPrefix || "qingwu",
      nameTemplate: s3NameTemplate || "{timestamp}-{timezone}-{filename}.{ext}",
    };
    const provider = createS3Storage(s3Opts);
    setStorageProvider(provider, {
      type: "s3",
      endpoint: s3Endpoint,
      bucket: s3Bucket,
      region: s3Region,
      accessKeyId: s3AccessKey,
      secretAccessKey: s3SecretKey,
      customDomain: s3Domain || undefined,
      uploadPrefix: s3UploadPrefix || "qingwu",
      nameTemplate: s3NameTemplate || "{timestamp}-{timezone}-{filename}.{ext}",
    });
    registerS3PreviewConfig(s3Opts);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  }, [
    s3Endpoint,
    s3Bucket,
    s3Region,
    s3AccessKey,
    s3SecretKey,
    s3Domain,
    s3UploadPrefix,
    s3NameTemplate,
    onClose,
  ]);

  const handleTestS3 = useCallback(async () => {
    if (!s3Endpoint || !s3Bucket || !s3AccessKey || testing) return;
    setTesting(true);
    setTestToast(null);
    let uploadedUrl = "";
    try {
      const provider = createS3Storage({
        endpoint: s3Endpoint,
        bucket: s3Bucket,
        region: s3Region,
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
        customDomain: s3Domain || undefined,
      });
      const file = new File(["qingwu storage test"], "qingwu-storage-test.txt", {
        type: "text/plain",
      });
      uploadedUrl = await provider.upload(file);
      // 先尝试公开访问
      let accessOk = false;
      let privateAccess = false;
      try {
        const readResponse = await fetch(uploadedUrl, { method: "GET" });
        accessOk = readResponse.ok;
      } catch {
        accessOk = false;
      }
      // 公开访问失败时尝试签名访问（私有桶）
      if (!accessOk) {
        try {
          const { signPreviewUrlHeaders } = await import("../editor/storage/signed-fetch");
          const { registerS3PreviewConfig } = await import("../editor/storage/signed-fetch");
          registerS3PreviewConfig({
            endpoint: s3Endpoint,
            bucket: s3Bucket,
            region: s3Region,
            accessKeyId: s3AccessKey,
            secretAccessKey: s3SecretKey,
            customDomain: s3Domain || undefined,
          });
          const headers = await signPreviewUrlHeaders(uploadedUrl);
          if (headers) {
            const signedResp = await fetch(uploadedUrl, { headers });
            if (signedResp.ok) {
              accessOk = true;
              privateAccess = true;
            }
          }
        } catch {
          /* signed access also failed */
        }
      }
      if (!accessOk) {
        throw new Error(`上传成功，但访问失败。请确认 Bucket 读写权限配置正确。`);
      }
      setTestToast({
        type: "success",
        message: privateAccess
          ? "存储连接成功（私有桶，通过签名访问）"
          : "存储连接和公开访问均成功",
      });
    } catch (e) {
      setTestToast({ type: "error", message: e instanceof Error ? e.message : "存储连接失败" });
    } finally {
      if (uploadedUrl) {
        const provider = createS3Storage({
          endpoint: s3Endpoint,
          bucket: s3Bucket,
          region: s3Region,
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey,
          customDomain: s3Domain || undefined,
        });
        await provider.remove(uploadedUrl).catch(() => {});
      }
      setTesting(false);
    }
  }, [s3Endpoint, s3Bucket, s3Region, s3AccessKey, s3SecretKey, s3Domain, testing]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {testToast && (
        <div
          className={`fixed right-4 top-4 z-[10001] w-[calc(100vw-32px)] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-sm ${
            testToast.type === "success"
              ? "border-green-200 bg-green-50/95 text-green-700"
              : "border-danger-200 bg-danger-50/95 text-danger"
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">{testToast.type === "success" ? "✓" : "!"}</span>
            <span className="min-w-0 break-words">{testToast.message}</span>
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[calc(100vw-32px)] max-w-[460px] max-h-[85vh] bg-background rounded-2xl shadow-2xl border border-default-200 overflow-hidden animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-default-100">
          <h2 className="text-base font-semibold">存储设置</h2>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-default-400 hover:text-default-600 hover:bg-default-100 transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Current status */}
        {info && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-default-50 border border-default-100">
            <div className="flex items-center gap-2 text-xs text-default-500 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              当前存储服务
            </div>
            <div className="text-sm font-medium">{info.name}</div>
            <div className="text-[11px] text-default-400 mt-0.5">
              {info.type === "local"
                ? "位置：浏览器内存 · Base64 编码 · 关闭页面后丢失"
                : info.type === "s3" && info.config?.type === "s3"
                  ? `${info.config.endpoint} · ${info.config.bucket}${info.config.customDomain ? ` → ${info.config.customDomain}` : ""}`
                  : ""}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-default-100 px-5 mt-4">
          {PROVIDER_TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-default-400 hover:text-default-600"
              }`}
              onClick={() => {
                setTab(key);
                setSaved(false);
              }}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Forms */}
        <div className="p-5 max-h-[50vh] overflow-y-auto">
          {tab === "local" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-sm font-medium text-blue-800 mb-1">💻 浏览器内存存储</p>
                <p className="text-xs text-blue-600 leading-relaxed">
                  文件以 Base64 编码存储在浏览器内存中，页面关闭后清除。
                  适合演示和临时使用，不建议用于生产环境。
                </p>
              </div>
              <button
                type="button"
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                  saved ? "bg-green-500 text-white" : "bg-primary text-white hover:opacity-90"
                }`}
                onClick={handleSaveLocal}
              >
                {saved ? "✓ 已保存" : "使用本地存储"}
              </button>
              <button
                type="button"
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-default-200 hover:bg-default-100 transition-all disabled:opacity-40"
                disabled={testing}
                onClick={handleTestLocal}
              >
                {testing ? "测试中..." : "测试连接"}
              </button>
            </div>
          )}

          {tab === "s3" && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-default-50 text-xs text-default-500 leading-relaxed mb-1">
                兼容 AWS S3、Cloudflare R2、MinIO、阿里云 OSS、腾讯云 COS 等所有 S3
                协议对象存储服务。
              </div>
              <div>
                <label className="block text-xs text-default-500 mb-1">Endpoint *</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
                  placeholder="https://<account>.r2.cloudflarestorage.com"
                  value={s3Endpoint}
                  onChange={(e) => setS3Endpoint(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-default-500 mb-1">Bucket 名称 *</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
                  placeholder="my-bucket"
                  value={s3Bucket}
                  onChange={(e) => setS3Bucket(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-default-500 mb-1">Region</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
                  placeholder="auto / us-east-1 / ap-northeast-1"
                  value={s3Region}
                  onChange={(e) => setS3Region(e.target.value)}
                />
                <p className="text-[11px] text-default-400 mt-0.5">
                  R2 / MinIO 填 <code>auto</code>，AWS 按实际区域填写
                </p>
              </div>
              <div>
                <label className="block text-xs text-default-500 mb-1">Access Key ID *</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  value={s3AccessKey}
                  onChange={(e) => setS3AccessKey(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-default-500 mb-1">Secret Access Key</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
                  placeholder="••••••••"
                  value={s3SecretKey}
                  onChange={(e) => setS3SecretKey(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-default-500 mb-1">
                  自定义访问域名（CDN，可选）
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
                  placeholder="cdn.example.com"
                  value={s3Domain}
                  onChange={(e) => setS3Domain(e.target.value)}
                />
                <p className="text-[11px] text-default-400 mt-0.5">
                  设置后，上传返回的资源 URL 将使用此域名
                </p>
              </div>
              <div>
                <label className="block text-xs text-default-500 mb-1">资源目录</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
                  placeholder="qingwu"
                  value={s3UploadPrefix}
                  onChange={(e) => setS3UploadPrefix(e.target.value)}
                />
                <p className="text-[11px] text-default-400 mt-0.5">
                  上传文件的存储目录，默认 qingwu（MinIO/S3 路径风格需填 bucket 名）
                </p>
              </div>
              <div>
                <label className="block text-xs text-default-500 mb-1">文件名模板</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-default-200 bg-background text-sm focus:outline-none focus:border-primary"
                  placeholder="{timestamp}-{timezone}-{filename}.{ext}"
                  value={s3NameTemplate}
                  onChange={(e) => setS3NameTemplate(e.target.value)}
                />
                <p className="text-[11px] text-default-400 mt-0.5">
                  {
                    "占位符: {timestamp}=时间戳, {timezone}=时区, {random}=随机ID, {ext}=扩展名, {filename}=原文件名"
                  }
                </p>
              </div>
              <div className="p-3 rounded-lg bg-default-50 text-[11px] text-default-500 leading-relaxed">
                上传路径：
                {s3Endpoint && s3Bucket
                  ? `${s3Endpoint}/${s3Bucket}/qingwu/...`
                  : "请填写 Endpoint 和 Bucket"}
                {s3Domain ? `\n访问域名：https://${s3Domain}/qingwu/...` : ""}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="py-2.5 rounded-xl text-sm font-medium border border-default-200 hover:bg-default-100 transition-all disabled:opacity-40"
                  disabled={!s3Endpoint || !s3Bucket || !s3AccessKey || testing}
                  onClick={handleTestS3}
                >
                  {testing ? "测试中..." : "测试连接"}
                </button>
                <button
                  type="button"
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 ${
                    saved ? "bg-green-500 text-white" : "bg-primary text-white hover:opacity-90"
                  }`}
                  disabled={!s3Endpoint || !s3Bucket || !s3AccessKey || testing}
                  onClick={handleSaveS3}
                >
                  {saved ? "✓ 已保存" : "保存并应用"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
