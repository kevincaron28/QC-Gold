@echo off
cd /d "%~dp0"
title Quebec Gold Bot
echo Starting Quebec Gold Bot...
echo (this window is the bot's console - closing it stops the bot)
echo.

rem Restarts the bot automatically if it crashes or its connection drops.
rem Close this window (or press Ctrl+C, then Y) to stop it for good.
:loop
call npm.cmd run start:local
echo.
echo ============================================================
echo  The bot stopped at %date% %time%.
echo  Restarting in 10 seconds... close this window to stop it.
echo ============================================================
timeout /t 10 /nobreak >nul
goto loop
