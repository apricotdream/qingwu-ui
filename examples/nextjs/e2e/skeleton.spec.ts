import { expect, type Page, test } from "@playwright/test";

/** 与包内 isLeafElement 一致的叶子判定，用于收集真实内容几何 */
async function collectLeafGeoms(page: Page): Promise<Array<{ top: number; left: number; width: number; height: number }>> {
  return page.evaluate(() => {
    const stage = document.querySelector("#ssr-demo-stage");
    const sRect = stage!.getBoundingClientRect();
    const alwaysLeaf = ["IMG", "SVG", "VIDEO", "CANVAS", "IFRAME", "INPUT", "TEXTAREA", "BUTTON"];
    const voidTags = ["BR", "WBR", "HR"];

    return Array.from(stage!.querySelectorAll(".sk-card *"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        if (alwaysLeaf.includes(el.tagName)) return true;
        const hasRealChildren = Array.from(el.children).some(
          (c) => !voidTags.includes(c.tagName),
        );
        return !hasRealChildren;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          top: Math.round(r.top - sRect.top),
          left: Math.round(r.left - sRect.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      })
      .sort((a, b) => a.top - b.top);
  });
}

/** 收集静态骨架块几何（相对 stage，按 top 排序） */
async function collectSkeletonGeoms(page: Page): Promise<Array<{ top: number; left: number; width: number; height: number }>> {
  return page.evaluate(() => {
    const stage = document.querySelector("#ssr-demo-stage");
    const sRect = stage!.getBoundingClientRect();
    return Array.from(stage!.querySelectorAll(".qs-skel-block"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          top: Math.round(r.top - sRect.top),
          left: Math.round(r.left - sRect.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      })
      .sort((a, b) => a.top - b.top);
  });
}

test.describe("Skeleton 演示页", () => {
  test("SSR 骨架：静态骨架块与真实卡片叶子几何按构造相等", async ({ page }) => {
    await page.goto("/demo/skeleton");

    // 初始为静态骨架（无 JS 预览）
    await expect(page.locator("#ssr-demo-stage .qs-skel-container")).toBeVisible();
    await expect(page.locator("#ssr-demo-stage .qs-skel-block.is-shimmer").first()).toBeVisible();

    const skeletonGeoms = await collectSkeletonGeoms(page);
    expect(skeletonGeoms.length).toBeGreaterThan(5);

    // 数据就绪：真实内容替换骨架
    await page.getByRole("button", { name: "▼ 数据就绪" }).click();
    await expect(page.locator("#ssr-demo-stage .sk-card")).toBeVisible();
    await expect(page.locator("#ssr-demo-stage .qs-skel-container")).toHaveCount(0);

    const contentGeoms = await collectLeafGeoms(page);
    expect(contentGeoms).toHaveLength(skeletonGeoms.length);

    // 逐块几何近似匹配（±2px）
    for (let i = 0; i < skeletonGeoms.length; i++) {
      expect(Math.abs(skeletonGeoms[i]!.top - contentGeoms[i]!.top)).toBeLessThanOrEqual(2);
      expect(Math.abs(skeletonGeoms[i]!.left - contentGeoms[i]!.left)).toBeLessThanOrEqual(2);
      expect(Math.abs(skeletonGeoms[i]!.width - contentGeoms[i]!.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(skeletonGeoms[i]!.height - contentGeoms[i]!.height)).toBeLessThanOrEqual(2);
    }
  });

  test("SSR 骨架：重新加载重建静态骨架", async ({ page }) => {
    await page.goto("/demo/skeleton");
    await expect(page.locator("#ssr-demo-stage .qs-skel-container")).toBeVisible();

    await page.getByRole("button", { name: "▼ 数据就绪" }).click();
    await expect(page.locator("#ssr-demo-stage .sk-card")).toBeVisible();

    await page.getByRole("button", { name: "▲ 重新加载" }).click();
    await expect(page.locator("#ssr-demo-stage .qs-skel-container")).toBeVisible();
  });

  test("回退导航：覆盖层与测量容器一一对应（无孤儿覆盖层位移）", async ({ page }) => {
    await page.goto("/demo/skeleton");
    await expect(page.locator(".qs-skeleton-overlays")).toHaveCount(6);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(300);

    // 导航到其他页面再返回（演示页卸载 → 重新挂载）
    await page.click('a[href="/demo/button"]');
    await page.waitForSelector(".qw-header", { timeout: 5000 });
    await page.waitForTimeout(800);

    await page.goBack();
    await page.waitForSelector(".demo-grid", { timeout: 10000 });
    await expect(page.locator(".qs-skeleton-overlays")).toHaveCount(6);

    // 每个覆盖层都对齐其测量容器（孤儿覆盖层会钉在视口左上角，必然失配）
    const aligned = await page.evaluate(() => {
      const overlays = Array.from(document.querySelectorAll(".qs-skeleton-overlays"));
      const roots = Array.from(document.querySelectorAll(".qs-skeleton-measuring"));
      return overlays.every((o) => {
        const or = o.getBoundingClientRect();
        return roots.some((r) => {
          const rr = r.getBoundingClientRect();
          return Math.abs(or.left - rr.left) <= 2 && Math.abs(or.top - rr.top) <= 2;
        });
      });
    });
    expect(aligned).toBe(true);
  });
});
