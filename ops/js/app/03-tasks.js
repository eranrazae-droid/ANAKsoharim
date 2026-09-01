/* לוח המשימות
   חלק 3 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
let _dragTaskEl   = null;


/* ── גרירת משימות ────────────────────────────────────────────────────
   אותה שיטה כמו בקוביות האיסוף: לחיצה ארוכה תופסת את הכרטיס, עותק
   שקוף נגרר עם היד, והכרטיסים האחרים מחליקים למקומם בזמן אמת.
   אפשר להעביר משימה גם בתוך העמודה וגם בין עמודות.               */
let _tkDrag = null, _tkPressing = false, _tkPendingRender = false;

function _tkEnableDrag(board) {
  if (!board || board.dataset.dragReady) return;
  board.dataset.dragReady = '1';

  let pressTimer = null, pressInfo = null;
  const cancelPress = () => {
    clearTimeout(pressTimer); pressTimer = null; pressInfo = null; _tkPressing = false;
    if (_tkPendingRender && !_tkDrag) { _tkPendingRender = false; renderTasksFromCache(); }
  };

  const beginDrag = (card, x, y, pointerId) => {
    const r = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.add('pk-ghost');
    ghost.style.width = r.width + 'px';
    ghost.style.height = r.height + 'px';
    ghost.style.left = r.left + 'px';
    ghost.style.top = r.top + 'px';
    document.body.appendChild(ghost);
    card.classList.add('pk-dragging');
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
    _tkPressing = false;
    try { window.getSelection()?.removeAllRanges(); } catch (e) {}
    _tkDrag = { card, ghost, dx: x - r.left, dy: y - r.top, moved: false,
                fromLabel: card.closest('.task-drop')?.dataset.label || '' };
    try { board.setPointerCapture(pointerId); } catch (e) {}
  };

  board.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) { cancelPress(); return; }
    const card = ev.target.closest('.task-card');
    if (!card || card.closest('.task-col-driver')) { cancelPress(); return; }
    pressInfo = { card, x: ev.clientX, y: ev.clientY, id: ev.pointerId, mouse: ev.pointerType === 'mouse' };
    _tkPressing = true;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (!pressInfo) return;
      beginDrag(pressInfo.card, pressInfo.x, pressInfo.y, pressInfo.id);
      pressInfo = null;
    }, 350);
  });

  /* בעכבר הגרירה מתחילה ברגע שמזיזים — אין סיבה להחזיק לחוץ, וזה מה
     שנתן תחושה שהגרירה לא עובדת. באצבע נשארת ההחזקה, אחרת אי אפשר לגלול. */
  board.addEventListener('pointermove', ev => {
    if (!pressInfo || _tkDrag) return;
    const far = Math.abs(ev.clientX - pressInfo.x) > 6 || Math.abs(ev.clientY - pressInfo.y) > 6;
    if (!far) return;
    if (pressInfo.mouse) {
      clearTimeout(pressTimer); pressTimer = null;
      beginDrag(pressInfo.card, ev.clientX, ev.clientY, pressInfo.id);
      pressInfo = null;
      return;
    }
    if (Math.abs(ev.clientX - pressInfo.x) > 12 || Math.abs(ev.clientY - pressInfo.y) > 12) cancelPress();
  });

  document.addEventListener('pointerup', cancelPress);
  document.addEventListener('pointercancel', cancelPress);
  window.addEventListener('blur', cancelPress);

  board.addEventListener('pointermove', ev => {
    const d = _tkDrag;
    if (!d) return;
    ev.preventDefault();
    d.moved = true;
    d.ghost.style.left = (ev.clientX - d.dx) + 'px';
    d.ghost.style.top  = (ev.clientY - d.dy) + 'px';

    // באיזו עמודה היד נמצאת
    const drop = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.task-drop');
    if (!drop) return;

    const cards = [...drop.querySelectorAll('.task-card')].filter(c => c !== d.card);
    const before = new Map();
    [...document.querySelectorAll('.task-card')].forEach(c => before.set(c, c.getBoundingClientRect()));

    // נקודת ההכנסה: הכרטיס הראשון שמרכזו מתחת ליד
    let ref = null;
    for (const c of cards) {
      const b = before.get(c);
      if (ev.clientY < b.top + b.height / 2) { ref = c; break; }
    }
    if (ref === d.card.nextElementSibling && d.card.parentElement === drop) return;
    if (!ref && d.card.parentElement === drop && !d.card.nextElementSibling) return;
    drop.insertBefore(d.card, ref);

    for (const [c, b] of before) {
      if (c === d.card || !c.isConnected) continue;
      const a = c.getBoundingClientRect();
      const mx = b.left - a.left, my = b.top - a.top;
      if (!mx && !my) continue;
      c.classList.remove('pk-shift');
      c.style.transform = `translate(${mx}px, ${my}px)`;
      requestAnimationFrame(() => { c.classList.add('pk-shift'); c.style.transform = ''; });
    }
  });

  const finish = () => {
    cancelPress();
    const d = _tkDrag;
    if (!d) return;
    _tkDrag = null;
    d.ghost.remove();
    d.card.classList.remove('pk-dragging');
    document.querySelectorAll('.task-card').forEach(c => { c.classList.remove('pk-shift'); c.style.transform = ''; });
    if (!d.moved) { if (_tkPendingRender) { _tkPendingRender = false; renderTasksFromCache(); } return; }
    board.dataset.swallowClick = '1';
    _tkPendingRender = false;      // הסדר על המסך הוא הנכון
    _tkSaveMove(d.card);
  };
  board.addEventListener('pointerup', finish);
  board.addEventListener('pointercancel', finish);

  // אחרי גרירה אמיתית לא פותחים את חלון העריכה
  board.addEventListener('click', ev => {
    if (!board.dataset.swallowClick) return;
    delete board.dataset.swallowClick;
    ev.stopPropagation(); ev.preventDefault();
  }, true);
}

