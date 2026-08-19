"""
ТИУ Incoming Lists Scraper v2
Парсит https://incoming.tyuiu.ru/incoming/ через Playwright.

Дропдауны на сайте (по порядку):
  0: Институт
  1: Форма обучения (Очная / Заочная / Очно-заочная)
  2: Категория (Договор / Бюджет)
  3: Вид приема (общий конкурс / Без ВИ / квота / ...)
  4: Специальность (загружается динамически)
  5: Наличие оплаты (фильтр)
  6: Согласие на зачисление (фильтр)

Таблица результатов:
  №  |  Уник. ID  |  ВИ  |  ИД  |  Сумма  |  Вид приёма  |  Приоритет  |  Согласие
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from dataclasses import dataclass, asdict, field
from pathlib import Path

from playwright.async_api import async_playwright, Page

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

BASE_URL = "https://incoming.tyuiu.ru/incoming/"
DATA_DIR = Path(__file__).parent.parent / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

TIMEOUT = 120_000         # 120 секунд на загрузку страницы
WAIT_AFTER_LOAD = 4000    # ждать 4 сек после загрузки
WAIT_AFTER_SELECT = 2000  # ждать после выбора дропдауна
WAIT_AFTER_SUBMIT = 6000  # ждать после нажатия Отправить
MAX_RETRIES = 3           # попытки загрузки страницы


@dataclass
class Applicant:
    position: int
    uid: str
    vi_score: int
    id_score: int
    total_score: int
    admission_type: str
    priority: int
    has_consent: bool


@dataclass
class CompetitionList:
    institute: str
    education_form: str
    category: str
    specialty: str
    total_seats: int = 0
    budget_seats: int = 0
    contract_seats: int = 0
    applicants: list = field(default_factory=list)
    scraped_at: str = ""

    def __post_init__(self):
        if not self.scraped_at:
            self.scraped_at = datetime.now().isoformat()


class TIUScraper:
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.results: list[CompetitionList] = []

    async def run(self, institutes=None, education_forms=None, categories=None):
        if education_forms is None:
            education_forms = ["Очная"]
        if categories is None:
            categories = ["Бюджет"]

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=self.headless)
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                locale="ru-RU",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            )
            page = await ctx.new_page()
            try:
                await self._scrape_all(page, institutes, education_forms, categories)
            finally:
                await browser.close()
        return self.results

    # ── Навигация ────────────────────────────────────────────────────────

    async def _goto(self, page: Page):
        """Загрузить страницу. 3 попытки с паузами."""
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                log.info("  Загрузка (попытка %d/%d)...", attempt, MAX_RETRIES)
                await page.goto(BASE_URL, wait_until="commit", timeout=TIMEOUT)
                # Ждём появления select-ов на странице
                await page.wait_for_selector("select", timeout=30_000)
                await page.wait_for_timeout(WAIT_AFTER_LOAD)
                return
            except Exception as e:
                log.warning("  Попытка %d не удалась: %s", attempt, str(e)[:80])
                if attempt < MAX_RETRIES:
                    wait = attempt * 10
                    log.info("  Жду %d сек...", wait)
                    await asyncio.sleep(wait)
                else:
                    raise Exception(f"Не удалось загрузить страницу после {MAX_RETRIES} попыток")

    async def _get_options(self, page: Page, idx: int) -> list[dict]:
        """Получить все option из select по индексу. Возвращает [{text, value}]."""
        selects = await page.query_selector_all("select")
        if idx >= len(selects):
            return []
        options = await selects[idx].query_selector_all("option")
        result = []
        for opt in options:
            text = (await opt.inner_text()).strip()
            value = await opt.get_attribute("value")
            if text and text != "---" and value:
                result.append({"text": text, "value": value})
        return result

    async def _select(self, page: Page, idx: int, text: str) -> bool:
        """Выбрать option по тексту (частичное совпадение)."""
        selects = await page.query_selector_all("select")
        if idx >= len(selects):
            log.warning("  Select %d не найден (всего %d)", idx, len(selects))
            return False
        for opt in await selects[idx].query_selector_all("option"):
            opt_text = (await opt.inner_text()).strip()
            if text.lower() in opt_text.lower():
                value = await opt.get_attribute("value")
                if value:
                    await selects[idx].select_option(value=value)
                    await page.wait_for_timeout(WAIT_AFTER_SELECT)
                    return True
        log.warning("  Не нашёл '%s' в select %d", text, idx)
        return False

    # ── Скрейпинг ────────────────────────────────────────────────────────

    async def _scrape_all(self, page, institutes, edu_forms, categories):
        log.info("Загружаю %s", BASE_URL)
        await self._goto(page)

        # Получить институты (select 0)
        all_insts = await self._get_options(page, 0)
        log.info("Найдено институтов: %d", len(all_insts))
        for i in all_insts:
            log.info("  - %s", i["text"])

        if institutes:
            all_insts = [i for i in all_insts
                         if any(t.lower() in i["text"].lower() for t in institutes)]
            log.info("После фильтра: %d", len(all_insts))

        for inst in all_insts:
            for edu in edu_forms:
                for cat in categories:
                    try:
                        await self._scrape_combo(page, inst["text"], edu, cat)
                    except Exception as e:
                        log.error("Ошибка [%s|%s|%s]: %s", inst["text"], edu, cat, e)

    async def _scrape_combo(self, page, institute, edu_form, category):
        log.info("═══ %s | %s | %s ═══", institute, edu_form, category)
        await self._goto(page)

        # 0: Институт
        if not await self._select(page, 0, institute):
            return
        # 1: Форма обучения
        if not await self._select(page, 1, edu_form):
            return
        # 2: Категория
        if not await self._select(page, 2, category):
            return

        await page.wait_for_timeout(1000)

        # 4: Специальности (индекс 4, после "Вид приёма" который на индексе 3)
        specialties = await self._get_options(page, 4)
        log.info("  Специальностей: %d", len(specialties))

        for spec in specialties:
            try:
                await self._scrape_spec(page, institute, edu_form, category, spec["text"])
            except Exception as e:
                log.error("  Ошибка [%s]: %s", spec["text"], e)

    async def _scrape_spec(self, page, institute, edu_form, category, specialty):
        log.info("  → %s", specialty)

        # Заново загрузить и выбрать всё
        await self._goto(page)

        await self._select(page, 0, institute)
        await self._select(page, 1, edu_form)
        await self._select(page, 2, category)
        await page.wait_for_timeout(1000)
        await self._select(page, 4, specialty)

        # Нажать Отправить
        btn = await page.query_selector("input[type='submit']")
        if not btn:
            btn = await page.query_selector("button[type='submit']")
        if not btn:
            # Поиск по тексту
            for el in await page.query_selector_all("input, button"):
                val = await el.get_attribute("value") or ""
                txt = await el.inner_text() if await el.get_attribute("type") != "submit" else val
                if "отправить" in (val + txt).lower():
                    btn = el
                    break

        if not btn:
            log.warning("  Кнопка Отправить не найдена!")
            return

        await btn.click()
        await page.wait_for_timeout(WAIT_AFTER_SUBMIT)

        # Парсим шапку
        body_text = await page.inner_text("body")
        total_seats, budget_seats, contract_seats = 0, 0, 0
        m = re.search(r"Всего мест по направлению:\s*(\d+)", body_text)
        if m: total_seats = int(m.group(1))
        m = re.search(r"Общий конкурс:\s*(\d+)", body_text)
        if m: budget_seats = int(m.group(1))
        m = re.search(r"По договору:\s*(\d+)", body_text)
        if m: contract_seats = int(m.group(1))

        # Парсим таблицу
        applicants = await self._parse_table(page)

        if applicants:
            self.results.append(CompetitionList(
                institute=institute,
                education_form=edu_form,
                category=category,
                specialty=specialty,
                total_seats=total_seats,
                budget_seats=budget_seats,
                contract_seats=contract_seats,
                applicants=applicants,
            ))
            log.info("  ✓ %d чел. | %d/%d мест", len(applicants), budget_seats, total_seats)
        else:
            log.info("  ✗ Пусто или ошибка")

    async def _parse_table(self, page: Page) -> list[Applicant]:
        """
        Колонки:
        0: №
        1: Уникальный идентификатор
        2: Баллы за ВИ
        3: Баллы за ИД
        4: Сумма
        5: Вид приёма
        6: Приоритет
        7: Согласие на зачисление
        """
        table = await page.query_selector("table")
        if not table:
            return []

        rows = await table.query_selector_all("tr")
        applicants = []

        for row in rows[1:]:
            cells = await row.query_selector_all("td")
            if len(cells) < 7:
                continue
            texts = []
            for c in cells:
                texts.append((await c.inner_text()).strip())

            try:
                pos = int(texts[0]) if texts[0].isdigit() else 0
                uid = texts[1].strip()
                vi = int(texts[2]) if texts[2].isdigit() else 0
                ид = int(texts[3]) if texts[3].isdigit() else 0
                total = int(texts[4]) if texts[4].isdigit() else 0
                adm_type = texts[5] if len(texts) > 5 else ""
                priority = int(texts[6]) if len(texts) > 6 and texts[6].isdigit() else 0
                consent = texts[7].strip().lower() if len(texts) > 7 else ""
                has_consent = consent in ("да", "+", "yes")

                if uid:
                    applicants.append(Applicant(
                        position=pos, uid=uid,
                        vi_score=vi, id_score=ид, total_score=total,
                        admission_type=adm_type, priority=priority,
                        has_consent=has_consent,
                    ))
            except Exception as e:
                log.debug("  Пропуск: %s", e)

        return applicants

    def save(self):
        data = {
            "scraped_at": datetime.now().isoformat(),
            "total_lists": len(self.results),
            "total_applicants": sum(len(r.applicants) for r in self.results),
            "lists": [
                {
                    "institute": r.institute,
                    "education_form": r.education_form,
                    "category": r.category,
                    "specialty": r.specialty,
                    "total_seats": r.total_seats,
                    "budget_seats": r.budget_seats,
                    "contract_seats": r.contract_seats,
                    "scraped_at": r.scraped_at,
                    "applicants": [asdict(a) for a in r.applicants],
                }
                for r in self.results
            ],
        }
        path = DATA_DIR / "latest.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("Сохранено: %s (%d списков, %d чел.)",
                 path, data["total_lists"], data["total_applicants"])


async def main():
    scraper = TIUScraper(headless=True)
    await scraper.run(
        institutes=None,
        education_forms=["Очная"],
        categories=["Бюджет"],
    )
    scraper.save()


if __name__ == "__main__":
    asyncio.run(main())
