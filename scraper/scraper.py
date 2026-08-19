"""
TIU Scraper v4 — uses real API endpoints from tyuiu-rating3 plugin.

API:
  POST /wp-admin/admin-ajax.php
    action=disciplines  -> returns specialty <option> list
    action=rating       -> returns HTML results table

Form fields: org, eduform, direction, competitionType, prof, paid, originals
"""

import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict, field

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install",
                           "requests", "beautifulsoup4", "--quiet"])
    import requests
    from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

AJAX_URL = "https://incoming.tyuiu.ru/wp-admin/admin-ajax.php"
BASE_URL = "https://incoming.tyuiu.ru/incoming/"
DATA_DIR = Path(__file__).parent.parent / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "*/*",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Referer": BASE_URL,
    "Origin": "https://incoming.tyuiu.ru",
    "X-Requested-With": "XMLHttpRequest",
}

INSTITUTES = {
    "1": "Институт заочного и дистанционного образования",
    "2": "Технологический институт",
    "3": "Институт архитектуры и дизайна",
    "6": "Строительный институт",
    "7": "Институт сервиса и отраслевого управления",
    "8": "Многопрофильный колледж",
    "9": "филиал ТИУ в г. Сургуте",
    "12": "филиал ТИУ в г. Тобольске",
    "15": "Высшая школа цифровых технологий",
    "16": "Нефтегазовый институт",
}
EDUFORMS = {"1": "Очная", "2": "Заочная", "3": "Очно-заочная"}
DIRECTIONS = {"1": "Договор", "2": "Бюджет"}


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
        self.results = []

    def run(self, institute_ids=None, eduform_ids=None, direction_ids=None):
        if eduform_ids is None:
            eduform_ids = ["1"]
        if direction_ids is None:
            direction_ids = ["2"]

        orgs = institute_ids if institute_ids else list(INSTITUTES.keys())

        log.info("=== TIU Scraper v4 ===")
        log.info("Institutes: %s", [INSTITUTES.get(o, o) for o in orgs])

        for org_id in orgs:
            for ef_id in eduform_ids:
                for dir_id in direction_ids:
                    self._scrape_combo(org_id, ef_id, dir_id)

        return self.results

    def _get_specialties(self, org_id, ef_id, dir_id):
        form_data = "org={}&eduform={}&direction={}&competitionType=0&prof=&paid=0&originals=0".format(org_id, ef_id, dir_id)
        try:
            resp = self.session.post(AJAX_URL,
                data="action=disciplines&ratingForm={}&contractValue=false".format(form_data),
                headers={**HEADERS, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
                timeout=30)
            resp.raise_for_status()
        except Exception as e:
            log.warning("  Specialties failed: %s", e)
            return []

        if resp.text.strip() == "0" or not resp.text.strip():
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        specs = []
        for opt in soup.find_all("option"):
            val = opt.get("value", "").strip()
            text = opt.get_text(strip=True)
            if val and text:
                specs.append({"value": val, "text": text})
        return specs

    def _get_rating(self, org_id, ef_id, dir_id, prof_value):
        form_data = "org={}&eduform={}&direction={}&competitionType=0&prof={}&paid=0&originals=0".format(
            org_id, ef_id, dir_id, requests.utils.quote(prof_value))
        try:
            resp = self.session.post(AJAX_URL,
                data="action=rating&ratingForm={}".format(form_data),
                headers={**HEADERS, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
                timeout=30)
            resp.raise_for_status()
        except Exception as e:
            log.warning("  Rating failed: %s", e)
            return None

        if resp.text.strip() == "0" or not resp.text.strip():
            return None
        return resp.text

    def _scrape_combo(self, org_id, ef_id, dir_id):
        inst = INSTITUTES.get(org_id, org_id)
        edu = EDUFORMS.get(ef_id, ef_id)
        cat = DIRECTIONS.get(dir_id, dir_id)
        log.info("")
        log.info("=== %s | %s | %s ===", inst, edu, cat)

        specs = self._get_specialties(org_id, ef_id, dir_id)
        if not specs:
            log.info("  No specialties")
            return

        log.info("  %d specialties", len(specs))

        for spec in specs:
            log.info("  -> %s", spec["text"][:70])
            html = self._get_rating(org_id, ef_id, dir_id, spec["value"])
            if not html:
                log.info("     Empty")
                continue

            soup = BeautifulSoup(html, "html.parser")
            text = soup.get_text()

            total_seats = budget_seats = contract_seats = 0
            m = re.search(r"Всего мест[^:]*:\s*(\d+)", text)
            if m: total_seats = int(m.group(1))
            m = re.search(r"Общий конкурс:\s*(\d+)", text)
            if m: budget_seats = int(m.group(1))
            m = re.search(r"По договору:\s*(\d+)", text)
            if m: contract_seats = int(m.group(1))

            applicants = self._parse_table(soup)
            if applicants:
                self.results.append(CompetitionList(
                    institute=inst, education_form=edu, category=cat,
                    specialty=spec["text"],
                    total_seats=total_seats, budget_seats=budget_seats,
                    contract_seats=contract_seats,
                    applicants=applicants,
                    scraped_at=datetime.now().isoformat(),
                ))
                log.info("     OK: %d people, %d/%d seats", len(applicants), budget_seats, total_seats)
            else:
                log.info("     No data in table")

    def _parse_table(self, soup):
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue
            applicants = []
            for row in rows[1:]:
                cells = row.find_all("td")
                if len(cells) < 5:
                    continue
                texts = [c.get_text(strip=True) for c in cells]
                try:
                    pos = int(texts[0]) if texts[0].isdigit() else 0
                    uid = texts[1].strip()
                    if not uid or not uid[0].isdigit():
                        continue
                    vi = int(texts[2]) if texts[2].replace('-','').isdigit() else 0
                    id_s = int(texts[3]) if texts[3].replace('-','').isdigit() else 0
                    tot = int(texts[4]) if texts[4].replace('-','').isdigit() else 0

                    adm = ""; pri = 0; con = ""
                    if len(texts) >= 8:
                        adm = texts[5]; pri = int(texts[6]) if texts[6].isdigit() else 0; con = texts[7].lower()
                    elif len(texts) == 7:
                        adm = texts[5]; con = texts[6].lower()
                    elif len(texts) == 6:
                        con = texts[5].lower()

                    applicants.append(Applicant(
                        position=pos, uid=uid, vi_score=vi, id_score=id_s,
                        total_score=tot, admission_type=adm, priority=pri,
                        has_consent=con.strip() in ("да","+","yes","1"),
                    ))
                except (ValueError, IndexError):
                    pass
            if applicants:
                return applicants
        return []

    def save(self):
        data = {
            "scraped_at": datetime.now().isoformat(),
            "total_lists": len(self.results),
            "total_applicants": sum(len(r.applicants) for r in self.results),
            "lists": [
                {**{k:v for k,v in asdict(r).items() if k != "applicants"},
                 "applicants": [asdict(a) for a in r.applicants]}
                for r in self.results
            ],
        }
        path = DATA_DIR / "latest.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("Saved: %s (%d lists, %d people)", path, data["total_lists"], data["total_applicants"])


def main():
    scraper = TIUScraper()
    scraper.run(
        institute_ids=None,    # None=all, ["15"]=ВШЦТ, ["15","16"]=ВШЦТ+НГИ
        eduform_ids=["1"],     # 1=Очная
        direction_ids=["2"],   # 2=Бюджет
    )
    scraper.save()

if __name__ == "__main__":
    main()
