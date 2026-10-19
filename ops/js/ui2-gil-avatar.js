/* Presentation only: keep the existing profile button and its click action. */
(function () {
  'use strict';
  const source = document.currentScript;
  if (!source) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../css/ui2-gil-avatar.css' + new URL(source.src).search, source.src).href;
  document.head.appendChild(link);
  let pending = false;
  function sync() {
    pending = false;
    const gil = typeof currentUser !== 'undefined' && currentUser &&
      currentUser.role === 'driver' && String(currentUser.name || '').trim() === 'גיל';
    document.querySelectorAll('#ui2m-home .u2m-avatar').forEach(button => {
      if (button.classList.contains('u2gil-photo') !== !!gil) button.classList.toggle('u2gil-photo', !!gil);
    });
  }
  function schedule() {
    if (pending) return;
    pending = true; requestAnimationFrame(sync);
  }
  function start() {
    new MutationObserver(schedule).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class']
    });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
