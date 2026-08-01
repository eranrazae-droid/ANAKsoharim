import type { Metadata } from "next";
import { Geist, Geist_Mono, Heebo } from "next/font/google";
import "./globals.css";
import "./detail.css";
import "./brand.css";
import "./trade.css";
import "./inner-pages.css";
import "./finance.css";
import "./monochrome.css";
import "./car-modern.css";
import "./car-listing.css";
import "./results-table.css"; // חייב להיטען לפני שכבת העיצוב, לא בתוך רכיב לקוח
import "./vehicle-list.css";
import "./car-page.css";
import "./account.css";
import "./compare.css";
import "./video.css";
import "./theme-light.css"; // אחרון — ערכת העיצוב הבהירה
import { BUSINESS, IS_LIVE, SITE_NAME, SITE_URL } from "./site-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// הגופן של האתר. נטען כמשתנה CSS ומופעל ב-globals.css דרך --font-hebrew,
// כדי שההגדרה תישאר במקום אחד ולא תדרוס את שאר העיצוב.
const heebo = Heebo({
  variable: "--font-hebrew",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | קנייה, מכירה, מימון וטרייד אין`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "ענק הרכבים ראשון לציון — מעל 150 רכבים במלאי, מימון עד 100% ועד 100 תשלומים, טרייד אין על כל סוגי הרכבים וקניית רכבים במזומן. פועלים משנת 1998.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${SITE_NAME} | קנייה, מכירה, מימון וטרייד אין`,
    description:
      "מעל 150 רכבים במלאי, מימון עד 100%, טרייד אין וקניית רכבים במזומן. דוד רזיאל 4, ראשון לציון.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: SITE_NAME }],
  },
  // כרטיס לשיתוף בטוויטר ובאפליקציות שקוראות אותו
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | קנייה, מכירה, מימון וטרייד אין`,
    description: "מעל 150 רכבים במלאי, מימון עד 100%, טרייד אין וקניית רכבים במזומן.",
    images: ["/og.jpg"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  // כל עוד האתר בהכנה — חסימה מפורשת של כל מנועי החיפוש.
  robots: IS_LIVE
    ? {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
      }
    : { index: false, follow: false, nocache: true },
  // אימות הבעלות מול Search Console. הערך מגיע ממשתנה סביבה.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

/**
 * סכמת האתר. מאפשרת לגוגל להציג את שם האתר בתוצאות ואת תיבת
 * החיפוש הפנימית, ומקשרת בין הדומיין לעסק.
 */
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  alternateName: "ענק הרכבים ראשון לציון",
  url: SITE_URL,
  inLanguage: "he-IL",
  publisher: { "@id": `${SITE_URL}/#business` },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/cars?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

const businessSchema = {
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  "@id": `${SITE_URL}/#business`,
  name: SITE_NAME,
  url: SITE_URL,
  telephone: BUSINESS.phoneIntl,
  foundingDate: BUSINESS.founded,
  image: `${SITE_URL}/assets/logo1.png`,
  logo: `${SITE_URL}/assets/logo1.png`,
  priceRange: "₪₪",
  address: {
    "@type": "PostalAddress",
    streetAddress: BUSINESS.street,
    addressLocality: BUSINESS.city,
    addressCountry: BUSINESS.country,
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: BUSINESS.latitude,
    longitude: BUSINESS.longitude,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
      opens: "08:30",
      closes: "18:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Friday",
      opens: "08:30",
      closes: "13:00",
    },
  ],
  sameAs: [
    "https://www.facebook.com/AnakHarechevim",
    "https://www.instagram.com/anak.arehavim",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${heebo.variable} antialiased`}
      >
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </body>
    </html>
  );
}
