/**
 * 多浏览器打包脚本
 *
 * 用法：
 *   node scripts/build.mjs               # 默认构建全部
 *   node scripts/build.mjs chrome        # 仅 chrome
 *   node scripts/build.mjs firefox       # 仅 firefox
 *   node scripts/build.mjs edge          # 仅 edge
 *   node scripts/build.mjs package       # 把三个版本打包为 zip
 *   node scripts/build.mjs icons         # 生成 PNG 图标（需 sharp）
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");
const targets = ["chrome", "edge", "firefox"];

// 读取 manifest 中的版本号，用于命名 zip
function readVersion() {
  const manifestPath = join(root, "manifest.json");
  if (!existsSync(manifestPath)) return "0.0.0";
  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// CRC32 表（用于 ZIP 文件校验）
const crc32Table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crc32Table[i] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crc32Table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// 跨平台 ZIP 打包（STORE 模式，不压缩）
// Chrome Web Store 接受 STORE 模式 zip；零依赖，Windows/Mac/Linux 通用
function zipDir(srcDir, outFile) {
  const files = [];
  const walk = (dir, base = "") => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = base ? `${base}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        walk(full, rel);
      } else {
        files.push({ rel, data: readFileSync(full) });
      }
    }
  };
  walk(srcDir);

  const chunks = [];
  const central = [];
  let offset = 0;

  for (const { rel, data } of files) {
    const nameBuf = Buffer.from(rel, "utf-8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8); // 压缩方式：0=STORE
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    chunks.push(localHeader, nameBuf, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralBuf.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  writeFileSync(outFile, Buffer.concat([...chunks, centralBuf, endRecord]));
  return files.length;
}

function log(...args) {
  console.log("[build]", ...args);
}

function copyRecursive(src, dest) {
  if (!existsSync(src)) return;
  const stat = statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyRecursive(join(src, entry), join(dest, entry));
    }
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
}

async function generateIcons() {
  log("生成图标 ...");
  const iconsDir = join(root, "public", "icons");
  mkdirSync(iconsDir, { recursive: true });

  // 优先用 icon-source.png（用户放置的真实品牌图），其次用 icon.svg
  const pngPath = join(iconsDir, "icon-source.png");
  const svgPath = join(iconsDir, "icon.svg");
  let srcBuf;
  if (existsSync(pngPath)) {
    srcBuf = readFileSync(pngPath);
    log("  使用 icon-source.png 作为图标源");
  } else if (existsSync(svgPath)) {
    srcBuf = readFileSync(svgPath);
    log("  使用 icon.svg 作为图标源");
  } else {
    // 兜底：写入默认 SVG
    const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#14B8A6"/><stop offset="100%" stop-color="#0D9488"/>
      </linearGradient></defs>
      <rect width="256" height="256" rx="42" fill="url(#bg)"/>
    </svg>`;
    writeFileSync(svgPath, defaultSvg);
    srcBuf = Buffer.from(defaultSvg);
    log("  使用默认 SVG 图标");
  }

  // 尝试用 sharp 生成 PNG
  let sharp = null;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    log("  ⚠️  未安装 sharp，跳过 PNG 生成");
    log("     运行：npm i -D sharp，然后重新执行 npm run build");
    log("     或手动用 https://realfavicongenerator.net 把 icon.svg 转成多尺寸 PNG");
    return false;
  }

  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    await sharp(srcBuf)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, `icon-${size}.png`));
  }
  log(`  ✓ PNG 图标已生成：${sizes.join(", ")}`);
  return true;
}

async function buildTarget(target) {
  log(`构建 ${target} ...`);
  const distDir = join(root, "dist", target);
  if (!existsSync(distDir)) {
    log(`  dist/${target} 不存在，请先运行：TARGET=${target} npx vite build`);
    return;
  }
  const manifestSrc =
    target === "firefox" ? "manifest.firefox.json" : "manifest.json";
  const manifestPath = join(root, manifestSrc);
  if (!existsSync(manifestPath)) {
    log(`  找不到 ${manifestSrc}`);
    return;
  }
  const manifestContent = JSON.parse(readFileSync(manifestPath, "utf-8"));
  writeFileSync(
    join(distDir, "manifest.json"),
    JSON.stringify(manifestContent, null, 2),
  );

  // content-script 的 CSS 是独立文件（manifest.content_scripts.css 引用），
  // vite 只把 content-script.ts 作为 JS 入口打包，不会处理这份 CSS，需手动复制
  const contentCssSrc = join(root, "src", "content", "content.css");
  if (existsSync(contentCssSrc)) {
    mkdirSync(join(distDir, "content"), { recursive: true });
    copyFileSync(contentCssSrc, join(distDir, "content", "content.css"));
  }

  const iconsDir = join(root, "public", "icons");
  if (existsSync(iconsDir)) {
    copyRecursive(iconsDir, join(distDir, "icons"));
  }
  log(`  ✓ ${target} 已就绪：dist/${target}/`);
}

async function packageAll(target) {
  const list = target ? [target] : targets;
  log(`打包 zip ...`);
  const version = readVersion();
  for (const t of list) {
    const distDir = join(root, "dist", t);
    if (!existsSync(distDir)) {
      log(`  跳过 ${t}（未构建）`);
      continue;
    }
    const zipFile = join(root, "dist", `qingwu-clipper-${t}-v${version}.zip`);
    const count = zipDir(distDir, zipFile);
    log(`  ✓ ${zipFile}（${count} 个文件）`);
  }
}

const argv = process.argv.slice(2);
const cmd = argv[0] ?? "all";

if (cmd === "package") {
  const target = argv[1];
  if (target && !targets.includes(target)) {
    log(`未知目标：${target}，可选：${targets.join(", ")}`);
  } else {
    await packageAll(target);
  }
} else if (cmd === "icons") {
  await generateIcons();
} else if (targets.includes(cmd)) {
  await buildTarget(cmd);
} else {
  // 默认：生成图标 + 构建三个目标
  await generateIcons();
  for (const t of targets) await buildTarget(t);
  log("完成");
}
