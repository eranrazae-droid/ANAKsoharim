# Mobile app shell — approved home design

Base: `fe4226a4dfa257d07558e777688d575d0c7901d0` on `claude/charming-archimedes-nlfl58`.

This implements the subsequently approved mobile reorganization. It supersedes the earlier CSS-only stage-A proposal in PR #12; do not merge both implementations blindly. Scope remains the mobile home, All-tools surface, bottom navigation, theme switch and AI overlay. Business screens keep their existing implementations and actions.

## Changed
- New `ops/css/ui2m.css`, `ops/js/ui2-mobile.js` and local optimized artwork under `ops/img/ui2m/`.
- Exactly two added loader lines in `ops/index.html`, per the user's explicit restriction. Existing version references and `ops/sw.js` are deliberately untouched; Claude must perform release cache versioning when integrating.
- Manager home: bodyshop/tasks, pits/intakes, battery cabinet/wash; Recall/inventory/ignition shortcuts; fast task creation and live task-request approvals.
- All tools as cards. Inventory remains only in the home shortcut. Existing charging, notification and account controls remain accessible.
- Driver: real live badges, highlighted pending pits/inventory/intakes first, no empty pits/inventory card; fast task request outside 08:00–10:00 Israel time and the existing morning assignment display inside that window. Other assigned work remains accessible.
- Manager nav: Calendar / AI / All-or-Home. Driver nav: Home / AI / WhatsApp. AI overlay retains source DOM, form values and conversation while closing; resets on account change.
- New settings switch `עיצוב חדש לטלפון`; `?ui2m=1/0` persists in `anak_ui2m`; effective only at ≤900px and eligible roles. Pickup users retain their existing structure with the limited stage-A visual polish. Ibrahim is excluded.

## AI status
UI and `window.AnakMobileAI.ask` integration contract only. No AI API, new network calls, Ministry API, model keys or fabricated vehicle answers. The disconnected state is explicit. See [AI-HANDOFF.md](AI-HANDOFF.md) for Claude's backend implementation work.

## Preservation
No changes to `ops/js/app/`, Firebase, rules, schemas, identifiers or existing function signatures. No desktop UI2 CSS/JS changes. Source home nodes remain in place; the opt-in surface proxies their existing actions. Turning the flag off or moving above 900px hides every new surface and restores the original home/navigation. Source internal modal placement reserves space above the mobile navbar; content/logic are unchanged.

## Screenshots and checks
All screenshots are 390×844 with synthetic demo data only. Each of the seven users has a `*-before.png` and `*-after.png`. The Ibrahim before/after captures are pixel-identical. Extra screenshots show manager All, chat over a task draft, driver chat over intake, and the morning slot.

Automated browser results are in `results.json`. Additional checks verified plate prefill only from the current driver's own intake and discarded late AI answers after a user switch. Manual release checks:
- [ ] Run the backend-integrated AI checks in AI-HANDOFF.md before enabling real answers.
- [ ] Exercise the existing bodyshop and wash tabs, without changing their content or workflow.
- [ ] Test on an actual iPhone/Android with the keyboard, safe-area insets and large text.
- [ ] Claude: apply release cache versioning, then publish a review preview. This branch is not deployed or merged by Codex.
