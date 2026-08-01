import { expect, type Page, test } from "@playwright/test";

/** 1x1 透明 PNG */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
/** 约 2.2 MB 的 PNG（超出 1 MB 单张限制） */
const PNG_BIG = Buffer.concat([PNG_1PX, Buffer.alloc(2 * 1024 * 1024)]);

async function selectFile(page: Page, buffer: Buffer, name = "sample.png", mime = "image/png") {
  await page.setInputFiles('input[type="file"]', { name, mimeType: mime, buffer });
}

/** 等待页面上全部上传项进入指定状态，返回项数 */
async function waitAllItems(page: Page, status: "success" | "error", count: number) {
  await expect
    .poll(() => page.locator(`.qw-upload-item.is-${status}`).count(), { timeout: 15_000 })
    .toBe(count);
}

test.describe("Upload 组件演示页", () => {
  test("页面加载后渲染拖拽区", async ({ page }) => {
    await page.goto("/demo/upload");
    await expect(page.locator(".qw-upload-dropzone")).toBeVisible();
    await expect(page.locator(".qw-upload-dropzone")).toContainText("拖拽图片到此处");
  });

  test("默认配置上传 PNG：压缩产出原图 + WebP + AVIF 三份，全部完成", async ({ page }) => {
    await page.goto("/demo/upload");
    await selectFile(page, PNG_1PX);

    // 压缩 + 模拟上传后三份上传项全部 success
    await waitAllItems(page, "success", 3);
    const tags = await page.locator(".qw-upload-item .qw-upload-tag").allTextContents();
    expect(tags).toEqual(expect.arrayContaining(["原图", "WebP", "AVIF"]));
    // 操作日志记录开始与完成
    await expect(page.locator(".cal-log-item").last()).toContainText("完成");
  });

  test("关闭压缩后仅上传一份原图", async ({ page }) => {
    await page.goto("/demo/upload");
    await page.selectOption("select >> nth=1", "false"); // 压缩：关闭
    await page.getByRole("button", { name: "应用配置" }).click();
    await selectFile(page, PNG_1PX);

    await waitAllItems(page, "success", 1);
    await expect(page.locator(".qw-upload-tag")).toContainText("原图");
  });

  test("按钮触发形态：渲染 qw-btn 按钮，上传正常", async ({ page }) => {
    await page.goto("/demo/upload");
    await page.selectOption("select >> nth=0", "button"); // 触发形态：按钮
    await page.getByRole("button", { name: "应用配置" }).click();

    await expect(page.locator(".qw-upload-dropzone")).toHaveCount(0);
    await expect(page.locator(".qw-upload button.qw-btn")).toContainText("选择图片");

    await selectFile(page, PNG_1PX);
    await waitAllItems(page, "success", 3);
  });

  test("单张限制：超过 maxSizeMB 的文件被拒绝并提示", async ({ page }) => {
    await page.goto("/demo/upload");
    await page.selectOption("select >> nth=4", "1"); // 单张限制：1 MB
    await page.getByRole("button", { name: "应用配置" }).click();

    await selectFile(page, PNG_BIG, "big.png");
    await expect(page.locator(".qw-upload-hint")).toBeVisible();
    await expect(page.locator(".qw-upload-hint")).toContainText("被拒绝");
    await expect(page.locator(".qw-upload-item")).toHaveCount(0);
  });

  test("真实上传模式：XHR 打 /api/upload 成功", async ({ page }) => {
    await page.goto("/demo/upload");
    await page.selectOption("select >> nth=7", "real"); // 上传方式：真实（0.4.0 新增 supportedFormats 字段后索引 +1）
    await page.getByRole("button", { name: "应用配置" }).click();
    await selectFile(page, PNG_1PX);

    await waitAllItems(page, "success", 3);
  });
});
