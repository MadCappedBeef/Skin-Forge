@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22 or later first.
  pause
  exit /b 1
)
if not exist "node_modules\wrangler\bin\wrangler.js" (
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 exit /b 1
)
echo This creates the community D1 database in your Cloudflare account and applies its schema.
node scripts\setup-community.mjs
if errorlevel 1 (
  echo Setup failed. Log in with Cloudflare.bat and try again.
  pause
  exit /b 1
)
pause
