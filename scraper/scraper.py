"""
TIU Scraper v3 — pure HTTP (no Playwright, no browser).
Uses requests + BeautifulSoup to fetch and parse incoming.tyuiu.ru.

Step 1: GET the page, parse form field names and options
Step 2: POST the form for each institute/specialty combo
Step 3: Parse the results table from the response HTML
"""

import json
import logging
import re
import sys
from datetime import datetime, timezone, timedelta

MSK = timezone(timedelta(hours=3))
def now_msk():
    return datetime.now(MSK).strftime('%d.%m.%Y %H:%M МСК')
from pathlib import Path
from dataclasses import dataclass, asdict, field
from urllib.parse import urljoin

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Installing dependencies...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install",
                           "requests", "beautifulsoup4", "--quiet"])
    import requests
    from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

BASE_URL = "https://incoming.tyuiu.ru/incoming/"
DATA_DIR = Path(__file__).parent.parent / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}


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


class TIUScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.results: list[CompetitionList] = []
        self.form_fields: dict = {}   # name -> list of {value, text}
        self.form_action: str = ""

    def run(self, institutes=None, education_forms=None, categories=None):
        if education_forms is None:
            education_forms = ["Очная"]
        if categories is None:
            categories = ["Бюджет"]

        # Step 1: fetch page, discover form structure
        log.info("Fetching %s ...", BASE_URL)
        resp = self.session.get(BASE_URL, timeout=60)
        resp.raise_for_status()
        log.info("Page loaded (%d bytes)", len(resp.text))

        soup = BeautifulSoup(resp.text, "html.parser")
        self._discover_form(soup)

        if not self.form_fields:
            log.error("No form fields found! The page structure may have changed.")
            return self.results

        # Show discovered structure
        log.info("=== Form structure ===")
        for name, opts in self.form_fields.items():
            log.info("  [%s] %d options", name, len(opts))
            for o in opts[:3]:
                log.info("    - %s = %s", o["value"], o["text"][:50])
            if len(opts) > 3:
                log.info("    ... and %d more", len(opts) - 3)

        # Step 2: iterate combinations
        field_names = list(self.form_fields.keys())
        log.info("Field names: %s", field_names)

        # Find institute field (first select with many options)
        inst_field = field_names[0] if field_names else None
        inst_options = self.form_fields.get(inst_field, [])

        if institutes:
            inst_options = [o for o in inst_options
                           if any(t.lower() in o["text"].lower() for t in institutes)]

        log.info("Institutes to scrape: %d", len(inst_options))

        for inst_opt in inst_options:
            for edu_form in education_forms:
                for category in categories:
                    self._scrape_combo(
                        inst_opt, edu_form, category,
                        field_names, soup
                    )

        return self.results

    def _discover_form(self, soup: BeautifulSoup):
        """Parse the HTML form to find field names and options."""
        # Find the form containing "Отправить"
        forms = soup.find_all("form")
        target_form = None
        for f in forms:
            if f.find("input", {"type": "submit"}) or f.find("button", {"type": "submit"}):
                target_form = f
                break
            if f.find(string=re.compile("Отправить", re.I)):
                target_form = f
                break

        if not target_form:
            # Try all selects on page
            target_form = soup

        # Get form action
        self.form_action = target_form.get("action", "") if target_form != soup else ""
        if not self.form_action:
            self.form_action = BASE_URL

        # Parse all selects
        selects = target_form.find_all("select")
        log.info("Found %d select elements", len(selects))

        for sel in selects:
            name = sel.get("name") or sel.get("id") or ""
            if not name:
                continue
            options = []
            for opt in sel.find_all("option"):
                val = opt.get("value", "")
                text = opt.get_text(strip=True)
                if val and text and text != "---":
                    options.append({"value": val, "text": text})
            if options:
                self.form_fields[name] = options

        # Also find hidden inputs
        for inp in (target_form if target_form != soup else soup).find_all("input", {"type": "hidden"}):
            name = inp.get("name", "")
            val = inp.get("value", "")
            if name:
                self.form_fields["_hidden_" + name] = [{"value": val, "text": "hidden"}]

    def _scrape_combo(self, inst_opt, edu_form_text, category_text, field_names, soup):
        """Scrape one institute/edu_form/category combo with all specialties."""
        log.info("=== %s | %s | %s ===", inst_opt["text"][:40], edu_form_text, category_text)

        # Build base form data
        form_data = {}

        # Set institute (field 0)
        if len(field_names) > 0:
            form_data[field_names[0]] = inst_opt["value"]

        # Set education form (field 1) - find matching option
        if len(field_names) > 1:
            for o in self.form_fields.get(field_names[1], []):
                if edu_form_text.lower() in o["text"].lower():
                    form_data[field_names[1]] = o["value"]
                    break

        # Set category (field 2)
        if len(field_names) > 2:
            for o in self.form_fields.get(field_names[2], []):
                if category_text.lower() in o["text"].lower():
                    form_data[field_names[2]] = o["value"]
                    break

        # Add hidden fields
        for k, v in self.form_fields.items():
            if k.startswith("_hidden_"):
                real_name = k.replace("_hidden_", "")
                form_data[real_name] = v[0]["value"]

        # Now we need specialties. They might load dynamically via AJAX
        # or they might all be in the initial HTML.
        # First try: get specialties from initial page
        spec_field = None
        spec_options = []

        # Specialty is usually field index 4 (after vid_priema at index 3)
        # But let's find it by checking which field has dynamic or many options
        for i, fname in enumerate(field_names):
            opts = self.form_fields.get(fname, [])
            field_lower = fname.lower()
            if "spec" in field_lower or "napravl" in field_lower or i == 4:
                spec_field = fname
                spec_options = opts
                break

        # If no spec field found by name, try the last meaningful field
        if not spec_field and len(field_names) > 3:
            for i in range(len(field_names) - 1, 2, -1):
                fname = field_names[i]
                if not fname.startswith("_hidden_"):
                    opts = self.form_fields.get(fname, [])
                    if len(opts) > 1:
                        spec_field = fname
                        spec_options = opts
                        break

        if not spec_options:
            # Try submitting without specialty to see what happens
            log.info("  No specialties found in initial HTML, trying POST without spec...")
            self._try_post(form_data, inst_opt["text"], edu_form_text, category_text, "")
            return

        # Try posting with specialty from initial page first
        # If specialties load via AJAX, we might need to try the AJAX endpoint
        log.info("  Found %d specialties in field '%s'", len(spec_options), spec_field)

        for spec_opt in spec_options:
            form_data_copy = dict(form_data)
            form_data_copy[spec_field] = spec_opt["value"]

            # Also try setting vid_priema if it exists (field 3)
            if len(field_names) > 3 and field_names[3] != spec_field:
                vid_field = field_names[3]
                for o in self.form_fields.get(vid_field, []):
                    if "общий" in o["text"].lower() or "конкурс" in o["text"].lower():
                        form_data_copy[vid_field] = o["value"]
                        break

            self._try_post(
                form_data_copy,
                inst_opt["text"], edu_form_text, category_text,
                spec_opt["text"]
            )

    def _try_post(self, form_data, institute, edu_form, category, specialty):
        """Submit form and parse results."""
        log.info("  -> %s", specialty[:60] if specialty else "(no spec)")
        log.debug("  POST data: %s", form_data)

        try:
            resp = self.session.post(
                self.form_action,
                data=form_data,
                timeout=60,
            )
            resp.raise_for_status()
        except Exception as e:
            log.warning("  POST failed: %s", e)
            return

        soup = BeautifulSoup(resp.text, "html.parser")

        # Parse header: "Всего мест: X  Общий конкурс: Y  По договору: Z"
        text = soup.get_text()
        total_seats = budget_seats = contract_seats = 0
        m = re.search(r"Всего мест[^:]*:\s*(\d+)", text)
        if m: total_seats = int(m.group(1))
        m = re.search(r"Общий конкурс:\s*(\d+)", text)
        if m: budget_seats = int(m.group(1))
        m = re.search(r"По договору:\s*(\d+)", text)
        if m: contract_seats = int(m.group(1))

        # Parse table
        applicants = self._parse_table(soup)

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
                scraped_at=now_msk(),
            ))
            log.info("  OK: %d applicants, %d/%d seats", len(applicants), budget_seats, total_seats)
        else:
            log.info("  Empty (no table or no rows)")

    def _parse_table(self, soup: BeautifulSoup) -> list[Applicant]:
        """
        Parse the results table.
        Columns: №, ID, ВИ, ИД, Сумма, Вид приёма, Приоритет, Согласие
        """
        tables = soup.find_all("table")
        if not tables:
            return []

        # Find the table with applicant data (has numbers in cells)
        for table in tables:
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue

            applicants = []
            for row in rows[1:]:  # skip header
                cells = row.find_all("td")
                if len(cells) < 7:
                    continue

                texts = [c.get_text(strip=True) for c in cells]

                try:
                    pos = int(texts[0]) if texts[0].isdigit() else 0
                    uid = texts[1].strip()
                    if not uid or not uid[0].isdigit():
                        continue

                    vi = int(texts[2]) if texts[2].isdigit() else 0
                    id_score = int(texts[3]) if texts[3].isdigit() else 0
                    total = int(texts[4]) if texts[4].isdigit() else 0
                    adm_type = texts[5] if len(texts) > 5 else ""
                    priority = int(texts[6]) if len(texts) > 6 and texts[6].isdigit() else 0
                    consent_text = texts[7].strip().lower() if len(texts) > 7 else ""
                    has_consent = consent_text in ("да", "+", "yes", "1")

                    applicants.append(Applicant(
                        position=pos, uid=uid,
                        vi_score=vi, id_score=id_score, total_score=total,
                        admission_type=adm_type, priority=priority,
                        has_consent=has_consent,
                    ))
                except (ValueError, IndexError) as e:
                    log.debug("  Skip row: %s", e)

            if applicants:
                return applicants

        return []

    def save(self):
        data = {
            "scraped_at": now_msk(),
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
        log.info("Saved: %s (%d lists, %d applicants)",
                 path, data["total_lists"], data["total_applicants"])
        return data


def main():
    scraper = TIUScraper()
    scraper.run(
        institutes=None,         # None = all, or ["Высшая школа цифровых технологий"]
        education_forms=["Очная"],
        categories=["Бюджет"],
    )
    scraper.save()

    total = sum(len(r.applicants) for r in scraper.results)
    print(f"\nDone: {len(scraper.results)} lists, {total} applicants")


if __name__ == "__main__":
    main()
