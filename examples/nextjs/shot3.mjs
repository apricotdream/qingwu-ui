import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:3000/demo/skeleton", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
// 小图（顶部 400px）
await page.screenshot({ path: "./sk-top.png", clip: { x: 0, y: 0, width: 1280, height: 420 } });
// 按钮区特写
await page.locator(".sk-toggle").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: "./sk-btn.png", clip: { x: 0, y: 0, width: 900, height: 300 } });
await browser.close();
console.log("done");
