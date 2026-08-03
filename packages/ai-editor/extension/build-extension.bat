@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   青梧 Web Clipper 一键构建扩展
echo ============================================
echo.

echo [1/4] 检查 Node.js...
where node >nul 2>&1
if errorlevel 1 (
  echo [X] 未检测到 Node.js，请先安装: https://nodejs.org/
  pause
  exit /b 1
)
echo     OK

echo [2/4] 检查依赖...
if not exist "node_modules" (
  echo     未安装，正在执行 npm install...
  call npm install
  if errorlevel 1 (
    echo [X] 依赖安装失败
    pause
    exit /b 1
  )
) else (
  echo     OK
)

echo [3/4] 构建三个浏览器版本 chrome / edge / firefox...
for %%t in (chrome edge firefox) do (
  echo     ---- 构建 %%t ----
  call npm run build:%%t
  if errorlevel 1 (
    echo [X] %%t 构建失败
    pause
    exit /b 1
  )
)

echo [4/4] 打包 zip...
call npm run package
if errorlevel 1 (
  echo [X] 打包失败
  pause
  exit /b 1
)

echo.
echo ============================================
echo   构建完成!产物 zip:
echo ============================================
dir /b "dist\qingwu-clipper-*-v*.zip" 2>nul
echo.
echo   未打包的可加载目录(浏览器调试用):
echo     dist\chrome   dist\edge   dist\firefox
echo.
pause
endlocal