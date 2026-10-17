/* סביבת הדגמה: פונקציות שרת חסומות */
export const getFunctions = () => ({ demo: true });
export const httpsCallable = (f, name) => async () => { console.info('[demo] blocked function ' + name); throw Object.assign(new Error('חסום בסביבת ההדגמה'), { code: 'functions/unavailable' }); };
