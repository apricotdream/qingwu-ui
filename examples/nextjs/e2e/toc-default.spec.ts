import { expect, test } from "@playwright/test";

// 编辑器演示页含长 README 内容，Next dev 按需编译可能较慢
test.setTimeout(90_000);

test.describe("TOC 默认收起 + 控件可用", () => {
  test("showToc=false 时目录默认收起，工具栏按钮可重新展开", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/demo/editor");
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60000 });

    // 默认 showToc=true：宽屏下桌面侧栏自动展开
    await expect(page.locator(".qingwu-toc-desktop")).toBeVisible();

    // 切到 showToc=false → 目录收起
    await page.locator('[data-tour="toc-default"]').click();
    await expect(page.locator(".qingwu-toc-desktop")).toBeHidden();

    // 工具栏目录按钮仍在，点击后重新展开侧栏
    const tocBtn = page.locator(".qed-tb-btn--desktop-only");
    await expect(tocBtn).toBeVisible();
    await tocBtn.click();
    await expect(page.locator(".qingwu-toc-desktop")).toBeVisible();
    // 宽屏（isWide）下只出侧栏，不叠开抽屉
    await expect(page.locator(".qingwu-toc-drawer")).toBeHidden();

    expect(errors).toEqual([]);
  });

  test("只读态下文档有标题时亮出目录悬浮球，点击打开抽屉", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/demo/editor");
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60000 });

    // 先切 showToc=false（目录控件可用但默认收起）
    await page.locator('[data-tour="toc-default"]').click();
    await expect(page.locator(".qingwu-toc-desktop")).toBeHidden();

    // 切到只读查看模式
    await page.locator('[data-tour="mode-toggle"]').click();
    await expect(page.locator(".qingwu-editor--readonly")).toBeVisible();

    // 文档含标题 → 悬浮球亮出
    const fab = page.locator(".qingwu-toc-fab");
    await expect(fab).toBeVisible();

    // 点击悬浮球 → 目录抽屉展开
    await fab.click();
    await expect(page.locator(".qingwu-toc-drawer")).toBeVisible();
    await expect(page.locator(".qingwu-toc-drawer .toc-panel")).toBeVisible();

    expect(errors).toEqual([]);
  });
});
