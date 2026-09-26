@echo off
rem Opens the Quebec Gold Companion desktop app (tray icon + window).
rem First time: run  npm install  inside the companion-app folder.
cd /d "%~dp0companion-app"
if not exist node_modules\electron\dist\electron.exe (
  echo The companion app is not installed yet. Running: npm install
  call npm.cmd install
)
set ELECTRON_RUN_AS_NODE=
call npm.cmd start
