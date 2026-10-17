/* מסד נתונים מדומה לסביבת ההדגמה — מחליף את Firestore בזיכרון הדפדפן.
   שום דבר לא נשלח לשרת. רענון הדף מחזיר את נתוני ההדגמה המקוריים. */
import { SEED } from './seed.js';

export class Timestamp {
  constructor(seconds, nanoseconds = 0) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static fromDate(d) { const ms = +d; return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static fromMillis(ms) { return Timestamp.fromDate(new Date(ms)); }
  static now() { return Timestamp.fromDate(new Date()); }
  toDate() { return new Date(this.toMillis()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  valueOf() { return this.toMillis(); }
  isEqual(o) { return o && o.toMillis && o.toMillis() === this.toMillis(); }
  toJSON() { return { seconds: this.seconds, nanoseconds: this.nanoseconds }; }
}

const SENT = { st: Symbol('serverTimestamp'), del: Symbol('deleteField'), inc: Symbol('increment'), au: Symbol('arrayUnion'), ar: Symbol('arrayRemove') };
export const serverTimestamp = () => ({ __s: SENT.st });
export const deleteField = () => ({ __s: SENT.del });
export const increment = n => ({ __s: SENT.inc, n });
export const arrayUnion = (...v) => ({ __s: SENT.au, v });
export const arrayRemove = (...v) => ({ __s: SENT.ar, v });

/* ── המאגר ── */
const store = new Map();               // collection -> Map(id -> data)
const col = n => { if (!store.has(n)) store.set(n, new Map()); return store.get(n); };
const clone = v => {
  if (v == null || typeof v !== 'object') return v;
  if (v instanceof Timestamp) return new Timestamp(v.seconds, v.nanoseconds);
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (Array.isArray(v)) return v.map(clone);
  if (typeof Blob !== 'undefined' && v instanceof Blob) return v;
  const o = {}; for (const k in v) o[k] = clone(v[k]); return o;
};
(function load() {
  const data = SEED(Timestamp);
  for (const [c, docs] of Object.entries(data)) for (const [id, d] of Object.entries(docs)) col(c).set(id, clone(d));
})();
let _seq = 0;
const newId = () => 'demo' + Date.now().toString(36) + (++_seq).toString(36) + Math.random().toString(36).slice(2, 6);

/* ── הפניות ── */
class Firestore { constructor() { this.type = 'firestore'; } }
const DB = new Firestore();
export const getFirestore = () => DB;
export const initializeFirestore = () => DB;
export const enableIndexedDbPersistence = async () => {};
export const enableMultiTabIndexedDbPersistence = async () => {};

class CollectionReference { constructor(path) { this.type = 'collection'; this.path = path; this.id = path.split('/').pop(); this._c = []; } }
class DocumentReference {
  constructor(c, id) { this.type = 'document'; this._col = c; this.id = id; this.path = c + '/' + id; }
  get parent() { return new CollectionReference(this._col); }
}
class Query { constructor(path, cons) { this.type = 'query'; this.path = path; this._c = cons; } }

export function collection(base, ...segs) {
  const parts = (base instanceof DocumentReference ? [base.path] : base instanceof CollectionReference ? [base.path] : []).concat(segs);
  return new CollectionReference(parts.join('/'));
}
export function doc(base, ...segs) {
  if (base instanceof CollectionReference) return new DocumentReference(base.path, segs.length ? segs.join('/') : newId());
  const parts = segs.join('/').split('/');
  const id = parts.pop();
  return new DocumentReference(parts.join('/'), id);
}
export const where = (f, op, v) => ({ k: 'where', f, op, v });
export const orderBy = (f, dir = 'asc') => ({ k: 'orderBy', f, dir });
export const limit = n => ({ k: 'limit', n });
export const limitToLast = n => ({ k: 'limitToLast', n });
export const startAfter = (...v) => ({ k: 'noop', v });
export const documentId = () => '__name__';
export function query(ref, ...cons) { return new Query(ref.path, (ref._c || []).concat(cons.filter(Boolean))); }

/* ── קריאה ── */
const getPath = (o, p) => p === '__name__' ? o.__id : p.split('.').reduce((a, k) => a == null ? undefined : a[k], o);
const cmpv = v => v && typeof v === 'object' && v.toMillis ? v.toMillis() : v;
function cmp(a, b) { a = cmpv(a); b = cmpv(b); if (a === b) return 0; if (a == null) return -1; if (b == null) return 1; return a < b ? -1 : 1; }
function match(d, w) {
  const x = getPath(d, w.f), v = w.v;
  switch (w.op) {
    case '==': return cmp(x, v) === 0 && (x !== undefined || v === undefined);
    case '!=': return x !== undefined && cmp(x, v) !== 0;
    case '<': return x != null && cmp(x, v) < 0;
    case '<=': return x != null && cmp(x, v) <= 0;
    case '>': return x != null && cmp(x, v) > 0;
    case '>=': return x != null && cmp(x, v) >= 0;
    case 'in': return v.some(y => cmp(x, y) === 0);
    case 'not-in': return x !== undefined && !v.some(y => cmp(x, y) === 0);
    case 'array-contains': return Array.isArray(x) && x.some(y => cmp(y, v) === 0);
    case 'array-contains-any': return Array.isArray(x) && x.some(y => v.some(z => cmp(y, z) === 0));
  }
  return true;
}
class DocumentSnapshot {
  constructor(ref, data) { this.ref = ref; this.id = ref.id; this._d = data; this.metadata = { fromCache: false, hasPendingWrites: false }; }
  exists() { return this._d !== undefined; }
  data() { return this._d === undefined ? undefined : clone(this._d); }
  get(f) { return this._d === undefined ? undefined : clone(getPath(this._d, f)); }
}
class QuerySnapshot {
  constructor(q, docs, changes) { this.query = q; this.docs = docs; this._ch = changes; this.metadata = { fromCache: false, hasPendingWrites: false }; }
  get size() { return this.docs.length; }
  get empty() { return !this.docs.length; }
  forEach(fn, t) { this.docs.forEach(fn, t); }
  docChanges() { return this._ch; }
}
function run(q) {
  const cons = q._c || [];
  let rows = [...col(q.path).entries()].map(([id, d]) => ({ id, d, w: { ...d, __id: id } }));
  for (const c of cons) if (c.k === 'where') rows = rows.filter(r => match(r.w, c));
  const ords = cons.filter(c => c.k === 'orderBy');
  if (ords.length) {
    rows = rows.filter(r => ords.every(o => getPath(r.w, o.f) !== undefined));
    rows.sort((a, b) => { for (const o of ords) { const c = cmp(getPath(a.w, o.f), getPath(b.w, o.f)); if (c) return o.dir === 'desc' ? -c : c; } return 0; });
  }
  const lim = cons.find(c => c.k === 'limit'); if (lim) rows = rows.slice(0, lim.n);
  const ll = cons.find(c => c.k === 'limitToLast'); if (ll) rows = rows.slice(-ll.n);
  return rows.map(r => new DocumentSnapshot(new DocumentReference(q.path, r.id), r.d));
}
const delay = () => new Promise(r => setTimeout(r, 30));
export async function getDoc(ref) { await delay(); return new DocumentSnapshot(ref, col(ref._col).get(ref.id)); }
export const getDocFromServer = getDoc, getDocFromCache = getDoc;
export async function getDocs(q) { await delay(); const docs = run(q); return new QuerySnapshot(q, docs, docs.map((d, i) => ({ type: 'added', doc: d, oldIndex: -1, newIndex: i }))); }
export const getDocsFromServer = getDocs, getDocsFromCache = getDocs;
export async function getCountFromServer(q) { const n = run(q).length; return { data: () => ({ count: n }) }; }

/* ── האזנה בזמן אמת ── */
const listeners = new Set();
export function onSnapshot(ref, ...args) {
  if (args[0] && typeof args[0] === 'object' && !('next' in args[0]) && typeof args[1] === 'function') args.shift();
  let next = args[0], error = args[1];
  if (next && typeof next === 'object') { error = next.error; next = next.next; }
  const L = { ref, next, prev: null, alive: true };
  const fire = () => {
    if (!L.alive) return;
    try {
      if (ref instanceof DocumentReference) {
        const d = col(ref._col).get(ref.id);
        const key = JSON.stringify(d === undefined ? null : d);
        if (key === L.prev) return; L.prev = key;
        next && next(new DocumentSnapshot(ref, d));
      } else {
        const docs = run(ref);
        const map = new Map(docs.map(d => [d.id, JSON.stringify(d._d)]));
        const old = L.prev || new Map();
        if (L.prev && map.size === old.size && [...map].every(([k, v]) => old.get(k) === v)) return;
        const ch = [];
        docs.forEach((d, i) => { if (!old.has(d.id)) ch.push({ type: 'added', doc: d, oldIndex: -1, newIndex: i }); else if (old.get(d.id) !== map.get(d.id)) ch.push({ type: 'modified', doc: d, oldIndex: i, newIndex: i }); });
        for (const k of old.keys()) if (!map.has(k)) ch.push({ type: 'removed', doc: new DocumentSnapshot(new DocumentReference(ref.path, k), undefined), oldIndex: 0, newIndex: -1 });
        L.prev = map;
        next && next(new QuerySnapshot(ref, docs, ch));
      }
    } catch (e) { console.error('[demo] listener', e); error && error(e); }
  };
  L.fire = fire; listeners.add(L);
  setTimeout(fire, 20);
  return () => { L.alive = false; listeners.delete(L); };
}
let _pend = false;
function notify() { if (_pend) return; _pend = true; setTimeout(() => { _pend = false; [...listeners].forEach(l => l.fire()); }, 0); }
export const onSnapshotsInSync = (db, cb) => { setTimeout(cb, 0); return () => {}; };

/* ── כתיבה (בזיכרון בלבד) ── */
function resolve(v, old) {
  if (v && typeof v === 'object' && v.__s) {
    if (v.__s === SENT.st) return Timestamp.now();
    if (v.__s === SENT.inc) return (typeof old === 'number' ? old : 0) + v.n;
    if (v.__s === SENT.au) { const a = Array.isArray(old) ? old.slice() : []; v.v.forEach(x => { if (!a.some(y => JSON.stringify(y) === JSON.stringify(x))) a.push(clone(x)); }); return a; }
    if (v.__s === SENT.ar) return (Array.isArray(old) ? old : []).filter(y => !v.v.some(x => JSON.stringify(x) === JSON.stringify(y)));
  }
  if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !(v instanceof Date) && !(typeof Blob !== 'undefined' && v instanceof Blob)) {
    const o = {}; for (const k in v) { const r = resolve(v[k], old && typeof old === 'object' ? old[k] : undefined); if (!(v[k] && v[k].__s === SENT.del)) o[k] = r; } return o;
  }
  return clone(v);
}
function mergeInto(base, patch) {
  for (const k in patch) {
    const v = patch[k];
    if (v && v.__s === SENT.del) { delete base[k]; continue; }
    if (v && typeof v === 'object' && !v.__s && !Array.isArray(v) && !(v instanceof Timestamp) && !(v instanceof Date) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && !(base[k] instanceof Timestamp)) mergeInto(base[k], v);
    else base[k] = resolve(v, base[k]);
  }
}
function setPath(o, path, v) {
  const ks = path.split('.'); const last = ks.pop();
  let cur = o; for (const k of ks) { if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; }
  if (v && v.__s === SENT.del) delete cur[last]; else cur[last] = resolve(v, cur[last]);
}
function _set(ref, data, opt) {
  const c = col(ref._col);
  if (opt && (opt.merge || opt.mergeFields)) { const base = c.get(ref.id) || {}; mergeInto(base, data); c.set(ref.id, base); }
  else c.set(ref.id, resolve(data, undefined));
}
function _update(ref, a, ...rest) {
  const c = col(ref._col); const base = c.get(ref.id);
  if (!base) { const e = new Error('No document to update: ' + ref.path); e.code = 'not-found'; throw e; }
  const patch = typeof a === 'string' ? (() => { const o = {}; const all = [a, ...rest]; for (let i = 0; i < all.length; i += 2) o[all[i]] = all[i + 1]; return o; })() : a;
  for (const k in patch) setPath(base, k, patch[k]);
}
const log = (op, ref) => console.info('[demo] ' + op + ' ' + ref.path + ' (בזיכרון בלבד)');
export async function setDoc(ref, data, opt) { await delay(); _set(ref, data, opt); log('set', ref); notify(); }
export async function updateDoc(ref, ...a) { await delay(); _update(ref, ...a); log('update', ref); notify(); }
export async function deleteDoc(ref) { await delay(); col(ref._col).delete(ref.id); log('delete', ref); notify(); }
export async function addDoc(cref, data) { const ref = doc(cref); await setDoc(ref, data); return ref; }
export function writeBatch() {
  const ops = [];
  const b = {
    set: (r, d, o) => (ops.push(() => _set(r, d, o)), b),
    update: (r, ...a) => (ops.push(() => _update(r, ...a)), b),
    delete: r => (ops.push(() => col(r._col).delete(r.id)), b),
    commit: async () => { await delay(); ops.forEach(f => f()); console.info('[demo] batch ' + ops.length + ' (בזיכרון בלבד)'); notify(); },
  };
  return b;
}
export async function runTransaction(db, fn) {
  const tx = {
    get: ref => getDoc(ref),
    set: (r, d, o) => (_set(r, d, o), tx),
    update: (r, ...a) => (_update(r, ...a), tx),
    delete: r => (col(r._col).delete(r.id), tx),
  };
  const out = await fn(tx); notify(); return out;
}
export const connectFirestoreEmulator = () => {};
export const terminate = async () => {};
export const clearIndexedDbPersistence = async () => {};
export const waitForPendingWrites = async () => {};
export const disableNetwork = async () => {};
export const enableNetwork = async () => {};
export const memoryLocalCache = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});

window.__demoStore = store;
