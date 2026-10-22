# Separate unfinished cars from manager-completed cars on desktop

In the manager's “אצל הפחח” view, white and blue cards previously shared the same grid row. The desktop presentation now puts unfinished vehicles first beneath “עדיין בעבודה” and blue, manager-marked vehicles beneath “סיימנו — עדיין אצל הפחח”. Each heading has a count; the blue group starts a new full-width section and therefore a fresh card row.

Grouping uses the existing `mgrDone` marker only within the existing open list. It preserves each group's original order, card nodes/actions and the separate returned/payment tab. This is a presentation change: it neither changes status nor marks jobs completed in the database. Phone rows and Ibrahim remain as before.

The original five-column grid remains. Headings consume their own compact rows; fitting subtracts their measured height so normal desktop windows retain two readable card rows. Extra rows remain scrollable. Partly filled groups may leave unused cells at their boundary because the next state deliberately begins a fresh row.

## Release

`bodyshop-design.js` and `bodyshop-design.css` are already wired. No new script or stylesheet tag is needed. Claude should bump all index asset versions and the first line/CACHE in `ops/sw.js` to the next free release (652 if unused), then publish through the existing workflow.

## Validation

Node syntax and whitespace checks. Review mixed/all-working/all-marked/empty lists and moving a vehicle between groups through the existing buttons; compare counts, IDs and ordering, then check 901/1280/1700px and short windows. Browser screenshot QA is pending in this environment. At 390px ensure the existing five phone rows remain; returned, drafts, payments and worker cards should be unchanged.
