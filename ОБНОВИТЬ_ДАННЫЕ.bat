@echo off
chcp 65001 >nul
title TIU Tracker — Сбор данных
echo.
echo ══════════════════════════════════════════
echo   TIU Tracker — Сбор данных
echo ══════════════════════════════════════════
echo.

:: Проверяем Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   [!] Python НЕ установлен!
    echo.
    echo   Скачай: https://www.python.org/downloads/
    echo   При установке ОБЯЗАТЕЛЬНО поставь галочку
    echo   "Add Python to PATH" внизу окна!
    echo.
    echo   После установки закрой это окно и запусти снова.
    echo.
    pause
    exit /b 1
)
echo   Python — OK

:: Проверяем Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   [!] Git НЕ установлен!
    echo.
    echo   Скачай: https://git-scm.com/download/win
    echo   Установи, жми Next-Next-Install.
    echo.
    echo   После установки закрой это окно и запусти снова.
    echo.
    pause
    exit /b 1
)
echo   Git    — OK

:: Устанавливаем зависимости Python
echo.
echo [1/4] Устанавливаю зависимости...
pip install playwright beautifulsoup4 2>&1
echo.
echo       Устанавливаю браузер (это может занять пару минут)...
playwright install chromium 2>&1
echo       Готово!

:: Запускаем скрейпер
echo.
echo ══════════════════════════════════════════
echo [2/4] Собираю данные с incoming.tyuiu.ru
echo       Это займёт 5-15 минут.
echo       НЕ ЗАКРЫВАЙ это окно!
echo ══════════════════════════════════════════
echo.
cd /d "%~dp0"
python scraper/scraper.py

if %errorlevel% neq 0 (
    echo.
    echo   [!] Скрейпер завершился с ошибкой.
    echo       Попробуй запустить ещё раз.
    echo       Если не помогает — скинь скриншот этого окна.
    echo.
    pause
    exit /b 1
)

:: Проверяем что файл создался
if not exist "public\data\latest.json" (
    echo.
    echo   [!] Файл данных не создан.
    echo       Скинь скриншот этого окна.
    echo.
    pause
    exit /b 1
)

echo.
echo [3/4] Данные собраны! Отправляю на GitHub...
echo.

git add public/data/latest.json
git commit -m "Обновление данных %date% %time:~0,5%"
git push

if %errorlevel% neq 0 (
    echo.
    echo   [!] Не удалось отправить на GitHub.
    echo.
    echo   Попробуй в GitHub Desktop:
    echo   1. Открой GitHub Desktop
    echo   2. Там будут изменения — нажми Commit
    echo   3. Потом нажми Push
    echo.
    pause
    exit /b 1
)

echo.
echo ══════════════════════════════════════════
echo   ГОТОВО!
echo.
echo   Данные отправлены на GitHub.
echo   Сайт обновится через 1-2 минуты.
echo ══════════════════════════════════════════
echo.
pause
