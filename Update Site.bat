@echo off
setlocal
cd /d "%~dp0"
title SkinForge - Update Cloudflare Site
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22 or later from https://nodejs.org first.
  pause
  exit /b 1
)
if not exist "node_modules\wrangler\bin\wrangler.js" (
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 goto failed
)
echo Checking and publishing the website from this SkinForge folder...
echo The existing R2 models and textures do not need uploading for this update.
echo.
call npm.cmd run cloudflare:deploy
if errorlevel 1 goto failed
echo.
echo Website update complete. Open the production URL printed above.
pause
exit /b 0
:failed
echo.
echo Update failed. Check the error above.
echo If login is required, open Cloudflare.bat and choose option 1, then try again.
pause
exit /b 1
