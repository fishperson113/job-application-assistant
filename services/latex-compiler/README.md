# latex-compiler

Self-hosted LaTeX → PDF service using [Tectonic](https://tectonic-typesetting.github.io/). The Job Application Assistant posts a tailored `cv.tex` here and gets back a PDF, so the CV never leaves infrastructure you control.

## Contract

```text
GET  /health   -> 200 "ok"
POST /compile  body: raw LaTeX (a full \documentclass document)
               -> 200 application/pdf, or 4xx/5xx with an error message
```

If `COMPILE_TOKEN` is set, `/compile` requires `Authorization: Bearer <COMPILE_TOKEN>`.

## Run locally

```bash
docker build -t latex-compiler services/latex-compiler
docker run -p 8080:8080 latex-compiler
curl -X POST --data-binary @cv.tex http://localhost:8080/compile -o out.pdf
```

## Free hosting (recommended: Google Cloud Run — scale-to-zero, generous free tier)

```bash
gcloud run deploy latex-compiler \
  --source services/latex-compiler \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 1Gi --timeout 180
```

Cloud Run prints an HTTPS URL. Alternatives: Render (Docker web service), Fly.io, Railway — any host that runs a container and gives an HTTPS URL.

First compile is slower because Tectonic downloads the TeX packages it needs, then caches them for the container's lifetime.

## Wire it into the client

Set the URL (and optionally a token) as Encore secrets on the Job Application app:

```bash
encore secret set --type prod,dev,pr,local LATEX_COMPILE_URL   # e.g. https://latex-compiler-xxxx.run.app
```

The client calls `POST <LATEX_COMPILE_URL>/compile`. To require the token, set `COMPILE_TOKEN` on the service and ask to have the client send it (a small addition).
