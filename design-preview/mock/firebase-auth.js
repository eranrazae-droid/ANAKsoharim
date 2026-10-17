/* סביבת הדגמה: הזדהות מדומה — אורח אנונימי, בלי שרת */
const user = { uid: 'demo-anon', isAnonymous: true, getIdToken: async () => 'demo-token' };
const A = { currentUser: null, demo: true };
export const getAuth = () => A;
export const browserLocalPersistence = {}, browserSessionPersistence = {}, inMemoryPersistence = {};
export const setPersistence = async () => {};
export function onAuthStateChanged(a, cb) { setTimeout(() => cb(A.currentUser), 10); return () => {}; }
export async function signInAnonymously() { A.currentUser = user; return { user }; }
export async function signInWithEmailAndPassword() { const e = new Error('demo'); e.code = 'auth/operation-not-allowed'; throw e; }
export async function signOut() { A.currentUser = null; }
export async function updatePassword() {}
export async function createUserWithEmailAndPassword() { const e = new Error('demo'); e.code = 'auth/operation-not-allowed'; throw e; }
export const EmailAuthProvider = { credential: () => ({}) };
export async function reauthenticateWithCredential() {}
