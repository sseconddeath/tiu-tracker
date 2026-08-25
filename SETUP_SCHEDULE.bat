@echo off
title TIU Tracker - Setup
echo.
echo Removing old tasks...
for %%t in (0840 0900 1240 1300 1540 1600) do schtasks /delete /tn "TIU_Update_%%t" /f >nul 2>&1
schtasks /delete /tn "TIU_Orders_Check" /f >nul 2>&1

echo Creating task...

set BAT="%~dp0AUTO_UPDATE.bat"

schtasks /create /tn "TIU_Orders_Check" /tr "cmd /c %BAT%" /sc minute /mo 20 /st 09:00 /et 20:00 /f /rl HIGHEST

echo.
echo Done!
echo Check every 20 min (9:00-20:00 Tyumen)
echo Full scrape at 10:40, 11:00, 14:40, 15:00, 17:40, 18:00
echo.
pause
