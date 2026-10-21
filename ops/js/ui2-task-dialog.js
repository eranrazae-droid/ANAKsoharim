/* Presentation only: keep every original field and the existing submit/close actions. */
(function () {
  'use strict';
  const source = document.currentScript;
  if (!source) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('../css/ui2-task-dialog.css' + new URL(source.src).search, source.src).href;
  css.addEventListener('load', init, { once: true });
  document.head.appendChild(css);

  function init() {
    const modal = document.getElementById('modal-task');
    const select = document.getElementById('task-label');
    const link = document.getElementById('task-link');
    const title = document.getElementById('task-title');
    const city = document.getElementById('task-city');
    const color = document.getElementById('task-color-picker');
    const box = modal && modal.querySelector('.modal-box');
    const submit = box && box.querySelector('.btn-submit');
    if (!box || !select || !link || !title || !city || !color || !submit || modal.classList.contains('u2td-enabled')) return;
    const selectGroup = select.closest('.form-group');
    const linkGroup = link.closest('.form-group');
    const heading = selectGroup && selectGroup.querySelector('label');
    if (!selectGroup || !linkGroup || !heading) return;

    title.closest('.form-group').classList.add('u2td-title');
    selectGroup.classList.add('u2td-choice');
    linkGroup.classList.add('u2td-link');
    city.closest('.form-group').classList.add('u2td-city');
    color.closest('.form-group').classList.add('u2td-color');
    heading.textContent = 'בחירת עמודה';
    heading.id = 'u2td-choice-heading';
    const hint = document.createElement('small');
    hint.className = 'u2td-hint'; hint.textContent = 'בחירה בלחיצה אחת';
    heading.appendChild(hint);
    const grid = document.createElement('div');
    grid.className = 'u2td-grid';
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-labelledby', heading.id);
    selectGroup.appendChild(grid);
    // Keep keyboard traversal in the same order as the visual fields.
    box.insertBefore(selectGroup, linkGroup);

    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'u2td-link-toggle';
    toggle.setAttribute('aria-controls', 'u2td-link-field');
    linkGroup.id = 'u2td-link-field';
    box.insertBefore(toggle, linkGroup);
    const footer = document.createElement('div');
    footer.className = 'u2td-footer';
    const selection = document.createElement('div');
    selection.className = 'u2td-selection'; selection.textContent = 'העמודה שנבחרה';
    const chosen = document.createElement('strong');
    chosen.setAttribute('aria-live', 'polite');
    selection.appendChild(chosen);
    box.insertBefore(footer, submit);
    footer.append(selection, submit); // Retain the same button, onclick and busy state.

    // One live form: desktop splits it into details on the right and choices on the left.
    // On phones these wrappers use display:contents, retaining the existing CSS order.
    const body = document.createElement('div'); body.className = 'u2td-body';
    const details = document.createElement('div'); details.className = 'u2td-details';
    const columns = document.createElement('div'); columns.className = 'u2td-columns';
    box.insertBefore(body, footer);
    details.append(title.closest('.form-group'), city.closest('.form-group'),
      color.closest('.form-group'), toggle, linkGroup);
    columns.appendChild(selectGroup);
    body.append(details, columns);

    // The desktop writing area mirrors the original field read by submitTask().
    const editor = document.createElement('textarea');
    editor.className = 'form-input u2td-title-editor';
    editor.setAttribute('aria-label', 'כותרת המשימה');
    editor.rows = 4; editor.placeholder = title.placeholder;
    editor.value = title.value;
    title.closest('.form-group').appendChild(editor);
    let writingFromEditor = false;
    editor.addEventListener('input', function () {
      // Task titles are stored through a single-line input; retain word boundaries.
      title.value = editor.value.replace(/[\r\n]+/g, ' ');
      writingFromEditor = true;
      try { title.dispatchEvent(new Event('input', { bubbles: true })); }
      finally { writingFromEditor = false; }
    });
    function syncEditor() {
      if (!writingFromEditor && editor.value !== title.value) editor.value = title.value;
    }
    title.addEventListener('input', syncEditor);
    title.addEventListener('change', syncEditor);

    function setLinkOpen(open) {
      linkGroup.classList.toggle('u2td-collapsed', !open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '− הסתר קישור' : '+ הוסף קישור';
    }
    toggle.addEventListener('click', function () {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      setLinkOpen(open);
      if (open) link.focus();
      // Collapsing never clears a link the user already typed.
    });
    function syncSelection() {
      let selectedText = '';
      Array.from(grid.children).forEach(function (button) {
        const selected = button.dataset.value === select.value;
        button.setAttribute('aria-checked', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected) selectedText = button.dataset.label;
      });
      chosen.textContent = selectedText;
      if (!selectedText) {
        const first = grid.querySelector('button:not(:disabled)');
        if (first) first.tabIndex = 0;
      }
    }
    function choose(button) {
      select.value = button.dataset.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncSelection();
    }
    function renderOptions() {
      grid.replaceChildren();
      Array.from(select.options).forEach(function (option) {
        if (option.hidden) return;
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'u2td-option';
        if (option.textContent.trim().length > 18) button.classList.add('u2td-long');
        button.dataset.value = option.value;
        button.dataset.label = option.textContent.trim();
        button.disabled = option.disabled || select.disabled;
        button.setAttribute('role', 'radio');
        const label = document.createElement('span'); label.textContent = option.textContent;
        const check = document.createElement('span'); check.className = 'u2td-check';
        check.textContent = '✓'; check.setAttribute('aria-hidden', 'true');
        button.append(label, check);
        button.addEventListener('click', function () { choose(button); });
        grid.appendChild(button);
      });
      syncSelection();
    }
    grid.addEventListener('keydown', function (event) {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(grid.querySelectorAll('button:not(:disabled)'));
      const current = buttons.indexOf(event.target);
      if (current < 0) return;
      event.preventDefault();
      // RTL: ArrowLeft advances in DOM order.
      let next = current + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? 1 : -1);
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      const button = buttons[(next + buttons.length) % buttons.length];
      choose(button); button.focus();
    });
    select.addEventListener('change', syncSelection);
    new MutationObserver(renderOptions).observe(select, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['disabled', 'hidden', 'label', 'value', 'selected']
    });

    let wasOpen = false;
    function syncOpen() {
      const open = modal.classList.contains('open');
      if (open && !wasOpen) {
        // openNewTaskModal resets .value silently before it opens the modal.
        renderOptions();
        setLinkOpen(Boolean(link.value.trim()));
        syncEditor();
      }
      wasOpen = open;
    }
    new MutationObserver(syncOpen).observe(modal, { attributes: true, attributeFilter: ['class'] });
    renderOptions(); setLinkOpen(Boolean(link.value.trim()));
    modal.classList.add('u2td-enabled');
    syncOpen();
  }
})();
