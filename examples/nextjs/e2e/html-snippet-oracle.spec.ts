import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const PAGES = [
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

mkdirSync(".tmp-html", { recursive: true });

for (const name of PAGES) {
  test(`${name} HTML snippet 自包含可运行`, async ({ page }) => {
    await page.goto(`/demo/${name}`);
    await page.locator(".demo-code-tabs").first().getByRole("button", { name: "HTML" }).click();
    const code = (await page.locator(".demo-card-code pre code").first().textContent()) ?? "";
    expect(code).toContain("<!doctype html>");
    const file = `.tmp-html/${name}.html`;
    writeFileSync(file, code);

    const errors: string[] = [];
    const fp = await page.context().newPage();
    fp.on("pageerror", (e) => errors.push(`${e.name}: ${e.message}`));
    await fp.goto(`file://${process.cwd()}/${file.replace(/\//g, "\\")}`);
    await fp.waitForTimeout(2500);

    expect(errors, errors.join("\n")).toEqual([]);
    await fp.close();
  });
}
