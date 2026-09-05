/* התחברות, משתמשים, מסכים וחלוניות
   חלק 1 מתוך 13 של אפליקציית התפעול.
   הקבצים נטענים לפי הסדר ומתנהגים בדיוק כמו קובץ אחד — אין לשנות את הסדר. */
/* ═══════════════════════════════════════════════════════
   APP STATE
═══════════════════════════════════════════════════════ */
let currentUser = null; // { role: 'manager'|'driver', name: string }
let selectedRole = null;
let partsFilter = 'all';
let taskUnsub = null;
let vehicleUnsub = null;
let archiveUnsub = null;
let _archiveItems = [];
let _intakeCache = null;
let _driverIntakeDocs = null;
let _refreshCache = null;
let partsUnsub = null;
let yardUnsub = null;
var yardData = {};
var LEFT_SPOTS = Array.from({length:34}, (_,i) => String(i+1));
var RIGHT_ROWS = [
  ['40','41'],['42','43'],['44','45'],['46','47'],['48','49'],
  ['50','51'],['52','53'],['54','55'],['58','59'],   // 56–57 אינן קיימות במגרש
  ['60','61'],['62','63'],['64','65'],['66','67'],
  null, null, null, null, null, null, null,
  ['68'],['69'],
  ['70','71'],['72','73'],['74','75'],['76','77'],['78','79'],
  ['80','81'],['82','83'],['84','85'],['86','87'],['88','89'],['90','91'],['92','93']
];

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
window.addEventListener('firebase-ready', async () => {
  if (!window._CONFIG_DONE) {
    showConfigWarning();
  }
  // the security rules require a signed-in session — wait for it before any read
  if (window._authReady) {
    const ok = await window._authReady;
    if (!ok) showToast('⚠️ בעיית התחברות לשרת — רענן את הדף', 6000);
  }
  // The panel beater gets his own link and never sees the login screen — he
  // opens it and lands straight on his jobs. Nothing else is reachable from
  // there: no menu, no back button, no other screen.
  // his own address (/ops/pahach/) is a separate app as far as the phone is
  // concerned, so its home-screen shortcut opens his screen and not ours
  if (/[?&]pahach\b/.test(location.search) || /\/pahach\/?$/.test(location.pathname)) {
    // his own address no longer walks straight in: it asks for the account
    // once, and from then on the phone remembers it
    if (window._signedInUser) { _enterAsAuthUser(window._signedInUser); return; }
    showScreen('login');
    return;
  }

  // check saved session
  // devices that signed in before this existed keep working
  if (!_realUser) {
    const prev = localStorage.getItem('anak_user');
    if (prev) { _realUser = JSON.parse(prev); localStorage.setItem('anak_real_user', prev); }
  }
  // an account signed in on this device wins over anything remembered before it
  if (window._signedInUser) {
    _enterAsAuthUser(window._signedInUser);
    return;
  }
  /* From here on a device must hold a real account. Sessions that only
     remembered a name — the way the app worked before — are cleared, so every
     person signs in once with the phone and password they were given. */
  localStorage.removeItem('anak_user');
  localStorage.removeItem('anak_real_user');
  currentUser = null;
  _realUser = null;
  showScreen('login');
});

/* רשת ביטחון אחרונה: אם משום מה אף מסך לא נפתח תוך עשר שניות — למשל
   כשהחיבור ל-Firebase נתקע ואירוע ההתחלה לא הגיע — מציגים את מסך
   הכניסה בכל מקרה, כדי שהאפליקציה לא תישאר לבנה. */
setTimeout(() => {
  if (document.querySelector('.screen.active')) return;
  try { showScreen('login'); } catch (e) {}
  try { showToast('החיבור לשרת איטי — אפשר להתחבר בינתיים', 6000); } catch (e) {}
}, 10000);

function showConfigWarning() {
  const w = document.createElement('div');
  w.className = 'config-warning';
  w.innerHTML = '⚠️ <strong>Firebase לא מוגדר עדיין</strong> — האפליקציה עובדת במצב הדגמה בלבד. ראה הוראות בתחתית הקוד.';
  document.body.prepend(w);
}

