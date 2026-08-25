"""Checks if enrollment orders have been published on TIU website."""
import json, sys, os
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
    text = soup.get_text().lower()

    # Look for PDF links (orders are published as PDFs)
    pdfs = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if ".pdf" in href.lower():
            title = a.get_text(strip=True) or href.split("/")[-1]
            if not href.startswith("http"):
                href = "https://www.tyuiu.ru" + href
            pdfs.append({"title": title, "url": href})

    # Check for keywords indicating orders are published
    has_orders = bool(pdfs) or "приказ" in text and ("зачисл" in text) and ("магистр" in text or "2026" in text)

    status = {
        "checked_at": datetime.now(MSK).strftime("%d.%m.%Y %H:%M МСК"),
        "has_orders": has_orders,
        "pdfs": pdfs,
        "message": f"Найдено {len(pdfs)} документов" if pdfs else "Приказы пока не опубликованы"
    }

    # Save to orders.json
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / "orders.json"
    path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Status: {status['message']} ({status['checked_at']})")

    # Also update latest.json if it exists
    latest_path = DATA_DIR / "latest.json"
    if latest_path.exists():
        data = json.loads(latest_path.read_text(encoding="utf-8"))
        data["orders"] = status
        latest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print("Updated latest.json")

    return has_orders

if __name__ == "__main__":
    check()
