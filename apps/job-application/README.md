# Job Application Assistant

This app is a workload/client of Corsair.

Owns:
- job applications and candidate profile
- JD intelligence and typed AI artifacts
- workflow/state machine
- CV, cover letter, validation, LaTeX/PDF artifacts
- Telegram interface and natural-language commands
- Google Sheets projection through Corsair

It may know only Corsair endpoint/API credentials and connection IDs. It must never handle provider OAuth secrets or tokens.

Implementation status: scaffold only. The first implementation target is one vertical slice: Telegram URL -> application -> package -> PDF -> Drive/Sheet -> Telegram.
