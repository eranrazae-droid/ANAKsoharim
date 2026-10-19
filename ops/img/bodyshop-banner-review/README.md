# Correction: full-row bodywork photo banner (v633)

The user rejected PR #27's small framed side photo on both desktop and phone.
This follow-up restores the earlier full-row photo-cover design.

## Mandatory acceptance criteria for Claude

1. Do not shrink the photo into a 130px/260px side thumbnail. The continuous
   photo/green cover must fill **100% of the content row**, above all stage tabs.
2. On desktop, content row means the full working area beside the fixed right
   sidebar (not behind the sidebar). Gold title is over the same cover.
3. On phone, the original photo itself fills the entire banner width. Title
   and existing More/actions button overlay its lower green gradient.
4. Preserve the actual four faces. No AI image generation, stretching or
   image edits: the original repository photo is used unchanged. Desktop uses
   a continuous cover/gradient with a sharp foreground to avoid destroying
   the portrait composition at an extremely wide aspect ratio.
5. Preserve exactly 5 desktop columns and 2 visible rows; 5 mobile rows;
   extra cars scroll inside the list. Existing short/zoomed-screen readability
   fallback remains. No list/action/sort/business changes are part of this fix.
6. Compare screenshots, do not approve based solely on CSS width declarations.
   Confirm all four faces and the title read well on desktop and a real iPhone.

Only CSS, one reversible manager-screen class, and cache references changed.
Remove `.bsd-wide-hero` to get the immediately previous small-side-photo UI.
The worker screen and all business JS are byte-for-byte unchanged.

## Local verification

The repository demo builder was used with mock Firebase and network guard,
plus external HTTPS blocking. No live records or user screenshots were used
as test data. Sample car photos/plates are illustrative placeholders.

30 layout cases: draft/open/done at 1440x900, 1366x768, 1280x720, 1920x1080,
901x900, 900x900, 768x1024, 390x844, 360x740 and 320x568.

Verified: banner equals available content width (within 2 CSS px) everywhere;
phone image equals banner width; original photo cover present; exactly 10
desktop cards / 5 mobile rows fully visible; extra items scroll; capacity-only
lists do not scroll; no horizontal/card overflow; fifth row not covered;
existing send, add, More and detail-sheet handlers work; ordering unchanged;
mobile scroll position survives re-render; no page JavaScript errors.

Before captures show the current small-side-photo UI with `.bsd-wide-hero`
removed. After captures show the full-row banner. Visually inspected both
desktop and phone. Please run the normal Claude review/demo workflow and
provide the live/demo before/after checks before approving deployment.
No automatic preview label, merge or production deployment by this change.
