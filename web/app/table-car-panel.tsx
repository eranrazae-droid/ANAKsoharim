"use client";

import { type DisplayCar } from "./vehicle-types";
import { DEMO_IMAGE } from "./site-config";
import CardGallery from "./card-gallery";
import { CarContactStrip, CarFacts, carName } from "./car-details";

/**
 * כרטיס הרכב שנפתח בתוך טבלת המלאי.
 *
 * לחיצה על הפלוס שליד מספר השורה פותחת כאן את כל מה שיש על
 * הרכב: תצלומים שאפשר לגלול ביניהם, כל הנתונים, ורצועת פנייה
 * שהרכב כבר רשום בה. כך הגולש רואה הכול בלי לצאת מהטבלה
 * ובלי לאבד את מקומו ברשימה.
 *
 * הנתונים ורצועת הפנייה מגיעים מ-car-details, ומוצגים באותה
 * צורה בדיוק גם בעמוד הרכב מתחת לתמונות.
 */

const MAX_SLIDES = 5;
const DEMO_SLIDES = [
  DEMO_IMAGE,
  ...Array.from({ length: MAX_SLIDES - 1 }, (_, i) => `/placeholders/car-${i + 2}.svg`),
];

export default function TableCarPanel({ car }: { car: DisplayCar }) {
  const real = car.images?.length ? car.images.slice(0, MAX_SLIDES) : car.image ? [car.image] : [];
  const slides = real.length ? real : DEMO_SLIDES;

  return (
    <div className="carPanel">
      <div className="panelMedia">
        <div className={`panelSlides ${real.length ? "" : "panelSlidesDemo"}`}>
          <CardGallery images={slides} alt={`${carName(car)} שנת ${car.year}`} />
          {!real.length && <span className="panelDemoTag">להמחשה</span>}
        </div>
        <a className="panelAllMedia" href={`/car/${car.id}`}>
          לצפייה בתמונות <bdi>360°</bdi> ובסרטון
        </a>
      </div>

      <div className="panelBody">
        <CarFacts car={car} inTable />
      </div>

      <CarContactStrip car={car} />
    </div>
  );
}
