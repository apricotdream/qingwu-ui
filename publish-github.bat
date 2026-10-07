@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   项目上传到 GitHub （注意要在项目根目录下执行！）
echo ============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [X] 未检测到 git，请先安装: https://git-scm.com/
  pause
  exit /b 1
)

echo [1/3] 暂存变更...
git add -A

REM git diff --cached --quiet 在有暂存内容时返回 1
git diff --cached --quiet
if errorlevel 1 (
  set "MSG="
  set /p "MSG=请输入 commit message（回车使用默认）: "
  if "!MSG!"=="" set "MSG=update: %date% %time%"
  echo [2/3] 提交: !MSG!
  git commit -m "!MSG!"
  if errorlevel 1 (
    echo [X] 提交失败
    pause
    exit /b 1
  )
) else (
  echo [2/3] 无变更可提交，跳过 commit
)

echo [3/3] 推送到 GitHub...
REM 判断当前分支是否已有 upstream（无则首次推送，设置 -u）
git rev-parse --abbrev-ref --symbolic-full-name @{u} >nul 2>&1
if errorlevel 1 (
  echo     首次推送，设置 upstream origin main...
  git push -u origin main
) else (
  git push
)
if errorlevel 1 (
  echo [X] 推送失败，请检查网络 / 权限 / 远程地址
  pause
  exit /b 1
)

echo.
echo ============================================
echo   已上传到 GitHub
echo ============================================
pause
endlocal