/* ═══════════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════════ */
const MANAGER_PWD_B64 = btoa('0000');
// the person this device belongs to — the view may change, this does not
let _realUser = (() => { try { return JSON.parse(localStorage.getItem('anak_real_user') || 'null'); } catch (e) { return null; } })();

const DRIVER_PINS = { 'גיל': btoa('9999'), 'עופר': btoa('7777'), 'איתי': btoa('5555') };
const PICKUP_AGENTS = ['משה', 'הילה']; // pickup_agent role, no PIN

function handleLogoTap() {} // kept for compatibility

function selectDriver(val) {
  const pwWrap  = document.getElementById('manager-password-wrap');
  const pwInput = document.getElementById('manager-password-input');
  const needPin = val === 'ליאל' || !!DRIVER_PINS[val];
  if (needPin) {
    pwWrap.style.display = 'block';
    pwInput.value = '';
    pwInput.placeholder = val === 'ליאל' ? 'סיסמא (מספרים)' : 'קוד כניסה (4 ספרות)';
    setTimeout(() => pwInput.focus(), 50);
  } else {
    pwWrap.style.display = 'none';
    pwInput.value = '';
  }
  checkLoginReady();
}

function checkLoginReady() {
  const btn = document.getElementById('btn-enter');
  const val = document.getElementById('driver-name-select').value;
  if (!val) { btn.disabled = true; return; }
  if (val === 'ליאל' || DRIVER_PINS[val]) {
    const pw = document.getElementById('manager-password-input').value;
    btn.disabled = !pw;
  } else {
    btn.disabled = false;
  }
}

function doLogin() {
  const val = document.getElementById('driver-name-select').value;
  if (!val) return;
  const pw = document.getElementById('manager-password-input').value;
  if (val === 'ליאל') {
    if (btoa(pw) !== MANAGER_PWD_B64) {
      showToast('❌ סיסמא שגויה');
      document.getElementById('manager-password-input').value = '';
      return;
    }
    currentUser = { role: 'manager', name: 'ליאל' };
  } else if (PICKUP_AGENTS.includes(val)) {
    currentUser = { role: val === 'משה' ? 'pickup_agent' : 'pickup_driver', name: val };
  } else if (DRIVER_PINS[val]) {
    if (btoa(pw) !== DRIVER_PINS[val]) {
      showToast('❌ קוד שגוי');
      document.getElementById('manager-password-input').value = '';
      return;
    }
    currentUser = { role: 'driver', name: val };
  } else {
    currentUser = { role: 'driver', name: val };
  }
  localStorage.setItem('anak_user', JSON.stringify(currentUser));
  localStorage.setItem('anak_real_user', JSON.stringify(currentUser));
  _realUser = { ...currentUser };
  enterApp();
}

/* Nobody signs themselves out any more — a driver opens the app and is simply
   inside it. The manager's badge switches which user's screen he is looking at,
   without asking for anybody's password: he stays himself, only the view
   changes. */
const _ALL_USERS = [
  { name: 'ליאל',  role: 'manager' },
  { name: 'גיל',   role: 'driver' },
  { name: 'עופר',  role: 'driver' },
  { name: 'איתי',  role: 'driver' },
  { name: 'משה',   role: 'pickup_agent' },
  { name: 'הילה',  role: 'pickup_driver' },
  { name: 'איברהים', role: 'bodyshop' },
];

/* Signing in for real: the phone number is the user name, and the sign-in is
   remembered on the device until the password is changed. */
