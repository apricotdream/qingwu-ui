import { expect, test } from "@playwright/test";

const COMPONENT_PAGES = [
  "select",
  "button",
  "upload",
  "carousel",
  "calendar-popup",
  "search",
  "action-menu",
  "notifications",
  "confirm",
  "skeleton",
  "toast",
  "tag-input",
  "avatar",
  "scroll-fab",
  "input",
  "text-layout",
];

const UTILITY_PAGES = ["inspector", "log", "perf", "changelog", "editor"];

for (const name of COMPONENT_PAGES) {
  test(`${name}: 统一范式`, async ({ page }) => {
    await page.goto(`/demo/${name}`);

    // 恰好一个 Playground（props 面板 + 应用/重置按钮）
    const panels = page.locator(".cal-props-panel");
    await expect(panels).toHaveCount(1);
    await expect(page.getByRole("button", { name: "应用" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "重置" })).toHaveCount(1);

    // Playground 至少 2 个属性控件
    expect(await page.locator(".cal-props-field").count()).toBeGreaterThanOrEqual(2);

    // 每个代码面板都有 react/html/vue 三个 tab
    const tabBars = page.locator(".demo-code-tabs");
    const barCount = await tabBars.count();
    expect(barCount).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < barCount; i++) {
      const tabs = tabBars.nth(i).locator(".demo-code-tab");
      await expect(tabs).toHaveCount(3);
    }

    // 仅校验结构；交互流程在后续用例覆盖
  });
}

for (const name of UTILITY_PAGES) {
  test(`${name}: 可访问`, async ({ page }) => {
    const res = await page.goto(`/demo/${name}`);
    expect(res?.status()).toBe(200);
  });
}

test("应用/重置可用（select）", async ({ page }) => {
  await page.goto("/demo/select");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 改变「整体禁用」下拉
  const disabledSelect = page.locator(".cal-props-field", { hasText: "整体禁用" }).locator("select");
  await disabledSelect.selectOption("true");
  await page.getByRole("button", { name: "应用" }).click();
  await expect(page.getByRole("button", { name: "重置" })).toBeVisible();

  // 重置恢复
  await page.getByRole("button", { name: "重置" }).click();
  await expect(disabledSelect).toHaveValue("false");

  expect(errors).toEqual([]);
});

test("HTML snippet 内容完整（select/button/confirm/toast/upload）", async ({ page }) => {
  for (const name of ["select", "button", "confirm", "toast", "upload"]) {
    await page.goto(`/demo/${name}`);
    // 切到 Playground 的 HTML tab（第一个 tab bar）
    await page.locator(".demo-code-tabs").first().getByRole("button", { name: "HTML" }).click();
    const code = page.locator(".demo-card-code pre code").first();
    await expect(code).toContainText(/<!doctype html>/i);
    await expect(code).toContainText("unpkg.com");
  }
});
