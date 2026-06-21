# Gcourses Revision Portal

An internal learning portal (à la a clean AI-learning portal) with **two
sides — admin and student** — for the July 17 revision launch and beyond.

- **Page:** [`portal.html`](portal.html) — gated by the existing magic-link login.
- **Students** browse modules → lessons (recordings, PDFs, notes, links) with
  per-lesson "mark complete" progress tracking.
- **Admins** get an inline editor (the **✎ Admin** button) to add / edit /
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
  the editor. If unset, it falls back to `SENDER_EMAIL` so there's always one
  admin. _Add the owner's email here_, e.g.
  `ADMIN_EMAILS=gigiimofarid@gmail.com,hmaki@amalandcompany.com`.
- `BLOB_READ_WRITE_TOKEN` — **optional.** Enables the "⬆ Upload file" button
  (Vercel → Storage → Blob). Without it, uploads are disabled and admins simply
  paste links instead — everything else still works.

## Notes

- Student progress is stored per-device in `localStorage` (no PII server-side).
- Large recordings should always be links (YouTube/Drive) — the 4 MB upload cap
  is a serverless limit, not a portal one.