// שמירת המיקום החדש: העמודה שאליה שוחררה המשימה והסדר בין שכניה
async function _tkSaveMove(card) {
  const id = card.dataset.id;
  const drop = card.closest('.task-drop');
  const label = drop?.dataset.label || '';
  const sibs = [...drop.querySelectorAll('.task-card')];
  const i = sibs.indexOf(card);
  const orderOf = el => {
    const t = tasksCache.find(x => x.id === el?.dataset.id);
    return t ? (t.sortOrder ?? t.createdAt?.toMillis?.() ?? null) : null;
  };
  const prev = orderOf(sibs[i - 1]);
  const next = orderOf(sibs[i + 1]);
  let sortOrder;
  if (prev !== null && next !== null) sortOrder = (prev + next) / 2;
  else if (prev !== null) sortOrder = prev + 1000;
  else if (next !== null) sortOrder = next - 1000;
  else sortOrder = Date.now();

  const updates = { sortOrder };
  const colToAssigned = {
    'רפד':'רפד','זגג':'זגג','חביב':'חביב','ולאדי':'ולאדי','גיל':'גיל',
    'עופר':'עופר','איתי':'איתי','רדארים':'רדארים','מוסך':'מוסך',
    'משימות בעדיפות עליונה':'כולם','משימות כלליות':'כולם',
  };
  if (label) {
    updates.label = label;
    if (colToAssigned[label]) updates.assignedTo = colToAssigned[label];
  }
  // מעדכנים בזיכרון מיד, כדי שהלוח לא יקפוץ חזרה בזמן השמירה
  const t = tasksCache.find(x => x.id === id);
  if (t) Object.assign(t, updates);
  if (!_requireNet('העברת המשימה')) return;
  try { await _updateDoc(_docRef('tasks', id), updates); }
  catch (e) { showToast('שגיאה בהעברה: ' + (e.code || e.message), 6000); }
}

function _onDragStart(e, taskId) {
  _dragTaskId = taskId;
  _dragTaskEl = e.currentTarget;
  // Trello-style ghost: a slightly tilted clone with a soft shadow
  try {
    const ghost = _dragTaskEl.cloneNode(true);
    ghost.id = '_dragGhost';
    ghost.style.width = _dragTaskEl.offsetWidth + 'px';
    ghost.style.transform = 'rotate(3deg)';
    ghost.style.opacity = '0.97';
    ghost.style.boxShadow = '0 14px 30px rgba(0,0,0,0.3)';
    ghost.style.position = 'fixed';
    ghost.style.top = '-9999px';
    ghost.style.left = '-9999px';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);
    const dx = Math.min(e.offsetX || 20, _dragTaskEl.offsetWidth - 10);
    e.dataTransfer.setDragImage(ghost, dx, e.offsetY || 20);
    setTimeout(() => ghost.remove(), 0);
  } catch(_) {}
  setTimeout(() => {
    _dragTaskEl?.classList.add('dragging');
    document.getElementById('task-list-container')?.classList.add('dragging-active');
  }, 0);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', taskId);
}
function _onDragEnd() {
  _dragTaskEl?.classList.remove('dragging');
  document.getElementById('task-list-container')?.classList.remove('dragging-active');
  _dragTaskId = null;
  _dragTaskEl = null;
  _stopAutoScroll();
  document.querySelectorAll('.task-drop-zone').forEach(z => z.classList.remove('drag-over'));
}
let _autoScrollRAF = null;
let _autoScrollDir = 0;

function _startAutoScroll(dir) {
  _autoScrollDir = dir;
  if (_autoScrollRAF) return;
  function step() {
    const container = document.getElementById('task-list-container');
    if (container && _autoScrollDir !== 0) {
      container.scrollLeft += _autoScrollDir * 14;
      _autoScrollRAF = requestAnimationFrame(step);
    } else {
      _autoScrollRAF = null;
    }
  }
  _autoScrollRAF = requestAnimationFrame(step);
}

function _stopAutoScroll() {
  _autoScrollDir = 0;
  if (_autoScrollRAF) { cancelAnimationFrame(_autoScrollRAF); _autoScrollRAF = null; }
}

