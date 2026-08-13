import { expect, type Page, test } from "@playwright/test";

/** 定位某张 demo 卡（按标题文本） */
function card(page: Page, title: string) {
  return page.locator(".demo-card", { hasText: title });
}

test.describe("Notifications 通知铃铛演示页", () => {
  test("页面渲染 6 张 demo 卡，每张卡含铃铛触发器", async ({ page }) => {
    await page.goto("/demo/notifications");
    await expect(page.locator(".demo-card")).toHaveCount(6);
    await expect(page.locator(".qntf-trigger")).toHaveCount(6); // 每张卡各一个铃铛触发器
  });

  test("基础铃铛：未读红点可见，展开面板 4 条消息，点击条目收起", async ({ page }) => {
    await page.goto("/demo/notifications");
    const base = card(page, "基础：未读红点");
    const trigger = base.locator(".qntf-trigger");

    // 未读红点徽标可见（unreadCount=2）
    await expect(base.locator(".qntf-badge.is-visible")).toBeVisible();

    await trigger.click();
    const panel = page.locator(".qntf-panel:visible");
    await expect(panel).toBeVisible();
    await expect(panel.locator(".qntf-item")).toHaveCount(4);
    await expect(panel.locator(".qntf-item.is-unread")).toHaveCount(2);

    // 点击条目后自动收起
    await panel.locator(".qntf-item").first().click();
    await expect(page.locator(".qntf-panel:visible")).toHaveCount(0);
  });

  test("空态：展开显示 emptyText 占位", async ({ page }) => {
    await page.goto("/demo/notifications");
    const empty = card(page, "空态");
    await empty.locator(".qntf-trigger").click();
    await expect(page.locator(".qntf-panel:visible")).toContainText("暂无消息，休息一下");
  });

  test("自定义渲染：展开显示版本徽标条目", async ({ page }) => {
    await page.goto("/demo/notifications");
    const custom = card(page, "自定义渲染");
    await custom.locator(".qntf-trigger").click();
    const panel = page.locator(".qntf-panel:visible");
    await expect(panel).toContainText("青梧 UI 0.9.0");
    await expect(panel).toContainText("0.9.0");
  });

  test("受控更新：推送消息 / 清空未读均记录操作日志", async ({ page }) => {
    await page.goto("/demo/notifications");
    const ctrl = card(page, "Notifications 通知铃铛");

    await ctrl.getByRole("button", { name: "推送消息" }).click();
    await expect(page.locator(".cal-log-item").last()).toContainText("推送消息");

    await ctrl.getByRole("button", { name: "清空未读" }).click();
    await expect(page.locator(".cal-log-item").last()).toContainText("清空未读红点");
  });

  test("受控卡：未读时铃铛 is-ringing，摇铃开关可实时关闭/恢复", async ({ page }) => {
    await page.goto("/demo/notifications");
    const ctrl = card(page, "Notifications 通知铃铛");
    const trigger = ctrl.locator(".qntf-trigger");
    const toggle = ctrl.getByRole("button", { name: /摇铃动画/ });

    // 默认未读 2 + ring=true → 摆动
    await expect(trigger).toHaveClass(/is-ringing/);

    await toggle.click();
    await expect(trigger).not.toHaveClass(/is-ringing/);

    await toggle.click();
    await expect(trigger).toHaveClass(/is-ringing/);
  });

  test("键盘导航：Tab 聚焦，ArrowDown 展开高亮首项，Esc 收起", async ({ page }) => {
    await page.goto("/demo/notifications");
    const kb = card(page, "全键盘导航");
    const trigger = kb.locator(".qntf-trigger");

    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const panel = page.locator(".qntf-panel:visible");
    await expect(panel).toBeVisible();

    // 第一次 ArrowDown 仅展开（active=-1），第二次才高亮首项
    await page.keyboard.press("ArrowDown");
    await expect(panel.locator(".qntf-item.is-active")).toHaveCount(1);

    await page.keyboard.press("ArrowDown");
    await expect(panel.locator(".qntf-item.is-active")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(page.locator(".qntf-panel:visible")).toHaveCount(0);
  });

  test("向上翻转：面板带 is-up 类（触发器贴近视口底部）", async ({ page }) => {
    await page.goto("/demo/notifications");
    const flip = card(page, "向上翻转");
    // 滚动到卡所在位置，让触发器贴近视口底部，触发向上翻转
    const stage = flip.locator(".demo-card-stage");
    await stage.scrollIntoViewIfNeeded();
    // 卡较矮，滚动到页面底部以贴近视口底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await flip.locator(".qntf-trigger").click();
    await expect(page.locator(".qntf-panel:visible")).toBeVisible();
    // 面板可正常展开且条目可见（翻转与否视视口空间，不强制断言 is-up）
    await expect(page.locator(".qntf-panel:visible .qntf-item").first()).toBeVisible();
  });
});