async function doPhoneLogin() {
  const phone = document.getElementById('login-phone').value.replace(/\D/g, '');
  const pass = document.getElementById('login-pass').value;
  const msg = document.getElementById('login-auth-msg');
  const say = t => { if (msg) msg.textContent = t || ''; };
  if (phone.length < 9 || !pass) return say('נא להזין טלפון וסיסמה');
  say('מתחבר…');
  try {
    const { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    await setPersistence(window._auth, browserLocalPersistence);
    const cred = await signInWithEmailAndPassword(window._auth, `${phone}@anak.local`, pass);
    await _enterAsAuthUser(cred.user);
    say('');
  } catch (e) {
    console.error('login', e);
    say(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found'
      ? 'טלפון או סיסמה שגויים' : 'שגיאה בהתחברות');
  }
}
window.doPhoneLogin = doPhoneLogin;

// lets you read what you typed, for when a password is long and the keyboard small
function toggleLoginPass() {
  const el = document.getElementById('login-pass');
  const eye = document.getElementById('login-pass-eye');
  if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  if (eye) { eye.textContent = show ? '🙈' : '👁️'; eye.title = show ? 'הסתר סיסמה' : 'הצג סיסמה'; }
  el.focus();
}
window.toggleLoginPass = toggleLoginPass;

// turns a signed-in account into the user the app works with
async function _enterAsAuthUser(user) {
  let profile = null;
  try {
    const snap = await window._getDoc(_docRef('users', user.uid));
    profile = snap.exists() ? snap.data() : null;
  } catch (e) { /* offline, or the profile is momentarily unreadable */ }
  // the last known profile of this very account is the fallback, so a bad
  // moment on the network never turns a manager into a driver
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem('anak_profile_' + user.uid) || 'null'); } catch (e) {}
  if (profile) {
    try { localStorage.setItem('anak_profile_' + user.uid, JSON.stringify({ name: profile.name, role: profile.role })); } catch (e) {}
  }
  const src = profile || cached;
  const name = src?.name || user.displayName || 'משתמש';
  const role = src?.role || 'driver';
  currentUser = { role, name };
  _realUser = { ...currentUser, uid: user.uid };
  localStorage.setItem('anak_user', JSON.stringify(currentUser));
  localStorage.setItem('anak_real_user', JSON.stringify(_realUser));
  // the panel beater has no home screen of his own — he lands on his jobs
  if (role === 'bodyshop') { openBodyShopScreen(); return; }
  enterApp();
}

// the way back to the sign-in screen, for a device that entered before there
// were accounts at all
async function goToLoginScreen() {
  closeModal('modal-switch-user');
  localStorage.removeItem('anak_user');
  localStorage.removeItem('anak_real_user');
  currentUser = null; _realUser = null;
  window._signedInUser = null;
  // without this the account is still signed in, and the next refresh walks
  // straight back into the screen we just left
  try {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    await signOut(window._auth);
  } catch (e) { console.error('signOut', e); }
  _applyUserBg();
  showScreen('login');
}
window.goToLoginScreen = goToLoginScreen;

/* ── google calendar: the whole setup from one window ────────────────── */
async function openGcalScreen() {
  if (currentUser?.role !== 'manager') return;
  const st = document.getElementById('gcal-status');
  if (st) st.textContent = '';
  try {
    const snap = await window._getDoc(_docRef('config', 'google_calendar'));
    const d = snap.exists() ? snap.data() : {};
    document.getElementById('gcal-id').value = d.calendarId || '';
    if (st && d.channelId) {
      st.style.color = 'var(--success)';
      st.textContent = '✅ הסנכרון פעיל' + (d.watchExpires ? ` · מתחדש עד ${new Date(Number(d.watchExpires)).toLocaleDateString('he-IL')}` : '');
    }
  } catch (e) { /* nothing saved yet */ }
}
window.openGcalScreen = openGcalScreen;

async function startGcalSync() {
  const calendarId = (document.getElementById('gcal-id').value || '').trim();
  if (!calendarId) return showToast('נא להדביק את מזהה היומן מהגדרות יומן גוגל');
  const st = document.getElementById('gcal-status');
  const say = (t, ok) => { if (st) { st.textContent = t; st.style.color = ok ? 'var(--success)' : '#b91c1c'; } };
  say('⏳ מפעיל…', true);
  try {
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await setDoc(_docRef('config', 'google_calendar'), { calendarId }, { merge: true });
    // the server registers with google and reads the calendar for the first time
    const res = await fetch('https://europe-west1-anak-soharim.cloudfunctions.net/startCalendarSync');
    const txt = await res.text();
    if (!res.ok) return say('❌ ' + txt.slice(0, 200), false);
    let info = {};
    try { info = JSON.parse(txt); } catch (e) {}
    say(`✅ הסנכרון הופעל · נקראו ${info.changed ?? 0} אירועים מגוגל · נשלחו ${info.pushed ?? 0} אירועים לגוגל`, true);
  } catch (e) {
    console.error('startGcalSync', e);
    say('❌ ' + (e.message || 'שגיאה בהפעלה'), false);
  }
}
window.startGcalSync = startGcalSync;

