# TIU Tracker

Мониторинг конкурсных списков ТИУ. Вводишь свой уникальный идентификатор — видишь все направления, позиции и шансы.

## Деплой на Vercel (5 минут)

### 1. Создай репозиторий на GitHub

```bash
cd tiu-web
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ТВОЙ_ЮЗЕР/tiu-tracker.git
git push -u origin main
```

### 2. Подключи к Vercel

1. Зайди на [vercel.com](https://vercel.com)
2. «Add New Project» → импортируй репо `tiu-tracker`
3. Framework: Next.js (определится автоматически)
4. Нажми Deploy
5. Готово — сайт будет на `tiu-tracker.vercel.app`

### 3. Запусти скрейпер первый раз

В репозитории на GitHub:
1. Вкладка **Actions**
2. Выбери **Scrape TIU Lists**
3. Нажми **Run workflow**
4. Подожди ~5 минут
5. Скрейпер соберёт данные, закоммитит `latest.json`, Vercel автоматически редеплоит

### 4. Автообновление

GitHub Actions уже настроен — скрейпер запускается **каждые 2 часа** с 6:00 до 22:00 по МСК.  
Каждый запуск: собирает данные → коммитит → Vercel редеплоит → сайт обновлён.

## Как это работает

```
GitHub Actions (каждые 2ч)
    │
    ▼
Playwright скрейпер
    │ парсит incoming.tyuiu.ru
    ▼
public/data/latest.json
    │ git push
    ▼
Vercel auto-deploy
    │
    ▼
Сайт обновлён ✓
```

## Настройка скрейпера

В `scraper/scraper.py` в функции `main()`:

```python
# Все институты, очная, бюджет
await scraper.run(institutes=None, education_forms=["Очная"], categories=["Бюджет"])

# Только ВШЦТ
await scraper.run(institutes=["Высшая школа цифровых технологий"])

# Бюджет + договор
await scraper.run(categories=["Бюджет", "Договор"])
```

## Локальная разработка

```bash
npm install
npm run dev
# Открой http://localhost:3000
```

## Структура

```
tiu-web/
├── app/
│   ├── layout.tsx          — HTML layout + шрифты
│   ├── page.tsx            — Главная страница (трекер)
│   ├── globals.css
│   └── api/data/route.ts   — API fallback
├── public/data/
│   └── latest.json          — Данные (обновляются скрейпером)
├── scraper/
│   └── scraper.py           — Playwright парсер
├── .github/workflows/
│   └── scrape.yml           — GitHub Actions (расписание)
├── package.json
└── README.md
```
