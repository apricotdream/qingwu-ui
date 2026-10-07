import { expect, test } from "@playwright/test";

// 编辑器演示页含长 README 内容，Next dev 按需编译可能较慢
test.setTimeout(90_000);

test("AI Editor 演示页：限制面板与编辑器渲染", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/demo/editor");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("附件上传限制", { exact: true })).toBeVisible();
  await expect(page.getByText(/单文件 ≤ 50 MB/)).toBeVisible();
  await expect(page.getByText(/文档附件总大小 ≤ 100 MB/)).toBeVisible();
  await expect(page.getByText("选择文件测试")).toBeVisible();
  expect(errors).toEqual([]);
});