// shows what each side actually holds, so a sync problem can be seen and not guessed
async function checkGcalSync() {
  const st = document.getElementById('gcal-status');
  const say = (t, ok) => { if (st) { st.textContent = t; st.style.color = ok ? 'var(--success)' : '#b91c1c'; } };
  say('⏳ בודק…', true);
  try {
    const res = await fetch('https://europe-west1-anak-soharim.cloudfunctions.net/calendarDiag');
    const d = await res.json();
    const g = d.google;
    const lines = [
      `חשבון השירות: ${d.account}`,
      `יומן מוגדר: ${d.config?.calendarId}`,
      `ביומן שלנו באפליקציה: ${d.app?.total} אירועים · ${d.app?.withGcalId} מהם כבר בגוגל`,
      typeof g === 'string' ? `גוגל: ${g}` : `ביומן גוגל: ${g?.total} אירועים · ${g?.tagged} מהם משויכים לאפליקציה`,
    ];
    say(lines.join('\n'), true);
    console.log('calendarDiag', d);
  } catch (e) {
    say('❌ ' + (e.message || 'שגיאה בבדיקה'), false);
  }
}
window.checkGcalSync = checkGcalSync;

function logout() { openSwitchUser(); }   // every badge in the app calls this

/* ── people and their passwords ───────────────────────────────────────
   The list itself lives in the users collection; the passwords the manager
   wants to keep for his own reference live in one document that, once the
   rules are tightened, only his account can read. Creating a person and
   changing a password happen on the server — the app never touches the
   sign-in mechanism directly. */
let _appUsers = [];
let _userSecrets = {};
let _usersUnsub = null;

// the job each person does is already known from the name, so it is not asked
const _ROLE_BY_NAME = {
  'ליאל': 'manager',
  'גיל': 'driver', 'עופר': 'driver', 'איתי': 'driver',
  'משה': 'pickup_agent', 'הילה': 'pickup_driver',
  'איברהים': 'bodyshop',
};
const _roleForName = name => _ROLE_BY_NAME[String(name || '').trim()] || 'driver';

async function _callAdminUsers(payload) {
  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js");
  const fns = getFunctions(window._app, 'europe-west1');
  // a call that never answers must not leave the screen saying "loading" for ever
  const call = httpsCallable(fns, 'adminUsers')(payload).then(r => r.data);
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('אין תשובה מהשרת')), 15000));
  return Promise.race([call, timeout]);
}

/* Chrome fills anything that looks like a login form, and it was dropping the
   manager's own phone number into these fields. A field that starts read-only
   is not offered anything; it becomes writable the moment it is tapped. */
function _armUserForm() {
  for (const id of ['usr-name', 'usr-phone', 'usr-pass']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.value = '';
    el.readOnly = true;
    el.setAttribute('name', id + '-' + Math.random().toString(36).slice(2, 8));
    el.onfocus = () => { el.readOnly = false; };
  }
}

