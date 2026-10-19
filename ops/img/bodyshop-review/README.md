# Manager bodywork — v631

Approved direction: original team photo and gold/ivory cards on desktop;
five columns, two fully visible rows (10 cars), additional cars scroll inside
the list. Mobile retains rows: five visible, additional rows scroll. Bottom
navigation is RTL: send / at shop / finished / add. More/actions remain
accessible from the header. Payment controls remain below the scrolling list.

## Implementation boundary

- New class `.bsm-design` on the manager screen is the rollback switch.
- No business module under `ops/js/app/` changed; no database/network writes
  are added. All forms, IDs, permissions and original renderers remain.
- Desktop action nodes come from the actual `_bshopJobCard(job, false)`
  renderer, including the exact original inline handlers and role-aware prices.
- Mobile rows open the existing `bsmMOpen` detail sheet, not a replacement form.
- Only the displayed order changes: draft oldest creation first, shop longest
  waiting first, finished most recent `returnedAt` first. No source array mutation.
- Original photo is copied unchanged; no generated/redrawn faces are shipped.
- Worker screen (`screen-bodyshop`), worker renderer and app are untouched.
- On exceptionally short/zoomed viewports, readable controls take priority:
  normal page scrolling remains available rather than hiding content.

## Local verification

Built using the repository's `design-preview/build.sh`, with its mock Firebase
and network guard. Browser automation additionally blocked external HTTPS.
Screenshots use illustrative mock data only (not live cars). Demo photo
placeholders do not correspond to the sample plate/model text.

`results.json`: Chromium tests, all three stages at 1440x900, 1366x768,
1280x720, 1920x1080, 901x900, 900x900, 768x1024, 390x844, 360x740, 320x568:

- Desktop: 5 columns and exactly 10 fully visible cards.
- Mobile: exactly 5 fully visible rows; fifth row not covered by another control.
- Extra items scroll; exactly-capacity lists do not scroll.
- No card content overflow or page horizontal overflow.
- Original desktop button handlers match; send opens original driver picker.
- Mobile row opens original detail sheet; plus opens original create modal;
  More opens original action menu; list scroll position survives re-render.
- Oldest-first waiting and newest-first finished ordering checked.
- No page JavaScript errors in this demo run.

Before/after screenshots are adjacent; desktop/mobile after captures cover
draft, shop and finished. Before is the same mock dataset with `.bsm-design`
removed (the original UI). Screenshots were visually reviewed.

## Recommended review before merge

Ask Claude to run the existing review/demo workflow (do not add the preview
label automatically). Check on a real desktop and iPhone with real fonts:

1. 10 cards visible without page scrolling, then reach the 11th card by list scroll.
2. Five mobile rows visible and sixth accessible; all four bottom controls work.
3. Send -> driver choice; freeze, delete, print/share, estimate, finish, software
   update, payment and archive behave exactly as before. No real writes were
   performed by automated tests.
4. Check role without price permission, unknown/missing dates, no photo, long
   notes, warnings, empty lists, and live updates while a detail sheet is open.
5. Confirm Ibrahim's separate app and screen are visually unchanged.
6. Review original team photo privacy before merge/publication.

No merge or production deployment was performed by this change.
