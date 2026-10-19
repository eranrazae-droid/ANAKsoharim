# Driver yard: focused sketch alongside existing full image

Drivers get two buttons above the yard: סקיצה ממוקדת / תצוגה מקורית. The sketch is the previously approved two-bank sketch, not the later proposal with a narrow column of empty slots. It is the default; the selected layout persists locally. Original mode reveals the untouched existing yard image and its original tap-to-zoom behavior.

The sketch reads `yardData`, `LEFT_SPOTS`, and `RIGHT_ROWS` without database access or writes. Empty consecutive rows collapse to numbered ranges; no slots are discarded. Left slots retain entrance/road lanes (including lane 3 for 30–34), and right slots retain pairs, singles, and the structural gap. TO_PLACE and SOLD entries remain in expandable bands. Text is inserted with textContent, and full raw values appear in the selected-slot detail. No inferred vehicle/plate parsing. Collapsed rows mean no vehicles assigned in the arrangement, not verified physical vacancy.

Only role `driver` gets the addition. Manager editing and Ibrahim are untouched. Existing done control is retained; no new completion action or per-space business state. The sketch is schematic and compresses distances; it is not a measured site plan. All parking identifiers remain represented, although dense arrangements can require vertical scrolling to keep text legible.

Files uploaded in this PR: `ops/js/ui2-yard.js`, `ops/css/ui2-yard.css`, and this review note. The existing mobile entry point is not included.

Validation: both JS files pass node --check and git diff --check. A mocked DOM run covers all 88 identifiers exactly once, compact empty ranges, 30–34 third lane, 68/69 singles, literal untrusted text, extra bands, switching and restoring preference, original list retention, snapshot replacement, no-data state, role changes, and stable repeated synchronization. Browser/device visual QA was unavailable; no before/after screenshots are claimed.

## Claude integration before release

PR remains draft pending integration and actual device review. Add `<script src="js/ui2-yard.js?v=NNN"></script>` after the existing mobile presentation scripts in `ops/index.html`, using the new release number. The yard script loads its own CSS with the same query version. Bump the current release number in `ops/sw.js` (version + CACHE) and every `?v=` reference in `ops/index.html`.

These integration/release edits are left for Claude: automatic review accepted the new yard presentation files but blocked uploading the entire existing `ui2-mobile.js`, because its unrelated mobile and AI/chat source is broader than the user's yard-file upload authorization. No alternate upload of that source is attempted. This PR deliberately contains only the yard-specific additions. The local experiment used a loader in that mobile entry point; that loader is NOT part of the PR and is NOT needed with the direct script tag above.

Check 320/360/390/768/900/901/1280px: switch both layouts, full-image zoom, occupied row selection and long raw text, empty range selection, dense and entirely empty parking arrangements, TO_PLACE/SOLD only, live updates, complete/reset via existing action, navigation away/back, reload with saved preference, and driver-to-manager/painter account switching. Confirm existing manager editing, sending, Telegram image, and painter screen unchanged. Capture before/after in the isolated preview before releasing. Do not merge or publish from the design branch.
