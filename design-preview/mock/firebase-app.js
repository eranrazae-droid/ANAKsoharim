/* סביבת הדגמה: אפליקציית Firebase מדומה */
export const initializeApp = (cfg) => ({ name: '[DEFAULT]', options: { ...cfg }, demo: true });
export const getApp = () => ({ name: '[DEFAULT]', demo: true });
export const getApps = () => [];