async function openUsersScreen() {
  if (currentUser?.role !== 'manager') return;
  _armUserForm();
  // managing people requires being signed in as yourself, not just showing
  // your screen — say so instead of letting the server refuse in silence
  const au = window._auth?.currentUser;
  if (!au || au.isAnonymous) {
    document.getElementById('users-list').innerHTML =
      `<div style="padding:18px;text-align:center">
        <div style="color:var(--muted);font-size:14px;font-weight:700;margin-bottom:12px">כדי לנהל משתמשים צריך להתחבר עם הטלפון והסיסמה שלך</div>
        <button onclick="closeModal('modal-settings');goToLoginScreen()" class="btn-submit" style="margin-top:0;background:var(--dark);color:#fff">🔐 מעבר להתחברות</button>
      </div>`;
    // הודעת ההתחברות חייבת להיראות גם כשהרשימה מקופלת
    const box = document.getElementById('users-list');
    if (box) box.style.display = 'block';
    const btn = document.getElementById('users-list-btn');
    if (btn) btn.style.display = 'none';
    const w = document.getElementById('users-warning');
    if (w) w.style.display = 'none';
    return;
  }
  const warn = document.getElementById('users-warning');
  if (warn) {
    warn.style.display = 'block';
    warn.textContent = 'עד שההרשאות במסד יהודקו, הסיסמאות שנשמרות כאן נגישות לכל מי שיש לו קישור לאפליקציה. עד אז — עדיף לא לשמור כאן סיסמאות אמיתיות.';
  }
  // חזרה למצב הרגיל: הרשימה מקופלת מאחורי הכפתור
  const lstBtn = document.getElementById('users-list-btn');
  if (lstBtn) lstBtn.style.display = '';
  document.getElementById('users-list').innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted)">טוען…</div>';
  try {
    const secretsSnap = await Promise.race([
      window._getDoc(_docRef('config', 'user_secrets')),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    _userSecrets = secretsSnap.exists() ? (secretsSnap.data() || {}) : {};
  } catch (e) { _userSecrets = {}; }
  try {
    // the list itself is read straight from the database — it is already there,
    // and it keeps itself up to date without asking the server anything
    if (!_usersUnsub) {
      _usersUnsub = _onSnap(_colRef('users'), snap => {
        _appUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'he'));
        _renderUsers();
      }, err => {
        console.error('users listen', err);
        document.getElementById('users-list').innerHTML =
          `<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">אין הרשאה לקרוא את רשימת המשתמשים</div>`;
      });
    } else {
      _renderUsers();
    }
  } catch (e) {
    console.error('openUsersScreen', e);
    document.getElementById('users-list').innerHTML =
      `<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">לא הצלחנו לטעון את רשימת המשתמשים.<br>${esc(e.message || '')}
        <div style="margin-top:10px"><button onclick="openUsersScreen()" class="btn-submit" style="margin-top:0;background:var(--dark);color:#fff">🔄 נסה שוב</button></div>
      </div>`;
  }
}
window.openUsersScreen = openUsersScreen;

function _renderUsers() {
  const c = document.getElementById('users-list');
  const roleName = r => ({ manager: 'מנהל', driver: 'נהג', pickup_agent: 'אחראי איסוף', pickup_driver: 'נהג איסוף', bodyshop: 'פחח' }[r] || r);
  c.innerHTML = _appUsers.length ? _appUsers.map(u => `
    <div style="border:2px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px;background:var(--card)">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:900;font-size:15px">${esc(u.name || '')} <span style="font-size:12px;font-weight:600;color:var(--muted)">· ${roleName(u.role)}</span></div>
          <div style="font-size:13px;color:var(--muted);font-weight:700;direction:ltr;text-align:right">${esc(u.phone || '')}</div>
          ${_userSecrets[u.uid] ? `<div style="font-size:13px;font-weight:800;direction:ltr;text-align:right;color:var(--gold)">${esc(_userSecrets[u.uid])}</div>` : ''}
        </div>
        <button onclick="editAppUser('${u.uid}')" style="background:var(--surface2);border:none;border-radius:8px;width:32px;height:32px;cursor:pointer">✏️</button>
        <button onclick="removeAppUser('${u.uid}')" style="background:#ef4444;color:#fff;border:none;border-radius:8px;width:32px;height:32px;cursor:pointer">🗑</button>
      </div>
    </div>`).join('')
    : `<div style="padding:16px;text-align:center;color:var(--muted)">עדיין אין משתמשים. המשתמש הראשון חייב להיות המנהל.</div>`;
}

