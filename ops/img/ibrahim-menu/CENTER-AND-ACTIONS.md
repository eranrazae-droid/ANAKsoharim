# Centered team banner, labels and worker note buttons

User approved all changes and GitHub upload. Based on screenshots, the header title was centered only in the leftover flex area, people occupied the left of the photo, and note-dialog buttons still inherited global yellow/bright-green because the modal lives outside the screen.

Changes:
- The header has balanced side columns, so פחחות / איברהים align to the viewport center, independent of menu width. Original return-to-manager control remains.
- The new team-centered.jpg is an imagegen background-extension edit requested by the user, based on the supplied event photo. Four people are centered with event scenery extended to the sides. JPEG is a web export of the generated panorama. The original photo stays in the repository. The panorama renders full width at its native aspect ratio, without desktop-specific cropping, so the centered group remains centered and all heads remain visible.
- Caption: עובדים יחד 🤝. Section headings centered; note/card typography and geometry unchanged.
- Original menu buttons now say 🔨 רכבים שבעבודה / ✅ מכוניות שסיימנו / 💳 תשלומים שקיבלת. Same handlers and view switching; labels restored outside worker role.
- Only the worker's existing modal-bshop-fill gets u2iw-dialog. Its add-part action uses muted gold (#c4a463/#d5bd83), finish action uses the app's forest green (#285640/#347456), total uses readable gold. Existing sizes, layout, onclick, autosave and finish behavior unchanged. The class is removed on role changes, leaving manager dialogs unaffected.

## Release and visual QA for Claude

Update the existing ui2-ibrahim-menu.js/css files, keep their existing single entry-point wiring, and bump all release versions in index.html/sw.js together. No second overlay or duplicate script. Do not overwrite the worker grid or manager bodyshop design.

Check 320/360/390/768/900/901/1280: title/photo/caption/section heading centers; full-width photo, all four heads visible; menu emoji and original actions, return control and logo hold action. Open a worker note and compare gold/green actions with the supplied screenshot; verify input, add-part, autosave and finish behavior. Switch to manager with the modal open and verify original styles return. Compare original box metrics/counts before/after. Capture actual screenshots before release. Actual browser/device visual QA remains pending; do not claim screenshot comparison already completed.
