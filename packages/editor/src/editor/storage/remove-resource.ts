import { getStorageProvider } from "./index";

export async function removeStoredResource(src: string): Promise<void> {
  if (!src) return;

  if (src.startsWith("blob:")) {
    URL.revokeObjectURL(src);
    return;
  }

  try {
    await getStorageProvider().remove(src);
  } catch (error) {
    console.warn("删除存储资源失败:", error);
  }
}

export function deleteNodeWithResource(src: string, deleteNode?: () => void): void {
  void removeStoredResource(src);
  deleteNode?.();
}