function _onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
  const container = document.getElementById('task-list-container');
  if (container) {
    const rect = container.getBoundingClientRect();
    const ZONE = 80;
    if (e.clientX < rect.left + ZONE) _startAutoScroll(-1);
    else if (e.clientX > rect.right - ZONE) _startAutoScroll(1);
    else _stopAutoScroll();
  }
}
function _onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
async function _onDrop(e, newLabel, beforeId, afterId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!_dragTaskId) return;
  const id = _dragTaskId;
  _dragTaskId = null;

  // Calculate new sortOrder between neighbours
  const getSortOrder = (tid) => {
    const t = tasksCache.find(x => x.id === tid);
    return t ? (t.sortOrder ?? t.createdAt?.toMillis?.() ?? Date.now()) : null;
  };
  const afterOrder  = afterId  ? getSortOrder(afterId)  : null;
  const beforeOrder = beforeId ? getSortOrder(beforeId) : null;

  let newOrder;
  if (afterOrder !== null && beforeOrder !== null) {
    newOrder = (afterOrder + beforeOrder) / 2;
  } else if (afterOrder !== null) {
    newOrder = afterOrder + 1000;   // drop at bottom — after the last task
  } else if (beforeOrder !== null) {
    newOrder = beforeOrder - 1000;  // drop at top — before the first task
  } else {
    newOrder = Date.now();
  }

  const updates = { sortOrder: newOrder };
  if (newLabel) updates.label = newLabel;

  // Update assignedTo based on new label
  const colToAssigned = {
    'רפד':'רפד','זגג':'זגג','חביב':'חביב','ולאדי':'ולאדי','גיל':'גיל',
    'עופר':'עופר','איתי':'איתי','רדארים':'רדארים','מוסך':'מוסך','משימות בעדיפות עליונה':'כולם','משימות כלליות':'כולם',
  };
  if (newLabel && colToAssigned[newLabel]) updates.assignedTo = colToAssigned[newLabel];

  try {
    await _updateDoc(_docRef('tasks', id), updates);
  } catch(err) { showToast('שגיאה בעדכון: ' + (err.message||err.code)); }
}
// ─────────────────────────────────────────────────────────

