#!/usr/bin/env python3
"""
Facebook Marketplace Monitor
סורק את Facebook Marketplace ושולח התראות בטלגרם

הרצה: python marketplace_monitor.py
קובץ חיפושים: market_alerts.json (ייצוא מהדשבורד)
"""

import json
import os
import time
import re
import hashlib
import logging
from datetime import datetime
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# טען .env אם קיים
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

# ─── הגדרות ──────────────────────────────────────────────────────────────────
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

ALERTS_FILE = Path("market_alerts.json")   # קובץ מיוצא מהדשבורד
SEEN_FILE = Path(".seen_listings.json")    # מודעות שכבר ראינו
FB_EMAIL = os.environ.get("FB_EMAIL", "")  # אימייל פייסבוק (אופציונלי)
FB_PASS = os.environ.get("FB_PASS", "")   # סיסמת פייסבוק (אופציונלי)

SCAN_INTERVAL_MINUTES = 10   # כל כמה דקות לסרוק
HEADLESS = True              # True = ללא חלון דפדפן

# ─── לוגים ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("monitor")

# ─── מסד נתונים של מודעות שנראו ──────────────────────────────────────────────
def load_seen() -> set:
    if SEEN_FILE.exists():
        return set(json.loads(SEEN_FILE.read_text()))
    return set()

def save_seen(seen: set):
    SEEN_FILE.write_text(json.dumps(list(seen)))

# ─── טלגרם ───────────────────────────────────────────────────────────────────
def send_telegram(msg: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        log.warning("⚠️  טוקן טלגרם חסר — הגדר TELEGRAM_TOKEN ו-TELEGRAM_CHAT_ID")
        print("📨 [TELEGRAM MOCK]:", msg)
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        resp = requests.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": msg,
            "parse_mode": "HTML",
            "disable_web_page_preview": False,
        }, timeout=10)
        resp.raise_for_status()
        log.info("📨 הודעת טלגרם נשלחה")
    except Exception as e:
        log.error(f"שגיאה בשליחת טלגרם: {e}")

# ─── טעינת חיפושים ───────────────────────────────────────────────────────────
def load_alerts() -> list:
    if not ALERTS_FILE.exists():
        log.error(f"קובץ חיפושים לא נמצא: {ALERTS_FILE}")
        log.error("ייצא את החיפושים מהדשבורד (כפתור ⬇️ ייצוא JSON)")
        return []
    alerts = json.loads(ALERTS_FILE.read_text(encoding="utf-8"))
    active = [a for a in alerts if a.get("active", True)]
    log.info(f"נטענו {len(active)} חיפושים פעילים")
    return active

# ─── בניית URL חיפוש ─────────────────────────────────────────────────────────
REGION_COORDS = {
    "north":     (32.794, 35.531, 50),
    "haifa":     (32.794, 34.989, 30),
    "center":    (32.085, 34.781, 40),
    "telaviv":   (32.085, 34.781, 20),
    "jerusalem": (31.769, 35.216, 30),
    "south":     (31.252, 34.791, 80),
}

def build_search_url(alert: dict) -> str:
    brand = alert.get("brand", "")
    model = alert.get("model", "")
    query = f"{brand} {model}".strip()

    params = [
        f"query={requests.utils.quote(query)}",
        "exact=false",
    ]
    if alert.get("priceMin"):
        params.append(f"minPrice={int(alert['priceMin'])}")
    if alert.get("priceMax"):
        params.append(f"maxPrice={int(alert['priceMax'])}")

    region = alert.get("region", "")
    if region and region in REGION_COORDS:
        lat, lon, radius = REGION_COORDS[region]
        params += [f"latitude={lat}", f"longitude={lon}", f"radius={radius}"]

    return "https://www.facebook.com/marketplace/category/vehicles?" + "&".join(params)

# ─── פרסור מודעה ─────────────────────────────────────────────────────────────
def parse_price(text: str) -> int | None:
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None

def listing_matches(listing: dict, alert: dict) -> bool:
    price = listing.get("price")
    year = listing.get("year")
    km = listing.get("km")

    if alert.get("priceMin") and price and price < alert["priceMin"]:
        return False
    if alert.get("priceMax") and price and price > alert["priceMax"]:
        return False
    if alert.get("yearMin") and year and year < alert["yearMin"]:
        return False
    if alert.get("yearMax") and year and year > alert["yearMax"]:
        return False
    if alert.get("kmMax") and km and km > alert["kmMax"]:
        return False
    return True

