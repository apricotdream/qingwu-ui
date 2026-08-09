@echo off
setlocal enabledelayedexpansion

REM ============================================
REM   npm 制品库发布凭据配置脚本
REM   用法:
REM     setup-kkrepo-auth.bat [registry-url]
REM     不带参数则交互输入 registry URL
REM   默认: http://192.168.3.8:8980/repository/npm-ugreen/
REM   三种方式:
REM     [1] 粘贴 token（免邮箱，推荐）
REM     [2] 用户名/密码（免邮箱，自动 base64 写 _auth）
REM     [3] npm adduser 登录（可能需要邮箱）
REM ============================================

set "REGISTRY=%~1"
if "%REGISTRY%"=="" (
  set /p "REGISTRY=请输入 npm registry URL（回车用默认 http://192.168.3.8:8980/repository/npm-ugreen/）: "
  if "!REGISTRY!"=="" set "REGISTRY=http://192.168.3.8:8980/repository/npm-ugreen/"
)

echo ============================================
echo   npm 制品库凭据配置（npm publish 用）
echo   目标: %REGISTRY%
echo ============================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [X] 未检测到 npm，请先安装 Node.js: https://nodejs.org/
  pause
  exit /b 1
)

echo 选择认证方式：
echo   [1] 粘贴 token（免邮箱，推荐）
echo   [2] 用户名/密码（免邮箱）
echo   [3] npm adduser 登录（可能需要邮箱）
set /p "MODE=请输入 1 / 2 / 3（回车默认 1）: "
if "!MODE!"=="" set "MODE=1"

if "!MODE!"=="3" goto adduser
if "!MODE!"=="2" goto userpass

REM ---------------- 方式 1：粘贴 token ----------------
echo.
echo [1/2] 请粘贴制品库的发布 token（在制品库网页端生成，形如 NpmToken.xxx 或 base64 串）：
set /p "TOKEN=token: "
if "!TOKEN!"=="" (
  echo [X] token 不能为空
  pause
  exit /b 1
)
set "AUTHKEY=_authToken=%TOKEN%"
goto write

REM ---------------- 方式 2：用户名/密码（免邮箱） ----------------
:userpass
echo.
echo [1/2] 输入用户名 / 密码（无需邮箱）：
set /p "NU=用户名: "
if "!NU!"=="" (
  echo [X] 用户名不能为空
  pause
  exit /b 1
)
echo   注意：密码将明文显示在屏幕上。
set /p "NP=密码: "

REM 用 node 生成 base64(user:password)，写入 _auth
set "BASE64="
for /f "delims=" %%b in ('node -e "console.log(btoa(process.env.NU+String.fromCharCode(58)+process.env.NP))"') do set "BASE64=%%b"
if "!BASE64!"=="" (
  echo [X] base64 生成失败，请确认 node 可用
  pause
  exit /b 1
)
set "AUTHKEY=_auth=%BASE64%"
goto write

REM ---------------- 方式 3：npm adduser ----------------
:adduser
echo.
echo [1/2] 执行 npm adduser 登录（输入制品库的 用户名 / 密码 / 邮箱）...
call npm adduser --registry "%REGISTRY%" --auth-type=legacy
if errorlevel 1 (
  echo.
  echo [X] npm adduser 登录失败。可改选方式 1 粘贴 token 或方式 2 用户名/密码（均免邮箱）。
  pause
  exit /b 1
)
echo [2/2] 验证凭据...
call npm whoami --registry "%REGISTRY%"
if errorlevel 1 (
  echo [X] 验证失败，请检查 ~/.npmrc 中的凭据
  pause
  exit /b 1
)
goto done

REM ---------------- 写入 ~/.npmrc ----------------
:write
set "NPMRC=%USERPROFILE%\.npmrc"
set "KEY=%REGISTRY%"
if "!KEY:~0,7!"=="http://" set "KEY=!KEY:~7!"
if "!KEY:~0,8!"=="https://" set "KEY=!KEY:~8!"
set "KEY=//!KEY!"
if not exist "%NPMRC%" type nul > "%NPMRC%"
echo %KEY%:%AUTHKEY%>> "%NPMRC%"
echo [2/2] 已写入 %NPMRC%
echo.
echo 验证凭据...
call npm whoami --registry "%REGISTRY%"
if errorlevel 1 (
  echo [X] 验证失败。检查：凭据是否正确 / 该 registry 是否用 _authToken 而非 _auth
  pause
  exit /b 1
)

:done
echo.
echo ============================================
echo   凭据配置成功！现在可以 npm publish
echo ============================================
pause
endlocal


