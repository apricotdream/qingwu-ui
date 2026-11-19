import { expect, test } from "@playwright/test";

test("备忘日历：节假日叠加、草稿取消、确认保存和窄屏编辑", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/demo/calendar-popup");
  const card = page.locator("article.demo-card", { hasText: "日期范围与备忘记事" });
  await expect(card).toBeVisible({ timeout: 60_000 });
  const inputs = card.locator(".qw-cal-input");
  const panel = page.locator(".qw-cal-panel.is-open");

  await inputs.nth(1).click();
  const holiday = panel.locator('[data-date="2026-10-01"]');
  await expect(holiday).toHaveClass(/is-marked-range/);
  await expect(holiday.locator(".qw-cal-cell-sub")).toHaveText("国庆节");
  await expect(holiday.locator(".qw-cal-cell-badge")).toHaveText("休");
  await expect(holiday.locator(".qw-cal-note-dot")).toHaveCount(1);
  await expect(panel.locator('[data-date="2026-10-10"] .qw-cal-cell-badge')).toHaveText("工");
  const color = await holiday.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(color).toBe("rgb(229, 242, 231)");
  await panel.locator(".qw-cal-note-input").fill("取消的草稿");
  await panel.locator(".qw-cal-cancel-btn").click();
  await inputs.nth(1).click();
  await expect(panel.locator(".qw-cal-note-input")).toHaveValue("出门前检查行李。");
  await panel.locator(".qw-cal-cancel-btn").click();

  await page.setViewportSize({ width: 390, height: 844 });
  await inputs.nth(0).click();
  await expect(panel.locator(".is-today.is-marked-range")).toHaveCount(1);
  const note = panel.locator(".qw-cal-note-input");
  await note.fill("本机验证");
  await note.press("End");
  await note.press("Enter");
  await note.pressSequentially("第二行");
  await expect(note).toHaveValue("本机验证\n第二行");
  await note.press("ArrowLeft");
  await expect(panel).toBeVisible();
  await panel.locator(".qw-cal-confirm-btn").click();
  await expect(card.getByRole("status")).toContainText("已保存");
  await page.reload();
  await inputs.nth(0).click();
  await expect(panel.locator(".qw-cal-note-input")).toHaveValue("本机验证\n第二行");
  expect(
    await panel.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: test.info().outputPath("calendar-memo-mobile.png"),
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
