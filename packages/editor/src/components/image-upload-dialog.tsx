import { type DragEvent, type FC, useCallback, useRef, useState } from "react";
import { getStorageProvider } from "../editor/storage";
import { toast } from "./toast";

interface ImageUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (url: string) => void;
  /** 上传前校验回调（单文件/总大小限制），返回错误消息则拒绝上传；缺省时回退硬编码 20MB 限制 */
  validate?: (file: File) => string | null;
}

type Tab = "upload" | "url";

export const ImageUploadDialog: FC<ImageUploadDialogProps> = ({ open, onClose, onInsert, validate }) => {
  const [tab, setTab] = useState<Tab>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const storageInfo = (() => {
    try {
      const info = getStorageProvider();
      return { name: info.name, type: info.type };
    } catch {
      return { name: "未配置", type: "none" };
    }
  })();

  const reset = useCallback(() => {
    setDragOver(false);
    setError(null);
    setPreview(null);
    setUploadedUrl(null);
    setUrlInput("");
    setUploading(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const uploadFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
    if (!ext || !allowed.includes(ext)) {
      setError(`不支持的图片格式: ${ext || "未知"}`);
      return;
    }
    // 优先使用宿主编译期校验（单文件/总大小限制）；缺省回退原硬编码 20MB
    const limitErr = validate
      ? validate(file)
      : file.size > 20 * 1024 * 1024
        ? "图片大小不能超过 20MB"
        : null;
    if (limitErr) {
      setError(limitErr);
      toast(limitErr);
      return;
    }

    setUploading(true);
    setError(null);

    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    try {
      const storage = getStorageProvider();
      const url = await storage.upload(file);
      // 上传成功后释放本地 blob 预览 URL，改用远端 URL
      URL.revokeObjectURL(previewUrl);
      setUploadedUrl(url);
      setPreview(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
      URL.revokeObjectURL(previewUrl);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, [validate]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) uploadFile(file);
          return;
        }
      }
    },
    [uploadFile],
  );

  const handleUrlInsert = useCallback(() => {
    if (!urlInput.trim()) return;
    onInsert(urlInput.trim());
    handleClose();
  }, [urlInput, onInsert, handleClose]);

  const handleUploadedInsert = useCallback(() => {
    if (uploadedUrl) {
      onInsert(uploadedUrl);
      handleClose();
    }
  }, [uploadedUrl, onInsert, handleClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* 弹窗 */}
      <div
        className="relative w-[calc(100vw-32px)] max-w-[420px] max-h-[90vh] bg-background rounded-2xl shadow-2xl border border-default-200 overflow-hidden animate-in"
        onPaste={tab === "upload" ? handlePaste : undefined}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-default-100">
          <h2 className="text-base font-semibold">插入图片</h2>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-default-400 hover:text-default-600 hover:bg-default-100 transition-colors"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-default-100 px-5">
          {(["upload", "url"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-default-400 hover:text-default-600"
              }`}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
            >
              {t === "upload" ? "上传图片" : "图片链接"}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="p-5">
          {tab === "upload" ? (
            <div className="space-y-4">
              {/* 存储服务商信息 */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-default-50 text-xs text-default-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                存储服务：{storageInfo.name}
              </div>

              {/* 拖拽/点击上传区域 */}
              {!preview && (
                <div
                  className={`relative flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                    dragOver
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-default-200 hover:border-default-300 hover:bg-default-50"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="w-14 h-14 rounded-full bg-default-100 flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-default-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-default-700">
                      {dragOver ? "松开放入" : "拖拽图片到此处"}
                    </p>
                    <p className="text-xs text-default-400 mt-1">或点击选择文件 · 支持粘贴图片</p>
                    <p className="text-[10px] text-default-300 mt-1">
                      PNG / JPG / GIF / WebP / AVIF · 最大 20MB
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              )}

              {/* 预览 + 上传进度 */}
              {preview && (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-default-100">
                    <img src={preview} alt="预览" className="w-full max-h-48 object-contain" />
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span className="text-white text-xs">上传中…</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {uploadedUrl && !uploading && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-xs text-green-700">
                      <svg
                        className="w-4 h-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      上传成功，已存储至 {storageInfo.name}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-40 transition-opacity"
                      disabled={!uploadedUrl || uploading}
                      onClick={handleUploadedInsert}
                    >
                      插入图片
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl border border-default-200 text-sm hover:bg-default-50 transition-colors"
                      onClick={reset}
                      disabled={uploading}
                    >
                      重新选择
                    </button>
                  </div>
                </div>
              )}

              {/* 错误提示 */}
              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger-50 text-sm text-danger">
                  <svg
                    className="w-4 h-4 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* URL 输入 */
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-default-500 mb-1.5">图片链接地址</label>
                <input
                  type="url"
                  className="w-full px-3 py-2.5 rounded-xl border border-default-200 bg-background text-sm focus:outline-none focus:border-primary transition-colors"
                  placeholder="https://example.com/image.png"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUrlInsert();
                  }}
                />
              </div>

              {urlInput && (
                <div className="rounded-xl overflow-hidden bg-default-100">
                  <img
                    src={urlInput}
                    alt="预览"
                    className="w-full max-h-40 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}

              <button
                type="button"
                className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-40 transition-opacity"
                disabled={!urlInput.trim()}
                onClick={handleUrlInsert}
              >
                插入图片
              </button>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-5 py-3 border-t border-default-100 text-[11px] text-default-300 text-center">
          图片将上传至 {storageInfo.name}
        </div>
      </div>
    </div>
  );
};
