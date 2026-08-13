# Job Application Assistant

Separate workload repository consuming Corsair Platform. Built on **Encore.ts** so it gets the same free Encore Cloud hosting path as Corsair.

Owns jobs, candidate evidence, JD intelligence, CV/cover-letter generation, document workflow, Telegram UX, and Google Drive/Sheets projections — all through Corsair. It must never contain provider OAuth credentials, refresh tokens, client secrets, or direct Google/Telegram API plumbing.

## MVP vertical slice

```text
Telegram URL -> JobApplication -> JD analysis -> candidate match -> CV/PDF -> Corsair Drive/Sheets -> Telegram
```

## Current status: walking skeleton (end-to-end, deployable)

The whole slice is wired and runs on Encore. The intelligence steps are stubbed behind typed interfaces so the flow compiles, deploys, and walks today:

- **Ingest** — a 1-minute cron polls Corsair `getTelegramUpdates`, extracts a URL, creates a `JobApplication`, and acks the sender. Updates are de-duplicated by `update_id`; the Telegram offset is persisted.
- **Pipeline** (`agents.ts`) — a three-agent sequence on the **OpenAI Agents SDK** (`@openai/agents`): **Analyst** (job text → structured `JobAnalysis`, zod) → **Matcher** (your CV + analysis → `MatchReport`) → **CV Tailor** (edits your real `cv.tex` — title, objective, skills, section emphasis — to fit the job, inventing nothing). The tailored LaTeX is compiled to **PDF** by your self-hosted Tectonic service (`services/latex-compiler`, `LATEX_COMPILE_URL`) and the PDF is uploaded to Drive. Your CV never leaves infrastructure you control. Model `gpt-4o-mini` (`config.ts`). Your canonical CV lives in the `CV_TEX` secret (not committed).
- **Delivery** — the (placeholder) CV is uploaded to Google Drive through Corsair, a row is appended to the tracker Google Sheet, and the owner is notified on Telegram — all via the thin Corsair adapter (`corsair.ts`), addressed only by `connectionId`.

State machine (`domain.ts`): `received → analyzing → matched → generating → packaged → delivered` (`failed` on error, retryable from `analyzing`).

## Corsair boundary

The client knows only: `CORSAIR_URL`, `CORSAIR_API_KEY`, and connection IDs. It never handles provider tokens. All provider calls go through Corsair's Bearer-authed workload API via `corsair.ts`.

## Local development

```bash
encore run
```

Endpoints: `GET /health`, `GET /applications`, `GET /applications/:id`, `POST /ingest/poll` (manual trigger — same work the cron does).

## Required Encore secrets

```text
CORSAIR_URL                 e.g. https://staging-corsair-platform-e542.encr.app
CORSAIR_API_KEY             the workload Bearer key configured in Corsair
TELEGRAM_CONNECTION_ID      Corsair connection id of the bot, e.g. telegram-bot-<id>
GOOGLE_CONNECTION_ID        e.g. google-personal
TRACKER_SPREADSHEET_ID      Google Sheet id used as the job tracker
OWNER_CHAT_ID               owner's Telegram chat id (for proactive notifications)
OPENAI_API_KEY              OpenAI key for the agent pipeline
CV_TEX                      your canonical CV as LaTeX (set: encore secret set CV_TEX < cv.tex)
LATEX_COMPILE_URL           base URL of your self-hosted Tectonic service (services/latex-compiler)
```

Set them with `encore secret set --type dev,prod <NAME>` (or via the Encore Cloud dashboard). For local dev, `CORSAIR_URL` defaults to `http://127.0.0.1:4000`.

## Free hosting on Encore Cloud

This repo is not yet linked to an Encore Cloud app (`encore.app` has an empty `id`). To create one and get a free staging URL:

```bash
encore app create job-application-assistant   # links this repo, writes the app id
git push encore                                # or push to GitHub if you wire the GitHub integration
```

## Next steps

1. Set the real secrets: `OPENAI_API_KEY`, `CV_TEX` (`encore secret set CV_TEX < cv.tex`), and `LATEX_COMPILE_URL` after hosting `services/latex-compiler`.
2. Generate a tailored cover letter alongside the CV.
3. Add a `latexUpdate`-style capability so the agent can update a job's status in the tracker Sheet in place.
4. Duplicate-application detection before creating a new `JobApplication`.
