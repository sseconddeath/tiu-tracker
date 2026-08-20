"""
TIU Scraper v6 — final working version.
Two API calls per specialty:
  1) originals=1 → full list with consent column (all applicants)
  2) originals=2 → consent-only list (correct seat counts)
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

AJAX = "https://incoming.tyuiu.ru/wp-admin/admin-ajax.php"
BASE = "https://incoming.tyuiu.ru/incoming/"
DATA_DIR = Path(__file__).parent.parent / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

HDR = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": BASE,
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
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": HDR["User-Agent"], "Accept-Language": "ru-RU,ru;q=0.9"})
        self.results = []
        self.institutes = {}

    def run(self, institute_ids=None, eduform_ids=None, direction_ids=None):
        if eduform_ids is None: eduform_ids = ["1"]
        if direction_ids is None: direction_ids = ["2"]

        log.info("Loading page...")
        r = self.s.get(BASE, timeout=30)
        r.raise_for_status()

        soup = BeautifulSoup(r.text, "html.parser")
        for opt in soup.find("select", {"name": "org"}).find_all("option"):
            v = opt.get("value", "0")
            t = opt.get_text(strip=True)
            if v != "0" and t != "---":
                self.institutes[v] = t

        orgs = institute_ids or list(self.institutes.keys())
        log.info("Institutes: %d", len(orgs))

        for org in orgs:
            for ef in eduform_ids:
                for di in direction_ids:
                    try:
                        self._scrape(org, ef, di)
                    except Exception as e:
                        log.error("Error: %s", e)

    def _post(self, data):
        r = self.s.post(AJAX, data=data, headers=HDR, timeout=30)
        r.raise_for_status()
        return None if r.text.strip() == "0" else r.text

    def _scrape(self, org, ef, di):
        inst = self.institutes.get(org, org)
        log.info("\n=== %s | %s | %s ===", inst, EDUFORMS.get(ef, ef), DIRECTIONS.get(di, di))

        form = f"org={org}&eduform={ef}&direction={di}&competitionType=0&prof=&paid=0&originals=1"
        html = self._post(f"action=disciplines&ratingForm={form}&contractValue=false")
        if not html:
            log.info("  No specialties"); return

        specs = [{"v": o.get("value",""), "t": o.get_text(strip=True)}
                 for o in BeautifulSoup(html, "html.parser").find_all("option") if o.get("value")]
        log.info("  %d specialties", len(specs))

        for sp in specs:
            log.info("  -> %s", sp["t"][:70])
            prof = quote(sp["v"], safe="")

            # Call 1: originals=1 → full list with consent info
            form1 = f"org={org}&eduform={ef}&direction={di}&competitionType=0&prof={prof}&paid=0&originals=1"
            html1 = self._post(f"action=rating&ratingForm={form1}")

            # Call 2: originals=2 → consent only, correct seat counts
            form2 = f"org={org}&eduform={ef}&direction={di}&competitionType=0&prof={prof}&paid=0&originals=2"
            html2 = self._post(f"action=rating&ratingForm={form2}")

            if not html1 and not html2:
                log.info("     Empty"); continue

            # Parse seats from call 2 (correct numbers)
            total_seats = budget_seats = contract_seats = 0
            if html2:
                txt2 = BeautifulSoup(html2, "html.parser").get_text()
                m = re.search(r"Всего мест[^:]*:\s*(\d+)", txt2)
                if m: total_seats = int(m.group(1))
                m = re.search(r"Общий конкурс:\s*(\d+)", txt2)
                if m: budget_seats = int(m.group(1))
                m = re.search(r"По договору:\s*(\d+)", txt2)
                if m: contract_seats = int(m.group(1))

            # Parse applicants from call 1 (full list with consent)
            applicants = []
            if html1:
                applicants = self._parse(BeautifulSoup(html1, "html.parser"))
                # If seats were 0 from call 2, try from call 1
                if total_seats == 0:
                    txt1 = BeautifulSoup(html1, "html.parser").get_text()
                    m = re.search(r"Всего мест[^:]*:\s*(\d+)", txt1)
                    if m: total_seats = int(m.group(1))
                    m = re.search(r"Общий конкурс:\s*(\d+)", txt1)
                    if m: budget_seats = int(m.group(1))
                    m = re.search(r"По договору:\s*(\d+)", txt1)
                    if m: contract_seats = int(m.group(1))

            if applicants:
                self.results.append(CompetitionList(
                    institute=inst, education_form=EDUFORMS.get(ef,ef),
                    category=DIRECTIONS.get(di,di), specialty=sp["t"],
                    total_seats=total_seats, budget_seats=budget_seats,
                    contract_seats=contract_seats, applicants=applicants,
                    scraped_at=datetime.now().isoformat(),
                ))
                consents = sum(1 for a in applicants if a.has_consent)
                log.info("     %d people (%d consent), %d/%d seats",
                         len(applicants), consents, budget_seats, total_seats)

    def _parse(self, soup):
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if len(rows) < 2: continue

            # Auto-detect columns from header
            hdr = [c.get_text(strip=True).lower() for c in rows[0].find_all(["th","td"])]
            col = {}
            for i, h in enumerate(hdr):
                if "№" in h or "п/п" in h: col["pos"] = i
                elif "идентиф" in h or "уникальн" in h: col["uid"] = i
                elif "вступительн" in h: col["vi"] = i
                elif "индивидуальн" in h or "достиж" in h: col["id"] = i
                elif "сумм" in h or "конкурсн" in h: col["total"] = i
                elif "вид" in h and ("приём" in h or "прием" in h): col["adm"] = i
                elif "приоритет" in h: col["pri"] = i
                elif "согласи" in h or "зачисл" in h: col["con"] = i

            if "uid" not in col:
                col = {"pos":0,"uid":1,"vi":2,"id":3,"total":4,"adm":5,"pri":6,"con":7}

            apps = []
            for row in rows[1:]:
                cells = [c.get_text(strip=True) for c in row.find_all("td")]
                if len(cells) < 5: continue
                def g(k, d=""): return cells[col[k]] if k in col and col[k] < len(cells) else d
                try:
                    uid = g("uid")
                    if not uid or not uid[0].isdigit(): continue
                    vi_s = g("vi","0").replace("—","0").replace("-","0")
                    id_s = g("id","0").replace("—","0").replace("-","0")
                    tot_s = g("total","0").replace("—","0").replace("-","0")
                    pri_s = g("pri","0")
                    con_s = g("con","").lower().strip()
                    apps.append(Applicant(
                        position=int(g("pos","0")) if g("pos","0").isdigit() else 0,
                        uid=uid,
                        vi_score=int(vi_s) if vi_s.isdigit() else 0,
                        id_score=int(id_s) if id_s.isdigit() else 0,
                        total_score=int(tot_s) if tot_s.isdigit() else 0,
                        admission_type=g("adm"),
                        priority=int(pri_s) if pri_s.isdigit() else 0,
                        has_consent=con_s in ("да","+","yes","1"),
                    ))
                except (ValueError, IndexError): pass
            if apps: return apps
        return []

    def save(self):
        data = {
            "scraped_at": datetime.now().isoformat(),
            "total_lists": len(self.results),
            "total_applicants": sum(len(r.applicants) for r in self.results),
            "lists": [{
                "institute": r.institute, "education_form": r.education_form,
                "category": r.category, "specialty": r.specialty,
                "total_seats": r.total_seats, "budget_seats": r.budget_seats,
                "contract_seats": r.contract_seats, "scraped_at": r.scraped_at,
                "applicants": [asdict(a) for a in r.applicants],
            } for r in self.results],
        }
        path = DATA_DIR / "latest.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("\n=== DONE: %d lists, %d applicants ===", data["total_lists"], data["total_applicants"])


def main():
    s = TIUScraper()
    s.run(
        institute_ids=None,    # None=all, ["15"]=ВШЦТ
        eduform_ids=["1"],     # 1=Очная
        direction_ids=["2"],   # 2=Бюджет
    )
    s.save()

if __name__ == "__main__":
    main()
