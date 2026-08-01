import { expect, test } from "@playwright/test";

test("回退后：骨架块与透明化真实内容逐块对齐", async ({ page }) => {
  await page.goto("/demo/skeleton");
  await expect(page.locator(".qs-skeleton-overlays")).toHaveCount(6);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(300);

  // 首次加载时的块-内容偏差（基线）
  const baseline = await blockContentDeltas(page);
  console.log("基线 maxDelta:", JSON.stringify(baseline));

  await page.click('a[href="/demo/button"]');
  await page.waitForTimeout(800);
  await page.goBack();
  await page.waitForSelector(".demo-grid", { timeout: 10000 });
  await page.waitForTimeout(1500);

  const after = await blockContentDeltas(page);
  console.log("回退后 maxDelta:", JSON.stringify(after));

  expect(after.overlayCount).toBe(after.rootCount);
  expect(after.maxDelta).toBeLessThanOrEqual(3);
});

async function blockContentDeltas(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const roots = Array.from(document.querySelectorAll(".qs-skeleton-measuring"));
    const leafTags = new Set(["IMG", "SVG", "VIDEO", "CANVAS", "IFRAME", "INPUT", "TEXTAREA", "BUTTON"]);
    let maxDelta = 0;
    let blockCount = 0;
    let rootCount = roots.length;
    let overlayCount = document.querySelectorAll(".qs-skeleton-overlays").length;

    for (const root of roots) {
      // 收集该容器内的骨架块
      const rootRect = root.getBoundingClientRect();
      const blocks = Array.from(root.querySelectorAll(":scope > .qs-skeleton-overlays"))[0];
      // 覆盖层在 body 上，按坐标匹配：找覆盖层盒子
      const overlays = Array.from(document.querySelectorAll(".qs-skeleton-overlays"));
      const myOverlay = overlays.find((o) => {
        const or = o.getBoundingClientRect();
        return Math.abs(or.left - rootRect.left) < 30 && Math.abs(or.top - rootRect.top) < 30;
      });
      if (!myOverlay) continue;
      const blockEls = Array.from(myOverlay.querySelectorAll(".qs-skeleton-overlay"));

      // 收集该容器内真实叶子（透明化但仍在布局中）
      const leaves: Array<{ left: number; top: number; width: number; height: number }> = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let n = walker.nextNode();
      while (n) {
        const el = n as HTMLElement;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const hasRealChildren = Array.from(el.children).some((c) => !["BR", "WBR", "HR"].includes(c.tagName));
          if (leafTags.has(el.tagName) || !hasRealChildren) {
            leaves.push({ left: r.left, top: r.top, width: r.width, height: r.height });
          }
        }
        n = walker.nextNode();
      }

      // 每个块找最近叶子，算偏差
      for (const b of blockEls) {
        blockCount++;
        const br = b.getBoundingClientRect();
        let best = Infinity;
        for (const l of leaves) {
          const dx = Math.abs(br.left - l.left) + Math.abs(br.top - l.top);
          if (dx < best) best = dx;
        }
        if (best > maxDelta) maxDelta = best;
      }
    }
    return { maxDelta, blockCount, overlayCount, rootCount };
  });
}
