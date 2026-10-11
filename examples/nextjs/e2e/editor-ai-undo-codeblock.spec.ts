import { expect, test } from "@playwright/test";

// 回归：代码块 NodeSelection 状态下打开 AI 助手「自定义指令」，焦点在面板输入框时
// 按 Backspace（撤销/删字）不应误弹「确认删除代码块」。
// 根因：删除确认的 keydown 监听挂在 window 捕获阶段，只看 selected 不看焦点归属。
test.setTimeout(90_000);

test("AI 自定义指令输入框中 Backspace 不弹删除代码块确认框", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/demo/editor");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60000 });

  // 1) 点第一个代码块工具栏的「写作助手」：内部会 setNodeSelection 并打开 AI 面板
  const aiBtn = page.locator(".cb-btn--ai").first();
  await aiBtn.waitFor({ state: "attached" });
  await aiBtn.evaluate((el) => el.scrollIntoView({ block: "center" }));
  // 右侧 TOC 浮层会盖住编辑器右缘、按钮又是 hover 才显现，物理点击会落到浮层上，
  // 故直接派发 DOM click（React 的 onClick 仍会响应）
  await aiBtn.evaluate((el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));

  // 2) 在 AI 面板选择「自定义指令」（zap），焦点进入其输入框
  await page.getByRole("button", { name: "自定义指令" }).first().click();
  const input = page.getByPlaceholder("例如：把这段内容改写成小红书风格");
  await expect(input).toBeFocused({ timeout: 10000 });

  // 3) 在输入框里打字后按 Backspace —— 这是在编辑指令文本，不是删除代码块
  await input.fill("把这段改得更简洁");
  await input.press("Backspace");
  await input.press("Backspace");

  // 4) 不应出现删除确认框
  await expect(page.getByText("确认删除代码块", { exact: true })).toHaveCount(0);
  // 输入框仍保留焦点且内容只是少了两个字（没有被编辑器劫持）
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("把这段改得更");

  expect(errors).toEqual([]);
});
