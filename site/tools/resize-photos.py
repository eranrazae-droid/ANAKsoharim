#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
הקטנת צילומי רכב לאתר.

צילום מהטלפון שוקל 3–5 מגה. באתר הוא מוצג ברוחב של פחות מ-1000 פיקסל,
כך שכל מה שמעבר לזה הוא משקל מיותר שהלקוח מוריד בסלולר.

שימוש:
    python3 resize-photos.py <תיקיית מקור> <תיקיית יעד>

הסקריפט לא נוגע בקבצי המקור. הוא יוצר עותקים מוקטנים בתיקיית היעד.

דורש: pip install pillow
"""

import os
import sys
from PIL import Image, ImageOps

MAX_SIDE = 1200     # הצלע הארוכה בפיקסלים — מספיק לכל מסך, כולל רטינה
QUALITY  = 78       # איכות JPEG. מתחת ל-70 מתחילים לראות ריבועים
EXTS     = ('.jpg', '.jpeg', '.png', '.heic', '.webp')


def human(n):
    return f'{n/1024:.0f}KB' if n < 1024 * 1024 else f'{n/1024/1024:.1f}MB'


def resize_one(src, dst):
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)        # מכבד את סיבוב התמונה מהטלפון
    im = im.convert('RGB')
    before_size = im.size
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    return before_size, im.size


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    src_dir, dst_dir = sys.argv[1], sys.argv[2]
    os.makedirs(dst_dir, exist_ok=True)

    files = sorted(f for f in os.listdir(src_dir) if f.lower().endswith(EXTS))
    if not files:
        print('לא נמצאו תמונות בתיקייה')
        sys.exit(1)

    total_before = total_after = 0
    print(f'{"קובץ":<22}{"לפני":>10}{"אחרי":>10}{"חיסכון":>10}')
    print('-' * 52)

    for i, name in enumerate(files, 1):
        src = os.path.join(src_dir, name)
        dst = os.path.join(dst_dir, f'{i:02d}.jpg')
        try:
            resize_one(src, dst)
        except Exception as e:
            print(f'{name:<22}  דילוג — {e}')
            continue

        b, a = os.path.getsize(src), os.path.getsize(dst)
        total_before += b
        total_after += a
        print(f'{name[:20]:<22}{human(b):>10}{human(a):>10}{100 - a*100//b:>9}%')

    print('-' * 52)
    saved = 100 - total_after * 100 // total_before
    print(f'{"סה״כ":<22}{human(total_before):>10}{human(total_after):>10}{saved:>9}%')
    print(f'\nהתמונות המוכנות נמצאות ב: {dst_dir}')


if __name__ == '__main__':
    main()
