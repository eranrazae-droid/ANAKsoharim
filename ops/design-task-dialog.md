# Task creation — approved phone and desktop designs

UI-only implementation for the latest approved task-creation proposal. Target: Claude integration branch. No changes to the four task-board tabs, task editing, worker requests or Ibrahim.

## Integration required before release

1. The script is already wired in release v649. Keep its single existing script tag; do not load it twice. The script loads its version-matched CSS itself.
2. Release this desktop update with the next available version (650 if unused): bump every asset `?v=` in `ops/index.html` and both the first-line version and CACHE in `ops/sw.js`, per the repository release rules. Neither file is included in this asset-only handoff; the desktop update is not live until versioned and released.
3. Run the demo and verify at 320/390/430/900/1280px, then release through the normal approved Claude workflow.

## What changes

- Forest-green heading, pale sage form, muted-gold original submit button.
- At 901px and above: centered 780px-wide desktop dialog; task details on the right, all column choices on the left, selected-column summary and gold save button below. The first two long choices span the full selector width; all other choices use three columns.
- Desktop multiline editor synchronizes with the original `task-title` field, including its existing reset on each new task. Phone editing and switching between phone/desktop widths use the same value. City, color and optional-link fields form the right-hand column.
- At 900px and below: existing single-column mobile layout and option grid retained through display:contents wrappers; there is no duplicated task form or submission action.
- All existing select options appear together in one compact, ungrouped radio-button grid. No category tabs. Options are derived from the original select, not a separate hard-coded list.
- Selection updates the original `task-label` value. The existing `submitTask()` button, field IDs, city autocomplete and color controls remain intact.
- Link input starts collapsed when empty. “הוסף קישור” reveals it and focuses the original `task-link`; collapsing preserves the typed value. Reopening a new task reflects the original form resets.
- Keyboard arrows (RTL), Home/End, checked state, focus indicators and selected-column summary.
- No pretend photo upload: the approved visual mock showed an image action, but the actual manager form has no corresponding upload workflow. This PR does not invent one or change business logic.

Files: `ops/js/ui2-task-dialog.js`, `ops/css/ui2-task-dialog.css`, this handoff.

## Verification / limitations

Node syntax check, DOM-mock interaction checks and `git diff --check`. No production writes or real tasks created. Browser/device rendering has not been verified in this environment; before/after screenshots must be captured from the demo during integration.

Manual acceptance:

- Open “משימה חדשה”: all 12 current column names visible together; general selected by the original form initializer.
- Select every column and confirm exactly one selected; saved label comes from the original select.
- Show link, type URL, hide and reveal: URL remains. Native URL validation/normalization unchanged.
- Close, open another new task: no stale column/link selection after the existing initializer resets values.
- City suggestions, color picker, original close, missing-title handling, save busy state and retry behavior unchanged.
- Resize 900 ↔ 901px with text and link filled: values must remain. Test a long multiline desktop title, opening a second new task, and all 12 choices on desktop.
- Long labels, 200% zoom, keyboard and phone keyboard: no horizontal overflow, all controls reachable by vertical scroll.
- Other task dialogs, task-board tabs, permissions and all other users/screens unchanged.
