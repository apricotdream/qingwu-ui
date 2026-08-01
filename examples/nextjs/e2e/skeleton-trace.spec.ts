import { test } from "@playwright/test";

test("回退后根容器与覆盖层位置随时间变化采样", async ({ page }) => {
  await page.goto("/demo/skeleton");
  await page.waitForSelector(".qs-skeleton-overlays");
  await page.click('a[href="/demo/button"]');
  await page.waitForTimeout(800);
  await page.goBack();
  await page.waitForSelector(".demo-grid", { timeout: 10000 });

  // 连续采样 20 次 × 100ms
  for (let i = 0; i < 20; i++) {
    const sample = await page.evaluate(() => {
      const overlays = Array.from(document.querySelectorAll(".qs-skeleton-overlays"));
      const roots = Array.from(document.querySelectorAll(".qs-skeleton-measuring"));
      return {
        scrollY: window.scrollY,
        roots: roots.slice(0, 2).map((r) => {
          const rr = r.getBoundingClientRect();
          return { top: Math.round(rr.top), left: Math.round(rr.left) };
        }),
        overlays: overlays.slice(0, 2).map((o) => {
          const or = o.getBoundingClientRect();
          return { top: Math.round(or.top), left: Math.round(or.left) };
        }),
      };
    });
    console.log(`t=${i * 100}ms:`, JSON.stringify(sample));
    await page.waitForTimeout(100);
  }
});
