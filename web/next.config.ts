import type { NextConfig } from "next";

/**
 * הפניות 301 מהאתר הישן.
 *
 * הן יושבות כאן ולא ב-vercel.json כדי שיעבדו בכל סביבה — גם
 * מקומית וגם אם נעבור אי פעם מ-Vercel — ושאפשר יהיה לבדוק אותן.
 * כתובת בעברית מופיעה פעמיים: פעם בטקסט ופעם בקידוד, כי האתר
 * הישן הגיש את שניהם.
 *
 * הכללים הכלליים בסוף הרשימה — הסדר קובע, הראשון שמתאים מנצח.
 *
 * 301 ולא 308: שניהם "הפניה קבועה" ושווים בעיני גוגל, אבל 301 הוא
 * הסטנדרט שכל סורק ותיק מכיר, וזה מעבר מאתר בן חמש עשרה שנה.
 *
 * תיקיות התמונות הישנות אינן מופנות בכוונה — הפניית תמונה לדף הבית
 * נחשבת אצל גוגל "404 רך", ועדיף שהן פשוט יחזירו 404.
 */
const LEGACY_REDIRECTS = [
  { source: "/טרייד-אין.asp", destination: "/trade", statusCode: 301 },
  { source: "/%D7%98%D7%A8%D7%99%D7%99%D7%93-%D7%90%D7%99%D7%9F.asp", destination: "/trade", statusCode: 301 },
  { source: "/תנאי-מימון.asp", destination: "/finance", statusCode: 301 },
  { source: "/%D7%AA%D7%A0%D7%90%D7%99-%D7%9E%D7%99%D7%9E%D7%95%D7%9F.asp", destination: "/finance", statusCode: 301 },
  { source: "/קונה-רכבים-לנסיעה.asp", destination: "/sell", statusCode: 301 },
  { source: "/%D7%A7%D7%95%D7%A0%D7%94-%D7%A8%D7%9B%D7%91%D7%99%D7%9D-%D7%9C%D7%A0%D7%A1%D7%99%D7%A2%D7%94.asp", destination: "/sell", statusCode: 301 },
  { source: "/מכירת-רכב-יד-שניה.asp", destination: "/sell", statusCode: 301 },
  { source: "/%EE%EB%E9%F8%FA-%F8%EB%E1-%E9%E3-%F9%F0%E9%E4.asp", destination: "/sell", statusCode: 301 },
  { source: "/מגרשי-מכוניות.asp", destination: "/cars", statusCode: 301 },
  { source: "/%D7%9E%D7%92%D7%A8%D7%A9%D7%99-%D7%9E%D7%9B%D7%95%D7%A0%D7%99%D7%95%D7%AA.asp", destination: "/cars", statusCode: 301 },
  { source: "/רכבים-ראשון-לציון.asp", destination: "/cars", statusCode: 301 },
  { source: "/%D7%A8%D7%9B%D7%91%D7%99%D7%9D-%D7%A8%D7%90%D7%A9%D7%95%D7%9F-%D7%9C%D7%A6%D7%99%D7%95%D7%9F.asp", destination: "/cars", statusCode: 301 },
  { source: "/לקוחות-ממליצים.asp", destination: "/reviews", statusCode: 301 },
  { source: "/%D7%9C%D7%A7%D7%95%D7%97%D7%95%D7%AA-%D7%9E%D7%9E%D7%9C%D7%99%D7%A6%D7%99%D7%9D.asp", destination: "/reviews", statusCode: 301 },
  { source: "/cars.asp", destination: "/cars", statusCode: 301 },
  { source: "/cars2.asp", destination: "/cars", statusCode: 301 },
  { source: "/articles.asp", destination: "/articles", statusCode: 301 },
  { source: "/index.asp", destination: "/", statusCode: 301 },
  { source: "/default.asp", destination: "/", statusCode: 301 },
  { source: "/home.asp", destination: "/", statusCode: 301 },
  { source: "/main.asp", destination: "/", statusCode: 301 },
  { source: "/contact.asp", destination: "/contact", statusCode: 301 },
  { source: "/about.asp", destination: "/", statusCode: 301 },
  { source: "/finance.asp", destination: "/finance", statusCode: 301 },
  { source: "/trade.asp", destination: "/trade", statusCode: 301 },
  { source: "/sell.asp", destination: "/sell", statusCode: 301 },
  { source: "/car.asp", destination: "/cars", statusCode: 301 },
  { source: "/car2.asp", destination: "/cars", statusCode: 301 },
  { source: "/carinfo.asp", destination: "/cars", statusCode: 301 },
  { source: "/details.asp", destination: "/cars", statusCode: 301 },
  { source: "/showcar.asp", destination: "/cars", statusCode: 301 },
  { source: "/:path*.asp", destination: "/", statusCode: 301 },
  { source: "/:path*.ASP", destination: "/", statusCode: 301 },
  { source: "/:path*.Asp", destination: "/", statusCode: 301 },
  { source: "/:path*.html", destination: "/", statusCode: 301 },
  { source: "/:path*.htm", destination: "/", statusCode: 301 },
];

const nextConfig: NextConfig = {
  async redirects() {
    return LEGACY_REDIRECTS;
  },
};

export default nextConfig;
