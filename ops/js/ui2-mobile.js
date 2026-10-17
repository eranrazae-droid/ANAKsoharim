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

/* Approved mobile home: presentation and existing action proxies only.
   No database writes, API calls, business-function replacement or desktop changes. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const art = name => '<img class="u2m-icon" src="img/ui2m/' + name + '.webp" alt="" aria-hidden="true">';
  const definitions = {
    bodyshop: ['פחחות','bodyshop','menu-card-bodyshop-mgr','badge-bodyshop-mgr'],
    tasks: ['משימות','tasks','menu-card-tasks','badge-tasks'],
    pits: ['בורות','pits','mc-phone-pits','badge-pits'],
    intakes: ['קליטות','intakes','menu-card-vehicles','badge-vehicles'],
    battery: ['ארון מצברים','battery','menu-card-battery-stock','badge-battery-stock'],
    wash: ['שטיפה','wash','mc-phone-wash',''],
    inventory: ['מלאי','inventory','stat-inventory-driver-card','stat-inventory-driver-count'],
    pickup: ['איסוף רכבים','pickup','menu-card-pickup','badge-pickup'],
    testdrive: ['נסיעות מבחן','test-drive','mc-phone-td','td-home-count'],
    yard: ['סידור מגרש','yard','mc-phone-yard','badge-yard'],
    charging: ['בדיקת טעינה','battery','mc-phone-battery','badge-battery'],
    settings: ['הגדרות','settings','btn-settings',''],
    users: ['משתמשים','all','',''],
    notifications: ['התראות','calendar','btn-notify-mgr','']
  };
  let home, nav, chat, content, signature = '', identity = '', view = 'home', pending = false;
  let returnFocus = null, locked = [], conversation = [], request = null, generation = 0, lastContext = '';
  function user() { return typeof currentUser !== 'undefined' ? currentUser : null; }
  function eligible() { return document.body.classList.contains('ui2m') && ['manager','driver'].includes(user()?.role); }
  function invoke(name) { if (typeof window[name] === 'function') window[name](); }
  function proxy(id) { const node = $(id); if (node) node.click(); }
  function count(id) { const e = $(id); return e && e.style.display !== 'none' ? (e.textContent || '').trim() : ''; }
  function visible(id) { const e = $(id); return !!e && e.style.display !== 'none'; }
  function tile(key, options) {
    const d = definitions[key], o = options || {}, n = o.count == null ? count(d[3]) : o.count;
    return '<button type="button" class="u2m-tile' + (o.priority ? ' u2m-priority' : '') + '" data-u2m-tile="' + key + '"><span class="u2m-tile-top">' + art(d[1]) + (n && n !== '0' ? '<span class="u2m-count">' + esc(n) + '</span>' : '') + '</span><b>' + esc(o.label || d[0]) + '</b>' + (o.note ? '<small>' + esc(o.note) + '</small>' : '') + '</button>';
  }
  function ensure() {
    if (!home?.isConnected) {
      home = document.createElement('section'); home.id = 'ui2m-home'; home.className = 'u2m-home'; home.style.display = 'none';
      home.innerHTML = '<div class="u2m-hero"><button type="button" class="u2m-avatar" data-u2m-action="profile" aria-label="משתמש והגדרות"></button></div><main class="u2m-content"></main>';
      $('screen-home')?.appendChild(home); content = home.querySelector('main'); signature = '';
    }
    if (!nav) {
      nav = document.createElement('nav'); nav.id = 'ui2m-nav'; nav.className = 'u2m-nav'; nav.style.display = 'none'; nav.setAttribute('aria-label','ניווט ראשי'); document.body.appendChild(nav);
    }
    if (!chat) buildChat();
  }
  function morning() { return user()?.role === 'driver' && Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Jerusalem'}).format(new Date())) >= 8 && Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Jerusalem'}).format(new Date())) < 10; }
  function render() {
    pending = false;
    const active = eligible();
    document.body.classList.toggle('ui2m-app',active);
    if (!active) { closeChat(); return; }
    ensure();
    const u = user(), key = u.role + ':' + u.name;
    if (identity !== key) {
      identity = key; view = 'home'; signature = ''; closeChat(); resetChat();
    }
    home.querySelector('.u2m-avatar').textContent = (u.name || '').charAt(0);
    const manager = u.role === 'manager', onHome = $('screen-home')?.classList.contains('active');
    document.body.classList.toggle('ui2m-more',view === 'more');
    const navKey = manager + ':' + (onHome && view === 'home');
    if (nav.dataset.state !== navKey) {
      nav.dataset.state = navKey;
      nav.innerHTML = manager
        ? '<button type="button" data-u2m-action="calendar">'+art('calendar')+'יומן</button><button type="button" data-u2m-action="chat">'+art('chat')+'צ׳אט AI</button><button type="button" data-u2m-action="toggle">'+art(onHome && view === 'home'?'all':'home')+(onHome && view === 'home'?'הכל':'בית')+'</button>'
        : '<button type="button" data-u2m-action="home">'+art('home')+'בית</button><button type="button" data-u2m-action="chat">'+art('chat')+'צ׳אט AI</button><button type="button" data-u2m-action="whatsapp"><span aria-hidden="true">💬</span>וואטסאפ למנהל</button>';
    }
    // Preserve source nodes, their IDs, listeners and live counters; render only this new home.
    const live = Object.values(definitions).map(d=>d[2]+':'+visible(d[2])+':'+count(d[3])).join('|');
    const morningSource = $('home-morning');
    const approvals = visible('task-req-pills') ? ($('task-req-pills')?.querySelector('span')?.textContent || '').trim() : '';
    const stamp = approvals + ':' + key + ':' + view + ':' + live + ':' + morning() + ':' + (morningSource?.innerHTML || '') + ':' + count('stat-intake-driver-count') + ':' + count('stat-pits-driver-count');
    if (stamp === signature) return;
    signature = stamp;
    if (view === 'more' && manager) {
      content.innerHTML = '<h2>הכל</h2><div class="u2m-grid">'+['pickup','testdrive','yard','charging','settings','users','notifications'].map(k=>tile(k)).join('')+'</div>';
      return;
    }
    const quick = '<button type="button" class="u2m-quick" data-u2m-action="quick"><span><b>'+(manager?'יצירת משימה מהירה':'הצעת משימה מהירה')+'</b><small>'+(manager?'פתיחה ושליחה לעובד':'שליחת בקשה לאישור המנהל')+'</small></span><span class="u2m-plus" aria-hidden="true">+</span></button>';
    let lead = quick;
    if (morning()) {
      lead = '<section class="u2m-morning"><div class="u2m-morning-source"></div><button type="button" data-u2m-action="morning">לרשימת ההנעות</button></section>';
    }
    const shortcuts = manager ? '<div class="u2m-shortcuts"><button type="button" data-u2m-proxy="hck-recall" aria-label="Recall"><span class="u2m-recall" lang="en" dir="ltr">Recall</span></button><button type="button" data-u2m-proxy="hck-inventory">'+art('inventory')+'מלאי</button><button type="button" data-u2m-proxy="hck-morning">'+art('ignitions')+'חלוקת הנעות</button></div>' : '';
    let cards;
    if (manager) cards = ['bodyshop','tasks','pits','intakes','battery','wash'].map(k=>tile(k)).join('');
    else {
      const priority = [];
      if (visible('stat-pits-driver-card') && Number(count('stat-pits-driver-count')) > 0) priority.push(tile('pits',{count:count('stat-pits-driver-count'),priority:true}));
      if (visible('stat-inventory-driver-card') && Number(count('stat-inventory-driver-count')) > 0) priority.push(tile('inventory',{priority:true}));
      const n = count('stat-intake-driver-count');
      if (Number(n)>0) priority.push(tile('intakes',{count:n,priority:true}));
      cards = priority.join('')+tile('tasks')+(Number(n)>0?'':tile('intakes'))+tile('battery',{label:'מצברים',count:count('badge-driver-battery-install')})+tile('wash');
      // Other assigned work remains reachable, using the exact source action and visibility.
      [['stat-battery-driver-card','בדיקת טעינה','charging'],['stat-pickup-driver-card','איסוף רכבים','pickup'],['stat-td-driver-card','נסיעות מבחן','testdrive'],['stat-yard-driver-card','סידור מגרש','yard']].forEach(([id,label,k])=>{
        if (visible(id)) cards += '<button type="button" class="u2m-tile" data-u2m-proxy="'+id+'">'+art(definitions[k][1])+'<b>'+label+'</b><span class="u2m-count">'+esc($(id)?.querySelector('.num')?.textContent || '')+'</span></button>';
      });
      cards += '<button type="button" class="u2m-tile" data-u2m-action="push">'+art('settings')+'<b>התראות והגדרות</b></button>';
    }
    content.innerHTML = lead + shortcuts + '<h2>אזורי העבודה שלך</h2><div class="u2m-grid">'+cards+'</div>' + (manager && approvals ? '<button type="button" class="u2m-approvals" data-u2m-action="requests">'+esc(approvals)+' בקשות משימה מחכות לאישור שלך</button>' : '');
    if (morning()) {
      const slot = content.querySelector('.u2m-morning-source');
      if (morningSource?.firstElementChild) { const copy = morningSource.firstElementChild.cloneNode(true); copy.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id')); copy.removeAttribute('id'); slot.append(copy); }
      else slot.textContent = 'רשימת ההנעות שלך תופיע כאן לאחר חלוקה';
    }
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(render); } }
  function goHomeView(next) {
    view = next; signature = ''; invoke('goHome'); schedule();
  }
  function action(name) {
    if (!eligible()) return;
    if (name === 'chat') return openChat();
    if (name === 'requests') return window.expandTaskReqModal?.(0);
    if (name === 'calendar') return invoke('openHomeCal');
    if (name === 'toggle') return goHomeView($('screen-home')?.classList.contains('active') && view === 'home'?'more':'home');
    if (name === 'home') return goHomeView('home');
    if (name === 'whatsapp') return invoke('driverWhatsAppManager');
    if (name === 'push') return invoke('openPushSettings');
    if (name === 'quick') return invoke(user()?.role === 'manager'?'openNewTaskModal':'openRequestTaskModal');
    if (name === 'morning') return window.goToScreen?.('morning-starts');
    if (name === 'profile') return invoke(user()?.role === 'manager'?'openSwitchUser':'openPushSettings');
  }
  function activateTile(key) {
    if (!eligible()) return;
    if (key === 'users') return invoke('openSwitchUser');
    if (user()?.role === 'driver') {
      if (key === 'battery') return proxy('menu-card-driver-battery-install');
      if (key === 'pits') return proxy('stat-pits-driver-card');
      if (key === 'wash') return proxy('menu-card-wash');
    }
    proxy(definitions[key][2]);
  }
  function buildChat() {
    chat = document.createElement('div'); chat.id = 'ui2m-chat'; chat.className = 'u2m-chat'; chat.hidden = true; chat.style.display = 'none';
    chat.innerHTML = '<section class="u2m-chat-sheet" role="dialog" aria-modal="true" aria-labelledby="ui2m-chat-title"><header>'+art('chat')+'<div><h2 id="ui2m-chat-title">צ׳אט AI</h2><small id="ui2m-ai-state">החיבור ל־AI עדיין לא פעיל</small></div><button type="button" data-u2m-action="close-chat" aria-label="סגירת הצ׳אט">×</button></header><form id="ui2m-plate-form" class="u2m-plate-form"><label for="ui2m-plate">מספר רכב</label><input id="ui2m-plate" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="מספר רישוי"><small>השיחה תתייחס למספר שתזין</small></form><div id="ui2m-messages" class="u2m-messages" role="log" aria-live="polite"></div><form id="ui2m-chat-form" class="u2m-composer"><label for="ui2m-message">מה תרצה לדעת על הרכב?</label><div><textarea id="ui2m-message" rows="2" placeholder="למשל: איזה מצבר מתאים לרכב?" required></textarea><button type="submit" aria-label="שליחת שאלה">שלח</button></div><small id="ui2m-chat-status" role="status"></small></form></section>';
    document.body.appendChild(chat);
    $('ui2m-plate-form').addEventListener('submit',e=>{e.preventDefault();$('ui2m-message').focus();});
    $('ui2m-chat-form').addEventListener('submit',send);
    resetChat();
  }
  function resetChat() {
    request?.abort(); request = null; generation++; conversation = []; lastContext = '';
    if (!chat) return;
    $('ui2m-plate').value = ''; $('ui2m-message').value = ''; $('ui2m-messages').replaceChildren();
    $('ui2m-chat-status').textContent = ''; $('ui2m-chat-form').querySelector('button').disabled = false;
    addMessage('הזן מספר רכב ושאל על גלגל ספייר, מצבר, אבזור או מיקום של רכיב. מתחת לכל תשובה יופיעו המקורות שלה.',false);
  }
  function addMessage(text, mine) {
    const e = document.createElement('div'); e.className = 'u2m-message'+(mine?' u2m-mine':''); e.textContent = text;
    $('ui2m-messages').appendChild(e); e.scrollIntoView({block:'nearest'});
  }
  function openChat() {
    if (!eligible()) return;
    returnFocus = document.activeElement;
    const ownIntake = user()?.role === 'manager' || (typeof _driverIntakeDocs !== 'undefined' && typeof _currentIntakeId !== 'undefined' && _driverIntakeDocs.some(v=>v.id===_currentIntakeId && v.assignedTo===user()?.name));
    if (ownIntake && $('modal-driver-intake')?.classList.contains('open')) {
      const plate = ($('di-vehicle-info')?.querySelector('strong')?.textContent || '').replace(/\D/g,'');
      if (/^\d{7,8}$/.test(plate) && plate !== lastContext) { $('ui2m-plate').value = plate; lastContext = plate; }
    }
    chat.hidden = false;
    $('ui2m-ai-state').textContent = typeof window.AnakMobileAI?.ask === 'function'?'עוזר הידע שלך לרכב':'החיבור ל־AI עדיין לא פעיל';
    locked = [...document.body.children].filter(e=>e!==chat && !['SCRIPT','STYLE','LINK'].includes(e.tagName)).map(e=>[e,e.inert]);
    locked.forEach(([e])=>e.inert=true);
    document.body.classList.add('ui2m-chat-open'); $('ui2m-message').focus();
  }
  function closeChat() {
    if (!chat || chat.hidden) return;
    chat.hidden = true; locked.forEach(([e,v])=>e.inert=v); locked = [];
    document.body.classList.remove('ui2m-chat-open');
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
  }
  async function send(event) {
    event.preventDefault();
    if (request || !eligible()) return;
    const message = $('ui2m-message').value.trim(), plate = $('ui2m-plate').value.replace(/\D/g,'');
    const status = $('ui2m-chat-status');
    if (!message) return;
    if (!/^\d{7,8}$/.test(plate)) { status.textContent = 'יש להזין מספר רכב בן 7 או 8 ספרות'; $('ui2m-plate').focus(); return; }
    const adapter = window.AnakMobileAI;
    if (typeof adapter?.ask !== 'function') { status.textContent = 'הצ׳אט עדיין לא מחובר לשירות AI. השאלה נשמרת כאן עד לחיבור.'; return; }
    const previous = conversation.filter(m=>m.plate===plate), token = generation;
    request = new AbortController(); $('ui2m-chat-form').querySelector('button').disabled = true;
    addMessage(message,true); $('ui2m-message').value = ''; status.textContent = 'בודק את המידע…';
    try {
      const result = await adapter.ask({plate,message,history:previous.map(m=>({role:m.role,content:m.content})),signal:request.signal});
      if (token !== generation) return;
      if (!result || typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('empty answer');
      conversation.push({plate,role:'user',content:message},{plate,role:'assistant',content:result.answer});
      addMessage(result.answer,false);
      if (Array.isArray(result.sources)) result.sources.forEach(source=>{
        try { const url=new URL(source.url); if(url.protocol!=='https:')return; const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=String(source.title || url.hostname);$('ui2m-messages').appendChild(link); } catch(e) {}
      });
      status.textContent = '';
    } catch (e) {
      if (token !== generation) return;
      status.textContent = 'לא התקבלה תשובה. אפשר לנסות שוב.'; $('ui2m-message').value = message;
    } finally {
      if (token === generation) { request = null; $('ui2m-chat-form').querySelector('button').disabled = false; }
    }
  }
  function start() {
    document.addEventListener('click',event=>{
      const b=event.target.closest('[data-u2m-action],[data-u2m-tile],[data-u2m-proxy]');
      if (event.target===chat || b?.dataset.u2mAction==='close-chat') return closeChat();
      if (!b || !eligible()) return;
      if (b.dataset.u2mAction) action(b.dataset.u2mAction);
      else if (b.dataset.u2mTile) activateTile(b.dataset.u2mTile);
      else proxy(b.dataset.u2mProxy);
    });
    document.addEventListener('keydown',event=>{
      if (!chat || chat.hidden) return;
      if (event.key==='Escape') { event.preventDefault(); closeChat(); }
      if (event.key==='Tab') {
        const controls=[...chat.querySelectorAll('button,input,textarea,a[href]')].filter(e=>!e.disabled);
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    new MutationObserver(records=>{
      if (records.some(r=>!(r.target instanceof Element ? r.target : r.target.parentElement)?.closest('#ui2m-home,#ui2m-nav,#ui2m-chat,#ui2m-toggle-row'))) schedule();
    }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style']});
    window.addEventListener('resize',schedule);
    document.addEventListener('visibilitychange',schedule);
    setInterval(()=>{if(eligible())schedule();},60000);
    schedule();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
