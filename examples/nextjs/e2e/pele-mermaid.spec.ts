import { expect, test, type Page } from "@playwright/test";

// pele 替换 beautiful-mermaid 后的真机验证：
// 多图表类型渲染、错误态、青梧主题色、暗色模式、缩放灯箱。
test.setTimeout(120_000);

const DIAGRAMS: Record<string, string> = {
  flowchart: [
    "flowchart LR",
    "  A[开始] --> B{判断?}",
    "  B -->|是| C[执行]",
    "  B -->|否| D[结束]",
  ].join("\n"),
  sequence: [
    "sequenceDiagram",
    "  Alice->>John: 你好 John",
    "  John-->>Alice: 你好!",
  ].join("\n"),
  gantt: ["gantt", "  title 计划", "  section 一阶段", "  任务A :a1, 2026-10-01, 7d"].join("\n"),
  pie: ['pie title 占比', '  "A" : 40', '  "B" : 60'].join("\n"),
};

// 在文末新起一段，用 ```mermaid 输入规则创建代码块并填入源码
async function insertMermaidBlock(page: Page, source: string) {
  await page.evaluate(() => {
    const ps = document.querySelectorAll(".ProseMirror > p");
    (ps[ps.length - 1] as HTMLElement).scrollIntoView({ block: "center" });
  });
  const ps = page.locator(".ProseMirror > p");
  await ps.last().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  await page.keyboard.type("```mermaid", { delay: 15 });
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);

  const block = page
    .locator(".code-block-node-view")
    .filter({ has: page.locator('button[title="渲染图表"]') })
    .last();
  await expect(block).toBeVisible();

  // 新块为空，光标应已在块内；一次性插入多行源码（CDP insertText，
  // 不逐键按 Enter，避免代码块与紧邻下段发生合并）
  await page.keyboard.insertText(source);
  await expect
    .poll(async () => (await block.locator("code").textContent())?.replace(/\u200b/g, ""))
    .toBe(source);
  return block;
}

async function clickRender(block: ReturnType<Page["locator"]>) {
  await block
    .locator('.cb-actions button[title="渲染图表"]')
    .evaluate((el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
}

for (const [name, source] of Object.entries(DIAGRAMS)) {
  test(`pele 渲染 ${name} 并可缩放`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/demo/editor");
    await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60_000 });

    const block = await insertMermaidBlock(page, source);
    await clickRender(block);

    await expect(block.locator(".cb-diagram-error")).toHaveCount(0, { timeout: 30_000 });
    const svg = block.locator(".cb-diagram-svg svg.pele");
    await expect(svg).toBeVisible({ timeout: 30_000 });
    const style = (await svg.getAttribute("style")) ?? "";
    expect(style).toContain("--pele-fg");
    expect(await svg.locator("path, rect, circle, ellipse, polygon, line, g").count()).toBeGreaterThan(5);
    expect(await svg.evaluate((el) => el.getAttribute("class"))).toContain(`pele-${name}`);
    expect(errors).toEqual([]);

    // 点击打开缩放灯箱
    await block.locator(".cb-diagram-svg").click();
    const lightbox = page.getByRole("dialog", { name: "Mermaid 图表预览" });
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator("svg.pele")).toBeVisible();
    const zoomAccent = await page
      .locator(".cb-diagram-zoom-content")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--pele-accent"));
    expect(zoomAccent.trim()).not.toBe("");
    await page.keyboard.press("Escape");
    await expect(lightbox).toHaveCount(0);
  });
}

test("pele 语法错误显示错误信息且不崩溃", async ({ page }) => {
  await page.goto("/demo/editor");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60_000 });

  const block = await insertMermaidBlock(page, "flowchart LR\n  A --> --> ");
  await clickRender(block);

  await expect(block.locator(".cb-diagram-error")).toBeVisible({ timeout: 30_000 });
  await expect(block.locator(".cb-diagram-error")).toContainText(/line|Parse|Expecting/i);
  await expect(block.locator("svg.pele")).toHaveCount(0);
});

test("暗色模式下 pele 变量正确切换", async ({ page }) => {
  await page.goto("/demo/editor");
  await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60_000 });

  const block = await insertMermaidBlock(page, DIAGRAMS.flowchart);
  await clickRender(block);
  const output = block.locator(".cb-diagram-output");
  await expect(output.locator("svg.pele")).toBeVisible({ timeout: 30_000 });

  const light = await output.evaluate((el) => ({
    fg: getComputedStyle(el).getPropertyValue("--pele-fg").trim(),
    accent: getComputedStyle(el).getPropertyValue("--pele-accent").trim(),
  }));
  expect(light.fg).toContain("#11181c");
  expect(light.accent).toContain("#0891b2");

  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(300);
  const dark = await output.evaluate((el) => ({
    fg: getComputedStyle(el).getPropertyValue("--pele-fg").trim(),
    accent: getComputedStyle(el).getPropertyValue("--pele-accent").trim(),
  }));
  expect(dark.fg).toBe("#f4f4f5");
  expect(dark.fg).not.toBe(light.fg);
});
