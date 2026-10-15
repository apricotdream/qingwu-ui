import { expect, test } from "@playwright/test";

// 回归：代码块折叠必须真正把代码区收缩为 0（后续内容上移），并能用语言胶囊点开。
// 旧实现把 class 加在 .cb-code-area 上，而 React 外壳与代码区是叔侄关系，
// querySelector 永远匹配不到 → 折叠从未生效。折叠后靠 grid 0fr 收缩，
// 因此必须断言真实几何：代码区高度归零 + 下方内容 y 坐标上移。
test.setTimeout(90_000);

test("代码块折叠后内容上移，点语言胶囊可展开", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/demo/editor");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60000 });

  // 选一个后面还有内容块的代码块，才能断言「下方内容随折叠上移」
  const idx = await page.evaluate(() =>
    [...document.querySelectorAll(".code-block-node-view")].findIndex((el) => el.nextElementSibling),
  );
  expect(idx).toBeGreaterThanOrEqual(0);

  const wrapper = page.locator(".code-block-node-view").nth(idx);
  const codeArea = wrapper.locator(".cb-code-area").first();
  await wrapper.scrollIntoViewIfNeeded();
  await expect(wrapper).not.toHaveClass(/code-block-node-view--collapsed/);

  const before = await codeArea.boundingBox();
  const nextBlock = wrapper.locator("xpath=following-sibling::*[1]");
  const nextBefore = await nextBlock.boundingBox();
  expect(before!.height).toBeGreaterThan(40);

  // NodeView 工具栏 hover 才显现，直接派发 DOM click 触发 React onClick
  const foldBtn = wrapper.locator('.cb-actions button[title="折叠"]').first();
  await foldBtn.evaluate((el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));

  await expect(wrapper).toHaveClass(/code-block-node-view--collapsed/);
  const bar = wrapper.locator(".cb-collapsed-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText(/\w/);

  // 折叠动画结束后（0.3s）代码区高度归零
  await page.waitForTimeout(600);
  const collapsed = await codeArea.boundingBox();
  const nextAfter = await nextBlock.boundingBox();
  expect(collapsed!.height).toBeLessThan(2);
  expect(nextBefore!.y - nextAfter!.y).toBeGreaterThan(before!.height - 4);

  // 点胶囊展开
  await bar.click();
  await expect(wrapper).not.toHaveClass(/code-block-node-view--collapsed/);
  await expect(wrapper.locator(".cb-collapsed-bar")).toHaveCount(0);
  await page.waitForTimeout(600);
  const expanded = await codeArea.boundingBox();
  expect(Math.abs(expanded!.height - before!.height)).toBeLessThan(2);

  expect(errors).toEqual([]);
});
