/**
 * DEV-ONLY experiment flag for the hero.
 *
 *   false  →  the landing page is EXACTLY as it is today (procedural NPCs).
 *   true   →  three test NPCs inside the SAME hero (shoreline walker, dock
 *             fisher, DO-vial researcher) are replaced by real skeletal-rig
 *             three.js characters for a side-by-side motion comparison.
 *             Everything else — headline, buttons, lake, dock, buoy, other
 *             NPCs, routes, auth, dashboard — is untouched.
 *
 * This is a reversible component-level experiment, NOT a second page and NOT
 * a user-facing route. To revert entirely, leave this false (or delete the
 * hero-rig/ folder and the three `USE_REAL_RIG_NPCS` guards in welcomeShore.js
 * and Welcome.jsx).
 */
export const USE_REAL_RIG_NPCS = false
