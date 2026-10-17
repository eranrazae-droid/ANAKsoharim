/* מדידת זמני מילוי — קליטה, בדיקת מלאי ונסיעת מבחן.
   רישום שקט בלבד: הקובץ לא משנה את הטפסים ולא את מה שהנהג רואה. הוא מאזין
   מבחוץ לפתיחה ולסגירה של החלונית ולכל לחיצה בתוכה, שומר את הזמנים במכשיר,
   ואחרי שהטופס נשלח בפועל כותב רשומה אחת ל-timing_logs. */
(function () {
  'use strict';
  const FORMS = [
    { kind: 'intake',    modal: 'modal-driver-intake',   col: 'intake_assignments',
      id: () => (typeof _currentIntakeId !== 'undefined' ? _currentIntakeId : null),
      item: el => { const b = el.closest('.ci-box[data-key]'); return b ? b.dataset.key : null; } },
    { kind: 'inventory', modal: 'modal-driver-inv',      col: 'inventory_assignments',
      id: () => (typeof _driverInvDocId !== 'undefined' ? _driverInvDocId : null),
      item: el => { const b = el.closest('[onclick^="dinvClick("]'); const m = b && b.getAttribute('onclick').match(/dinvClick\((\d+)/); return m ? 'r' + m[1] : null; } },
    { kind: 'testdrive', modal: 'modal-fill-test-drive', col: 'test_drives',
      id: () => document.getElementById('tdf-id')?.value || null,
      item: el => { const b = el.closest('.ci-box[data-key]'); return b ? b.dataset.key : null; } },
  ];
  const KEY = (f, id) => `anak_tm_${f.kind}_${id}`;
  const load = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const drop = k => { try { localStorage.removeItem(k); } catch (e) {} };
  const live = {};   // kind -> { id, key, st }

  function onOpen(f) {
    const id = f.id(); if (!id) return;
    const k = KEY(f, id);
    const st = load(k) || { openedAt: Date.now(), sessions: [], acts: [], marks: {}, changes: 0 };
    st.sessions.push({ o: Date.now(), c: null });
    live[f.kind] = { id, key: k, st };
    save(k, st);
  }
  function onClose(f) {
    const L = live[f.kind]; if (!L) return;
    delete live[f.kind];
    const s = L.st.sessions[L.st.sessions.length - 1]; if (s && !s.c) s.c = Date.now();
    save(L.key, L.st);
    // אחרי השליחה הסטטוס מתעדכן — בודקים בשקט אם הטופס באמת נשלח
    setTimeout(() => finish(f, L.id, L.key), 2500);
  }
  async function finish(f, id, k) {
    const st = load(k); if (!st) return;
    try {
      const snap = await window._getDoc(window._docRef(f.col, id));
      if (!snap.exists()) { drop(k); return; }
      const d = snap.data();
      if (d.status === 'pending') return;          // עדיין לא נשלח — ממשיכים בפעם הבאה
      const done = d.completedAt?.toMillis ? d.completedAt.toMillis() : (st.sessions.at(-1)?.c || Date.now());
      await window._setDoc(window._docRef('timing_logs', `${f.kind}_${id}`), {
        kind: f.kind, refId: id,
        driver: d.completedBy || d.assignedTo || (typeof currentUser !== 'undefined' && currentUser?.name) || '',
        plate: d.plate || '',
        openedAt: st.openedAt, submittedAt: done,
        sessions: st.sessions.slice(-20),
        acts: st.acts.slice(-600),
        marks: st.marks, changes: st.changes || 0,
        createdAt: window._serverTs(),
      });
      drop(k);
    } catch (e) { console.warn('timing', e); }
  }
  function onAct(f, ev) {
    const L = live[f.kind]; if (!L) return;
    const now = Date.now(), st = L.st;
    if (!st.acts.length || now - st.acts[st.acts.length - 1] > 800) st.acts.push(now);
    const key = f.item(ev.target);
    if (key) { if (!st.marks[key]) st.marks[key] = now; else st.changes = (st.changes || 0) + 1; }
    save(L.key, st);
  }
  function watch() {
    FORMS.forEach(f => {
      const m = document.getElementById(f.modal); if (!m) return;
      let open = m.classList.contains('open');
      if (open) onOpen(f);
      new MutationObserver(() => {
        const now = m.classList.contains('open');
        if (now === open) return;
        open = now;
        try { now ? setTimeout(() => onOpen(f), 300) : onClose(f); } catch (e) {}
      }).observe(m, { attributes: true, attributeFilter: ['class'] });
      ['pointerdown', 'input'].forEach(t => m.addEventListener(t, ev => { try { onAct(f, ev); } catch (e) {} }, true));
    });
    // טפסים שנסגרו בלי שהתשובה הגיעה (רענון, חיבור חלש) — ננסה שוב בכניסה הבאה
    setTimeout(() => {
      try {
        Object.keys(localStorage).filter(k => k.startsWith('anak_tm_')).forEach(k => {
          const [, , kind, ...rest] = k.split('_'); const f = FORMS.find(x => x.kind === kind);
          if (f && !live[kind]) finish(f, rest.join('_'), k);
        });
      } catch (e) {}
    }, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
