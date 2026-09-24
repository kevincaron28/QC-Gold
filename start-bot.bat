@echo off
cd /d "%~dp0"
echo Starting Quebec Gold Bot...
echo (this window is the bot's console - closing it stops the bot)
echo.
call npm.cmd run start:local
echo.
echo Bot process exited.
pause
