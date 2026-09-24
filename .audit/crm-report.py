# קורא את תשובת crmVehicle או crmCompare מהקלט ומדפיס אותה קריא.
import sys, json
what = sys.argv[1] if len(sys.argv) > 1 else 'vehicle'
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print('תשובה שאינה JSON:', raw[:300]); raise SystemExit(0)
if what != 'ownscan' and not d.get('ok'):
    print('נכשל:', json.dumps(d, ensure_ascii=False)[:400]); raise SystemExit(0)
if what == 'ownscan':
    print('ok:', d.get('ok'))
    if not d.get('ok'):
        print('  סיבת הכישלון:', d.get('reason'))
        print('  פירוט:', json.dumps({k: v for k, v in d.items() if k not in ('ok',)}, ensure_ascii=False)[:600])
    else:
        print('  נבדקו:', d.get('checked'), '| לא על תו סחר:', d.get('notOurs'), '| לא ידוע:', d.get('unknown'))
        print('  מצב המרשם:', json.dumps(d.get('registryHttp'), ensure_ascii=False)[:300])
        print('  חדשים שטרם נבדקו:', len(d.get('newUnchecked') or []))
        print('  ירדו מהמלאי:', len(d.get('goneFromStock') or []))
    raise SystemExit(0)
if what == 'source':
    print('רכבים שהסריקות רואות:', d.get('count'))
    for s in (d.get('sample') or [])[:3]:
        print('  ', s.get('plate'), s.get('tozeret'), s.get('degem'), s.get('shnat'))
elif what == 'vehicle':
    v = d.get('vehicle') or {}
    print('נמצא:', d.get('found'))
    for k in ('plate','status','maker','model','modelRegistry','subModel','year','color','vin','enteredAt'):
        print('  %-14s %r' % (k, v.get(k)))
else:
    print('ב-CRM:', d['crmCount'], '| בפיד הישן:', d['feedCount'], '| CRM עודכן:', d.get('crmUpdatedAt'))
    print('סטטוסים ב-CRM:', json.dumps(d.get('statuses'), ensure_ascii=False))
    print()
    print('--- %d רכבים שבפיד הישן ואינם ב-CRM ---' % d['onlyInFeedCount'])
    for v in d['onlyInFeed']:
        print('  ', v['plate'], v.get('desc',''))
    print()
    print('--- %d רכבים שב-CRM ואינם בפיד הישן ---' % d['onlyInCrmCount'])
    for v in d['onlyInCrm']:
        print('  ', v['plate'], v.get('status',''), v.get('desc',''))
