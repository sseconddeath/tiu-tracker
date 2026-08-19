@echo off
title TIU Tracker
echo.
echo ========================================
echo   TIU Tracker - collecting data
echo ========================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Python NOT installed!
    echo   Download: https://www.python.org/downloads/
    echo   CHECK the box "Add Python to PATH" !!!
    echo.
    pause
    exit /b 1
)
echo   Python - OK

git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Git NOT installed!
    echo   Download: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)
echo   Git    - OK

echo.
echo [1/4] Installing dependencies...
pip install requests beautifulsoup4 --quiet >nul 2>&1
echo       Done!

echo.
echo ========================================
echo [2/4] Scraping incoming.tyuiu.ru
echo       DO NOT close this window!
echo ========================================
echo.
cd /d "%~dp0"
python scraper/scraper.py

if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Scraper failed.
    echo   Send screenshot of this window.
    echo.
    pause
    exit /b 1
)

if not exist "public\data\latest.json" (
    echo.
    echo   [ERROR] Data file not created.
    echo.
    pause
    exit /b 1
)

echo.
echo [3/4] Pushing to GitHub...
echo.

git add public/data/latest.json
git commit -m "Update data"
git push

if %errorlevel% neq 0 (
    echo.
    echo   [!] Could not push via git.
    echo   Open GitHub Desktop - commit and push there.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo [4/4] DONE!
echo       Site will update in 1-2 minutes.
echo ========================================
echo.
pause
