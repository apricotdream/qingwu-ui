import { expect, test } from "@playwright/test";

async function atBottom(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) < 2,
  );
}

test("点击滚到底 → 悬停绕满翻转 → 再点击回顶", async ({ page }) => {
  await page.goto("/demo/scroll-fab");
  const fab = page.locator(".qsf-root").first();
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAttribute("data-mode", "to-bottom");

  await fab.click(); // 点击恒为当前模式动作：滚到底
  await expect.poll(() => atBottom(page), { timeout: 8000 }).toBe(true);

  // 点击后指针停留在悬浮栏上：悬停绕满 800ms 自动翻转为“返回顶部”
  await expect(fab).toHaveAttribute("data-mode", "to-top", { timeout: 5000 });

  await fab.click(); // 按当前箭头（上）直接回顶部
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 }).toBeLessThan(2);
});

test("悬停绕满是纯翻转：不附带任何滚动", async ({ page }) => {
  await page.goto("/demo/scroll-fab");
  const fab = page.locator(".qsf-root").first();
  const box = (await fab.boundingBox())!;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(fab).toHaveAttribute("data-mode", "to-top", { timeout: 5000 });
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 1000 }).toBeLessThan(2);

  // 移开：描边衰减，但模式保持翻转结果（不随悬停状态派生回退）
  await page.mouse.move(4, 4);
  await expect(fab).toHaveAttribute("data-mode", "to-top", { timeout: 2000 });
});

test("触屏全流程：轻点到底 → 长按绕满翻转（不滚动）→ 再轻点回顶", async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 700 } });
  const page = await ctx.newPage();
  await page.goto("/demo/scroll-fab");
  const fab = page.locator(".qsf-root").first();
  await expect(fab).toBeVisible();
  const box = (await fab.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.touchscreen.tap(cx, cy); // 轻点 = 滚动到底部
  await expect.poll(() => atBottom(page), { timeout: 8000 }).toBe(true);

  // 模拟触屏长按：PointerEvent 状态机与真机同路径（隐式 pointerenter 不得驱动描边）。
  // 必须在 evaluate 内等待松手完成，否则后续真轻点会落在按住窗口期被首指针独占吞掉。
  await fab.evaluate(
    async (el, [x, y]) => {
      const fire = (type: string) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 9,
            pointerType: "touch",
            button: 0,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          }),
        );
      fire("pointerenter");
      fire("pointerdown");
      await new Promise((r) => setTimeout(r, 1200));
      fire("pointerup");
      await new Promise((r) => setTimeout(r, 100));
    },
    [cx, cy],
  );
  await expect(fab).toHaveAttribute("data-mode", "to-top", { timeout: 2000 });
  await expect.poll(() => atBottom(page), { timeout: 2000 }).toBe(true); // 绕满松手被消费：不滚动

  await page.touchscreen.tap(cx, cy); // 轻点 = 返回顶部
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 }).toBeLessThan(2);
  await ctx.close();
});
