@echo off
cd /d "%~dp0"
echo %date% %time% START >> update_log.txt

:: Check orders (fast, 1 request)
python check_orders.py >> update_log.txt 2>&1

:: Run full scraper only at scheduled times (not every 30 min)
for /f "tokens=1-2 delims=:" %%a in ("%time: =0%") do set HH=%%a&set MM=%%b
if "%HH%"=="10" if %MM% GEQ 35 if %MM% LEQ 45 goto SCRAPE
if "%HH%"=="11" if %MM% LEQ 10 goto SCRAPE
if "%HH%"=="14" if %MM% GEQ 35 if %MM% LEQ 45 goto SCRAPE
if "%HH%"=="15" if %MM% LEQ 10 goto SCRAPE
if "%HH%"=="17" if %MM% GEQ 35 if %MM% LEQ 45 goto SCRAPE
if "%HH%"=="18" if %MM% LEQ 10 goto SCRAPE
goto PUSH

:SCRAPE
echo %date% %time% SCRAPING >> update_log.txt
python scraper/scraper.py >> update_log.txt 2>&1

:PUSH
git add public/data/ >nul 2>&1
git diff --cached --quiet >nul 2>&1
if %errorlevel% equ 0 (echo %date% %time% NO CHANGES >> update_log.txt & exit /b 0)
git commit -m "Auto update" >nul 2>&1
git pull --rebase >nul 2>&1
git push >nul 2>&1
echo %date% %time% DONE >> update_log.txt