function renderTasksFromCache() {
  const container = document.getElementById('task-list-container');
  if (!container) return;
  const isManager = currentUser?.role === 'manager';
  const myName = currentUser?.name || '';

  const _driverNames = ['עופר','גיל','איתי'];
  let allTasks = tasksCache;
  if (!isManager) {
    allTasks = allTasks.filter(t => t.label === myName || t.assignedTo === myName);
  }

  const statusLabel = { open:'פתוחה', inprog:'בביצוע', done:'הושלמה' };

  function makeCard(t, readOnly, vladi, colColor, colLabel) {
    // Divider card
    if (t.type === 'divider') {
      const div = document.createElement('div');
      div.dataset.id = t.id;
      div.draggable = isManager;
      div.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;cursor:grab;user-select:none';
      if (isManager) {
        div.addEventListener('dragstart', e => _onDragStart(e, t.id));
        div.addEventListener('dragend',   _onDragEnd);
      }
      div.innerHTML = `<div style="flex:1;border-top:2px dashed #94a3b8"></div><span style="font-size:11px;font-weight:900;color:#64748b;white-space:nowrap;background:#e8eaf4;padding:2px 8px;border-radius:999px">רכבים שמחוץ למגרש ↓</span><div style="flex:1;border-top:2px dashed #94a3b8"></div>${isManager?`<button onclick="event.stopPropagation();deleteTask('${t.id}')" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px;padding:0 2px" title="מחק חוצץ">✕</button>`:''}`;

      return div;
    }
    const done = t.status === 'done';
    const card = document.createElement('div');
    card.className = `task-card${t.color?' color-'+t.color:''}${done?' done':''}`;
    card.dataset.id = t.id;
    if (isManager && !done) {
      card.addEventListener('click', e => { if (!e.target.closest('button')) openEditTask(t.id); });
      card.style.cursor = 'pointer';
    }
    /* שם המבצע מוצג רק כשהוא באמת מוסיף מידע: לא כשהוא זהה לשם העמודה
       ולא כש"כולם". סטטוס "פתוחה" ירד מהכרטיס — הוא נכון לכל משימה פתוחה. */
    const who = String(t.assignedTo || '').trim();
    const showWho = who && who !== 'כולם' && who !== String(colLabel || '').trim();
    // כפתורי הפעולה: אייקון עם שם מתחתיו, בגודל אחיד
    const act = (fn, icon, label, bg) =>
      `<button onclick="event.stopPropagation();${fn}" title="${label}" style="background:${bg}">${icon}<b>${label}</b></button>`;
    const acts = [];
    if (isManager && !done) acts.push(act(`managerCompleteTask('${t.id}')`, '✅', 'בוצע', '#16a34a'));
    if (isManager && !done) acts.push(act(`openEditTask('${t.id}')`, '✏️', 'עריכה', '#6366f1'));
    if (isManager)          acts.push(act(`deleteTask('${t.id}')`, '🗑️', 'מחק', '#ef4444'));
    if (!isManager && !done && !readOnly) acts.push(act(`driverCompleteTask('${t.id}')`, '✅', 'הושלמה', '#16a34a'));
    if (!isManager && vladi) acts.push(act(`driverClearVladiTask('${t.id}')`, '✔', 'בוצע', '#16a34a'));
    card.innerHTML = `
      <div class="task-strip"${colColor && !t.color ? ` style="background:${colColor}"` : ''}></div>
      <div class="task-top">
        <div class="task-title">${esc(t.title)}</div>
      </div>
      ${t.notes ? `<div class="task-notes" style="font-size:12.5px;color:var(--muted);margin:0 0 7px">${esc(t.notes)}</div>` : ''}
      ${Array.isArray(t.photos) && t.photos.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px">${t.photos.map(p => `<img src="${p}" onclick="event.stopPropagation();openLightbox(this.src)" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid var(--border);cursor:pointer">`).join('')}</div>` : ''}
      ${showWho || done ? `<div class="task-meta">
        ${showWho ? `<span class="tag assignee" style="font-size:11px">👤 ${esc(who)}</span>` : ''}
        ${done ? `<span class="tag status-done" style="font-size:11px">${statusLabel.done}</span>` : ''}
      </div>` : ''}
      ${acts.length ? `<div class="task-acts" style="grid-template-columns:repeat(${acts.length},1fr)">${acts.join('')}</div>` : ''}`;
    return card;
  }

  function makeDropZone(label, afterId, beforeId) {
    const zone = document.createElement('div');
    zone.className = 'task-drop-zone';
    zone.dataset.label = label;
    zone.addEventListener('dragover',  _onDragOver);
    zone.addEventListener('dragleave', _onDragLeave);
    zone.addEventListener('drop',      e => _onDrop(e, label, beforeId, afterId));
    return zone;
  }

  function sortTasks(tasks) {
    return [...tasks].sort((a,b) => {
      const dA = a.status==='done'?1:0, dB = b.status==='done'?1:0;
      if (dA !== dB) return dA - dB;
      // colored cards float to top within their done/open group
      const cA = a.color ? 0 : 1, cB = b.color ? 0 : 1;
      if (cA !== cB) return cA - cB;
      const sA = a.sortOrder ?? a.createdAt?.toMillis?.() ?? 0;
      const sB = b.sortOrder ?? b.createdAt?.toMillis?.() ?? 0;
      return sA - sB;
    });
  }


  async function addDivider(label, sortOrder) {
    const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await addDoc(collection(window._db, 'tasks'), { type:'divider', label, sortOrder, createdAt: _serverTs() });
  }

  function makeCol(label, color, tasks, { title, minWidth } = {}) {
    const hasDivider = ['חביב','ולאדי'].includes(label);
    const realTasks = tasks.filter(t => t.type !== 'divider');
    const openCount = realTasks.filter(t => t.status !== 'done').length;
    const col = document.createElement('div');
    col.className = 'task-col';
    if (minWidth) { col.style.minWidth = minWidth; col.style.maxWidth = minWidth; }

    const header = document.createElement('div');
    header.className = 'task-col-header';
    const dividerExists = tasks.some(t => t.type === 'divider');
    const dividerBtn = (hasDivider && isManager && !dividerExists)
      ? `<button onclick="window._addDivider('${label}').then(()=>showToast('חוצץ נוסף'))" style="background:#e2e8f0;border:none;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer;color:#475569;margin-right:6px">+ חוצץ</button>`
      : '';
    header.style.background = color || 'var(--dark)';
    header.innerHTML = `<span class="task-col-title">${title||label}</span><div style="display:flex;align-items:center;gap:4px">${dividerBtn}<span class="task-col-count">${openCount}</span></div>`;
    col.appendChild(header);

    const cards = document.createElement('div');
    cards.className = 'task-col-cards task-drop';
    cards.dataset.label = label;

    if (tasks.length === 0) {
      const zone = makeDropZone(label, null, null);
      zone.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px 0">אין משימות</div>`;
      cards.appendChild(zone);
    } else {
      cards.appendChild(makeDropZone(label, null, tasks[0].id));
      tasks.forEach((t, i) => {
        cards.appendChild(makeCard(t, false, false, color, label));
        const nextId = tasks[i+1]?.id ?? null;
        cards.appendChild(makeDropZone(label, t.id, nextId));
      });
    }
    col.appendChild(cards);
    return col;
  }

  // ציור מחדש באמצע גרירה הורס את הכרטיס הנגרר — דוחים אותו לסיום
  if (_tkDrag || _tkPressing) { _tkPendingRender = true; return; }
  container.innerHTML = '';
  // הגרירה החדשה יושבת על הלוח עצמו, ולכן שורדת ציור מחדש של הכרטיסים
  setTimeout(() => _tkEnableDrag(container), 0);

  if (!isManager) {
    // הנהג רואה שתי עמודות זו לצד זו: המשימות שלו, ולעיון גם ולאדי.
    // עמודת ולאדי היא לצפייה בלבד — בלי כפתור "הושלמה".
    const myTasks = sortTasks(allTasks);
    const vladiTasks = sortTasks(tasksCache.filter(t => t.label === 'ולאדי' && t.type !== 'divider'));
    const buildDriverCol = (title, color, tasks, readOnly, who) => {
      const openCount = tasks.filter(t => t.status !== 'done').length;
      const col = document.createElement('div');
      col.className = 'task-col task-col-driver';
      col.innerHTML = `<div class="task-col-header" style="background:${color}"><span class="task-col-title">${title}</span><span class="task-col-count">${openCount}</span></div>`;
      const cards = document.createElement('div');
      cards.className = 'task-col-cards';
      if (!tasks.length) cards.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px 0">אין משימות</div>`;
      else tasks.forEach(t => cards.appendChild(makeCard(t, readOnly, readOnly, color, who)));  // readOnly=כן רק בעמודת ולאדי
      col.appendChild(cards);
      return col;
    };
    container.appendChild(buildDriverCol('המשימות שלי', '#ef4444', myTasks, false, currentUser.name));
    container.appendChild(buildDriverCol('ולאדי', '#3b82f6', vladiTasks, true, 'ולאדי'));
    return;
  }

  const colColors = {
    'משימות בעדיפות עליונה':'#dc2626','משימות כלליות':'#6366f1','חביב':'#f59e0b','ולאדי':'#3b82f6',
    'רפד':'#ec4899','זגג':'#10b981','רדארים':'#8b5cf6','מוסך':'#f97316',
    'עופר':'#0ea5e9','גיל':'#f97316','איתי':'#84cc16',
  };

  // Regular single-label columns
  ['משימות בעדיפות עליונה','משימות כלליות','חביב','ולאדי'].forEach(label => {
    container.appendChild(makeCol(label, colColors[label], sortTasks(allTasks.filter(t => t.label === label))));
  });

  // Combined רדארים/מוסך column
  const radarMosakCol = document.createElement('div');
  radarMosakCol.className = 'task-col';
  radarMosakCol.style.minWidth = '260px'; radarMosakCol.style.maxWidth = '260px';
  const rmOpenCount = ['רדארים','מוסך'].reduce((s,l) => s + allTasks.filter(t=>t.label===l&&t.status!=='done').length, 0);
  radarMosakCol.innerHTML = `<div class="task-col-header" style="background:#475569"><span class="task-col-title">רדארים / מוסך</span><span class="task-col-count">${rmOpenCount}</span></div>`;
  const rmCards = document.createElement('div');
  rmCards.className = 'task-col-cards';
  ['רדארים','מוסך'].forEach(name => {
    const tasks = sortTasks(allTasks.filter(t => t.label === name));
    const sub = document.createElement('div');
    sub.className = 'task-drop';
    sub.dataset.label = name;
    sub.style.marginBottom = '10px';
    const subHeader = document.createElement('div');
    subHeader.style.cssText = `font-size:12px;font-weight:900;color:${colColors[name]};padding:4px 2px 6px;border-bottom:2px solid ${colColors[name]};margin-bottom:6px`;
    subHeader.textContent = name;
    sub.appendChild(subHeader);
    if (tasks.length === 0) {
      const zone = makeDropZone(name, null, null);
      zone.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:12px;padding:8px 0">אין משימות</div>`;
      sub.appendChild(zone);
    } else {
      sub.appendChild(makeDropZone(name, null, tasks[0].id));
      tasks.forEach((t,i) => { sub.appendChild(makeCard(t, false, false, colColors[name], name)); sub.appendChild(makeDropZone(name, t.id, tasks[i+1]?.id??null)); });
    }
    rmCards.appendChild(sub);
  });
  radarMosakCol.appendChild(rmCards);
  container.appendChild(radarMosakCol);

  // Combined זגג/רפד column
  const zagRafadCol = document.createElement('div');
  zagRafadCol.className = 'task-col';
  zagRafadCol.style.minWidth = '260px'; zagRafadCol.style.maxWidth = '260px';
  const zrOpenCount = ['רפד','זגג'].reduce((s,l) => s + allTasks.filter(t=>t.label===l&&t.status!=='done').length, 0);
  zagRafadCol.innerHTML = `<div class="task-col-header" style="background:#475569"><span class="task-col-title">זגג / רפד</span><span class="task-col-count">${zrOpenCount}</span></div>`;
  const zrCards = document.createElement('div');
  zrCards.className = 'task-col-cards';
  ['רפד','זגג'].forEach(name => {
    const tasks = sortTasks(allTasks.filter(t => t.label === name));
    const sub = document.createElement('div');
    sub.className = 'task-drop';
    sub.dataset.label = name;
    sub.style.marginBottom = '10px';
    const subHeader = document.createElement('div');
    subHeader.style.cssText = `font-size:12px;font-weight:900;color:${colColors[name]};padding:4px 2px 6px;border-bottom:2px solid ${colColors[name]};margin-bottom:6px`;
    subHeader.textContent = name;
    sub.appendChild(subHeader);
    if (tasks.length === 0) {
      const zone = makeDropZone(name, null, null);
      zone.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:12px;padding:8px 0">אין משימות</div>`;
      sub.appendChild(zone);
    } else {
      sub.appendChild(makeDropZone(name, null, tasks[0].id));
      tasks.forEach((t,i) => { sub.appendChild(makeCard(t, false, false, colColors[name], name)); sub.appendChild(makeDropZone(name, t.id, tasks[i+1]?.id??null)); });
    }
    zrCards.appendChild(sub);
  });
  zagRafadCol.appendChild(zrCards);
  container.appendChild(zagRafadCol);

  // Combined נהגים column
  const driversCol = document.createElement('div');
  driversCol.className = 'task-col';
  driversCol.style.minWidth = '260px'; driversCol.style.maxWidth = '260px';
  const drOpenCount = ['עופר','גיל','איתי'].reduce((s,l) => s + allTasks.filter(t=>t.label===l&&t.status!=='done').length, 0);
  driversCol.innerHTML = `<div class="task-col-header" style="background:#475569"><span class="task-col-title">נהגים</span><span class="task-col-count">${drOpenCount}</span></div>`;
  const drCards = document.createElement('div');
  drCards.className = 'task-col-cards';
  ['עופר','גיל','איתי'].forEach(driver => {
    const tasks = sortTasks(allTasks.filter(t => t.label === driver));
    const sub = document.createElement('div');
    sub.className = 'task-drop';
    sub.dataset.label = driver;
    sub.style.marginBottom = '10px';
    const subHeader = document.createElement('div');
    subHeader.style.cssText = `font-size:12px;font-weight:900;color:${colColors[driver]};padding:4px 2px 6px;border-bottom:2px solid ${colColors[driver]};margin-bottom:6px`;
    subHeader.textContent = driver;
    sub.appendChild(subHeader);
    if (tasks.length === 0) {
      const zone = makeDropZone(driver, null, null);
      zone.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:12px;padding:8px 0">אין משימות</div>`;
      sub.appendChild(zone);
    } else {
      sub.appendChild(makeDropZone(driver, null, tasks[0].id));
      tasks.forEach((t,i) => { sub.appendChild(makeCard(t, false, false, colColors[driver], driver)); sub.appendChild(makeDropZone(driver, t.id, tasks[i+1]?.id??null)); });
    }
    drCards.appendChild(sub);
  });
  driversCol.appendChild(drCards);
  container.appendChild(driversCol);
}

