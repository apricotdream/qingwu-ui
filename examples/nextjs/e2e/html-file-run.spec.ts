import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";

test("select HTML snippet 存盘可直接运行", async ({ page }) => {
  await page.goto("/demo/select");
  await page.locator(".demo-code-tabs").first().getByRole("button", { name: "HTML" }).click();
  const code = (await page.locator(".demo-card-code pre code").first().textContent()) ?? "";
  expect(code).toContain("<!doctype html>");
  writeFileSync(".tmp-select-demo.html", code);

  const errors: string[] = [];
  const filePage = await page.context().newPage();
  filePage.on("pageerror", (e) => errors.push(e.message));
  await filePage.goto(`file://${process.cwd()}/.tmp-select-demo.html`);

  // 触发器渲染
  const trigger = filePage.locator(".qw-select-trigger, [class*='qw-select']").first();
  await expect(trigger).toBeVisible({ timeout: 15000 });

  // 点开并看到选项
  await trigger.click();
  await expect(filePage.getByText("React", { exact: true }).first()).toBeVisible({ timeout: 5000 });

  expect(errors).toEqual([]);
  await filePage.close();
});
