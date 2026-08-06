function openModal(id) {
  document.getElementById(id).classList.add('open');
  // the page behind a modal must not scroll under the wheel
  document.body.classList.add('modal-open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  // one modal may sit on top of another — release only when the last one goes
  if (!document.querySelector('.modal-overlay.open')) document.body.classList.remove('modal-open');
}
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) o.classList.remove('open');
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
