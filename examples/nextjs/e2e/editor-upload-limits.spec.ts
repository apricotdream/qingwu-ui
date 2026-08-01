import { expect, test } from "@playwright/test";

// 编辑器演示页含长 README 内容，Next dev 按需编译可能较慢
test.setTimeout(90_000);

const MB = 1024 * 1024;

/**
 * 在编辑器上派发 drop 事件（携带指定大小的文件）。
 * 注意：坐标必须落在编辑器元素内——prosemirror 的 handleDrop 在调用
 * 插件 handleDrop 前先做 posAtCoords，坐标在编辑器外会提前 return。
 */
async function dropFile(page: import("@playwright/test").Page, sizeMB: number, name: string) {
  await page.evaluate(
    ({ size, fileName }) => {
      const dt = new DataTransfer();
      const blob = new Blob([new ArrayBuffer(size)], { type: "application/octet-stream" });
      dt.items.add(new File([blob], fileName, { type: "application/octet-stream" }));
      const el = document.querySelector(".ProseMirror") as HTMLElement;
      const rect = el.getBoundingClientRect();
      const ev = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      });
      el.dispatchEvent(ev);
    },
    { size: sizeMB * MB, fileName: name },
  );
}

test("AI Editor 演示页：单文件超限被拦截并 toast 提示，不插入占位", async ({ page }) => {
  await page.goto("/demo/editor");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(1500); // 等待编辑器事件处理与 React 副作用就绪

  // 60MB > 单文件 50MB 限制
  await dropFile(page, 60, "big.bin");

  await expect(page.getByText(/单文件大小不能超过 50 MB/)).toBeVisible();
  // 文档中不应出现附件节点（attachment-embed 容器）
  expect(await page.locator(".attachment-embed").count()).toBe(0);
});

test("AI Editor 演示页：附件总大小超限被拦截并 toast 提示", async ({ page }) => {
  await page.goto("/demo/editor");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(1500); // 等待编辑器事件处理与 React 副作用就绪

  // 40MB + 40MB 通过；第三个 40MB 使总大小 120MB > 100MB 限制
  await dropFile(page, 40, "a.bin");
  await expect(page.locator(".attachment-embed")).toHaveCount(1);
  await dropFile(page, 40, "b.bin");
  await expect(page.locator(".attachment-embed")).toHaveCount(2);
  await dropFile(page, 40, "c.bin");

  await expect(page.getByText(/附件总大小不能超过 100 MB/)).toBeVisible();
  expect(await page.locator(".attachment-embed").count()).toBe(2);
});

test("AI Editor 演示页：切换单文件上限后即时生效", async ({ page }) => {
  await page.goto("/demo/editor");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60000 });

  // 切换单文件上限 50MB → 10MB
  await page.getByLabel("单文件上限").selectOption({ label: "10 MB" });
  await expect(page.getByText(/单文件 ≤ 10 MB/)).toBeVisible();

  // 20MB 超新限制 → 拦截，不插入
  await dropFile(page, 20, "mid.bin");
  await expect(page.getByText(/单文件大小不能超过 10 MB/)).toBeVisible();
  expect(await page.locator(".attachment-embed").count()).toBe(0);
});

test("AI Editor 演示页：切换总大小上限后即时生效", async ({ page }) => {
  await page.goto("/demo/editor");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60000 });

  // 切换总大小上限 100MB → 50MB
  await page.getByLabel("总大小上限").selectOption({ label: "50 MB" });
  await expect(page.getByText(/文档附件总大小 ≤ 50 MB/)).toBeVisible();

  // 第一个 40MB 通过并插入
  await dropFile(page, 40, "a.bin");
  await expect(page.locator(".attachment-embed")).toHaveCount(1);
  // 第二个 40MB 使总大小 80MB > 50MB → 拦截
  await dropFile(page, 40, "b.bin");
  await expect(page.getByText(/附件总大小不能超过 50 MB/)).toBeVisible();
  expect(await page.locator(".attachment-embed").count()).toBe(1);
});
