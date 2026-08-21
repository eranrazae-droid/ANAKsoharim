// חלונית שנפתחת מעל חלונית אחרת חייבת לשבת מעליה. לכל החלוניות אותו
// z-index, ולכן בלי זה הסדר נקבע לפי המיקום בקובץ — וחלונית אישור שנפתחת
// מתוך כרטיס הסתתרה מאחורי הכרטיס עצמו, כאילו הכפתור לא עשה כלום.
let _modalZ = 200;
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (document.querySelector('.modal-overlay.open')) el.style.zIndex = ++_modalZ;
  el.classList.add('open');
  // the page behind a modal must not scroll under the wheel
  document.body.classList.add('modal-open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  el.style.zIndex = '';
  // one modal may sit on top of another — release only when the last one goes
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.classList.remove('modal-open');
    _modalZ = 200;
  }
}
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => {
    // חלונית נעולה נסגרת רק מהכפתורים שבתוכה
    if (o.dataset.locked === '1') return;
    // goes through closeModal so the page scroll is released as well
    if (e.target === o) closeModal(o.id);
  });
});

function showToast(msg, duration) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration || 2800);
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
