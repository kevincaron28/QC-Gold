@echo off
setlocal
rem Opens the Guilded Companion desktop app (tray icon + window). No console window stays open.
rem First time: run  npm install  inside the companion-app folder.
cd /d "%~dp0companion-app"
if not exist node_modules\electron\dist\electron.exe (
  echo The companion app is not installed yet. Running: npm install
  call npm.cmd install
)
set ELECTRON_RUN_AS_NODE=
start "" "%~dp0companion-app\node_modules\electron\dist\electron.exe" "%~dp0companion-app"
exit /b 0
