# Gcourses Portal

An internal learning portal (à la a clean AI-learning portal) with **two
sides — admin and student** — for the July 17 revision launch and beyond.

- **Page:** [`portal.html`](portal.html) — gated by the existing magic-link login.
- **Students** browse modules → lessons (recordings, PDFs, notes, links) with
  per-lesson "mark complete" progress tracking.
- **Admins** get an inline editor (the **Admin** button) to add / edit /
  reorder / delete modules and lessons and **Save** them for everyone.

## How content works

Each **module** holds **lessons**. A lesson is one of:

| Type        | What to add                                                        |
|-------------|--------------------------------------------------------------------|
| ▶ Recording | A YouTube, Vimeo, Loom, Google Drive, or direct `.mp4` link        |
| PDF         | A Drive/Dropbox/direct PDF link **or** a direct upload (≤ 4 MB)     |
| Notes/text  | Rich text — supports `**bold**`, `*italics*`, `` `code` `` & links |
| Link        | Any external resource (opens in a new tab)                         |
| (any)       | Recordings & PDFs can also carry notes shown beneath them          |

Pasting links works out of the box. Direct file upload is optional (see below).

## Backend

Three serverless endpoints reuse the site's existing auth + storage:

- `POST /api/portal-data` — returns the curriculum + whether you're an admin.
- `POST /api/portal-save` — admin-only; saves the whole curriculum to Vercel KV.
- `POST /api/portal-upload` — admin-only; optional direct file upload to Blob.

Shared helpers live in `api/_portal.js`. Curriculum is stored as a single JSON
value under the KV key `portal:curriculum`.

## Environment variables

Already used by the site (required):

- `JWT_SECRET` — verifies magic-link tokens.
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — Vercel KV (stores the curriculum).

New / relevant to the portal:

- `ADMIN_EMAILS` — **comma-separated** list of admin emails. Anyone here sees
  the editor. If unset, it falls back to `SENDER_EMAIL`, and finally to the
  built-in default admin `gigiimofarid@gmail.com` — so there's always one
  admin. To add more: `ADMIN_EMAILS=gigiimofarid@gmail.com,someone@else.com`.
- `BLOB_READ_WRITE_TOKEN` — **optional.** Enables the "⬆ Upload file" button
  (Vercel → Storage → Blob). Without it, uploads are disabled and admins simply
  paste links instead — everything else still works.

## Gamification

The student course view is gamified to make working through modules more
motivating. Everything is **client-side** and stored per-device in
`localStorage` (key `gc_portal_game`) — no backend or PII involved.

- **XP & Levels** — every completed lesson is worth 100 XP. Levels (Seedling →
  Sprout → … → Legend) come from a rising XP curve, shown with a level badge
  and an XP progress bar in the course sidebar.
- **Daily streak** — a 🔥 counter that grows when you complete a lesson on
  consecutive days and resets if you skip a day.
- **Achievement badges** — eight unlockable badges (first lesson, 5 lessons,
  finish a module, finish a course, 3- and 7-day streaks, 5 lessons in a day,
  reach Level 5). Earned badges light up in the sidebar.
- **Per-module progress rings** — each module shows a ring with how many of its
  lessons are done, turning into a green ✓ when the module is fully complete.
- **Celebrations** — leveling up, finishing a module or course, and unlocking a
  badge each trigger a confetti burst and a celebratory pop-up.

## Notes

- Student progress is stored per-device in `localStorage` (no PII server-side).
- Large recordings should always be links (YouTube/Drive) — the 4 MB upload cap
  is a serverless limit, not a portal one.
