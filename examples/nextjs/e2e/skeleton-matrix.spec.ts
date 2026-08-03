import { expect, type Page, test } from "@playwright/test";

/** 每个覆盖层与其测量容器坐标差（取最近容器） */
async function alignDeltas(page: Page) {
  return page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll(".qs-skeleton-overlays"));
    const roots = Array.from(document.querySelectorAll(".qs-skeleton-measuring"));
    return {
      overlayCount: overlays.length,
      rootCount: roots.length,
      deltas: overlays.map((o) => {
        const or = o.getBoundingClientRect();
        const best = roots
          .map((r) => {
            const rr = r.getBoundingClientRect();
            return { dx: or.left - rr.left, dy: or.top - rr.top };
          })
          .sort((a, b) => Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy)))[0]!;
        return best;
      }),
    };
  });
}

async function navAwayAndBack(page: Page) {
  await page.click('a[href="/demo/button"]');
  await page.waitForTimeout(800);
  await page.goBack();
  await page.waitForSelector(".demo-grid", { timeout: 10000 });
  await page.waitForTimeout(1000);
}

for (const y of [0, 900, 2000]) {
  test(`回退导航矩阵 scrollY=${y}：覆盖层与容器始终对齐`, async ({ page }) => {
    await page.goto("/demo/skeleton");
    await expect(page.locator(".qs-skeleton-overlays")).toHaveCount(6);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(200);

    await navAwayAndBack(page);

    // 回退后立即 + 继续滚动后 + 稳定后，三刻对齐
    const checks = [await alignDeltas(page)];
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(300);
    checks.push(await alignDeltas(page));
    await page.waitForTimeout(2500);
    checks.push(await alignDeltas(page));

    for (const c of checks) {
      expect(c.overlayCount).toBe(c.rootCount);
      for (const d of c.deltas) {
        expect(Math.abs(d.dx)).toBeLessThanOrEqual(2);
        expect(Math.abs(d.dy)).toBeLessThanOrEqual(2);
      }
    }
  });
}