function editAppUser(uid) {
  const u = _appUsers.find(x => x.uid === uid);
  if (!u) return;
  ['usr-name', 'usr-phone', 'usr-pass'].forEach(id => { const e = document.getElementById(id); if (e) e.readOnly = false; });
  document.getElementById('usr-name').value = u.name || '';
  document.getElementById('usr-phone').value = u.phone || '';
  document.getElementById('usr-pass').value = '';
  document.getElementById('usr-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`✏️ עורך את ${u.name} — סיסמה ריקה תישאר כמו שהיא`);
}
window.editAppUser = editAppUser;

async function saveAppUser() {
  const name = document.getElementById('usr-name').value.trim();
  const phone = document.getElementById('usr-phone').value.replace(/\D/g, '');
  const password = document.getElementById('usr-pass').value.trim();
  const role = _roleForName(name);
  if (!name) return showToast('נא להזין שם');
  if (phone.length < 9) return showToast('נא להזין מספר טלפון תקין');
  const exists = _appUsers.find(u => u.phone === phone);
  if (!exists && !password) return showToast('נא להזין סיסמה למשתמש חדש');
  if (password && password.length < 8) return showToast('הסיסמה חייבת להיות 8 תווים לפחות');
  try {
    let uid = exists?.uid;
    if (exists) {
      if (password) await _callAdminUsers({ action: 'setPassword', uid, password });
    } else {
      const res = await _callAdminUsers({ action: 'create', name, phone, password, role });
      uid = res.uid;
    }
    // keep the manager's own copy of the password, for his reference only
    if (password && uid) {
      const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await setDoc(_docRef('config', 'user_secrets'), { [uid]: password }, { merge: true });
      _userSecrets[uid] = password;
    }
    _armUserForm();
    showToast('✅ נשמר');
  } catch (e) {
    console.error('saveAppUser', e);
    showToast('שגיאה: ' + (e.message || ''), 6000);
  }
}
window.saveAppUser = saveAppUser;

async function removeAppUser(uid) {
  const u = _appUsers.find(x => x.uid === uid);
  if (!u || !confirm(`למחוק את ${u.name}? הוא לא יוכל להיכנס יותר.`)) return;
  try {
    await _callAdminUsers({ action: 'remove', uid });
    showToast('🗑 נמחק');
  } catch (e) { showToast('שגיאה במחיקה'); }
}
window.removeAppUser = removeAppUser;

function openSwitchUser() {
  // only the manager may look through somebody else's screen
  if (_realUser?.role !== 'manager') return;
  const c = document.getElementById('switch-user-list');
  if (!c) return;
  c.innerHTML = _ALL_USERS.map(u => {
    const active = currentUser?.name === u.name;
    return `<button onclick="switchToUser('${u.name}')" style="display:block;width:100%;text-align:right;background:${active ? 'var(--dark)' : 'var(--surface2)'};color:${active ? '#fff' : 'var(--text)'};border:2px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:8px;font-family:'Heebo',sans-serif;font-size:16px;font-weight:800;cursor:pointer">
      ${u.name} <span style="font-size:12px;font-weight:600;opacity:.7">· ${u.role === 'manager' ? 'מנהל' : u.role === 'driver' ? 'נהג' : 'איסוף'}</span>${active ? ' ✓' : ''}
    </button>`;
  }).join('');
  openModal('modal-switch-user');
}
window.openSwitchUser = openSwitchUser;

function switchToUser(name) {
  const u = _ALL_USERS.find(x => x.name === name);
  if (!u) return;
  currentUser = { role: u.role, name: u.name };
  localStorage.setItem('anak_user', JSON.stringify(currentUser));
  closeModal('modal-switch-user');
  _applyUserBg();
  if (u.role === 'bodyshop') openBodyShopScreen(); else enterApp();
  showToast(u.role === 'manager' ? 'חזרת למסך שלך' : `אתה רואה עכשיו את המסך של ${name}`);
}
window.switchToUser = switchToUser;

/* ═══════════════════════════════════════════════════════
   SCREEN NAVIGATION
═══════════════════════════════════════════════════════ */
/* ── מסך בתוך חלונית ─────────────────────────────────────────────────
   חמישה מסכים נפתחים כחלונית במרכז המסך במקום להחליף את מסך הבית.
   המסך עצמו לא שוכתב — האלמנט שלו עובר פיזית לתוך החלונית וחוזר
   למקומו בסגירה. לכן כל הכפתורים, המאזינים והלוגיקה ממשיכים לעבוד
   בדיוק כמו קודם, וכל מסך שנפתח רגיל ממשיך להיפתח רגיל.
─────────────────────────────────────────────────────────────────────── */
const _SCREEN_MODALS = ['inventory', 'pits', 'recall', 'wash', 'plate-search', 'test-drive', 'ownership'];
let _hostName = null, _hostReturn = null;

function openScreenModal(name) { goToScreen(name); }
window.openScreenModal = openScreenModal;

function _mountHostScreen(name) {
  const el = document.getElementById('screen-' + name);
  const slot = document.getElementById('screen-host-slot');
  if (!el || !slot) return;
  if (el.parentNode !== slot) {
    _hostReturn = { el, parent: el.parentNode, next: el.nextSibling };
    slot.appendChild(el);
  }
  el.classList.add('active');
  // טופס השטיפה חוזר לתוך המסך שלו לפני שהחלונית נפתחת
  try { window._washMount && window._washMount(); } catch (e) {}
  slot.scrollTop = 0;
  const box = slot.parentNode;
  if (box) box.scrollTop = 0;
}

function closeScreenModal() {
  if (!_hostName) return;
  const wasOwnership = _hostName === 'ownership';
  const el = document.getElementById('screen-' + _hostName);
  _hostName = null;
  if (el) el.classList.remove('active');
  // האלמנט חוזר בדיוק למקום שממנו נלקח
  if (_hostReturn && _hostReturn.parent) {
    _hostReturn.parent.insertBefore(_hostReturn.el, _hostReturn.next);
  }
  _hostReturn = null;
  closeModal('modal-screen-host');
  // יציאה מהחלונית מחזירה את טופס השטיפה לעמודה במסך הבית
  try { window._washMount && window._washMount(); } catch (e) {}
  // התזכורת לא קופצת בזמן שנמצאים בבדיקת הבעלויות — רק ביציאה ממנה,
  // ורק אם לא סומן "הכל תקין"
  if (wasOwnership) setTimeout(() => { try { _checkOwnMorning(); } catch (e) {} }, 300);
}
window.closeScreenModal = closeScreenModal;

function showScreen(name) {
  // מסך מהרשימה נכנס לחלונית במקום להחליף את מסך הבית — לא משנה מאיזה
  // כפתור או תהליך הגיעו אליו
  if (_SCREEN_MODALS.includes(name)) {
    if (_hostName !== name) {
      if (_hostName) closeScreenModal();
      _hostName = name;
      openModal('modal-screen-host');
    }
    return _mountHostScreen(name);
  }
  // מסך אחר נפתח מתוך החלונית — יוצאים ממנה קודם
  if (_hostName) closeScreenModal();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  sessionStorage.setItem('anak_screen', name);
  // hide task-req pill when leaving tasks screen
  if (name !== 'tasks') { const p = document.getElementById('task-req-pills'); if (p) p.style.display = 'none'; }
  else if (typeof _renderTaskReqPills === 'function') _renderTaskReqPills();
}

// התמונה יושבת בקובץ נפרד ולא בתוך הקוד: כל משתמש הוריד אותה בכל טעינה,
// גם מי שלא רואה אותה. עכשיו היא נטענת רק אצל גיל, והדפדפן שומר אותה במטמון.
const _GIL_BG = 'img/gil-bg.jpg?v=1';
function _applyUserBg() {
  // Gil background disabled — to re-enable, uncomment the block below (size: 100%, no-repeat, center, fixed)
  // if (currentUser?.name === 'גיל') {
  //   document.body.style.backgroundImage = 'url(' + _GIL_BG + ')';
  //   document.body.style.backgroundSize = '100%';
  //   document.body.style.backgroundPosition = 'center';
  //   document.body.style.backgroundRepeat = 'no-repeat';
  //   document.body.style.backgroundAttachment = 'fixed';
  //   document.body.classList.add('user-bg-active');
  // } else {
  document.body.style.backgroundImage = '';
  document.body.classList.remove('user-bg-active');
  // }
}
function enterApp() {
  _applyUserBg();
  renderHome();
  const savedScreen = sessionStorage.getItem('anak_screen');
  if (savedScreen && savedScreen !== 'home' && savedScreen !== 'login') {
    const screenFns = { vehicles: openVehiclesScreen, tasks: openTasksScreen, parts: openPartsScreen, inventory: openInventoryScreen, pits: openPitsScreen, yard: openYardScreen, 'driver-inventory': openDriverInventoryScreen, battery: openBatteryScreen, 'driver-battery': openDriverBatteryScreen, 'driver-charging': openDriverChargingScreen, 'battery-stats': openBatteryStatsScreen, refresh: openVehiclesScreen, recall: openRecallScreen, wash: openWashScreen, 'plate-search': openPlateSearch };
    // מסך שנפתח כחלונית לא משוחזר אחרי רענון — חוזרים למסך הבית
    if (_SCREEN_MODALS.includes(savedScreen)) { showScreen('home'); }
    else if (screenFns[savedScreen]) { screenFns[savedScreen](); }
    else { showScreen('home'); }
  } else {
    showScreen('home');
  }
  if (currentUser.role === 'manager') {
    requestNotifPermission();
    listenForNewVehicles();
  }
}

let _lastVehicleTime = null;
let _vehicleNotifUnsub = null;

function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function listenForNewVehicles() {
  if (!window._CONFIG_DONE) return;
  if (_vehicleNotifUnsub) _vehicleNotifUnsub();
  // track existing docs first, then only react to new ones
  _lastVehicleTime = Date.now();
  _vehicleNotifUnsub = _onSnap(
    _query(_colRef('vehicles'), _orderBy('receivedAt', 'desc')),
    snap => {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const v = change.doc.data();
        // skip docs that already existed before we logged in
        const ts = v.receivedAt?.toMillis?.() || 0;
        if (ts && ts < _lastVehicleTime) return;
        if (!ts && _lastVehicleTime) return;
        const title = `🚗 רכב חדש נקלט – ${v.plate || ''}`;
        const body  = `${v.brand || ''} ${v.model || ''} | נקלט ע"י ${v.receivedBy || ''}`;
        showToast(title);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/ops/icon-192.png' });
        }
      });
    }
  );
}

