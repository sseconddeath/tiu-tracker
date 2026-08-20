"""
TIU API Diagnostic - tries multiple request formats to find the working one.
Run with VPN OFF.
"""
import requests

BASE = "https://incoming.tyuiu.ru"
AJAX = BASE + "/wp-admin/admin-ajax.php"
PAGE = BASE + "/incoming/"
HDR = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": PAGE,
}

s = requests.Session()
s.headers.update(HDR)

# Step 1: Load page to get cookies
print("1. Loading main page...")
try:
    r = s.get(PAGE, timeout=30)
    print(f"   OK: {r.status_code}, {len(r.text)} bytes, cookies: {dict(s.cookies)}")
except Exception as e:
    print(f"   FAIL: {e}")
    print("\n   VPN is probably ON. Turn it OFF and try again.")
    input("\nPress Enter...")
    exit()

# Step 2: Try different request formats for disciplines
serialized = "org=15&eduform=1&direction=2&competitionType=0&prof=&paid=0&originals=0"

tests = [
    ("Raw string (jQuery style)",
     f"action=disciplines&ratingForm={serialized}&contractValue=false",
     "raw"),
    
    ("Dict with ratingForm as string",
     {"action": "disciplines", "ratingForm": serialized, "contractValue": "false"},
     "dict"),
    
    ("Dict flat params",
     {"action": "disciplines", "org": "15", "eduform": "1", "direction": "2",
      "competitionType": "0", "prof": "", "paid": "0", "originals": "0", "contractValue": "false"},
     "dict"),
    
    ("Dict flat + ratingForm",
     {"action": "disciplines", "ratingForm": "org=15", "org": "15", "eduform": "1", 
      "direction": "2", "competitionType": "0", "prof": "", "paid": "0", "originals": "0",
      "contractValue": "false"},
     "dict"),

    ("Raw with encoded ratingForm",
     "action=disciplines&ratingForm=org%3D15%26eduform%3D1%26direction%3D2%26competitionType%3D0%26prof%3D%26paid%3D0%26originals%3D0&contractValue=false",
     "raw"),
]

print("\n2. Testing disciplines API...")
for name, data, fmt in tests:
    try:
        if fmt == "raw":
            r = s.post(AJAX, data=data,
                      headers={**HDR, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
                      timeout=15)
        else:
            r = s.post(AJAX, data=data, timeout=15)
        
        resp = r.text.strip()
        ok = resp != "0" and len(resp) > 5
        status = "SUCCESS" if ok else "fail (returned 0)"
        preview = resp[:200] if ok else resp[:50]
        print(f"\n   [{status}] {name}")
        print(f"   Response ({len(resp)} bytes): {preview}")
        
        if ok:
            # Found working format! Try rating too
            print(f"\n   >>> WORKING FORMAT FOUND: {name}")
            
            # Parse specialties
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp, "html.parser")
            options = soup.find_all("option")
            print(f"   Found {len(options)} specialties:")
            for opt in options[:5]:
                print(f"     value='{opt.get('value','')}' text='{opt.text.strip()[:60]}'")
            
            if options:
                # Try getting rating for first specialty
                prof_val = options[0].get("value", "")
                print(f"\n3. Testing rating API with prof='{prof_val[:50]}'...")
                
                if fmt == "raw":
                    rating_serial = f"org=15&eduform=1&direction=2&competitionType=0&prof={requests.utils.quote(prof_val)}&paid=0&originals=0"
                    r2 = s.post(AJAX,
                               data=f"action=rating&ratingForm={rating_serial}",
                               headers={**HDR, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
                               timeout=15)
                else:
                    r2 = s.post(AJAX,
                               data={"action": "rating", "ratingForm": f"org=15", "org": "15",
                                     "eduform": "1", "direction": "2", "competitionType": "0",
                                     "prof": prof_val, "paid": "0", "originals": "0"},
                               timeout=15)
                
                resp2 = r2.text.strip()
                ok2 = resp2 != "0" and len(resp2) > 100
                print(f"   Rating response: {len(resp2)} bytes, {'SUCCESS' if ok2 else 'fail'}")
                if ok2:
                    print(f"   Preview: {resp2[:300]}")
                    # Save for analysis
                    open("debug_working.html", "w", encoding="utf-8").write(resp2)
                    print(f"\n   Saved full response to debug_working.html")
            
            break
            
    except Exception as e:
        print(f"\n   [error] {name}: {e}")

print("\n" + "="*50)
print("Done. Send screenshot of this window.")
input("\nPress Enter to close...")
