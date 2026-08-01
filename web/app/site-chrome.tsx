import FloatingActions from "./floating-actions";
import { BUSINESS } from "./site-config";
import SocialLinks from "./social-links";
import { Logo } from "./site-image";
import SiteNav from "./site-nav";

export function SiteHeader() {
  return <><SiteNav links={<><a href="/">דף הבית</a><a href="/cars">מלאי עדכני</a><a href="/finance">מחשבון מימון</a><a href="/trade">טרייד אין</a><a href="/sell">מכירת רכב</a><a href="/reviews">לקוחות ממליצים</a><a href="/articles">מדריכים</a><a href="/contact">צור קשר</a><a href="/compare">השוואת רכבים</a><a href="/account">האזור האישי</a></>}><a className="logo" href="/"><Logo eager /></a><SocialLinks /><div className="headerActions"><a className="location" href="https://waze.com/ul?ll=31.9888,34.77084&navigate=yes">⌖ דוד רזיאל 4, ראשון לציון</a><a className="phone" href={`tel:${BUSINESS.dial}`}><small>חייגו עכשיו</small><strong>*2369</strong><span>☎</span></a></div></SiteNav></>;
}

export function SiteFooter() {
  return <footer><div className="shell footerGrid"><div><Logo /><p>מכירה, קנייה וטרייד אין לרכבים מאז 1998.</p></div><div><h3>צרו קשר</h3><p>רחוב דוד רזיאל 4, ראשון לציון</p><a href={`tel:${BUSINESS.dial}`}>*2369</a><p>א׳-ה׳ 08:30-18:00 | ו׳ 08:30-13:00</p></div><div><h3>קישורים</h3><a href="/cars">רכבים במלאי</a><a href="/sell">מכירת רכב</a><a href="/finance">מימון</a><a href="/trade">טרייד אין</a><a href="/reviews">לקוחות ממליצים</a><a href="/articles">מדריכים</a><a href="/contact">צור קשר</a></div></div><div className="copyright">© {new Date().getFullYear()} ענק הרכבים. כל הזכויות שמורות.</div><FloatingActions /></footer>;
}