async function openEditTask(id) {
  const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const snap = await getDoc(doc(window._db, 'tasks', id));
  if (!snap.exists()) return showToast('לא נמצאה משימה');
  const t = snap.data();
  document.getElementById('et-id').value = id;
  document.getElementById('et-title').value = t.title || '';
  document.getElementById('et-city').value = t.regionCity || '';
  document.getElementById('et-label').value = t.label || 'משימות כלליות';
  const existingColor = t.color || '';
  document.getElementById('et-color').value = existingColor;
  document.querySelectorAll('#et-color-picker .color-swatch').forEach(s => s.classList.toggle('selected', s.dataset.color === existingColor));
  _etPhotos = Array.isArray(t.photos) ? [...t.photos] : [];
  _etRenderPhotos();
  openModal('modal-edit-task');
}
window.openEditTask = openEditTask;

/* ── תמונות במשימה קיימת ─────────────────────────────────────────────
   אפשר להוסיף ולהסיר תמונות מכל משימה. התמונה נדחסת, עולה לשרת
   הקבצים, ואם ההעלאה אינה זמינה היא נשמרת בתוך הרשומה כמו קודם.   */
let _etPhotos = [];
const _ET_MAX_PHOTOS = 4;

function _etRenderPhotos() {
  const box = document.getElementById('et-photos');
  if (!box) return;
  box.innerHTML = _etPhotos.map((p, i) => `<div style="position:relative">
      <img src="${p}" onclick="openLightbox(this.src)" style="width:78px;height:78px;object-fit:cover;border-radius:10px;border:2px solid var(--border);cursor:zoom-in">
      <button type="button" onclick="etRemovePhoto(${i})" title="הסר תמונה"
        style="position:absolute;top:-6px;left:-6px;background:#ef4444;color:#fff;border:none;border-radius:999px;width:24px;height:24px;font-size:13px;font-weight:900;cursor:pointer;line-height:1">✕</button>
    </div>`).join('') || '<div style="font-size:12.5px;color:var(--muted);font-weight:700">אין תמונות</div>';
  const btn = document.getElementById('et-photo-btn');
  if (btn) btn.style.display = _etPhotos.length >= _ET_MAX_PHOTOS ? 'none' : '';
}

