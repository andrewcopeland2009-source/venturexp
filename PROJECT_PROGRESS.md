# VentureXP — Project Progress

_Last updated: 2026-10-19_

## Status summary

All 13 steps of the build order are implemented. Typecheck, the production build, **86 unit tests** and **6 Playwright end-to-end tests** pass.

| Build step | Status |
| --- | --- |
| 1. Scaffold & design tokens | ✅ React 19 + TS + Vite 7, Tailwind 4, dark palette from spec + light theme, self-hosted fonts |
| 2. Routing & app shell | ✅ Hash router, bottom tabs (mobile), sidebar (desktop), safe areas, offline pill, SW update prompt |
| 3. IndexedDB & typed models | ✅ Dexie tables for every model; Zod schemas reused for backup validation; localStorage-snapshot fallback if IndexedDB is unavailable |
| 4. Catalog & learning path | ✅ 12 categories, 26 course records (6 playable, 20 “Coming soon” outlines), search + filters, vertical path with 5 node states |
| 5. Lesson engine | ✅ All 12 activity types, schema-validated, grading separate from rendering, missed questions re-asked once, attempts + weak concepts recorded |
| 6. Shipping Terminology | ✅ 15 lessons, uses all 12 activity types |
| 7. XP, levels, streaks, badges | ✅ Idempotent XP ledger, caps, level curve, timezone calendar-day streaks, daily challenges, 18 achievements |
| 8. Practice, flashcards, glossary | ✅ 6 practice modes + flashcards (SRS), 170-term glossary |
| 9. Onboarding & recommendations | ✅ 6-step onboarding with “Skip for now”; transparent recommendation scoring |
| 10. Simulator | ✅ “Launch a POD Brand”, 3 setup steps + 3 monthly rounds, documented rules, summary, replay |
| 11. Remaining five courses | ✅ E-commerce Fundamentals, Business Finance, Print on Demand, TikTok Shop Basics, Creator Marketing 101 |
| 12. PWA/offline polish | ✅ Manifest, maskable + apple-touch icons, Workbox precache (hashed assets, outdated caches cleaned), prompt-to-reload updates, offline e2e test |
| 13. Tests, performance, docs | ✅ See below; README has run/deploy/install steps |

### Content totals (verified by tests)
- 6 playable courses × 3 modules × 5 lessons = **90 lessons**, **456 activities** (min 5 per lesson).
- Activity mix: numeric 98, true/false 84, MCQ 67, scenario 39, match 30, fill-blank 25, strategy 24, recall 23, order 23, case study 21, spot-the-mistake 16, flashcard 6.
- **170 glossary terms**, each with definition, example, related terms, category and difficulty.

## What has been verified
- `npm run typecheck`, `npm run build` — clean.
- `npm test` — 86 tests: XP idempotency (refresh/double-submit/replay caps), cumulative level thresholds, calendar-day streaks across timezones and DST, lesson unlocks + checkpoint gating, grading of every activity type, numeric tolerance and parsing, glossary search (MOQ), flashcard scheduling, backup validation + merge/replace, simulation arithmetic, curriculum integrity.
- `npm run test:e2e` (Chromium, iPhone 13 emulation) — onboarding → Shipping Terminology → finish lesson → XP + unlock + first badge → reload persistence → glossary “MOQ” → flashcard review + badge → Quick Quiz → full simulation → export backup → import (replace) → progress intact; offline reload after first visit; no horizontal overflow at 320/375/390/430 px on 13 screens.

## Not verified / known limitations
- **Not tested on a physical iPhone or in real Safari.** Testing used Chromium with iPhone viewport emulation. Safari-specific behavior (Add to Home Screen, standalone storage, share-sheet export) should be checked on a device.
- **Not deployed.** A GitHub Pages workflow is included; hosting must be set up by you.
- Official reference links inside lessons could not be link-checked from the build environment (outbound network blocked). Spot-check them after deploying.
- Platform-specific facts (TikTok Shop rules, carrier dim divisors, duty/de minimis rules, tax rules) are taught as concepts and flagged in-lesson with “Verify before relying on it” notes; they were written from general knowledge as of the review date, not live-verified.
- The localStorage fallback (for browsers that block IndexedDB) is implemented but not exercised in an automated test.
- Light theme is functional but less polished than the default dark theme.
- Changing timezone affects future days only; past activity keeps the date it was recorded under.
- Flashcard activities inside lessons are self-rated and don’t count toward lesson score; their cards join the SRS deck after the lesson is completed.

## Suggested next steps (for a later session)
1. Deploy (GitHub Pages workflow or Netlify) and run through the acceptance test on an iPhone in Safari + as a Home Screen app.
2. Spot-check every reference link and the “verify” notes against current official sources; update `lastReviewed`.
3. Write the next courses from the outlines in `src/content/catalog.ts` (e.g. `shipping-international`, `dropship-foundations`, `marketing-foundations`): move the outline into a new `src/content/courses/*.ts` using `defineCourse`, add to `courses/index.ts`, remove from `comingSoonCourses`, run `npm test`.
4. Add an automated test for the localStorage fallback (e.g. stub `indexedDB` to throw).
5. Optional polish: per-course completion certificates, sound effects toggle, more simulation scenarios.
