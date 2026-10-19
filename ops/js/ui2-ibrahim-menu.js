/* Approved worker header/menu only. Existing job cards and grids are untouched. */
(function () {
  'use strict';
  const source = document.currentScript;
  if (!source) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('../css/ui2-ibrahim-menu.css' + new URL(source.src).search, source.src).href;
  document.head.appendChild(css);
  const photoURL = new URL('../img/ibrahim-menu/team-original.jpg', source.src).href;
  let pending = false, banner, originalButton, originalText;
  function sync() {
    pending = false;
    const screen = document.getElementById('screen-bodyshop');
    if (!screen) return;
    const allowed = typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'bodyshop';
    if (screen.classList.contains('u2iw-enabled') !== !!allowed) screen.classList.toggle('u2iw-enabled', !!allowed);
    if (!allowed) {
      if (banner) banner.hidden = true;
      if (originalButton && originalButton.classList.contains('u2iw-menu-trigger')) {
        originalButton.classList.remove('u2iw-menu-trigger'); originalButton.textContent = originalText;
        originalButton.removeAttribute('aria-controls'); originalButton.removeAttribute('aria-expanded');
      }
      return;
    }
    const header = screen.querySelector('.app-header');
    const button = header && header.querySelector('button[aria-label="תפריט"]');
    const menu = document.getElementById('bshop-menu');
    if (!header || !button || !menu) return;
    if (!banner) {
      banner = document.createElement('section'); banner.className = 'u2iw-banner';
      banner.setAttribute('aria-label', 'צוות התפעול');
      const photo = document.createElement('img'); photo.src = photoURL;
      photo.alt = 'תמונת הצוות המשותפת'; photo.decoding = 'async';
      const caption = document.createElement('div'); caption.className = 'u2iw-caption'; caption.textContent = 'עובדים יחד';
      banner.append(photo, caption);
    }
    if (header.nextElementSibling !== banner) header.after(banner);
    banner.hidden = false;
    // Keep aria-label and the existing onclick: outside-click handling relies on them.
    if (!button.classList.contains('u2iw-menu-trigger')) {
      originalButton = button; originalText = button.textContent;
      button.classList.add('u2iw-menu-trigger');
      button.textContent = '☰ תפריט';
    }
    if (button.getAttribute('aria-controls') !== 'bshop-menu') button.setAttribute('aria-controls', 'bshop-menu');
    const expanded = String(menu.style.display !== 'none');
    if (button.getAttribute('aria-expanded') !== expanded) button.setAttribute('aria-expanded', expanded);
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(sync); } }
  function start() {
    document.addEventListener('keydown', event => {
      const screen = document.getElementById('screen-bodyshop');
      if (event.key === 'Escape' && screen && screen.classList.contains('u2iw-enabled') &&
          screen.classList.contains('active') && typeof toggleBshopMenu === 'function') {
        const menu = document.getElementById('bshop-menu');
        if (menu && menu.style.display !== 'none') {
          toggleBshopMenu(false); screen.querySelector('.u2iw-menu-trigger')?.focus();
        }
      }
    });
    new MutationObserver(schedule).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style']
    });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
