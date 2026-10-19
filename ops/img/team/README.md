# Small square photo in Gil's existing phone profile button

User approved replacing Gil's initial with the supplied photo, square and small. This adds a 40×40px photo with 8px corner radius and a fine gold border, preserving the original button position, accessible name, and profile/settings action. Both people appear through a CSS crop of the untouched original photograph. No generated faces or mockup image is used. Only the driver named גיל is eligible; manager, other drivers, pickup users, and Ibrahim keep their current avatar. No home-screen redesign.

The CSS class is restored after the mobile renderer updates its letter and removed on role/name changes. Class writes are guarded to avoid observer loops. No Firebase or account record updates.

## Claude integration

Add `<script src="js/ui2-gil-avatar.js?v=NNN"></script>` after `ui2-mobile.js` in `ops/index.html`. It loads the stylesheet with the same release query. Bump `ops/sw.js` version/CACHE and all index release queries together. The full existing index/mobile sources are not uploaded through the connector, following earlier source-egress review restrictions. Only these avatar-specific additions and the supplied photo are included.

Verify on a real 360/390/430px phone: both faces visible inside the 40px square; source text updates do not obscure the image; existing avatar tap still opens profile; switch Gil → another driver → manager → Gil; logout; new/old design preference; image load; narrow header; painter unchanged. Desktop is unaffected. Before/after screenshots and browser visual QA remain for Claude before publication. Keep the PR draft until integration and review.
