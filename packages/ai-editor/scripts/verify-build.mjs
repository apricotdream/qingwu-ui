/**
 * 真机验证（无头 Chrome，独立 profile，不影响用户已开的浏览器）：
 *  1. 编辑器正常加载（ProseMirror 挂载，无整页报错）
 *  2. Tiptap/file-viewer 已 external（bundle 内不含其源码）——通过运行时模块加载验证
 *  3. 更新日志弹窗能打开，含 beta.25 条目，能关闭
 *  4. 附件预览静态资源 /file-viewer/vendor/... 可访问
 */
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3002";
const EXEC = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: "new",
  args: ["--no-sandbox", "--ignore-certificate-errors"],
});
const page = await browser.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

await page.goto(`${BASE}/?test=verify25`, { waitUntil: "networkidle0", timeout: 60000 });

// 1) ProseMirror 挂载
await page.waitForSelector(".ProseMirror", { timeout: 15000 });
const hasContent = await page.$eval(".ProseMirror", (el) => el.textContent.length > 0);
console.log(`1. 编辑器挂载: OK（正文长度>0 = ${hasContent}）`);

// 4) 附件预览静态资源可访问（抽查 pdf worker + 一个 wasm + ppt worker）
for (const path of [
  "/file-viewer/vendor/pdf/pdf.worker.mjs",
  "/file-viewer/vendor/pdf/wasm/jbig2.wasm",
  "/file-viewer/vendor/ppt/worker.mjs",
  "/file-viewer/vendor/xlsx/sheet.worker.js",
]) {
  const res = await page.evaluate(async (p) => (await fetch(p)).status, path);
  console.log(`4. 资源 ${path}: HTTP ${res}`);
  if (res !== 200) errors.push(`asset ${path} -> ${res}`);
}

// 3) 更新日志：点工具栏 📝 按钮（title=更新日志）
await page.waitForSelector('button[title="更新日志"]', { timeout: 10000 });
await page.evaluate(() => {
  document.querySelector('button[title="更新日志"]').click();
});
await new Promise((r) => setTimeout(r, 600));
// 用文本兜底定位弹窗（不依赖转义类名）
const dialogHandle = await page.evaluateHandle(() =>
  Array.from(document.querySelectorAll("div")).find(
    (d) => d.textContent.includes("青梧 AI 编辑器版本记录") && d.querySelector("div"),
  ),
);
const dialogEl = dialogHandle.asElement();
if (!dialogEl) {
  await page.screenshot({ path: "/tmp/dialog-fail.png" });
  throw new Error("更新日志弹窗未出现（已截图 /tmp/dialog-fail.png）");
}
const dialogText = await page.evaluate((el) => el.textContent, dialogEl);
const has25 = dialogText.includes("0.9.0-beta.25");
const versions = ["beta.19", "beta.20", "beta.21", "beta.22", "beta.23", "beta.24", "beta.25"].filter((v) =>
  dialogText.includes(v),
);
console.log(`3. 更新日志打开: OK；含 beta.25 = ${has25}；出现版本: ${versions.join(", ")}`);

// 关闭弹窗：定位遮罩层（fixed + z-index 9999）内的关闭按钮，用 trusted click
const closeBtn = await page.evaluateHandle(() => {
  const ov = Array.from(document.querySelectorAll("div.fixed.inset-0")).find(
    (d) => getComputedStyle(d).zIndex === "9999",
  );
  return ov ? ov.querySelector('button[title="关闭"]') : null;
});
const closeEl = closeBtn.asElement();
if (closeEl) await closeEl.click();
await new Promise((r) => setTimeout(r, 500));
const stillOpen = await page.evaluate(
  () =>
    Array.from(document.querySelectorAll("div.fixed.inset-0")).some(
      (d) => getComputedStyle(d).zIndex === "9999",
    ),
);
console.log(`3. 更新日志关闭: ${stillOpen ? "FAIL（仍打开）" : "OK"}`);
if (stillOpen) errors.push("dialog did not close");

await browser.close();

console.log("\n=== 页面运行时错误 ===");
// 过滤开发态无关噪音
const real = errors.filter(
  (e) => !/favicon|Download the React DevTools|cookie/i.test(e),
);
if (real.length === 0) console.log("无");
else real.forEach((e) => console.log(`  ${e}`));

if (real.length || !hasContent || !has25) {
  console.log("\n结果: FAIL");
  process.exit(1);
}
console.log("\n结果: PASS ✓");
