@echo off
title TIU Tracker - Setup
echo.
echo Setting up scheduled tasks...
echo.

for %%t in (0840 0900 1240 1300 1540 1600) do schtasks /delete /tn "TIU_Update_%%t" /f >nul 2>&1

set PW=pythonw.exe
set SC="%~dp0auto_update.py"

schtasks /create /tn "TIU_Update_0840" /tr "%PW% %SC%" /sc daily /st 10:40 /f
schtasks /create /tn "TIU_Update_0900" /tr "%PW% %SC%" /sc daily /st 11:00 /f
schtasks /create /tn "TIU_Update_1240" /tr "%PW% %SC%" /sc daily /st 14:40 /f
schtasks /create /tn "TIU_Update_1300" /tr "%PW% %SC%" /sc daily /st 15:00 /f
schtasks /create /tn "TIU_Update_1540" /tr "%PW% %SC%" /sc daily /st 17:40 /f
schtasks /create /tn "TIU_Update_1600" /tr "%PW% %SC%" /sc daily /st 18:00 /f

echo.
echo Done! 6 silent tasks created.
echo No windows, no popups.
echo.
pause