function etRemovePhoto(i) { _etPhotos.splice(i, 1); _etRenderPhotos(); }
window.etRemovePhoto = etRemovePhoto;

async function etAddPhotos(input) {
  const files = [...input.files].slice(0, _ET_MAX_PHOTOS - _etPhotos.length);
  input.value = '';
  if (!files.length) return;
  if (!_requireNet('הוספת התמונה')) return;
  const id = document.getElementById('et-id').value;
  for (let i = 0; i < files.length; i++) {
    showToast(`⏳ מעבד תמונה ${i + 1}/${files.length}...`);
    try {
      const b64 = await compressToBase64(files[i], 900, 0.7);
      const urls = await _uploadAll(`tasks/${id}/photo`, [b64]);
      _etPhotos.push(urls ? urls[0] : b64);
    } catch (e) { showToast('שגיאה בעיבוד התמונה', 4000); }
  }
  _etRenderPhotos();
  showToast('התמונה נוספה — לא לשכוח לשמור', 4000);
}
window.etAddPhotos = etAddPhotos;

function pickColor(prefix, el) {
  document.querySelectorAll(`#${prefix}-color-picker .color-swatch`).forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById(`${prefix}-color`).value = el.dataset.color;
}
window.pickColor = pickColor;

async function saveEditTask() {
  const id = document.getElementById('et-id').value;
  if (!id) return;
  const title = document.getElementById('et-title').value.trim();
  if (!title) return showToast('נא להזין כותרת');
  if (!_requireNet('שמירת המשימה')) return;
  // תמונות שנשמרות בתוך הרשומה חייבות להיכנס לתקציב הגודל
  const inRecord = _etPhotos.filter(p => String(p).startsWith('data:'));
  if (inRecord.reduce((t, b) => t + _b64Size(b), 0) > _DOC_PHOTO_BUDGET) {
    return showToast('⚠️ התמונות כבדות מדי — הסר אחת ונסה שוב', 8000);
  }
  try {
    const etCity = document.getElementById('et-city').value.trim();
    await _updateDoc(_docRef('tasks', id), {
      title,
      label: document.getElementById('et-label').value,
      color: document.getElementById('et-color').value,
      regionCity: etCity,
      region: _regionOfCity(etCity),
      photos: _etPhotos,
    });
    closeModal('modal-edit-task');
    showToast('✅ המשימה עודכנה!');
  } catch(e) {
    showToast('שגיאה: ' + (e.code || e.message));
  }
}
window.saveEditTask = saveEditTask;

/* ── ארכיון משימות ───────────────────────────────────────────────────
   כל משימה שנמחקת או מבוצעת נרשמת ב-tasks_archive לפני שהיא נעלמת,
   עם מי עשה מה ומתי. הארכיון מוצג למנהל בלבד.
   הרישום נעשה לפני המחיקה — משימה שכבר נמחקה אי אפשר לקרוא.
─────────────────────────────────────────────────────────────────────── */
let _tasksArchive = [], _tasksArchiveUnsub = null, _taFilter = 'all';

