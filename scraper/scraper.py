"""
ТИУ Incoming Lists Scraper
Автоматизирует сбор данных с https://incoming.tyuiu.ru/incoming/

Реальная структура таблицы (из скриншотов):
  №  | Уникальный идентификатор | Баллы ВИ | Баллы ИД | Сумма | Вид приёма | Приоритет | Согласие

Шапка таблицы содержит:
  "Всего мест по направлению: 22  Общий конкурс: 20  По договору: 2"

Форма на сайте (дропдауны):
  Институт → Форма обучения → Категория → Специальность → Согласие (фильтр)
  НЕТ отдельного дропдауна "Вид приёма" — он в колонке таблицы.

Использование:
    pip install playwright
    playwright install chromium
    python scraper.py
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Optional

from playwright.async_api import async_playwright, Page

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

BASE_URL = "https://incoming.tyuiu.ru/incoming/"
DATA_DIR = Path(__file__).parent.parent / "public" / "data"
DATA_DIR.mkdir(exist_ok=True)


@dataclass
class Applicant:
    position: int
    uid: str                     # Уникальный идентификатор (7 цифр)
    vi_score: int                # Баллы за вступительное испытание
    id_score: int                # Баллы за индивидуальные достижения
    total_score: int             # Сумма конкурсных баллов
    admission_type: str          # Вид приёма (Общий конкурс и т.д.)
    priority: int                # Приоритет
    has_consent: bool            # Согласие на зачисление


@dataclass
class CompetitionList:
    institute: str
    education_form: str
    category: str
    specialty: str
    total_seats: int = 0         # Всего мест по направлению
    budget_seats: int = 0        # Общий конкурс (бюджет)
    contract_seats: int = 0      # По договору
    applicants: list = field(default_factory=list)
    scraped_at: str = ""

    def __post_init__(self):
        if not self.scraped_at:
            self.scraped_at = datetime.now().isoformat()


class TIUScraper:
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.results: list[CompetitionList] = []

    async def run(
        self,
        institutes: list[str] | None = None,
        education_forms: list[str] | None = None,
        categories: list[str] | None = None,
    ):
        if education_forms is None:
            education_forms = ["Очная"]
        if categories is None:
            categories = ["Бюджет"]

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=self.headless)
            ctx = await browser.new_context(viewport={"width": 1280, "height": 900}, locale="ru-RU")
            page = await ctx.new_page()
            try:
                await self._scrape_all(page, institutes, education_forms, categories)
            finally:
                await browser.close()
        return self.results

    async def _scrape_all(self, page: Page, institutes, edu_forms, categories):
        log.info("Загружаю %s", BASE_URL)
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30_000)
        await page.wait_for_timeout(2000)

        all_insts = await self._get_options(page, 0)
        log.info("Институты: %s", all_insts)

        if institutes:
            all_insts = [i for i in all_insts if any(t.lower() in i.lower() for t in institutes)]

        for inst in all_insts:
            for edu in edu_forms:
                for cat in categories:
                    await self._scrape_combo(page, inst, edu, cat)

    async def _get_options(self, page: Page, select_idx: int) -> list[str]:
        selects = await page.query_selector_all("select")
        if select_idx >= len(selects):
            return []
        options = await selects[select_idx].query_selector_all("option")
        result = []
        for opt in options:
            text = (await opt.inner_text()).strip()
            val = await opt.get_attribute("value")
            if text and text != "---" and val:
                result.append(text)
        return result

    async def _select(self, page: Page, idx: int, text: str) -> bool:
        selects = await page.query_selector_all("select")
        if idx >= len(selects):
            return False
        options = await selects[idx].query_selector_all("option")
        for opt in options:
            opt_text = (await opt.inner_text()).strip()
            if text.lower() in opt_text.lower():
                val = await opt.get_attribute("value")
                if val:
                    await selects[idx].select_option(value=val)
                    await page.wait_for_timeout(500)
                    return True
        return False

    async def _scrape_combo(self, page: Page, institute: str, edu_form: str, category: str):
        log.info("── %s | %s | %s ──", institute, edu_form, category)
        await page.goto(BASE_URL, wait_until="networkidle", timeout=30_000)
        await page.wait_for_timeout(1500)

        # Институт (select 0)
        if not await self._select(page, 0, institute):
            log.warning("  Не выбрать институт: %s", institute)
            return
        await page.wait_for_timeout(1000)

        # Форма обучения (select 1)
        if not await self._select(page, 1, edu_form):
            log.warning("  Не выбрать форму: %s", edu_form)
            return
        await page.wait_for_timeout(500)

        # Категория (select 2)
        if not await self._select(page, 2, category):
            log.warning("  Не выбрать категорию: %s", category)
            return
        await page.wait_for_timeout(800)

        # Специальности (select 3, загружается динамически)
        specialties = await self._get_options(page, 3)
        log.info("  Специальности: %d шт.", len(specialties))

        for spec in specialties:
            await self._scrape_spec(page, institute, edu_form, category, spec)

    async def _scrape_spec(self, page, institute, edu_form, category, specialty):
        log.info("    → %s", specialty)

        await page.goto(BASE_URL, wait_until="networkidle", timeout=30_000)
        await page.wait_for_timeout(1000)

        await self._select(page, 0, institute)
        await page.wait_for_timeout(800)
        await self._select(page, 1, edu_form)
        await page.wait_for_timeout(300)
        await self._select(page, 2, category)
        await page.wait_for_timeout(800)
        await self._select(page, 3, specialty)
        await page.wait_for_timeout(300)

        # Нажать "Отправить"
        btn = await page.query_selector("input[type='submit'], button[type='submit']")
        if not btn:
            btn = await page.query_selector("text=Отправить")
        if not btn:
            log.warning("    Кнопка не найдена")
            return

        await btn.click()
        await page.wait_for_timeout(3000)

        # ── Парсим шапку: "Всего мест: 22  Общий конкурс: 20  По договору: 2"
        total_seats, budget_seats, contract_seats = 0, 0, 0
        header_text = await page.inner_text("body")
        m_total = re.search(r"Всего мест по направлению:\s*(\d+)", header_text)
        m_budget = re.search(r"Общий конкурс:\s*(\d+)", header_text)
        m_contract = re.search(r"По договору:\s*(\d+)", header_text)
        if m_total: total_seats = int(m_total.group(1))
        if m_budget: budget_seats = int(m_budget.group(1))
        if m_contract: contract_seats = int(m_contract.group(1))

        # ── Парсим таблицу
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
            log.info("    ✓ %d чел. | %d мест", len(applicants), budget_seats)
        else:
            log.info("    ✗ Пусто")

    async def _parse_table(self, page: Page) -> list[Applicant]:
        """
        Парсит таблицу с реальной структурой:
        №  |  Уник. ID  |  Баллы ВИ  |  Баллы ИД  |  Сумма  |  Вид приёма  |  Приоритет  |  Согласие
        0      1             2             3           4          5              6             7
        """
        table = await page.query_selector("table")
        if not table:
            return []

        rows = await table.query_selector_all("tr")
        applicants = []

        for row in rows[1:]:  # пропускаем заголовок
            cells = await row.query_selector_all("td")
            if len(cells) < 7:
                continue

            texts = []
            for c in cells:
                texts.append((await c.inner_text()).strip())

            try:
                position = int(texts[0])
                uid = texts[1].strip()
                vi_score = int(texts[2]) if texts[2].isdigit() else 0
                id_score = int(texts[3]) if texts[3].isdigit() else 0
                total_score = int(texts[4]) if texts[4].isdigit() else 0
                admission_type = texts[5].strip() if len(texts) > 5 else ""
                priority = int(texts[6]) if len(texts) > 6 and texts[6].isdigit() else 0
                consent_text = texts[7].lower() if len(texts) > 7 else ""
                has_consent = consent_text in ("да", "+", "yes", "1")

                applicants.append(Applicant(
                    position=position,
                    uid=uid,
                    vi_score=vi_score,
                    id_score=id_score,
                    total_score=total_score,
                    admission_type=admission_type,
                    priority=priority,
                    has_consent=has_consent,
                ))
            except (ValueError, IndexError) as e:
                log.debug("    Пропуск строки: %s", e)

        return applicants

    def save(self, filename: str | None = None):
        if filename is None:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"scrape_{ts}.json"
        path = DATA_DIR / filename
        data = self._to_dict()
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("Сохранено: %s", path)

        # latest.json
        latest = DATA_DIR / "latest.json"
        latest.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def _to_dict(self):
        return {
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


async def main():
    scraper = TIUScraper(headless=True)
    await scraper.run(
        institutes=None,          # все (или ["Высшая школа цифровых технологий"])
        education_forms=["Очная"],
        categories=["Бюджет"],
    )
    scraper.save()
    total = sum(len(r.applicants) for r in scraper.results)
    print(f"\n✓ {len(scraper.results)} списков, {total} абитуриентов")


if __name__ == "__main__":
    asyncio.run(main())
