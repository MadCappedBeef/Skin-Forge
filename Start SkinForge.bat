@echo off
setlocal
cd /d "%~dp0"
title SkinForge - Cloudflare Preview
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js from https://nodejs.org first.
  pause
  exit /b 1
)
echo Keep this window open while using the local preview.
node scripts/preview.mjs --open
if errorlevel 1 pause
