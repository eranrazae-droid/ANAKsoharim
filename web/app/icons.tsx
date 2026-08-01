/**
 * האייקונים של האתר.
 *
 * עד עכשיו הם היו תווים מיוחדים בתוך הטקסט — ☎ ⌖ ✓ ← וכדומה.
 * שני חסרונות היו לזה: כל תו כזה גרר הורדה של 14KB גופן נוסף
 * בכל כניסה לאתר, וכל מכשיר צייר אותם קצת אחרת — באייפון ☎
 * יוצא אמוג׳י צבעוני ובאנדרואיד סמל שחור.
 *
 * כאן הם ציורים. הם נכנסים ישירות ל-HTML ולכן לא מוסיפים אף
 * בקשת רשת, הם חדים בכל גודל, ונראים אותו דבר בכל מכשיר.
 *
 * currentColor אומר לציור לקבל את צבע הטקסט שסביבו, כך שכל
 * כלל צבע קיים ממשיך לעבוד בלי שינוי.
 */

type Props = { className?: string; size?: number };

function Svg({ children, size = 16, className }: Props & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** טלפון */
export const PhoneIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  </Svg>
);

/** סיכת מיקום */
export const PinIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Svg>
);

/** וי — סימון פריט ברשימה */
export const CheckIcon = (p: Props) => (
  <Svg {...p}>
    <path d="m20 6-11 11-5-5" />
  </Svg>
);

/** חץ לכיוון תחילת הקריאה. ב-RTL הוא מצביע ימינה. */
export const BackIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </Svg>
);

/** חץ לכיוון המשך הקריאה */
export const NextIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Svg>
);

/** סגירה */
export const CloseIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
);

/** תפריט */
export const MenuIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </Svg>
);

/** תצוגת טבלה */
export const TableIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18" />
    <path d="M3 15h18" />
  </Svg>
);

/** תצוגת גלריה */
export const GridIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </Svg>
);

/** עיפרון — השארת פרטים */
export const PencilIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </Svg>
);

/** הפעלת סרטון */
export const PlayIcon = ({ size = 26, className }: Props) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <path d="M8 5.5v13l11-6.5Z" fill="currentColor" />
  </svg>
);

/** משולש מיון — למעלה או למטה */
export const SortIcon = ({ up, size = 11, className }: Props & { up?: boolean }) => (
  <svg className={className} viewBox="0 0 12 8" width={size} height={size * 0.7} aria-hidden="true" focusable="false">
    <path d={up ? "M6 0 12 8H0Z" : "M6 8 0 0h12Z"} fill="currentColor" />
  </svg>
);

/** פלוס ומינוס — פתיחת שורה בטבלה וסגירתה */
export const PlusMinusIcon = ({ open, size = 14, className }: Props & { open?: boolean }) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false"
       fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
    <path d="M5 12h14" />
    {!open && <path d="M12 5v14" />}
  </svg>
);

/** רכב — סמל "מגוון ענק" */
export const CarIcon = ({ size = 26, className }: Props) => (
  <Svg {...{ size, className }}>
    <path d="M5 17h14M4 17v-4l2-5h12l2 5v4" />
    <circle cx="7.5" cy="17.5" r="1.6" />
    <circle cx="16.5" cy="17.5" r="1.6" />
  </Svg>
);

/** כוכב — סמל "שירות ואמינות" */
export const StarIcon = ({ size = 26, className }: Props) => (
  <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9Z" fill="currentColor" />
  </svg>
);
