# Mobile home hero replacement

Replaces only `ops/img/ui2m/hero.webp` with the dealership photo supplied by the user: the frontal gold sign and cars arranged in a semicircle. Source PNG is preserved unchanged; the app copy is optimized as 1200px WebP (quality 87), with no generated content or image alteration.

The existing mobile hero uses the same asset URL and layout. The monogram stays at the upper right with its existing charcoal/gold finish. Home actions, navbar, responsive behavior and other screens are untouched. No desktop image or CSS/JS file changes.

Base: `c4a8c788db5f4dbf9df7da90f63efb0d05c2add9` (v572). PR #15 has already been merged; this is a separate follow-up PR into `claude/charming-archimedes-nlfl58`. Claude should perform the regular release version/cache update when integrating; this asset-only change does not edit SW, index or the desktop theme.

Screenshots: manager, Gil, Ofer and Itai, before and after, all 390×844, synthetic demo data. Browser inspection checks that the replacement loads and the sign and cars are visible in the existing crop. No business logic is touched; no expanded test suite is needed for this asset replacement.
