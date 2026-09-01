/* בדיקת מערכת מלאה: עוברת על כל המסכים בכל התפקידים, ומתעדת
   מה נוצר על המסך, כמה חיבורים חיים לשרת נפתחו, ואילו שגיאות היו.
   מריצים לפני השינוי ואחריו ומשווים — כל הבדל הוא רגרסיה. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2] || '/tmp/baseline.json';
const SCREENS = ['home','tasks','vehicles','refresh','parts','parts-catalog','inventory','pits','yard',
  'pickup','test-drive','recall','wash','battery','battery-stock','battery-stats','ownership',
  'morning-starts','notify-mgr','plate-search','driver-inventory','driver-battery','driver-charging',
  'driver-battery-stock','bodyshop','bodyshop-mgr','host-slot','host-close'];

const DATA = {
  tasks: [{id:'t1',plate:'12345678',title:'החלפת מצבר',status:'open',assignedTo:'גיל',label:'כללי',createdAt:'2026-08-30T08:00:00Z'},
          {id:'t2',plate:'87654321',title:'ריפוד',status:'open',assignedTo:'עופר',label:'רפד'}],
  vehicles: [{id:'v1',plate:'12345678',brand:'יונדאי',model:'i10',status:'done',assignedTo:'גיל',checklist:{}}],
  intake_assignments: [{id:'i1',plate:'12345678',brand:'יונדאי',model:'i10',status:'done',assignedTo:'גיל',checklist:{}}],
  intake_archive: [{id:'ia1',plate:'11111111',status:'checked',assignedTo:'גיל',checklist:{}}],
  bodyshop_jobs: [{id:'j1',plate:'54283203',maker:'יונדאי',desc:'ELANTRA',status:'draft',items:[{name:'פגוש',price:500}]},
                  {id:'j2',plate:'33045503',maker:'צ׳רי',desc:'TIGGO',status:'at_shop',sentAt:'2026-08-28T08:00:00Z',items:[{name:'גג'}]},
                  {id:'j3',plate:'66672501',maker:'אאודי',desc:'A3',status:'returned',returnedAt:'2026-08-30T08:00:00Z',items:[{name:'סף',price:300}]}],
  bodyshop_archive: [{id:'a1',title:'עד 1.9.2026',paidAt:'2026-09-01T08:00:00Z',total:48000,cars:[{plate:'5724285',desc:'קיה',total:1500}]}],
  bodyshop_trips: [{id:'tr1',plate:'12345678',desc:'פגוש',driver:'גיל',jobId:'j1',at:'2026-08-20T09:00:00Z'}],
  battery_stock: [{id:'s1',model:'42 אמפר יפני',sku:'641/1',qty:2},{id:'s2',model:'40 אמפר',sku:'643/1',qty:1}],
  battery_audits: [], battery_installs: [],
  pickup_cars: [{id:'p1',plate:'99887766',city:'חיפה',address:'דרך יפו 157',yard:'חיפה|דרך יפו 157'}],
  pickup_archive: [], parts: [{id:'pt1',plate:'12345678',name:'מראה',status:'pending'}],
  inventory_assignments: [{id:'inv1',assignedTo:'גיל',status:'pending',headers:['רישוי','דגם'],rowsJson:JSON.stringify([['12345678','i10']])}],
  charging_tasks: [], pit_checks: [], test_drives: [], refreshes: [], task_requests: [],
  driver_notifications: [], battery_assignments: [], users: [], plate_cache: [],
};

const stub = `
const DATA = ${JSON.stringify(DATA)};
window.__live = 0; window.__opened = 0;      // חיבורים חיים / כמה נפתחו בסך הכל
const mk = a => ({ id:a.id, data:()=>a, exists:()=>true });
const empty = {docs:[],empty:true,size:0,exists:()=>false,data:()=>({}),forEach:()=>{},docChanges:()=>[]};
const mkSnap = arr => ({docs:arr.map(mk),empty:!arr.length,size:arr.length,exists:()=>!!arr.length,
  data:()=>(arr[0]||{}),forEach:f=>arr.map(mk).forEach(f),docChanges:()=>arr.map(a=>({type:'added',doc:mk(a)}))});
const pick = n => { for (const k in DATA) if (String(n).includes(k)) return DATA[k]; return null; };
export const initializeApp=()=>({});export const getFirestore=()=>({});export const getStorage=()=>({});
export const getAuth=()=>({currentUser:{uid:'u1',isAnonymous:false}});
export const collection=(db,n)=>({_n:n});
export const doc=(db,c,id)=>({_c:c,_id:id,_n:c});
export const query=(r)=>r; export const where=()=>({}); export const orderBy=()=>({}); export const limit=()=>({});
export const onSnapshot=(q,cb,err)=>{
  const n=String(q&&(q._n||q._c)||''); const arr=pick(n);
  window.__live++; window.__opened++;
  setTimeout(()=>{ try{ cb(arr?mkSnap(arr):empty); }catch(e){ console.error('SNAPCB',n,e&&e.message); } },30);
  return ()=>{ window.__live--; };
};
export const getDocs=async(q)=>{const arr=pick(String(q&&(q._n||q._c)||''));return arr?mkSnap(arr):empty;};
export const getDoc=async(r)=>{const arr=pick(String(r&&(r._c||r._n)||''));
  return arr&&arr.length?{exists:()=>true,data:()=>arr[0],id:arr[0].id}:empty;};
export const addDoc=async(r,d)=>{(window.__w=window.__w||[]).push(['add',r._n,d]);return{id:'new'}};
export const setDoc=async(r,d)=>{(window.__w=window.__w||[]).push(['set',r._c,r._id,d]);};
export const updateDoc=async(r,d)=>{(window.__w=window.__w||[]).push(['upd',r._c,r._id,d]);};
export const deleteDoc=async(r)=>{(window.__w=window.__w||[]).push(['del',r._c,r._id]);};
export const serverTimestamp=()=>({_ts:1});
export const ref=()=>({});export const uploadBytes=async()=>({});export const getDownloadURL=async()=>'';
export const signInAnonymously=async()=>({});
export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb({uid:'u1',isAnonymous:false,displayName:''}),10);return ()=>{}};
`;

const norm = t => String(t||'').replace(/\d{1,2}[:.]\d{2}(:\d{2})?/g,'<שעה>')
  .replace(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/g,'<תאריך>').replace(/\s+/g,' ').trim().slice(0,600);

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const report = {};

async function role(who, width) {
  const p = await b.newPage({ viewport:{width,height:900} });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: '+String(e).split('\n')[0]));
  p.on('console', m => { const t=m.text();
    if (m.type()==='error' && !/ERR_|Failed to load resource|net::/.test(t)) errs.push('CONSOLE: '+t.slice(0,160)); });
  p.on('dialog', d => d.dismiss().catch(()=>{}));
  await p.route('**/www.gstatic.com/**', r => r.fulfill({status:200,contentType:'application/javascript',body:stub}));
  await p.route('**/cdn*/**', r => r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await p.route('**/cloudfunctions.net/**', r => r.fulfill({status:200,contentType:'application/json',body:'{"result":{"records":[]}}'}));
  await p.goto('http://localhost:8903/ops/index.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1600);
  await p.evaluate(w => window.switchToUser(w), who);
  await p.waitForTimeout(1200);

  const key = who+'@'+width;
  const r = report[key] = { screens:{}, listeners:{}, errors:[] };
  r.listeners.afterLogin = await p.evaluate(()=>({live:window.__live,opened:window.__opened}));

  for (const s of SCREENS) {
    try {
      await p.evaluate(n => { try { goToScreen(n); } catch(e) { showScreen && showScreen(n); } }, s);
      await p.waitForTimeout(320);
      r.screens[s] = await p.evaluate(n => {
        const el = document.getElementById('screen-'+n);
        return { present: !!el, visible: el ? el.classList.contains('active') : false,
                 text: el ? el.innerText : '' };
      }, s);
      r.screens[s].text = norm(r.screens[s].text);
    } catch (e) { r.screens[s] = { error:String(e).slice(0,120) }; }
  }
  r.listeners.afterScreens = await p.evaluate(()=>({live:window.__live,opened:window.__opened}));

  // חמש חזרות למסך הבית — כאן נערמים החיבורים
  for (let i=0;i<5;i++){ await p.evaluate(()=>goToScreen('home')); await p.waitForTimeout(260); }
  r.listeners.after5Home = await p.evaluate(()=>({live:window.__live,opened:window.__opened}));

  // שלוש החלפות משתמש
  for (const w of ['גיל','ליאל','עופר']) { await p.evaluate(x=>window.switchToUser(x), w); await p.waitForTimeout(500); }
  r.listeners.after3Switch = await p.evaluate(()=>({live:window.__live,opened:window.__opened}));

  r.errors = [...new Set(errs)];
  await p.close();
}

for (const [who,w] of [['ליאל',1280],['ליאל',390],['גיל',390],['עופר',390],['משה',390],['איברהים',390]]) {
  await role(who,w);
}
await b.close();
writeFileSync(OUT, JSON.stringify(report,null,1));
console.log('נשמר:', OUT);
for (const k of Object.keys(report)) {
  const r = report[k];
  console.log(k, '| חיבורים:', JSON.stringify(r.listeners), '| שגיאות:', r.errors.length);
}
