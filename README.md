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
- **Pipeline** (`pipeline.ts`) — `analyzeJobDescription`, `matchCandidate`, `buildCv` are **placeholder stubs**. Replace each with a Claude-backed implementation without touching the orchestrator (`ingest.ts`).
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
```

Set them with `encore secret set --type dev,prod <NAME>` (or via the Encore Cloud dashboard). For local dev, `CORSAIR_URL` defaults to `http://127.0.0.1:4000`.

## Free hosting on Encore Cloud

This repo is not yet linked to an Encore Cloud app (`encore.app` has an empty `id`). To create one and get a free staging URL:

```bash
encore app create job-application-assistant   # links this repo, writes the app id
git push encore                                # or push to GitHub if you wire the GitHub integration
```

## Next steps

1. Replace the `pipeline.ts` stubs with real Claude-backed JD analysis, candidate match, and CV generation.
2. Render the CV/cover letter to real PDF (LaTeX or a PDF lib) instead of the text placeholder.
3. Add candidate profile/evidence storage and grounding.
4. Duplicate-application detection before creating a new `JobApplication`.
