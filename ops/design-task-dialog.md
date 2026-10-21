# Task creation — flat column picker (approved design)

UI-only implementation for the latest approved task-creation proposal. Target: Claude integration branch. No changes to the four task-board tabs, task editing, worker requests or Ibrahim.

## Integration required before release

1. Add `<script src="js/ui2-task-dialog.js?v=649"></script>` after the other UI presentation scripts in `ops/index.html`. Use the next available release number if 649 is already taken. The script loads its version-matched CSS itself.
2. Bump every asset `?v=` in `ops/index.html` and both the first-line version and CACHE in `ops/sw.js`, per the repository release rules. Neither file is included in this asset-only handoff; this PR is not live until wired and released.
3. Run the demo and verify at 320/390/430/900/1280px, then release through the normal approved Claude workflow.

## What changes

- Forest-green heading, pale sage form, muted-gold original submit button.
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
- Long labels, 200% zoom, keyboard and phone keyboard: no horizontal overflow, all controls reachable by vertical scroll.
- Other task dialogs, task-board tabs, permissions and all other users/screens unchanged.
