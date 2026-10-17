/* Presentation only: reuse the live yard fields and battery cards, never copy their data. */
(function () {
  'use strict';
  const version = (document.currentScript.src.match(/[?&]v=(\d+)/) || [])[1] || '578';
  const observer = new MutationObserver(schedule);
  let queued = false;

  function enabled() {
    return innerWidth > 900 && document.body.classList.contains('ui2') &&
      typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'manager';
  }
  function unwrap(list) {
    list.querySelectorAll(':scope > .u2-yard-zone').forEach(zone => {
      const heading = zone.querySelector(':scope > .yard-sec-h');
      const labels = zone.querySelector(':scope > .u2-yard-labels');
      const cards = zone.querySelector(':scope > .u2-yard-cards');
      if (heading) list.insertBefore(heading, zone);
      if (labels) { labels.classList.remove('u2-yard-labels'); list.insertBefore(labels, zone); }
      if (cards) while (cards.firstChild) list.insertBefore(cards.firstChild, zone);
      zone.remove();
    });
  }
  function arrangeYard(list) {
    // The renderer replaces the list wholesale. Rebuild wrappers only for its fresh nodes.
    if (list.querySelector(':scope > .u2-yard-zone')) return;
    let zone, cards;
    Array.from(list.children).forEach(node => {
      if (node.classList.contains('yard-sec-h')) {
        zone = document.createElement('section');
        zone.className = 'u2-yard-zone';
        zone.setAttribute('aria-label', node.textContent.trim());
        cards = document.createElement('div'); cards.className = 'u2-yard-cards';
        list.insertBefore(zone, node); zone.append(node, cards);
      } else if (zone && node.classList.contains('yard-card')) {
        if (!node.querySelector('[data-key]')) {
          node.classList.add('u2-yard-labels'); zone.insertBefore(node, cards);
        } else cards.appendChild(node);
      }
    });
  }
  function batteryIcons() {
    const source = document.querySelector('#screen-battery-stock > .app-header .logo svg');
    if (!source) return;
    document.querySelectorAll('#bs-stock .bs-box > .bs-row').forEach(row => {
      if (row.querySelector(':scope > .u2-battery-icon')) return;
      const icon = source.cloneNode(true);
      icon.classList.add('u2-battery-icon');
      icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('focusable', 'false');
      // Append only a decorative icon, preserving the original quantity/detail/action order.
      row.appendChild(icon);
    });
  }
  function sync() {
    queued = false; observer.disconnect();
    const active = enabled(), list = document.getElementById('yard-list');
    document.body.classList.toggle('u2-operations-layout', !!active);
    if (active) {
      if (!document.getElementById('ui2-operations-css')) {
        const link = document.createElement('link'); link.id = 'ui2-operations-css';
        link.rel = 'stylesheet'; link.media = 'screen and (min-width:901px)';
        link.href = 'css/ui2-operations.css?v=' + version; document.head.appendChild(link);
      }
      if (list) arrangeYard(list);
      batteryIcons();
    } else {
      if (list) unwrap(list);
      document.querySelectorAll('.u2-battery-icon').forEach(icon => icon.remove());
    }
    observer.observe(document.body, { attributes:true, attributeFilter:['class'] });
    if (list) observer.observe(list, { childList:true });
    const stock = document.getElementById('bs-stock');
    if (stock) observer.observe(stock, { childList:true, subtree:true });
  }
  function schedule() {
    if (queued) return; queued = true; Promise.resolve().then(sync);
  }
  window.addEventListener('resize', schedule);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
})();
