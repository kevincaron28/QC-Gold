@echo off
rem Makes the Guilded companion start by itself when you log in to Windows.
rem Double-click once. To undo, delete "Guilded Companion" from the Startup folder
rem (Win+R, shell:startup).
cd /d "%~dp0\.."
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Guilded Companion.lnk'); $s.TargetPath='%CD%\start-companion.bat'; $s.WorkingDirectory='%CD%'; $s.WindowStyle=7; $s.Save()"
echo The companion will now start when you log in to Windows.
pause