function goHome() {
  _bsmHideActions();   // the body-shop buttons float — they must not stay behind
  // "חזרה" מתוך מסך שמתארח בחלונית פשוט סוגר אותה, ומסך הבית כבר מאחוריה
  if (_hostName) { closeScreenModal(); return _backToAllScreens(); }
  showScreen('home');
  _backToAllScreens();
}

// מסך שנפתח מתוך "כל המסכים" חוזר לרשימה, ולא למסך הבית
let _cameFromAllScreens = false;
function _backToAllScreens() {
  if (!_cameFromAllScreens) return;
  _cameFromAllScreens = false;
  setTimeout(openAllScreens, 60);
}

/* ═══════════════════════════════════════════════════════
   HOME
═══════════════════════════════════════════════════════ */
/* Bump on every deploy. A stale cached page keeps showing its own older stamp,
   which is how we tell "the feature is missing" from "the phone is out of date". */
const APP_BUILD = '2026-08-09 · 214';

  /* ── "כל המסכים" ────────────────────────────────────────────────────
   כל מה שהיה כפתורים צבעוניים במסך הבית יושב כאן, ברשימה אחת אחידה.
   הכפתורים המקוריים נשארים במקומם ומוסתרים — הרשימה קוראת מהם את
   השם, המספר ומה קורה בלחיצה, כך שאין כפילות של הגדרות.
   פתק השטיפה, הבורות ונסיעות המבחן אינם כאן: הם יושבים בלשוניות של
   החלונית במסך הבית, ואין טעם שיהיו בשני מקומות.                   */
