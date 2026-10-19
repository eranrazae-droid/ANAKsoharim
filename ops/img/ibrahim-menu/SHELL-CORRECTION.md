# Finish Ibrahim's shell, recolor existing boxes only

The previous PR intentionally avoided even color tokens in the job area, and retained the original header logo/title styling. That left the new photo/menu next to the legacy shell and card palette. The user now explicitly requests the surroundings to match the LEFT menu-based mockup, with ONLY the new palette inside the original boxes.

This correction scopes forest green/sage/white/gold tokens to `#screen-bodyshop.u2iw-enabled`; inline `var(...)` colors on existing notes, metadata, money and payment folders now inherit this palette. No per-card/grid/wrapper dimensions, font metrics, padding, gaps, tracks, counts, child order, form data, status or sorting change. Explicit warning colors remain. All box DOM is unchanged.

Header: white פחחות title with איברהים below, green surface without the old black shadow. Legacy painter image remains hidden. Original logo artwork is visually suppressed; its original hold target and handlers stay positioned over the title, preserving that action. The original menu buttons/actions are retained; decorative emoji removed from their labels while this shell is active and restored when leaving the role. No visible tab row. Existing full-width ORIGINAL photo and עובדים יחד caption stay unchanged. Section headings use the mockup's dark green typography. Shell sizing can change above the grid; individual boxes/tracks remain identical.

## Claude release and acceptance

This is an update to the ALREADY WIRED `ui2-ibrahim-menu.js` and its stylesheet, not a second overlay or another entry point. Do not add the script twice. No image replacement needed. Update release versions in sw.js/index.html together. These release-only full source files are left to Claude because of the existing connector source-egress restriction.

Do not mix in manager `bodyshop-design.css`, stacked mockup rows, 5x2 manager grids, or earlier worker headers. Use this one worker shell stylesheet. Keep all existing worker job/payment logic and original box markup.

Before releasing: compare the selected LEFT mockup for header/photo/menu/caption/background only. At 360/390/768/900/901/1280, verify all three menus, photos of all four people, white header title/name, sage surround and recolored boxes. With identical jobs assert the same box width/height, column tracks/gaps, row count/order, card padding/font metrics before vs after; only colors should differ inside boxes. Top offset can change with the new shell. Test long-press logo action over title, original menu outside-click, Escape, profile switch and return to manager. Capture actual screenshots. Browser visual QA is not claimed by this patch.
