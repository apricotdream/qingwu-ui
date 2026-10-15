import { expect, test } from "@playwright/test";

// 回归：日历「未选中」状态。setSelectedDate 传空值后输入框变空、日期网格与
// 年/月视图都不高亮、详情侧栏不展开；面板打开期间清空后按「取消」回到的是
// 清空后的值（新回滚基准）而不是打开面板前的旧日期；清空后仍能重新选中并确认。
// 另外覆盖：预设值带时分秒时不能被吞成 00:00:00。
// 注意 popover 模式下面是 portal 到 body 的（脱离宿主裁剪），面板不在卡片里。
test.setTimeout(90_000);

test("日历清空选中：进入未选中态、取消不回滚旧值、可重新选中确认", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/demo/calendar-popup");
  const card = page.locator("article.demo-card", { hasText: "清空选中（未选中状态）" });
  await expect(card).toBeVisible({ timeout: 60_000 });

  const input = card.locator(".qw-cal-input");
  const panel = page.locator(".qw-cal-panel.is-open");
  // 预设值带时分秒：不能被吞成 00:00:00
  await expect(input).toHaveValue("2026-08-15 12:34:56");

  // 1) 清空：输入框留空
  await card.getByRole("button", { name: "清空选中" }).click();
  await expect(input).toHaveValue("");

  // 2) 打开面板：网格无高亮、详情侧栏不展开、时间回 00
  await input.click();
  await expect(panel).toHaveCount(1, { timeout: 10_000 });
  await expect(panel.locator(".is-selected")).toHaveCount(0);
  await expect(panel.locator(".qw-cal-side.is-active")).toHaveCount(0);
  await expect(panel.getByLabel("时")).toHaveValue("00");

  // 3) 月视图、年视图同样不该有高亮；看完用「取消」收起（open() 会把视图重置回日视图）
  await panel.locator(".qw-cal-title-month").click();
  await expect(panel.locator(".is-selected")).toHaveCount(0);
  await panel.locator(".qw-cal-title-year").click();
  await expect(panel.locator(".is-selected")).toHaveCount(0);
  await panel.locator(".qw-cal-cancel-btn").click();
  await expect(panel).toHaveCount(0);
  await expect(input).toHaveValue("");

  // 清空后 selected 为 null，重开面板落回「今天」所在月，所以按浏览器本地日期取日格
  const today = await page.evaluate(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  const cell = panel.locator(`[data-date="${today}"]`);

  // 4) 清空后取消：在面板里选了一天再取消，不应把清空前的日期回滚回来
  await input.click();
  await expect(panel).toHaveCount(1);
  await expect(panel.locator(".is-selected")).toHaveCount(0);
  await cell.click();
  await expect(panel.locator(".is-selected")).toHaveCount(1);
  await panel.locator(".qw-cal-cancel-btn").click();
  await expect(panel).toHaveCount(0);
  await expect(input).toHaveValue("");
  await input.click();
  await expect(panel.locator(".is-selected")).toHaveCount(0);

  // 5) 重新选中并确认：回发新值，重开面板后仍是选中态
  await cell.click();
  await panel.locator(".qw-cal-confirm-btn").click();
  await expect(panel).toHaveCount(0);
  await expect(input).toHaveValue(`${today} 00:00:00`);
  await input.click();
  await expect(panel.locator(`[data-date="${today}"].is-selected`)).toHaveCount(1);

  expect(errors).toEqual([]);
});
