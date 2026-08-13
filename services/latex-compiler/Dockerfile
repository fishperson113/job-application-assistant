# Self-hosted LaTeX -> PDF compile service using Tectonic.
# The owner runs this; the CV never leaves infrastructure they control.
FROM node:20-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh \
 && mv tectonic /usr/local/bin/tectonic \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.mjs .

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