# ─── סריקת Marketplace ────────────────────────────────────────────────────────
def scrape_marketplace(page, url: str) -> list[dict]:
    listings = []
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(3000)

        # נסה לאתר כרטיסיות מודעה
        cards = page.query_selector_all('[data-testid="marketplace_feed_item"], a[href*="/marketplace/item/"]')

        # fallback — כל קישור לפריט
        if not cards:
            cards = page.query_selector_all('a[href*="/marketplace/item/"]')

        seen_hrefs = set()
        for card in cards[:30]:
            try:
                href = card.get_attribute("href") or ""
                if not href or href in seen_hrefs:
                    continue
                seen_hrefs.add(href)

                full_url = "https://www.facebook.com" + href if href.startswith("/") else href
                # חלץ ID מה-URL
                m = re.search(r"/item/(\d+)", full_url)
                item_id = m.group(1) if m else hashlib.md5(full_url.encode()).hexdigest()[:12]

                text = card.inner_text()
                lines = [l.strip() for l in text.splitlines() if l.strip()]

                price = None
                year = None
                km = None
                title = lines[0] if lines else "ללא כותרת"

                for line in lines:
                    if "₪" in line or "ILS" in line or re.search(r"\d{4,}", line):
                        if price is None:
                            price = parse_price(line)
                    if re.match(r"^(19|20)\d{2}$", line):
                        year = int(line)
                    km_m = re.search(r"([\d,]+)\s*ק.?מ", line)
                    if km_m:
                        km = parse_price(km_m.group(1))

                listings.append({
                    "id": item_id,
                    "title": title,
                    "price": price,
                    "year": year,
                    "km": km,
                    "url": full_url,
                })
            except Exception:
                continue

    except PlaywrightTimeoutError:
        log.warning(f"Timeout בטעינת: {url}")
    except Exception as e:
        log.error(f"שגיאה בסריקה: {e}")

    return listings

# ─── בניית הודעת טלגרם ────────────────────────────────────────────────────────
def format_message(listing: dict, alert: dict) -> str:
    price_str = f"₪{listing['price']:,}" if listing.get("price") else "מחיר לא צוין"
    year_str = str(listing["year"]) if listing.get("year") else ""
    km_str = f"{listing['km']:,} ק\"מ" if listing.get("km") else ""

    details = " | ".join(filter(None, [year_str, km_str, price_str]))

    return (
        f"🚗 <b>מודעה חדשה!</b>\n"
        f"🔍 חיפוש: {alert['name']}\n"
        f"📌 {listing['title']}\n"
        f"💰 {details}\n"
        f"🔗 <a href=\"{listing['url']}\">פתח ב-Facebook</a>"
    )

# ─── לולאה ראשית ─────────────────────────────────────────────────────────────
def run_once(page, alerts: list, seen: set) -> set:
    new_seen = set(seen)
    for alert in alerts:
        url = build_search_url(alert)
        log.info(f"סורק: {alert['name']} → {url}")
        listings = scrape_marketplace(page, url)
        log.info(f"  נמצאו {len(listings)} מודעות")

        for listing in listings:
            key = f"{alert['id']}:{listing['id']}"
            if key in seen:
                continue
            if listing_matches(listing, alert):
                msg = format_message(listing, alert)
                send_telegram(msg)
                log.info(f"  ✅ התראה: {listing['title']}")
            new_seen.add(key)

        time.sleep(2)  # נחכה קצת בין חיפושים
    return new_seen

def main():
    log.info("🚀 Marketplace Monitor מתחיל")

    if not TELEGRAM_TOKEN:
        log.warning("=" * 60)
        log.warning("TELEGRAM_TOKEN לא מוגדר — ההתראות יודפסו למסך בלבד")
        log.warning("הגדר: export TELEGRAM_TOKEN=your_token")
        log.warning("       export TELEGRAM_CHAT_ID=your_chat_id")
        log.warning("=" * 60)

    seen = load_seen()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=HEADLESS)
        ctx = browser.new_context(
            locale="he-IL",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = ctx.new_page()

        # התחברות לפייסבוק אם יש פרטים
        if FB_EMAIL and FB_PASS:
            log.info("מתחבר לפייסבוק...")
            try:
                page.goto("https://www.facebook.com/login", timeout=20_000)
                page.fill("#email", FB_EMAIL)
                page.fill("#pass", FB_PASS)
                page.click("[name='login']")
                page.wait_for_timeout(4000)
                log.info("✅ מחובר לפייסבוק")
            except Exception as e:
                log.warning(f"לא הצלחתי להתחבר: {e}")

        while True:
            alerts = load_alerts()
            if alerts:
                seen = run_once(page, alerts, seen)
                save_seen(seen)

            next_run = datetime.now().strftime("%H:%M")
            log.info(f"✅ סריקה הושלמה. סריקה הבאה בעוד {SCAN_INTERVAL_MINUTES} דקות")
            time.sleep(SCAN_INTERVAL_MINUTES * 60)

if __name__ == "__main__":
    main()
