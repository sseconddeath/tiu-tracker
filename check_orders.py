"""Checks for magistratura enrollment orders on TIU website."""
import json, sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "beautifulsoup4", "--quiet"])
    import requests
    from bs4 import BeautifulSoup

MSK = timezone(timedelta(hours=3))
URL = "https://www.tyuiu.ru/postuplenie/priemnaia-kampaniia-2025/prikazy-o-zacislenii"
DATA_DIR = Path(__file__).parent / "public" / "data"

def check():
    print("Checking orders page...")
    r = requests.get(URL, timeout=30, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # Find the "Магистратура" section and collect PDFs after it
    mag_pdfs = []
    in_magistratura = False

    content = soup.find("div", class_="content")
    if not content:
        content = soup

    for el in content.find_all(["p", "div", "strong", "b"]):
        text = el.get_text(strip=True).lower()

        # Detect section headers
        if el.name in ("strong", "b") or (el.name == "div" and el.find("strong")):
            if "магистратур" in text:
                in_magistratura = True
                continue
            elif in_magistratura and any(w in text for w in ["кадры", "бакалавр", "специалит", "среднее", "общежити", "форма"]):
                in_magistratura = False
                continue

        # Collect PDFs in magistratura section
        if in_magistratura:
            for a in el.find_all("a", href=True):
                href = a["href"]
                if ".pdf" in href.lower():
                    title = a.get_text(strip=True)
                    if not href.startswith("http"):
                        href = "https://old.tyuiu.ru" + href
                    mag_pdfs.append({"title": title, "url": href})

    status = {
        "checked_at": datetime.now(MSK).strftime("%d.%m.%Y %H:%M МСК"),
        "has_orders": len(mag_pdfs) > 0,
        "pdfs": mag_pdfs,
        "message": f"Магистратура: {len(mag_pdfs)} приказов" if mag_pdfs else "Приказы магистратуры пока не опубликованы"
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    latest_path = DATA_DIR / "latest.json"
    if latest_path.exists():
        data = json.loads(latest_path.read_text(encoding="utf-8"))
        data["orders"] = status
        latest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Status: {status['message']} ({status['checked_at']})")
    for p in mag_pdfs:
        print(f"  -> {p['title']}")

if __name__ == "__main__":
    check()
