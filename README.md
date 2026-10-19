# VentureXP

A personal, offline-first learning app for entrepreneurship and e-commerce — short interactive lessons, XP, streaks, achievements, spaced-repetition flashcards, a business glossary and a business simulation. Built as an installable PWA for iPhone (Safari → Add to Home Screen).

- **No account, no backend, no API keys.** Everything runs in the browser.
- **Progress is stored locally** in IndexedDB on the device you use. It does **not** sync between devices, browsers or iCloud. Use **Settings → Backup & restore → Export Progress** to keep a copy or move to another device.
- **Works offline** after the app has been opened online once.

## What’s inside

| Area | Details |
| --- | --- |
| Courses | 6 complete playable courses — Shipping Terminology, E-commerce Fundamentals, Business Finance, Print on Demand, TikTok Shop Basics, Creator Marketing 101 — each 3 modules × 5 lessons (**90 lessons, 450+ activities**). 20 more courses across all 12 subjects are listed as clearly-labelled “Coming soon” outlines. |
| Activities | 12 interaction types: multiple choice, true/false, tap-to-match, fill in the blank, reorder steps, scenario, flashcard self-rating, numeric calculation (tolerance + currency), spot the mistake, strategy with trade-offs, vocabulary recall, multi-question case study. |
| Progression | XP ledger with deterministic, idempotent awards; level curve `round(100 × L^1.35)`; calendar-day streaks in your timezone; daily challenges; 18 achievements. |
| Practice | Daily Review, Weak Areas, Quick Quiz, Vocabulary, Calculations, Mastery Check, Flashcards (Again/Hard/Good/Easy spaced repetition). Only uses completed content. |
| Glossary | 170+ terms with definitions, examples, related terms; offline search across terms, courses, lessons and topics. |
| Simulation | “Launch a POD Brand” — deterministic 3-month simulation with transparent rules. Educational only, not a forecast. |
| Backup | Timestamped JSON export; validated import with preview and Merge/Replace. |

## Run it

Requires Node.js 20+ (22 recommended).

```bash
npm install
npm run dev          # http://localhost:5173 — development server
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build at http://localhost:4173
```

To try it on your phone on the same Wi-Fi during development: `npm run dev -- --host` and open the printed network address. Note: offline mode and “Add to Home Screen” install need **HTTPS**, so for real phone use, deploy it (below).

## Test it

```bash
npm test             # Vitest unit tests (grading, XP, levels, streaks, unlocks, SRS, backup, simulation, search, content)
npm run test:e2e     # Playwright: full journey, offline mode, no-overflow at 320/375/390/430px
npm run typecheck
```

If Playwright browsers aren’t installed on your machine: `npx playwright install chromium`.

## Deploy for free (static hosting, HTTPS)

`npm run build` produces a fully static `dist/` folder. It uses relative paths and hash-based URLs, so it works from any host or sub-path with no server configuration.

**Option A — GitHub Pages (automatic):**
1. Push this project to a GitHub repository (branch `main`).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The included workflow `.github/workflows/deploy.yml` tests, builds and publishes on every push. Your URL will be `https://<username>.github.io/<repo>/`.

**Option B — Netlify / Cloudflare Pages / Vercel:** create a new site from your repo with build command `npm run build` and output directory `dist`. Or drag-and-drop the `dist/` folder into Netlify’s “Deploy manually” page.

When you deploy an update, the app shows “A new version of VentureXP is ready → Reload”. Your progress is kept.

## Install on iPhone

1. Open your deployed **HTTPS** URL in **Safari** (not an in-app browser).
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open VentureXP from the Home Screen once while online. After that, lessons, practice, glossary and the simulation work offline.

Notes: this is a web app (PWA), not an App Store app. Data saved in the Home Screen app lives in that app’s own storage on that device. If you clear Safari website data or delete the Home Screen app, local progress is removed — export a backup first.

## Project structure

```
src/
  domain/        pure logic: content schemas (Zod), grading, XP, levels, streaks, SRS, achievements, simulation, search
  content/       curriculum engine, catalog, glossary, courses/*.ts (one file per playable course)
  db/            Dexie (IndexedDB) schema, progression service (single source of truth), practice builder, backup
  components/    UI primitives, activity renderers + player, app shell
  screens/       one file per screen
  hooks/         live queries over IndexedDB
tests/e2e/       Playwright tests
```

Adding a course: create `src/content/courses/<name>.ts` with `defineCourse({...})` (activities need no ids; the last lesson of each module becomes its checkpoint), add it to `src/content/courses/index.ts`, and run `npm test` — the content tests validate schema, answer indices, glossary references and structure.
