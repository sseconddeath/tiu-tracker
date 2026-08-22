@echo off
cd /d "%~dp0"
python scraper/scraper.py >nul 2>&1
if %errorlevel% neq 0 exit /b 1
if not exist "public\data\latest.json" exit /b 1
git add public/data/latest.json >nul 2>&1
git commit -m "Auto update" >nul 2>&1
git pull --rebase >nul 2>&1
git push >nul 2>&1
