@echo off
cd /d "%~dp0"
title Guilded Companion
if not exist "companion\companion.config.json" (
  echo The companion isn't set up yet. Running setup first...
  call npm.cmd run companion:setup
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Guilded companion: sends your addon data to the bot after each /reload or logout.
echo Leave this window open while you play. Close it to stop.
echo.
:loop
call npm.cmd run companion:watch
echo.
echo The companion stopped at %date% %time%. Restarting in 10 seconds... close this window to stop it.
timeout /t 10 /nobreak >nul
goto loop
