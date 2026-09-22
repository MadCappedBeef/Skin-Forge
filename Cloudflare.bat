@echo off
setlocal
cd /d "%~dp0"
title SkinForge - Cloudflare
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org first.
  pause
  exit /b 1
)
if not exist "node_modules\wrangler\bin\wrangler.js" (
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
:menu
cls
echo SkinForge - Cloudflare Pages and R2
echo.
echo First deployment: use options 1, 2, 3, then 4.
echo Enable R2 in your Cloudflare account before creating the bucket.
echo Bucket and project settings are in wrangler.jsonc and package.json.
echo.
echo 1. Log in to Cloudflare
echo 2. Create the skinforge-assets R2 bucket - one time only
echo 3. Upload original models and textures to R2
echo 4. Publish the website to Cloudflare Pages
echo 5. Check files locally
echo 6. Exit
choice /c 123456 /n /m "Choose an option: "
if errorlevel 6 exit /b 0
if errorlevel 5 goto check
if errorlevel 4 goto deploy
if errorlevel 3 goto upload
if errorlevel 2 goto bucket
call npm.cmd run cloudflare:login
goto done
:bucket
call npm.cmd run cloudflare:create-bucket
goto done
:upload
call npm.cmd run cloudflare:upload
goto done
:deploy
call npm.cmd run cloudflare:deploy
goto done
:check
call npm.cmd run check
:done
if errorlevel 1 echo The operation failed. Review the message above before continuing.
pause
goto menu
