# ClassVault — Web

A web port of the ClassVault mobile app: same flow and features (semesters →
subjects → timetable → syllabus/resources/lectures/assignments/notes →
AI chat), rebuilt with Next.js for the browser.

## What moved where

- **Login / signup (username + password)** → stored in **MongoDB Atlas**.
  This is the *only* thing that touches the database — see
  `src/lib/models/User.ts` and `src/app/api/auth/*`.
- **Everything else** (semesters, subjects, timetable, syllabus, resources,
  lectures + OCR text, assignments, notes, chat history, app settings, and
  uploaded files) is stored **locally in the browser** via IndexedDB, one
  database per logged-in username (`src/lib/local/db.ts`, `repo.ts`). None
  of it is ever sent to a server. Use Settings → Export backup to get a
  portable JSON copy.
- **OCR / text extraction** runs on-device in the browser: Tesseract.js for
  photos, pdfjs for PDFs (`src/lib/extract.ts`) — mirroring the original
  app's on-device ML Kit OCR.
- **AI features** (Explain / Summarize / Key Points / Important Questions /
  Generate Notes, subject-scoped chat, and the global assistant) call the
  Gemini API directly from the browser (`src/lib/gemini.ts`).

## Getting started

```bash
npm install
cp .env.example .env.local
# edit .env.local:
#   MONGODB_URI=<your MongoDB Atlas connection string>
#   JWT_SECRET=<any long random string>
#   NEXT_PUBLIC_GEMINI_API_KEY=<optional — can also be set per-user in Settings>
npm run dev
```

Open http://localhost:3000 — you'll land on Login/Signup first.

## MongoDB Atlas setup (auth only)

1. Create a free cluster at https://www.mongodb.com/cloud/atlas.
2. Create a database user and allow network access (0.0.0.0/0 for quick
   testing, or your host's egress IPs in production).
3. Copy the connection string into `MONGODB_URI` in `.env.local` (and in
   your hosting provider's environment variables when you deploy).

The app only ever writes to one collection, `users`, storing a username and
a bcrypt password hash — no academic data goes here.

## Gemini API key

You said you'll add this at deploy time — set `NEXT_PUBLIC_GEMINI_API_KEY`
in your hosting provider's environment variables. Each user can also
override it with their own key in **Settings → Gemini API key**, which
always takes priority. No code changes needed either way.

## Deploying

Works on any Next.js host (Vercel, Netlify, Render, your own Node server).
Steps for Vercel:

```bash
npm i -g vercel
vercel
```

Set `MONGODB_URI`, `JWT_SECRET`, and (optionally) `NEXT_PUBLIC_GEMINI_API_KEY`
in the project's environment variables, then redeploy.

## Project layout

```
src/
  app/
    login/, signup/            – auth pages
    (app)/                     – authenticated shell (sidebar + topbar)
      home/                    – dashboard
      semester/                – create/switch semesters
      subjects/                – subject list, subject workspace, timetable upload
      ai-chat/                 – global assistant
      search/                  – cross-content search
      revision/                – starred lectures
      settings/                – theme, Gemini key, backup/restore, account
    api/auth/                  – signup/login/logout/me (Mongo-backed)
  components/                  – Sidebar, TopBar, ChatPanel, subject tab components
  lib/
    auth/                      – JWT session + client AuthContext
    db/mongodb.ts              – Mongo Atlas connection (auth only)
    models/User.ts             – Mongoose User model
    local/                     – IndexedDB data layer + typed repositories (everything else)
    gemini.ts, extract.ts      – Gemini client, OCR/PDF text extraction
    timetableParser.ts         – heuristic timetable text parser
```

## Notes

- Since app data lives in IndexedDB, it's per-browser/per-device. There's no
  cross-device sync (matching the original app's local-first design) beyond
  manual export/import in Settings.
- `middleware.ts` protects all `(app)` routes behind the login cookie.
