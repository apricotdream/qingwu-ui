#!/usr/bin/env bash
# 青梧 Web Clipper 一键构建扩展
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================"
echo "  青梧 Web Clipper 一键构建扩展"
echo "============================================"
echo ""

echo "[1/4] 检查 Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "[X] 未检测到 Node.js,请先安装:https://nodejs.org/"
  exit 1
fi
echo "    OK"

echo "[2/4] 检查依赖..."
if [ ! -d node_modules ]; then
  echo "    未安装,正在执行 npm install..."
  npm install
else
  echo "    OK"
fi

echo "[3/4] 构建三个浏览器版本 chrome / edge / firefox..."
for t in chrome edge firefox; do
  echo "    ---- 构建 $t ----"
  npm run "build:$t"
done

echo "[4/4] 打包 zip..."
npm run package

echo ""
echo "============================================"
echo "  构建完成!产物 zip:"
echo "============================================"
ls -1 dist/qingwu-clipper-*-v*.zip 2>/dev/null | sed 's/^/  /' || true
echo ""
echo "  未打包的可加载目录(浏览器调试用):"
echo "    dist/chrome   dist/edge   dist/firefox"
echo ""