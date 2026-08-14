# Setup TODO — Job Application Assistant

Handoff of everything left to do to make the assistant fully work end-to-end.
Written 2026-08-14. Both apps are already deployed and healthy; what remains is
plugging in your real OpenAI key and your real CV, and hosting the LaTeX compiler.

---

## Where things stand

### Corsair Platform (the control plane) — DONE
- Encore app: `corsair-platform-e542`
- Staging: https://staging-corsair-platform-e542.encr.app
- GitHub: `github.com/fishperson113/corsair-platform` (push `main` → auto deploy)
- Google connected (`google-personal`), 1 Telegram bot connected:
  `telegram-bot-7904126940` = **@ada113_bot** (healthy)
- All 6 secrets set with real values. Nothing to do here.

### Job Application Assistant (the client) — needs 3 things below
- Encore app: `job-application-assistant-n4bi`
- Staging: https://staging-job-application-assistant-n4bi.encr.app
- GitHub: `github.com/fishperson113/job-application-assistant` (push `main` → auto deploy)
- Endpoints: `GET /health`, `GET /applications`, `GET /applications/:id`,
  `POST /ingest/poll` (manual trigger). Cron polls hourly.
- Pipeline: OpenAI multi-agent (Analyst → Matcher → CV Tailor), model `gpt-4o-mini`.
- CV compile: your self-hosted Tectonic service (not hosted yet).

### Secret status (client app `job-application-assistant-n4bi`)

| Secret | Status |
|---|---|
| CORSAIR_URL | ✅ real |
| CORSAIR_API_KEY | ✅ real |
| TELEGRAM_CONNECTION_ID | ✅ real (`telegram-bot-7904126940`) |
| GOOGLE_CONNECTION_ID | ✅ real (`google-personal`) |
| TRACKER_SPREADSHEET_ID | ✅ real (you set it) |
| OWNER_CHAT_ID | ✅ real (`5083029113`) |
| OPENAI_API_KEY | ⚠️ **PLACEHOLDER — replace** |
| LATEX_COMPILE_URL | ⚠️ **PLACEHOLDER — replace** |
| CV_TEX | 🗑️ orphaned (no longer used; ignore or delete) |

Run all `encore ...` commands below from `clients/job-application/` (this dir is
linked to the client app). The `!` prefix note is for Claude Code sessions; in a
normal terminal just run the command.

---

## TODO 1 — Set the real OpenAI key

```bash
cd clients/job-application
encore secret set --type prod,dev,pr,local OPENAI_API_KEY
# paste your sk-... key at the hidden prompt
```

Model is `gpt-4o-mini` (change in `apps/job-application/config.ts` → `OPENAI_MODEL`
if your key has access to something else).

---

## TODO 2 — Put your real CV into the compile service and host it

Your CV is a multi-file LaTeX project; it lives INSIDE the compile service, not
in the client. The service ships a sample under `services/latex-compiler/cv/`
with the same layout as your `main.tex`.

### 2a. Replace the sample with your real project
Copy your real files over `services/latex-compiler/cv/` keeping the same paths:
```text
cv/main.tex
cv/preamble.tex
cv/config/commands.tex   cv/config/personal.tex
cv/sections/header.tex   summary.tex  education.tex  skills.tex
cv/sections/experience.tex  research.tex  projects.tex  publications.tex  awards.tex
```
The agent may edit ONLY these (default `TAILORABLE`): `sections/header.tex`,
`sections/summary.tex`, `sections/skills.tex`, `sections/experience.tex`,
`sections/projects.tex`. Everything else compiles verbatim. Keep those filenames
so tailoring lines up (or change the `TAILORABLE` env on the service).

Keep the CV out of git (optional but recommended):
```bash
echo "services/latex-compiler/cv/" >> clients/job-application/.gitignore
```
`gcloud run deploy --source` still uploads the local `cv/` to the build, so the
CV reaches your own GCP but not GitHub.

### 2b. Host the service (Google Cloud Run — free tier, scale-to-zero)
Needs the `gcloud` CLI and a GCP project (`gcloud init` once).
```bash
cd clients/job-application
gcloud run deploy latex-compiler \
  --source services/latex-compiler \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 1Gi --timeout 300
```
It prints an HTTPS URL like `https://latex-compiler-xxxxx.run.app`.
Sanity check:
```bash
curl https://latex-compiler-xxxxx.run.app/health          # -> ok
curl https://latex-compiler-xxxxx.run.app/source           # -> your tailorable sections
```
(First compile is slow — Tectonic downloads TeX packages once, then caches them.)

Alternatives if you prefer: Render (Docker web service), Fly.io, Railway — any
host that runs the container and gives an HTTPS URL. See
`services/latex-compiler/README.md`.

### 2c. Point the client at it
```bash
cd clients/job-application
printf '%s' "https://latex-compiler-xxxxx.run.app" | \
  encore secret set --type prod,dev,pr,local LATEX_COMPILE_URL
```

