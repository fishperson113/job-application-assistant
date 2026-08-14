# latex-compiler

Self-hosted service that holds your **multi-file LaTeX CV project** and compiles it to PDF with [Tectonic](https://tectonic-typesetting.github.io/). The Job Application Assistant reads your tailorable sections, edits them for a job, and posts them back — your CV never leaves infrastructure you control.

## Your CV project

Put your real CV project in `./cv` (this repo ships a sample with the same layout):

```text
cv/
  main.tex            entry (\input preamble, config/*, sections/*)
  preamble.tex
  config/commands.tex
  config/personal.tex
  sections/header.tex summary.tex education.tex skills.tex experience.tex ...
```

Replace `cv/` with your project. To keep it out of source control, add `services/latex-compiler/cv/` to `.gitignore` — `gcloud run deploy --source` still uploads the local dir to the build.

## Contract

```text
GET  /health   -> 200 "ok"
GET  /source   -> { entry, tailorable, files: { "sections/summary.tex": "...", ... } }
POST /compile  body: { overrides: { "sections/summary.tex": "...", ... } }
               -> 200 application/pdf   (overrides restricted to the tailorable set)
```

Configure via env: `ENTRY` (default `main.tex`), `TAILORABLE` (comma list, default
`sections/header.tex,sections/summary.tex,sections/skills.tex,sections/experience.tex,sections/projects.tex`),
optional `COMPILE_TOKEN` (then `/source` and `/compile` require `Authorization: Bearer <token>`).

## Run locally

```bash
docker build -t latex-compiler services/latex-compiler
docker run -p 8080:8080 latex-compiler
curl localhost:8080/source
curl -X POST localhost:8080/compile -H 'content-type: application/json' -d '{"overrides":{}}' -o out.pdf
```

## Free hosting (Google Cloud Run — scale-to-zero)

```bash
gcloud run deploy latex-compiler \
  --source services/latex-compiler \
  --region europe-west1 --allow-unauthenticated \
  --memory 1Gi --timeout 300
```

Then point the client at it:

```bash
encore secret set --type prod,dev,pr,local LATEX_COMPILE_URL   # https://latex-compiler-xxxx.run.app
```

First compile is slower — Tectonic downloads and caches the TeX packages it needs.