function openTasksArchive() {
  if (currentUser?.role !== 'manager') return;
  const el = document.getElementById('ta-search'); if (el) el.value = '';
  _taFilter = 'all';
  if (!_tasksArchiveUnsub) {
    _tasksArchiveUnsub = _onSnap(_colRef('tasks_archive'), snap => {
      _tasksArchive = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0));
      if (document.getElementById('modal-tasks-archive')?.classList.contains('open')) _renderTasksArchive();
    }, () => {});
  }
  _renderTasksArchive();
  openModal('modal-tasks-archive');
}
window.openTasksArchive = openTasksArchive;

function tasksArchiveFilter(f) { _taFilter = f; _renderTasksArchive(); }
window.tasksArchiveFilter = tasksArchiveFilter;

function _renderTasksArchive() {
  const c = document.getElementById('ta-list');
  if (!c) return;
  ['all','done','deleted'].forEach(f => {
    const b = document.getElementById('ta-f-' + f);
    if (b) { const on = _taFilter === f; b.style.background = on ? 'var(--dark)' : 'var(--surface2)'; b.style.color = on ? '#fff' : 'var(--text)'; b.style.borderColor = on ? 'var(--dark)' : 'var(--border)'; }
  });
  const term = (document.getElementById('ta-search')?.value || '').trim().toLowerCase();
  let rows = _tasksArchive;
  if (_taFilter !== 'all') rows = rows.filter(r => r.action === _taFilter);
  if (term) rows = rows.filter(r => `${r.title || ''} ${r.label || ''} ${r.assignedTo || ''} ${r.by || ''}`.toLowerCase().includes(term));
  if (!rows.length) {
    c.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted)">${term || _taFilter !== 'all' ? 'לא נמצאו רשומות' : 'הארכיון ריק — משימות שיבוצעו או יימחקו יופיעו כאן'}</div>`;
    return;
  }
  c.innerHTML = rows.slice(0, 200).map(r => {
    const d = r.at?.toDate ? r.at.toDate() : null;
    const when = d ? `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : '';
    const done = r.action === 'done';
    return `<div style="border:2px solid ${done ? '#bbf7d0' : '#fecaca'};border-right:5px solid ${done ? '#16a34a' : '#ef4444'};border-radius:11px;padding:10px 13px;margin-bottom:7px;background:${done ? '#f0fdf4' : '#fef2f2'}">
      <div style="font-weight:900;font-size:14px">${done ? '✅' : '🗑'} ${esc(r.title || '(ללא כותרת)')}</div>
      ${r.notes ? `<div style="font-size:12px;color:var(--muted);font-weight:700;margin-top:2px">${esc(r.notes)}</div>` : ''}
      <div style="font-size:12px;font-weight:800;margin-top:4px;color:${done ? '#166534' : '#991b1b'}">
        ${done ? 'בוצעה' : 'נמחקה'} ע״י ${esc(r.by || '—')}${when ? ' · ' + esc(when) : ''}
      </div>
      <div style="font-size:11.5px;color:var(--muted);font-weight:700;margin-top:2px">
        ${r.label ? 'עמודה: ' + esc(r.label) : ''}${r.assignedTo ? ' · הוקצתה ל' + esc(r.assignedTo) : ''}
      </div>
    </div>`;
  }).join('');
}
window._renderTasksArchive = _renderTasksArchive;

async function _archiveTask(id, action) {
  const t = tasksCache.find(x => x.id === id);
  if (!t || t.type === 'divider') return;   // חוצץ אינו משימה
  try {
    await _addDoc(_colRef('tasks_archive'), {
      taskId: id,
      title: t.title || '',
      notes: t.notes || '',
      label: t.label || '',
      assignedTo: t.assignedTo || '',
      action,                                  // 'done' | 'deleted'
      by: currentUser?.name || '',
      at: _serverTs(),
      createdAt: t.createdAt || null,
    });
  } catch (e) { console.error('archive task', e); }
}

async function driverCompleteTask(id) {
  if (!confirm('לסמן משימה זו כהושלמה ולמחוק אותה?')) return;
  await _archiveTask(id, 'done');
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await deleteDoc(doc(window._db, 'tasks', id));
  showToast('✅ המשימה הושלמה ונמחקה');
}
window.driverCompleteTask = driverCompleteTask;

// כפתור "בוצע" של המנהל — אותה משמעות בדיוק: נרשם בארכיון כבוצעה ויורד
// מהלוח. שם נפרד רק כדי שנוסח האישור יתאים.
async function managerCompleteTask(id) {
  if (!confirm('לסמן שהמשימה בוצעה? היא תעבור לארכיון ותרד מהלוח.')) return;
  await _archiveTask(id, 'done');
  try {
    const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(doc(window._db, 'tasks', id));
    showToast('✅ בוצעה — נשמרה בארכיון');
  } catch (e) { showToast('שגיאה: ' + (e.code || e.message)); }
}
window.managerCompleteTask = managerCompleteTask;

// נהג מסמן וי על משימת ולאדי → המשימה נמחקת לגמרי, ולכן נעלמת גם מהרשימה
// של הנהג וגם מזו של ולאדי אצל המנהל.
async function driverClearVladiTask(id) {
  if (!window._CONFIG_DONE) return;
  if (!confirm('המשימה בוצעה? היא תוסר מהרשימה שלך ושל ולאדי.')) return;
  try {
    await _archiveTask(id, 'done');
    const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await deleteDoc(doc(window._db, 'tasks', id));
    showToast('✔ המשימה הוסרה');
  } catch (e) { showToast('שגיאה במחיקה'); }
}
window.driverClearVladiTask = driverClearVladiTask;

async function deleteTask(id) {
  if (!window._CONFIG_DONE) return;
  const t = tasksCache.find(x => x.id === id);
  if (t?.type !== 'divider' && !confirm('למחוק את המשימה?')) return;
  await _archiveTask(id, 'deleted');
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await deleteDoc(doc(window._db, 'tasks', id));
}

function toggleTaskDone(id, currentStatus) {
  if (!window._CONFIG_DONE) return showToast('Firebase לא מחובר');
  const newStatus = currentStatus === 'done' ? 'open' : 'done';
  // סימון כבוצעה נרשם בארכיון; ביטול הסימון לא — המשימה חזרה לעבודה
  if (newStatus === 'done') _archiveTask(id, 'done');
  const extra = newStatus === 'done'
    ? { doneBy: currentUser.name, doneAt: _serverTs() }
    : { doneBy: '', doneAt: null };
  _updateDoc(_docRef('tasks', id), { status: newStatus, ...extra });
}

function openNewTaskModal() {
  document.getElementById('task-title').value = '';
  document.getElementById('task-city').value = '';
  document.getElementById('task-label').value = 'משימות כלליות';
  document.getElementById('task-color').value = '';
  document.querySelectorAll('#task-color-picker .color-swatch').forEach((s,i) => s.classList.toggle('selected', i===0));
  openModal('modal-task');
}

// ── Driver task request ──────────────────────────────────────────────────────
let _reqTaskPhotoData = null;
let _pendingTaskReqId = null;

let _reqTaskCol = null;

function _selectReqCol(btn, col) {
  _reqTaskCol = col;
  document.getElementById('req-task-cols').querySelectorAll('button').forEach(b => {
    b.style.background = 'var(--surface2)';
    b.style.color = 'var(--text)';
    b.style.borderColor = 'transparent';
  });
  btn.style.background = 'var(--gold)';
  btn.style.color = '#000';
  btn.style.borderColor = 'var(--gold)';
}

function openRequestTaskModal() {
  document.getElementById('req-task-text').value = '';
  document.getElementById('req-task-photo-preview').innerHTML = '';
  document.getElementById('req-task-file').value = '';
  document.getElementById('req-task-plate').value = '';
  document.getElementById('req-task-city').value = '';
  document.getElementById('req-plate-result').textContent = '';
  _reqTaskPhotoData = null;
  _reqTaskCol = null;
  _reqVehicleInfo = null;
  const cols = [
    { label:'כללי', value:'משימות כלליות' },
    { label:'חביב', value:'חביב' },
    { label:'ולאדי', value:'ולאדי' },
    { label:'רדארים', value:'רדארים' },
    { label:'מוסך', value:'מוסך' },
    { label:'רפד', value:'רפד' },
  ];
  const container = document.getElementById('req-task-cols');
  container.innerHTML = cols.map(c =>
    `<button type="button" onclick="_selectReqCol(this,'${c.value}')" style="background:var(--surface2);color:var(--text);border:2px solid transparent;border-radius:20px;padding:7px 16px;font-family:Heebo,sans-serif;font-size:14px;font-weight:700;cursor:pointer">${c.label}</button>`
  ).join('');
  openModal('modal-request-task');
}

let _reqVehicleInfo = null;

// gov.il's tozeret_nm appends the country of manufacture ("יונדאי צכיה",
// "טויוטה-יפן"). Single place that strips it — used everywhere a manufacturer
// is pulled, so the app never shows the country.
const _MAKER_COUNTRIES = ['ישראל','גרמניה','יפן','קוריאה','דרום קוריאה','צרפת','פרנסה','איטליה','שבדיה','שוודיה',
  'אנגליה','בריטניה','רומניה','הונגריה','סלובקיה','סלובניה','צ׳כיה','צכיה',"צ'כיה",'טורקיה','סין','הודו','ספרד',
  'אמריקה','ארה"ב','ארהב','ארצות הברית','מקסיקו','ברזיל','רוסיה','תאילנד','מלזיה','אוסטריה','הולנד','בלגיה',
  'פולין','פורטוגל','ארגנטינה','דרום אפריקה','קנדה','אינדונזיה','ויאטנם','אוקראינה'];
function _cleanMaker(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  // a name can carry more than one trailing country token — keep stripping
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of _MAKER_COUNTRIES) {
      for (const sep of [' ', '-', '־', ' - ']) {
        const suffix = sep + c;
        if (s.length > suffix.length && s.endsWith(suffix)) {
          s = s.slice(0, -suffix.length).trim();
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return s.trim();
}

/* ── משיכת פרטי רכב לפי מספר רישוי ───────────────────────────────────
   נקודה אחת לכל המערכת. שני דברים עושים אותה מהירה:
   • תשובה נשמרת בדפדפן — לוחית שכבר נמשכה חוזרת מיידית, בלי רשת
   • שאילתה מדויקת אחת בלבד, עם גבול זמן, בלי חיפוש חופשי איטי אחריה
   בקשה שכבר רצה על אותה לוחית לא נשלחת פעמיים.
─────────────────────────────────────────────────────────────────────── */
