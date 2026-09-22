@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22 or later first.
  pause
  exit /b 1
)
node scripts\prepare-github.mjs
if errorlevel 1 (
  echo Preparation failed. Check the error above.
  pause
  exit /b 1
)
echo Add GitHubSource in GitHub Desktop, commit, and publish as public.
start "" "%~dp0GitHubSource"
pause
