/* Optional phone presentation. No routing, data access or business function wrappers. */
(function () {
  'use strict';
  const KEY = 'anak_ui2m';
  const phone = window.matchMedia('(max-width:900px)');
  const roles = new Set(['manager', 'driver', 'pickup_agent', 'pickup_driver']);
  let enabled = false, row = null, checkbox = null, pending = false;
  try { enabled = localStorage.getItem(KEY) === '1'; } catch (e) {}
  try {
    const value = new URLSearchParams(location.search).get('ui2m');
    if (value === '1' || value === '0') {
      enabled = value === '1';
      try { localStorage.setItem(KEY, value); } catch (e) {}
    }
  } catch (e) {}

  function allowed() {
    return phone.matches && typeof currentUser !== 'undefined' && currentUser && roles.has(currentUser.role);
  }
  function apply() {
    pending = false;
    const eligible = allowed();
    document.body.classList.toggle('ui2m', !!(eligible && enabled));
    const box = document.querySelector('#modal-settings .modal-box');
    if (!eligible || !box) {
      if (row) row.remove();
      row = checkbox = null;
      return;
    }
    if (!row) {
      row = document.createElement('label');
      row.id = 'ui2m-toggle-row';
      // Keep the opt-in control usable even when its stylesheet is disabled.
      row.style.cssText = 'display:flex;align-items:center;gap:12px;min-height:44px;flex-shrink:0;font:inherit;cursor:pointer';
      checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('role', 'switch');
      checkbox.style.cssText = 'width:24px;height:44px;margin:0;flex-shrink:0;accent-color:#80652e';
      const label = document.createElement('span');
      label.textContent = 'עיצוב חדש לטלפון';
      row.append(checkbox, label);
      checkbox.addEventListener('change', function () {
        enabled = checkbox.checked;
        try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (e) {}
        apply();
      });
      // Append without moving or rebuilding any existing settings control.
      box.appendChild(row);
    }
    checkbox.checked = enabled;
  }
  function schedule() {
    if (pending) return;
    pending = true;
    queueMicrotask(apply);
  }
  function start() {
    apply();
    // Existing routing/login changes screen classes; observe only these attributes.
    const observer = new MutationObserver(schedule);
    document.querySelectorAll('.screen').forEach(screen => observer.observe(screen, { attributes:true, attributeFilter:['class'] }));
    const settings = document.getElementById('modal-settings');
    if (settings) observer.observe(settings, { attributes:true, attributeFilter:['class'] });
    phone.addEventListener('change', schedule);
    window.addEventListener('storage', event => {
      if (event.key !== KEY && event.key !== null) return;
      try { enabled = localStorage.getItem(KEY) === '1'; } catch (e) { enabled = false; }
      schedule();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
