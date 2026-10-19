# Ibrahim worker screen: photo header + original menu navigation

The user explicitly approved changing Ibrahim's screen, overriding the older instruction to leave him unchanged, but limited the work: keep the existing note boxes, their dimensions and their row/column counts exactly as they are. Choose the LEFT proposal with menu navigation and the newly supplied four-person event photo. `תיישם` explicitly includes GitHub upload authorization for relevant code and images in this conversation.

This patch adds ONLY the worker-screen header, a full-width team photo banner and caption, and styling for the existing menu. All three existing sections remain reachable through the original button and handlers: רכבים שבעבודה / מכוניות שסיימנו / תשלומים שקיבלת. There is no visible tab row. The original menu's aria-label and click handler remain; aria-expanded mirrors menu visibility; Escape closes via the existing function. The new header applies only to role bodyshop. Manager impersonation keeps the existing return button.

No changes to card markup, card styles, grid rules, counts, dimensions, order, status filters, scroll containers, financial totals, payment folders, notes or business functions. In particular, the stacked cards from the mockup are NOT implemented. This preserves whatever card geometry the current app already has at each viewport.

Original photo copied unchanged as team-original.jpg; CSS crops empty space while retaining all four faces. No generated preview image or generated faces are used.

## Claude integration before release

Add `<script src="js/ui2-ibrahim-menu.js?v=NNN"></script>` after current presentation scripts in ops/index.html, bump sw.js version/CACHE and all index version queries together. The script loads its own CSS with the same version. Existing full application sources are not uploaded here due prior source-egress review restrictions. Keep this PR draft until integration and actual browser/device review.

Verify 360/390/768/900/901/1280px: new photo spans the entire row, all four faces visible; menu opens, outside click closes, all three original views work, Escape and keyboard focus, payment totals and note forms unchanged, return-to-manager button. Compare card bounding boxes, computed grid tracks, row/column counts and scroll behavior before/after for identical data in all three views, not only appearance. No new grid/card/wrapper CSS is included. Capture screenshots before/after. Browser/device visual QA not yet performed.
