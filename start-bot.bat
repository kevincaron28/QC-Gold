@echo off
cd /d "%~dp0"
title Quebec Gold Bot
echo Starting Quebec Gold Bot...
echo (this window is the bot's console - closing it stops the bot)
echo.

rem Bring the database and the generated Prisma client up to date first, so
rem new versions of the bot just work. Safe to run every time (only applies
rem migrations that are missing). If it fails, the bot is NOT started, because
rem it would crash on the old database.
echo Updating the database...
call npm.cmd run db:update
if errorlevel 1 (
  echo.
  echo ============================================================
  echo  The database update failed, so the bot was not started.
  echo  If the message mentions EPERM, another copy of the bot is
  echo  still running: close its window, then run this again.
  echo ============================================================
  pause
  exit /b 1
)

rem Start the companion (sends addon data to the bot) in its own window.
rem The first time, it asks a few setup questions there.
start "Quebec Gold Companion" cmd /c "%~dp0start-companion.bat"

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
