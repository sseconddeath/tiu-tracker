"""
TIU Scraper v5 — WORKING version.
Uses raw jQuery-style POST to /wp-admin/admin-ajax.php.

Tested format:
  action=disciplines&ratingForm=org=15&eduform=1&direction=2&...&contractValue=false
  action=rating&ratingForm=org=15&eduform=1&direction=2&...&prof=ENCODED_VALUE&...
"""

import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict, field
from urllib.parse import quote

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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": BASE_URL,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
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
        self.session.headers.update({
            "User-Agent": HEADERS["User-Agent"],
            "Accept-Language": "ru-RU,ru;q=0.9",
        })
        self.results = []
        self.institutes = {}

    def run(self, institute_ids=None, eduform_ids=None, direction_ids=None):
        if eduform_ids is None:
            eduform_ids = ["1"]
        if direction_ids is None:
            direction_ids = ["2"]

        # Load page to discover institutes
        log.info("Loading %s ...", BASE_URL)
        r = self.session.get(BASE_URL, timeout=30)
        r.raise_for_status()
        log.info("Page: %d bytes", len(r.text))

        soup = BeautifulSoup(r.text, "html.parser")
        org_select = soup.find("select", {"name": "org"})
        if org_select:
            for opt in org_select.find_all("option"):
                val = opt.get("value", "0")
                text = opt.get_text(strip=True)
                if val != "0" and text != "---":
                    self.institutes[val] = text

        log.info("Found %d institutes", len(self.institutes))

        orgs = institute_ids if institute_ids else list(self.institutes.keys())

        for org_id in orgs:
            for ef_id in eduform_ids:
                for dir_id in direction_ids:
                    try:
                        self._scrape_combo(org_id, ef_id, dir_id)
                    except Exception as e:
                        log.error("Error [%s|%s|%s]: %s",
                                  self.institutes.get(org_id, org_id), ef_id, dir_id, e)

        return self.results

    def _ajax(self, raw_data):
        """Send raw POST to admin-ajax.php (jQuery style)."""
        r = self.session.post(AJAX_URL, data=raw_data, headers=HEADERS, timeout=30)
        r.raise_for_status()
        if r.text.strip() == "0":
            return None
        return r.text

    def _get_specs(self, org_id, ef_id, dir_id):
        """Get specialties via action=disciplines."""
        form = f"org={org_id}&eduform={ef_id}&direction={dir_id}&competitionType=0&prof=&paid=0&originals=1"
        raw = f"action=disciplines&ratingForm={form}&contractValue=false"
        html = self._ajax(raw)
        if not html:
            return []
        soup = BeautifulSoup(html, "html.parser")
        return [{"value": o.get("value", ""), "text": o.get_text(strip=True)}
                for o in soup.find_all("option") if o.get("value")]

    def _get_rating(self, org_id, ef_id, dir_id, prof_value):
        """Get rating table via action=rating."""
        form = f"org={org_id}&eduform={ef_id}&direction={dir_id}&competitionType=0&prof={quote(prof_value, safe='')}&paid=0&originals=1"
        raw = f"action=rating&ratingForm={form}"
        return self._ajax(raw)

    def _scrape_combo(self, org_id, ef_id, dir_id):
        inst = self.institutes.get(org_id, f"org_{org_id}")
        edu = EDUFORMS.get(ef_id, ef_id)
        cat = DIRECTIONS.get(dir_id, dir_id)
        log.info("")
        log.info("=== %s | %s | %s ===", inst, edu, cat)

        specs = self._get_specs(org_id, ef_id, dir_id)
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
                log.info("     %d people, %d/%d seats", len(applicants), budget_seats, total_seats)
            else:
                log.info("     No data")

    def _parse_table(self, soup):
        """Parse the rating table. Auto-detect column layout."""
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if len(rows) < 2:
                continue

            # Detect columns from header
            header_cells = rows[0].find_all(["th", "td"])
            headers = [c.get_text(strip=True).lower() for c in header_cells]

            col = {}
            for i, h in enumerate(headers):
                if "№" in h or "п/п" in h:
                    col["pos"] = i
                elif "идентификатор" in h or "уникальн" in h:
                    col["uid"] = i
                elif "вступительн" in h or ("балл" in h and "инд" not in h and "сумм" not in h and "конкурс" not in h):
                    col["vi"] = i
                elif "индивидуальн" in h or "достиж" in h:
                    col["id"] = i
                elif "сумм" in h or "конкурсн" in h:
                    col["total"] = i
                elif "вид" in h and "приём" in h or "вид" in h and "прием" in h:
                    col["adm"] = i
                elif "приоритет" in h:
                    col["pri"] = i
                elif "согласи" in h or "зачисл" in h:
                    col["consent"] = i

            if "uid" not in col:
                # Fallback: assume standard layout
                col = {"pos": 0, "uid": 1, "vi": 2, "id": 3, "total": 4,
                       "adm": 5, "pri": 6, "consent": 7}

            applicants = []
            for row in rows[1:]:
                cells = row.find_all("td")
                if len(cells) < 5:
                    continue
                t = [c.get_text(strip=True) for c in cells]

                def g(key, default=""):
                    idx = col.get(key)
                    return t[idx] if idx is not None and idx < len(t) else default

                try:
                    uid = g("uid")
                    if not uid or not uid[0].isdigit():
                        continue

                    pos_s = g("pos", "0")
                    vi_s = g("vi", "0").replace("-", "0")
                    id_s = g("id", "0").replace("-", "0")
                    tot_s = g("total", "0").replace("-", "0")
                    pri_s = g("pri", "0")
                    con_s = g("consent", "").lower().strip()

                    applicants.append(Applicant(
                        position=int(pos_s) if pos_s.isdigit() else 0,
                        uid=uid,
                        vi_score=int(vi_s) if vi_s.isdigit() else 0,
                        id_score=int(id_s) if id_s.isdigit() else 0,
                        total_score=int(tot_s) if tot_s.isdigit() else 0,
                        admission_type=g("adm"),
                        priority=int(pri_s) if pri_s.isdigit() else 0,
                        has_consent=con_s in ("да", "+", "yes", "1"),
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
            "lists": [{
                "institute": r.institute,
                "education_form": r.education_form,
                "category": r.category,
                "specialty": r.specialty,
                "total_seats": r.total_seats,
                "budget_seats": r.budget_seats,
                "contract_seats": r.contract_seats,
                "scraped_at": r.scraped_at,
                "applicants": [asdict(a) for a in r.applicants],
            } for r in self.results],
        }
        path = DATA_DIR / "latest.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("")
        log.info("=== DONE ===")
        log.info("Saved: %s", path)
        log.info("Lists: %d, Applicants: %d", data["total_lists"], data["total_applicants"])


def main():
    scraper = TIUScraper()
    scraper.run(
        institute_ids=None,    # None=all, ["15"]=ВШЦТ only
        eduform_ids=["1"],     # 1=Очная
        direction_ids=["2"],   # 2=Бюджет
    )
    scraper.save()


if __name__ == "__main__":
    main()
