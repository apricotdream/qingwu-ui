import { expect, type Page, test } from "@playwright/test";

/** 定位某张 demo 卡（按标题文本） */
function card(page: Page, title: string) {
  return page.locator(".demo-card", { hasText: title });
}

test.describe("Confirm 确认框演示页", () => {
  test("页面渲染 3 张 demo 卡：主卡 / 转场说明 / 键盘无障碍", async ({ page }) => {
    await page.goto("/demo/confirm");
    await expect(page.locator(".demo-card")).toHaveCount(3);
    await expect(card(page, "Confirm 确认框")).toBeVisible();
  });

  test("打开确认框：morph 长出，Esc 逃逸 resolve dismiss 并移除 DOM", async ({ page }) => {
    await page.goto("/demo/confirm");
    await page.getByRole("button", { name: "打开确认框" }).click();

    const panel = page.locator(".qc-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveClass(/qc-open/);
    await expect(page.locator(".qc-backdrop")).toHaveClass(/qc-open/);

    await page.keyboard.press("Escape");
    await expect(page.locator(".qc-layer")).toHaveCount(0);
    await expect(page.locator(".cal-log-item").last()).toContainText("dismiss");
  });

  test("点确认 → resolve confirm", async ({ page }) => {
    await page.goto("/demo/confirm");
    await page.getByRole("button", { name: "打开确认框" }).click();
    await page.locator(".qc-confirm").click();
    await expect(page.locator(".qc-layer")).toHaveCount(0);
    await expect(page.locator(".cal-log-item").last()).toContainText("confirm");
  });

  test("危险删除（qc-danger）+ 点遮罩默认 dismiss", async ({ page }) => {
    await page.goto("/demo/confirm");
    await page.locator("button", { hasText: "危险删除" }).click();
    await expect(page.locator(".qc-panel")).toHaveClass(/qc-danger/);

    await page.locator(".qc-backdrop").click({ position: { x: 20, y: 20 } });
    await expect(page.locator(".qc-layer")).toHaveCount(0);
    await expect(page.locator(".cal-log-item").last()).toContainText("dismiss");
  });

  test("异步确认：loading 态出现、期间 Esc 忽略、完成后 resolve confirm", async ({ page }) => {
    await page.goto("/demo/confirm");
    await page.locator("button", { hasText: "异步确认" }).click();
    await page.locator(".qc-confirm").click();

    await expect(page.locator(".qc-panel")).toHaveClass(/qc-loading/);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await expect(page.locator(".qc-layer")).toHaveCount(1); // loading 期间 Esc 被忽略

    await expect(page.locator(".qc-layer")).toHaveCount(0, { timeout: 8000 }); // 1.5s 后完成
    await expect(page.locator(".cal-log-item").last()).toContainText("异步");
    await expect(page.locator(".cal-log-item").last()).toContainText("confirm");
  });

  test("互斥替换：A 打开后 1.5s 被 B 替换，A resolve dismiss，同时仅一个面板", async ({ page }) => {
    await page.goto("/demo/confirm");
    await page.locator("button", { hasText: "演示互斥替换" }).click();

    await expect(page.locator(".qc-title")).toHaveText(/操作 A/);
    await expect(page.locator(".qc-title")).toHaveText(/操作 B/, { timeout: 6000 });
    await expect(page.locator(".qc-panel")).toHaveCount(1);
    await expect(
      page.locator(".cal-log-item").filter({ hasText: "确认框 A" }).last(),
    ).toContainText("dismiss");

    await page.locator(".qc-cancel").click();
    await expect(page.locator(".qc-layer")).toHaveCount(0);
  });

  test("backdrop 'cancel' 模式：点遮罩 resolve cancel", async ({ page }) => {
    await page.goto("/demo/confirm");
    await page.locator("button", { hasText: "cancel" }).first().click();
    await page.getByRole("button", { name: "打开确认框" }).click();
    await page.locator(".qc-backdrop").click({ position: { x: 20, y: 20 } });
    await expect(page.locator(".qc-layer")).toHaveCount(0);
    await expect(page.locator(".cal-log-item").last()).toContainText("cancel");
  });

  test("移动端视口 390px：面板全宽可见并可关闭", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demo/confirm");
    await page.getByRole("button", { name: "打开确认框" }).click();
    await expect(page.locator(".qc-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".qc-layer")).toHaveCount(0);
  });
});
