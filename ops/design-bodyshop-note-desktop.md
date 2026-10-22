# Desktop manager vehicle-parts note

The reported screenshot is `modal-bshop-fill` (grouped vehicle parts, add part, total and print), not `modal-task`. PR #33 already shipped task creation as v650; it did not style this other dialog.

This change adds scoped desktop styles to the existing, already loaded `ops/css/ui2-operations.css`. The manager sees a centered 780px note, forest-green sticky heading, pale sage background, grouped white parts panel with compact rows, quiet red remove controls, muted-gold add button, highlighted total and green print button.

Activation is the existing `body.ui2.u2-operations-layout` manager gate at widths >=901px. No extra script tag is needed. The CSS does not change `display` on price, print or completion controls. It keeps the manager's read-only prices, original group order, IDs, handlers and printing behavior. Ibrahim's worker view is outside this gate. Remove the scope class to restore the original styling.

## Claude release

Release the updated existing stylesheet with the next free version (651 if unused). Bump every asset `?v=` in `ops/index.html` and the first line and CACHE in `ops/sw.js`. The operations loader uses its script's version when loading CSS. The PR is the stylesheet update; version publication remains the release step.

## Validation

Static selector review, CSS delimiter check and git diff whitespace check; no business JS or data changes. Real-browser screenshot comparison is pending because the local browser executable is unavailable; the source screenshot was inspected to identify the correct modal.

Check the manager at 901/1280/1440px: open the note, scroll long parts lists, remove and add a part, observe totals, close and reopen, and print the note. Confirm prices remain read-only for the manager, hidden for staff without money access, and the worker's input/save workflow and 390px phone view stay unchanged. The existing operations gate is manager-only; do not broaden it to workers during integration.