---

## TODO 3 — Redeploy the client so it picks up the new secrets

Secret changes need a redeploy. Easiest: an empty commit pushed to GitHub.
```bash
cd clients/job-application
git commit --allow-empty -m "chore: redeploy with real secrets"
# push the standalone repo to GitHub (its origin), which triggers the deploy:
git -C /c/workspace/job-application-assistant fetch . main
```
Simplest in practice: from the standalone checkout
`C:\workspace\job-application-assistant`, make any commit and `git push origin main`.
Deploy is triggered by GitHub push to `main` — **not** `git push encore`.

Watch it finish: the deploy page is linked from
https://app.encore.dev/job-application-assistant-n4bi (staging → deploys).
It must reach **success**; a `provisioning_failed` almost always means a secret
is still empty.

---

## How to test end-to-end (after TODO 1–3)

1. In Telegram, open **@ada113_bot** and send a real job-posting URL.
   (You must have messaged the bot at least once so it can reply to you.)
2. Trigger processing immediately (otherwise the cron picks it up within the hour):
   ```bash
   curl -X POST https://staging-job-application-assistant-n4bi.encr.app/ingest/poll
   # -> {"polled":N,"created":M}
   ```
3. Check results:
   ```bash
   curl https://staging-job-application-assistant-n4bi.encr.app/applications
   ```
   Expect the application to reach `status: "delivered"`, plus:
   - a tailored **PDF CV** in your Google Drive,
   - a new row in your tracker Google Sheet
     `[timestamp, company, title, url, "applied", cv link]`,
   - a Telegram message from the bot with the CV link.

Pipeline stages: `received → analyzing → matched → generating → packaged → delivered`
(`failed` on error; the bot messages you the error).

---

## Troubleshooting

- **Deploy failed `provisioning_failed`** → a secret is undefined. Every declared
  Encore `secret()` must have a value. Check the deploy page error; set the
  missing secret; redeploy.
- **Application goes to `failed`** → the bot sends the error. Common causes:
  - `OPENAI_API_KEY is not set` → do TODO 1.
  - `LATEX_COMPILE_URL is not set` / compile 5xx → do TODO 2, verify `/health`.
  - `CV source fetch failed` → the service has no CV project (empty `cv/`).
  - Sheets/Drive errors → the tracker sheet must be **owned by / shared with**
    the connected Google account (`phamduong1132005@gmail.com`).
- **Bot has an old pending message** with no URL → `created:0` is normal; that
  update had no link. Send an actual URL.
- **Prerequisite requirements** in Corsair must stay healthy: Google connection
  `google-personal` and the bot `telegram-bot-7904126940`. Manage them at
  https://staging-corsair-platform-e542.encr.app (`/connections`, `/telegram`).

---

## Optional / nice-to-have (not required to run)

- **Delete the orphaned CV_TEX secret** (unused now).
- **Lock down the compile service**: set `COMPILE_TOKEN` env on Cloud Run; then
  ask to have the client send `Authorization: Bearer <token>` (small change to
  `apps/job-application/latex.ts`). Currently the service is open (low risk: only
  compiles LaTeX, timeout-bounded).
- **Faster auto-processing**: the deployed cron runs hourly (`2 * * * *`) —
  Encore Cloud capped the `every: "1m"` I coded. Use `POST /ingest/poll` for
  instant runs.
- **Auth on `/ingest/poll`**: currently public (it only polls Corsair, which is
  authed). Can add a Bearer check if you want.
- **Cover letter**: a second agent producing a tailored cover letter.
- **Tracker in-place updates**: add a `sheetsUpdate`/`batchUpdate` capability to
  Corsair so the agent can update a job's status in the sheet, not just append.
- **Change tailorable sections**: set `TAILORABLE` env on the compile service (a
  comma list of section paths); the client picks it up from `/source` — no client
  change needed.

---

## Key facts / gotchas (so you don't relearn them)

- **Two apps, two GitHub repos.** Push `main` on each repo → Encore auto-deploys.
  Do **not** use `git push encore`.
- **Corsair owns all provider credentials.** The client only knows
  `CORSAIR_URL` + `CORSAIR_API_KEY` + connection IDs; it never sees Google/Telegram
  tokens. Provider calls go through Corsair's `/api/telegram/*` and `/api/google/*`.
- **AI is OpenAI-only** (your choice) via `@openai/agents` — do not add Claude.
- **The CV never leaves your infra**: it lives in your compile service; the client
  only round-trips small tailored section text.
- **Verify locally** in either repo: `npm run typecheck`, `npm test`, `encore check`.
- **The `clients/job-application` submodule** in `corsair-platform` mirrors the
  standalone `C:\workspace\job-application-assistant` (GitHub origin). Both are kept
  in sync; the platform records a submodule pointer.
