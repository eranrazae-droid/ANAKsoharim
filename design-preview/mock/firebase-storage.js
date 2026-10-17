/* סביבת הדגמה: אחסון קבצים מדומה — הקבצים נשארים בדפדפן בלבד */
const files = new Map();
export const getStorage = () => ({ demo: true });
export const ref = (s, path = '') => ({ fullPath: path, name: path.split('/').pop(), bucket: 'demo' });
export async function uploadBytes(r, data) { files.set(r.fullPath, URL.createObjectURL(data instanceof Blob ? data : new Blob([data]))); console.info('[demo] upload ' + r.fullPath + ' (בזיכרון בלבד)'); return { ref: r, metadata: { fullPath: r.fullPath } }; }
export function uploadBytesResumable(r, data) { const p = uploadBytes(r, data); return { on: (ev, prog, err, done) => { p.then(() => { prog && prog({ bytesTransferred: 1, totalBytes: 1 }); done && done(); }, err); }, then: (a, b) => p.then(a, b), snapshot: { ref: r } }; }
export async function uploadString(r, s) { files.set(r.fullPath, s.startsWith('data:') ? s : 'data:text/plain,' + encodeURIComponent(s)); return { ref: r }; }
export async function getDownloadURL(r) { return files.get(r.fullPath) || '/ops/img/ui2/mod-intake.jpg'; }
export async function deleteObject(r) { files.delete(r.fullPath); }
export async function listAll() { return { items: [], prefixes: [] }; }
