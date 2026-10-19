/* Driver-only yard presentation. Reads the existing snapshot; never writes data. */
(function () {
  'use strict';
  const script = document.currentScript;
  const base = new URL('../', script.src);
  const version = new URL(script.src).search;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('css/ui2-yard.css' + version, base).href;
  document.head.appendChild(css);
  let mode = 'sketch', panel, signature = '', pending = false, selected = '';
  try { if (localStorage.getItem('anak_yard_driver_layout') === 'full') mode = 'full'; } catch (e) {}
  const text = value => value == null ? '' : String(value).trim();
  const el = (tag, cls, value) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  function fields(data, spot, right) {
    if (right) {
      const label = +spot % 2 === 0 ? 'בפנים' : 'בחוץ';
      return [{ label: spot + ' · ' + label, value: text(data['R_' + spot + '_' + label]) }];
    }
    return [
      { label: 'חניה', value: text(data['L_' + spot + '_כניסה']) },
      { label: +spot >= 30 ? 'כביש 1' : 'כביש', value: text(data['L_' + spot + '_כביש_1']) },
      ...(+spot >= 30 ? [{ label: 'כביש 2', value: text(data['L_' + spot + '_כביש_2']) }] : [])
    ];
  }
  function rows(data, left, right) {
    return [left.map(s => ({ numbers: [s], fields: fields(data, s, false) })),
      right.map(row => row ? ({ numbers: row, fields: row.flatMap(s => fields(data, s, true)) }) : null)];
  }
  function groupEmpty(source) {
    const result = [];
    source.forEach(row => {
      if (!row) {
        if (result.length && !result[result.length - 1].gap) result.push({ gap: true });
        return;
      }
      const filled = row.fields.some(f => f.value);
      const last = result[result.length - 1];
      if (!filled && last && last.empty) {
        last.numbers.push(...row.numbers); last.fields.push(...row.fields);
      } else result.push({ ...row, numbers: [...row.numbers], fields: [...row.fields], empty: !filled });
    });
    return result;
  }
  function numberLabel(numbers) {
    return numbers.length > 2 ? numbers[0] + '–' + numbers[numbers.length - 1] : numbers.join(' / ');
  }
  function showDetail(row, button) {
    selected = row.numbers.join(',');
    panel.querySelectorAll('[data-yard-row]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    const detail = panel.querySelector('.u2y-detail');
    detail.replaceChildren(el('strong', '', 'חניות ' + numberLabel(row.numbers)));
    if (row.empty) detail.appendChild(el('div', '', 'ללא רכבים בסידור בחניות האלה'));
    else row.fields.forEach(f => {
      const line = el('div', 'u2y-detail-line');
      line.append(el('span', '', f.label + ': '), el('bdi', '', f.value || 'ללא רכב בסידור'));
      detail.appendChild(line);
    });
  }
  function build(data, left, right) {
    const sketch = panel.querySelector('.u2y-sketch');
    sketch.replaceChildren();
    const extras = [['רכבים להכנסה', 'TO_PLACE_'], ['רכבים מכורים', 'SOLD_']];
    extras.forEach(([label, prefix]) => {
      const values = Array.from({ length: 6 }, (_, i) => text(data[prefix + (i + 1)])).filter(Boolean);
      if (!values.length) return;
      const band = el('details', 'u2y-extras');
      band.appendChild(el('summary', '', label + ' · ' + values.length));
      values.forEach(value => band.appendChild(el('div', '', value)));
      sketch.appendChild(band);
    });
    const plan = el('div', 'u2y-plan'); plan.setAttribute('aria-label', 'סקיצה ממוקדת של חניות המגרש');
    const grouped = rows(data, left, right).map(groupEmpty);
    let first, restored;
    grouped.forEach((items, i) => {
      if (i === 1) { const road = el('div', 'u2y-road'); road.appendChild(el('span', '', 'מעבר')); plan.appendChild(road); }
      const bank = el('div', 'u2y-bank');
      bank.appendChild(el('div', 'u2y-bank-title', i ? 'בפנים / בחוץ' : 'חניה / כביש'));
      items.forEach(row => {
        if (row.gap) { const gap = el('div', 'u2y-gap'); gap.setAttribute('aria-hidden', 'true'); bank.appendChild(gap); return; }
        const button = el('button', row.empty ? 'u2y-empty' : 'u2y-filled');
        button.type = 'button'; button.dataset.yardRow = row.numbers.join(',');
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', 'חניות ' + numberLabel(row.numbers) + ': ' + (row.empty ? 'ללא רכבים בסידור' : row.fields.map(f => f.label + ': ' + (f.value || 'ללא רכב')).join(', ')));
        button.appendChild(el('bdi', 'u2y-number', numberLabel(row.numbers)));
        if (row.empty) button.appendChild(el('span', '', 'ללא רכבים'));
        else row.fields.filter(f => f.value).forEach(f => {
          const line = el('span', 'u2y-car');
          line.append(el('small', '', f.label), el('bdi', '', f.value)); button.appendChild(line);
        });
        button.addEventListener('click', () => showDetail(row, button));
        bank.appendChild(button);
        if (!first && !row.empty) first = { row, button };
        if (row.numbers.join(',') === selected) restored = { row, button };
      });
      plan.appendChild(bank);
    });
    sketch.append(plan, el('div', 'u2y-legend', 'חניות ללא רכבים בסידור מכווצות · לחצו על חניה לפירוט'));
    const detail = el('div', 'u2y-detail'); detail.setAttribute('aria-live', 'polite'); sketch.appendChild(detail);
    const target = restored || first;
    if (target) showDetail(target.row, target.button);
    else detail.textContent = 'לא מולאו רכבים בחניות. אפשר לראות רכבים להכנסה ומכורים למעלה.';
  }
  function schedule() {
    if (pending) return;
    pending = true; requestAnimationFrame(sync);
  }
  function sync() {
    pending = false;
    const screen = document.getElementById('screen-yard');
    const list = document.getElementById('yard-list');
    const allowed = typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'driver';
    const active = allowed && screen && screen.classList.contains('active') && list &&
      typeof yardData !== 'undefined' && typeof LEFT_SPOTS !== 'undefined' && typeof RIGHT_ROWS !== 'undefined' &&
      Object.values(yardData || {}).some(v => text(v));
    if (!active) {
      if (screen && (screen.classList.contains('u2y-enabled') || screen.classList.contains('u2y-sketch-mode'))) screen.classList.remove('u2y-enabled', 'u2y-sketch-mode');
      if (panel) panel.hidden = true;
      return;
    }
    if (!panel) {
      panel = el('section', 'u2y-panel'); panel.id = 'u2y-panel';
      const switcher = el('div', 'u2y-switch'); switcher.setAttribute('role', 'group'); switcher.setAttribute('aria-label', 'תצוגת סידור המגרש');
      [['sketch', 'סקיצה ממוקדת'], ['full', 'תצוגה מקורית']].forEach(([value, label]) => {
        const b = el('button', '', label); b.type = 'button'; b.dataset.yardMode = value;
        b.addEventListener('click', () => { mode = value; try { localStorage.setItem('anak_yard_driver_layout', mode); } catch (e) {} schedule(); });
        switcher.appendChild(b);
      });
      panel.append(switcher, el('div', 'u2y-sketch'));
    }
    if (panel.parentNode !== list.parentNode || panel.nextElementSibling !== list) list.before(panel);
    panel.hidden = false;
    if (!screen.classList.contains('u2y-enabled')) screen.classList.add('u2y-enabled');
    if (screen.classList.contains('u2y-sketch-mode') !== (mode === 'sketch')) screen.classList.toggle('u2y-sketch-mode', mode === 'sketch');
    panel.querySelector('.u2y-sketch').hidden = mode !== 'sketch';
    panel.querySelectorAll('[data-yard-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.yardMode === mode)));
    const next = JSON.stringify([yardData, LEFT_SPOTS, RIGHT_ROWS]);
    if (signature !== next) { signature = next; build(yardData, LEFT_SPOTS, RIGHT_ROWS); }
  }
  function start() {
    new MutationObserver(records => {
      if (records.some(r => {
        const node = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        return !node || !node.closest('.u2y-panel');
      })) schedule();
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
