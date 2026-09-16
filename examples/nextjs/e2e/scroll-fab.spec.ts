import { expect, test } from "@playwright/test";

async function atBottom(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) < 2,
  );
}

test("短按滚动到底部", async ({ page }) => {
  await page.goto("/demo/scroll-fab");
  const fab = page.locator(".qsf-root").first();
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAttribute("data-mode", "to-bottom");

  await fab.click();
  await expect.poll(() => atBottom(page), { timeout: 8000 }).toBe(true);
});

test("按住绕满翻转为返回顶部，松手点击回顶部", async ({ page }) => {
  await page.goto("/demo/scroll-fab");
  const fab = page.locator(".qsf-root").first();
  const box = (await fab.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(1200); // 超过 800ms 绕满
  await page.mouse.up();
  await expect(fab).toHaveAttribute("data-mode", "to-top");

  // 翻转顺带滚到底
  await expect.poll(() => atBottom(page), { timeout: 8000 }).toBe(true);

  await fab.click();
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 }).toBeLessThan(2);
});

test("触屏设备可交互（hasTouch）", async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 700 } });
  const page = await ctx.newPage();
  await page.goto("/demo/scroll-fab");
  const fab = page.locator(".qsf-root").first();
  await expect(fab).toBeVisible();
  const box = (await fab.boundingBox())!;
  // 轻点 = 短按执行当前模式动作（滚到底）；ghost click 已抑制，动作只执行一次
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => atBottom(page), { timeout: 8000 }).toBe(true);
  await ctx.close();
});
