"""
TIU Scraper v7.1 — with retry logic for unstable connection.
5 attempts with increasing delays for initial page load.
"""
import json,logging,re,sys,time
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass,asdict,field
from urllib.parse import quote
try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable,"-m","pip","install","requests","beautifulsoup4","--quiet"])
    import requests
    from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO,format="%(asctime)s [%(levelname)s] %(message)s")
log=logging.getLogger(__name__)
AJAX="https://incoming.tyuiu.ru/wp-admin/admin-ajax.php"
BASE="https://incoming.tyuiu.ru/incoming/"
DATA_DIR=Path(__file__).parent.parent/"public"/"data"
DATA_DIR.mkdir(parents=True,exist_ok=True)
HDR={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
     "X-Requested-With":"XMLHttpRequest","Referer":BASE,
     "Content-Type":"application/x-www-form-urlencoded; charset=UTF-8"}
EDUFORMS={"1":"Очная","2":"Заочная","3":"Очно-заочная"}
DIRECTIONS={"1":"Договор","2":"Бюджет"}

@dataclass
class Applicant:
    position:int;uid:str;vi_score:int;id_score:int;total_score:int
    admission_type:str;priority:int;has_consent:bool

class TIUScraper:
    def __init__(self):
        self.s=requests.Session()
        self.s.headers.update({"User-Agent":HDR["User-Agent"],"Accept-Language":"ru-RU,ru;q=0.9"})
        self.results=[];self.institutes={}

    def _fetch_with_retry(self,url,max_attempts=5,**kwargs):
        for attempt in range(1,max_attempts+1):
            try:
                log.info("  Loading (attempt %d/%d)...",attempt,max_attempts)
                r=self.s.get(url,timeout=60,**kwargs);r.raise_for_status()
                return r
            except Exception as e:
                log.warning("  Attempt %d failed: %s",attempt,str(e)[:80])
                if attempt==max_attempts:raise
                wait=attempt*15
                log.info("  Waiting %ds...",wait)
                time.sleep(wait)

    def run(self,institute_ids=None,eduform_ids=None,direction_ids=None):
        if eduform_ids is None:eduform_ids=["1"]
        if direction_ids is None:direction_ids=["2"]
        log.info("Fetching page...")
        r=self._fetch_with_retry(BASE)
        log.info("Page: %d bytes",len(r.text))
        soup=BeautifulSoup(r.text,"html.parser")
        for opt in soup.find("select",{"name":"org"}).find_all("option"):
            v,t=opt.get("value","0"),opt.get_text(strip=True)
            if v!="0" and t!="---":self.institutes[v]=t
        orgs=institute_ids or list(self.institutes.keys())
        log.info("%d institutes",len(orgs))
        for org in orgs:
            for ef in eduform_ids:
                for di in direction_ids:
                    try:self._scrape(org,ef,di)
                    except Exception as e:log.error("Error: %s",e)

    def _post(self,data):
        for attempt in range(1,4):
            try:
                r=self.s.post(AJAX,data=data,headers=HDR,timeout=30);r.raise_for_status()
                return None if r.text.strip()=="0" else r.text
            except Exception as e:
                if attempt==3:log.warning("POST failed: %s",str(e)[:60]);return None
                time.sleep(5*attempt)

    def _scrape(self,org,ef,di):
        inst=self.institutes.get(org,org)
        log.info("\n=== %s | %s | %s ===",inst,EDUFORMS.get(ef,ef),DIRECTIONS.get(di,di))
        form=f"org={org}&eduform={ef}&direction={di}&competitionType=0&prof=&paid=0&originals=1"
        html=self._post(f"action=disciplines&ratingForm={form}&contractValue=false")
        if not html:log.info("  No specs");return
        specs=[{"v":o.get("value",""),"t":o.get_text(strip=True)}
               for o in BeautifulSoup(html,"html.parser").find_all("option") if o.get("value")]
        log.info("  %d specialties",len(specs))
        for sp in specs:
            log.info("  -> %s",sp["t"][:70])
            prof=quote(sp["v"],safe="")
            h1=self._post(f"action=rating&ratingForm=org={org}&eduform={ef}&direction={di}&competitionType=0&prof={prof}&paid=0&originals=1")
            h2=self._post(f"action=rating&ratingForm=org={org}&eduform={ef}&direction={di}&competitionType=0&prof={prof}&paid=0&originals=2")
            if not h1 and not h2:log.info("     Empty");continue
            seats={"total":0,"budget":0,"contract":0}
            for src in [h2,h1]:
                if not src:continue
                txt=BeautifulSoup(src,"html.parser").get_text()
                m=re.search(r"Всего мест[^:]*:\s*(\d+)",txt)
                if m and seats["total"]==0:seats["total"]=int(m.group(1))
                m=re.search(r"Общий конкурс:\s*(\d+)",txt)
                if m and seats["budget"]==0:seats["budget"]=int(m.group(1))
                m=re.search(r"По договору:\s*(\d+)",txt)
                if m and seats["contract"]==0:seats["contract"]=int(m.group(1))
            full=self._parse(BeautifulSoup(h1,"html.parser")) if h1 else []
            consent=self._parse(BeautifulSoup(h2,"html.parser")) if h2 else []
            if full or consent:
                self.results.append({
                    "institute":inst,"education_form":EDUFORMS.get(ef,ef),
                    "category":DIRECTIONS.get(di,di),"specialty":sp["t"],
                    "total_seats":seats["total"],"budget_seats":seats["budget"],
                    "contract_seats":seats["contract"],
                    "applicants":[asdict(a) for a in full],
                    "consent_applicants":[asdict(a) for a in consent],
                    "scraped_at":datetime.now().isoformat(),
                })
                log.info("     full:%d consent:%d seats:%d/%d",len(full),len(consent),seats["budget"],seats["total"])

    def _parse(self,soup):
        for table in soup.find_all("table"):
            rows=table.find_all("tr")
            if len(rows)<2:continue
            hdr=[c.get_text(strip=True).lower() for c in rows[0].find_all(["th","td"])]
            col={}
            for i,h in enumerate(hdr):
                if "№" in h or "п/п" in h:col["pos"]=i
                elif "идентиф" in h or "уникальн" in h:col["uid"]=i
                elif "вступительн" in h:col["vi"]=i
                elif "индивидуальн" in h or "достиж" in h:col["id"]=i
                elif "сумм" in h or "конкурсн" in h:col["total"]=i
                elif "вид" in h and ("приём" in h or "прием" in h):col["adm"]=i
                elif "приоритет" in h:col["pri"]=i
                elif "согласи" in h or "зачисл" in h:col["con"]=i
            if "uid" not in col:col={"pos":0,"uid":1,"vi":2,"id":3,"total":4,"adm":5,"pri":6,"con":7}
            apps=[]
            for row in rows[1:]:
                cells=[c.get_text(strip=True) for c in row.find_all("td")]
                if len(cells)<5:continue
                def g(k,d=""):return cells[col[k]] if k in col and col[k]<len(cells) else d
                try:
                    uid=g("uid")
                    if not uid or not uid[0].isdigit():continue
                    vs=g("vi","0").replace("—","0").replace("-","0")
                    ids=g("id","0").replace("—","0").replace("-","0")
                    ts=g("total","0").replace("—","0").replace("-","0")
                    ps=g("pri","0");cs=g("con","").lower().strip()
                    apps.append(Applicant(
                        position=int(g("pos","0")) if g("pos","0").isdigit() else 0,
                        uid=uid,vi_score=int(vs) if vs.isdigit() else 0,
                        id_score=int(ids) if ids.isdigit() else 0,
                        total_score=int(ts) if ts.isdigit() else 0,
                        admission_type=g("adm"),priority=int(ps) if ps.isdigit() else 0,
                        has_consent=cs in ("да","+","yes","1"),
                    ))
                except (ValueError,IndexError):pass
            if apps:return apps
        return []

    def save(self):
        data={"scraped_at":datetime.now().isoformat(),"total_lists":len(self.results),
              "total_applicants":sum(len(r["applicants"]) for r in self.results),
              "lists":self.results}
        path=DATA_DIR/"latest.json"
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
        log.info("\n=== DONE: %d lists, %d people ===",data["total_lists"],data["total_applicants"])

def main():
    s=TIUScraper()
    s.run(institute_ids=None,eduform_ids=["1"],direction_ids=["2"])
    s.save()

if __name__=="__main__":main()
