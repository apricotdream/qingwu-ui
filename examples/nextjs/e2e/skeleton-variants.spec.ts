import { expect, test, type Page } from "@playwright/test";

async function alignInfo(page: Page) {
  return page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll(".qs-skeleton-overlays"));
    const roots = Array.from(document.querySelectorAll(".qs-skeleton-measuring"));
    return {
      scrollY: window.scrollY,
      overlayCount: overlays.length,
      rootCount: roots.length,
      maxDelta: Math.max(...overlays.map((o) => {
        const or = o.getBoundingClientRect();
        const best = roots.map((r) => {
          const rr = r.getBoundingClientRect();
          return Math.abs(or.left - rr.left) + Math.abs(or.top - rr.top);
        }).sort((a, b) => a - b)[0]!;
        return best;
      })),
    };
  });
}

test("变体A: sider 链接去 → sider 链接回（push 往返）", async ({ page }) => {
  await page.goto("/demo/skeleton");
  await expect(page.locator(".qs-skeleton-overlays")).toHaveCount(6);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  await page.click('a[href="/demo/button"]');
  await page.waitForTimeout(800);
  await page.click('a[href="/demo/skeleton"]'); // 点 sider 链接回
  await page.waitForSelector(".demo-grid", { timeout: 10000 });
  await page.waitForTimeout(1500);
  const info = await alignInfo(page);
  console.log("变体A:", JSON.stringify(info));
  expect(info.overlayCount).toBe(info.rootCount);
  expect(info.maxDelta).toBeLessThanOrEqual(2);
});

test("变体B: 去首页 → 浏览器返回", async ({ page }) => {
  await page.goto("/demo/skeleton");
  await expect(page.locator(".qs-skeleton-overlays")).toHaveCount(6);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  await page.click('a[href="/"]');
  await page.waitForTimeout(800);
  await page.goBack();
  await page.waitForSelector(".demo-grid", { timeout: 10000 });
  await page.waitForTimeout(1500);
  const info = await alignInfo(page);
  console.log("变体B:", JSON.stringify(info));
  expect(info.overlayCount).toBe(info.rootCount);
  expect(info.maxDelta).toBeLessThanOrEqual(2);
});

test("变体C: 头部导航去更新日志 → 浏览器返回", async ({ page }) => {
  await page.goto("/demo/skeleton");
  await expect(page.locator(".qs-skeleton-overlays")).toHaveCount(6);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);
  await page.click('a[href="/demo/changelog"]');
  await page.waitForTimeout(800);
  await page.goBack();
  await page.waitForSelector(".demo-grid", { timeout: 10000 });
  await page.waitForTimeout(1500);
  const info = await alignInfo(page);
  console.log("变体C:", JSON.stringify(info));
  expect(info.overlayCount).toBe(info.rootCount);
  expect(info.maxDelta).toBeLessThanOrEqual(2);
});
