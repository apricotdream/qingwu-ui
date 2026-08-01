import type { StorageProvider } from "../index";

export function createLocalStorage(): StorageProvider {
  return {
    name: "浏览器内存 (Base64)",
    type: "local",
    async upload(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(file);
      });
    },
    async remove(_url: string): Promise<void> {},
  };
}
