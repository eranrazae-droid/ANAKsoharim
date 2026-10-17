#!/usr/bin/env bash
# בונה את סביבת ההדגמה: עותק של ops/ שמחובר למסד נתונים מדומה.
# שימוש:  design-preview/build.sh [תיקיית-מקור-ops] [תיקיית-יעד]
# ברירת מחדל: ops  →  _preview
# הפעלה מקומית:  python3 -m http.server 8080 -d _preview   ואז  http://localhost:8080/ops/
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-$HERE/../ops}"
OUT="${2:-$HERE/../_preview}"
rm -rf "$OUT"
mkdir -p "$OUT/ops"
cp -R "$SRC"/. "$OUT/ops/"
mkdir -p "$OUT/ops/__demo"
cp "$HERE"/mock/*.js "$OUT/ops/__demo/"

FB=https://www.gstatic.com/firebasejs/10.12.0
MAP='<script src="/ops/__demo/guard.js"></script><script type="importmap">{"imports":{'
for m in app firestore storage auth functions; do MAP+="\"$FB/firebase-$m.js\":\"/ops/__demo/firebase-$m.js\","; done
MAP="${MAP%,}}}</script>"

# כל דף HTML: שומר רשת + מפת ייבוא לפני כל סקריפט אחר, ומפתחות Firebase מזויפים
find "$OUT/ops" -name '*.html' -print0 | while IFS= read -r -d '' f; do
  python3 - "$f" "$MAP" <<'PY'
import re, sys
p, inject = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf-8').read()
s = re.sub(r'<head([^>]*)>', lambda m: '<head' + m.group(1) + '>' + inject, s, count=1, flags=re.I)
s = re.sub(r'AIza[0-9A-Za-z_\-]{20,}', 'demo-api-key', s)
s = s.replace('"anak-soharim"', '"demo-anak"').replace("'anak-soharim'", "'demo-anak'")
open(p, 'w', encoding='utf-8').write(s)
PY
done

# Service Workers שמוחקים את עצמם
for sw in "$OUT"/ops/*sw.js; do
  printf "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',()=>self.registration.unregister());\n" > "$sw"
done

cat > "$OUT/index.html" <<'HTML'
<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/ops/"><title>הדגמה</title>
HTML
cat > "$OUT/firebase.json" <<'JSON'
{ "hosting": { "public": ".", "ignore": ["firebase.json", "**/.*"],
  "headers": [{ "source": "**", "headers": [{ "key": "Cache-Control", "value": "no-store" }, { "key": "X-Robots-Tag", "value": "noindex" }] }] } }
JSON
echo "demo built → $OUT"
