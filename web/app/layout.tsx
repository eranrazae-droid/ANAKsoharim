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
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  // כל עוד האתר בהכנה — חסימה מפורשת של כל מנועי החיפוש.
  robots: IS_LIVE
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
};

const businessSchema = {
  "@context": "https://schema.org",
  "@type": "AutoDealer",
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
      </body>
    </html>
  );
}