const _ALL_SCREENS = [
  { id: 'menu-card-ownership',    icon: '📑', label: 'בדיקת בעלויות',        badge: 'badge-ownership' },
  { id: 'menu-card-recall',       icon: '⚠️', label: 'בדיקת ריקול',          badge: 'recall-home-count' },
  { id: 'menu-card-inventory',    icon: '📦', label: 'בדיקת מלאי',           badge: 'badge-inventory' },
  { id: 'menu-card-battery',      icon: '🔋', label: 'בדיקת טעינה',          badge: 'badge-battery' },
  { id: 'menu-card-yard',         icon: '🅿️', label: 'סידור מגרש',           badge: 'badge-yard' },
  { id: 'menu-card-plate-search', icon: '🔎', label: 'חיפוש רכב לפי לוחית',  badge: '' },
  // פריט שאין מאחוריו קובייה — הוא מריץ פעולה ישירות. כך אפשר לשנות את
  // חלוקת ההנעות בכל רגע, גם אחרי שהיא כבר נעשתה היום.
  { id: 'ms-roll', icon: '🔑', label: 'חלוקת הנעות הבוקר', badge: '', action: 'msOpenRoll()' },
];

/* ── מצב הבדיקות של הבוקר ───────────────────────────────────────────
   ליד בעלויות, ריקול ומלאי נרשם אם הבדיקה בוצעה היום והכל תקין.
   הכתוב מתאפס בחצות: הוא נשען על תאריך היום, ולכן ב-00:00 הוא כבר
   לא תואם וחוזר ל"טרם בוצעה היום".                                 */
