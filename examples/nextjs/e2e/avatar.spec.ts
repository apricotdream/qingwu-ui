import { expect, test } from "@playwright/test";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJUlEQVR4nGP8z8Dwn4GKgImaho0aOGroqIGjRgkGDRowatSgADYdDgAV6RMXAAAAAElFTkSuQmCC",
  "base64",
);

/** 64×64 纯色不透明 PNG（#E74C3C），用于导出像素级圆度校验 */
const SOLID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAmUlEQVR4nO3QMREAIBDAsBeGBPxbQAbIyECH7L3O2ev+bHSA1gAdoDVAB2gN0AFaA3SA1gAdoDVAB2gN0AFaA3SA1gAdoDVAB2gN0AFaA3SA1gAdoDVAB2gN0AFaA3SA1gAdoDVAB2gN0AFaA3SA1gAdoDVAB2gN0AFaA3SA1gAdoDVAB2gN0AFaA3SA1gAdoDVAB2gN0AHaA7FN4jvH+ELAAAAAAElFTkSuQmCC",
  "base64",
);

test("头像编辑：上传、拖动、缩放、圆角并导出", async ({ page }) => {
  await page.goto("/demo/avatar");
  await page.locator(".qav-trigger").click();
  await expect(page.locator(".qav-dialog")).toBeVisible();

  await page
    .locator(".qav-file")
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator(".qav-empty")).toBeHidden();
  await expect(page.locator(".qav-primary")).toBeEnabled();

  await page.getByRole("button", { name: "向右旋转" }).click();
  const box = await page.locator(".qav-canvas").boundingBox();
  if (!box) throw new Error("canvas 不存在");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10);
  await page.mouse.up();
  await page.locator(".qav-range").first().fill("1.5");
  await page.locator(".qav-range").nth(1).fill("30");
  await page.getByRole("button", { name: "确认" }).click();

  await expect(page.locator(".qav-dialog")).toBeHidden();
  await expect(page.getByText("256×256")).toBeVisible();
  await expect(page.getByText("data:image/png;base64,", { exact: false })).toBeVisible();
});

test("圆角拉满（50）导出为正圆", async ({ page }) => {
  await page.goto("/demo/avatar");
  await page.locator(".qav-trigger").click();
  await page.locator(".qav-file").setInputFiles({
    name: "solid.png",
    mimeType: "image/png",
    buffer: SOLID_PNG,
  });
  await expect(page.locator(".qav-primary")).toBeEnabled();
  // 第二个 .qav-range 是圆角率，拉到最大 50
  await page.locator(".qav-range").nth(1).fill("50");
  await page.getByRole("button", { name: "确认" }).click();
  await expect(page.locator(".qav-dialog")).toBeHidden();

  const stats = await page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>(".qav-preview")!;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let coverage = 0;
    for (let i = 3; i < data.length; i += 4) coverage += data[i] / 255;
    const at = (x: number, y: number) => data[(y * width + x) * 4 + 3];
    const corners = [
      at(0, 0),
      at(width - 1, 0),
      at(0, height - 1),
      at(width - 1, height - 1),
      at(Math.floor(width * 0.05), Math.floor(height * 0.05)),
      at(Math.floor(width * 0.95), Math.floor(height * 0.05)),
      at(Math.floor(width * 0.05), Math.floor(height * 0.95)),
      at(Math.floor(width * 0.95), Math.floor(height * 0.95)),
    ];
    const r = width / 2;
    return { width, height, coverage, ideal: Math.PI * r * r, corners };
  });

  expect(stats.width).toBe(256);
  expect(stats.height).toBe(256);
  // 正圆：四角及 5% 内缩角点全部透明
  for (const alpha of stats.corners) expect(alpha).toBe(0);
  // 覆盖率 ≈ π·128²，±1% 内（二次贝塞尔旧实现偏差 +8.9%，会失败）
  expect(Math.abs(stats.coverage - stats.ideal) / stats.ideal).toBeLessThan(0.01);
});
