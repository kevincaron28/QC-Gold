@echo off
rem Makes the Quebec Gold companion start by itself when you log in to Windows.
rem Double-click once. To undo, delete "Quebec Gold Companion" from the Startup folder
rem (Win+R, shell:startup).
cd /d "%~dp0\.."
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Quebec Gold Companion.lnk'); $s.TargetPath='%CD%\start-companion.bat'; $s.WorkingDirectory='%CD%'; $s.WindowStyle=7; $s.Save()"
echo The companion will now start when you log in to Windows.
pause
