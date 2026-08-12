# Job Application Assistant

Separate workload repository consuming Corsair Platform through `@corsair-platform/client`.

Owns jobs, candidate evidence, JD intelligence, CV/cover-letter generation, document workflow, Telegram, and Google Drive/Sheets projections through Corsair.

It must never contain provider OAuth credentials, refresh tokens, client secrets, or direct Google API plumbing.

## MVP vertical slice

```text
Telegram URL -> JobApplication -> JD analysis -> candidate match -> CV/PDF -> Corsair Drive/Sheets -> Telegram
```

The first release uses a thin Corsair adapter and a single personal connection. Generic integrations and full natural-language CRUD remain later phases.
