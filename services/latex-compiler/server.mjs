// Self-hosted LaTeX -> PDF service for a multi-file CV project (Tectonic).
// The full CV project lives here (in ./cv); the client only reads the tailorable
// section files and posts back edited versions. Node built-ins only.
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile, cp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 8080);
const CV_DIR = process.env.CV_DIR || "/app/cv";
const ENTRY = process.env.ENTRY || "main.tex";
const TOKEN = process.env.COMPILE_TOKEN || "";
const TAILORABLE = (process.env.TAILORABLE ||
  "sections/header.tex,sections/summary.tex,sections/skills.tex,sections/experience.tex,sections/projects.tex")
  .split(",").map((s) => s.trim()).filter(Boolean);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => { size += c.length; if (size > 4_000_000) reject(new Error("payload too large")); else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const json = (res, code, obj) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(obj));

async function readSource() {
  const files = {};
  for (const rel of TAILORABLE) {
    try { files[rel] = await readFile(join(CV_DIR, rel), "utf8"); } catch { /* missing section: skip */ }
  }
  return files;
}

async function compile(overrides) {
  const dir = await mkdtemp(join(tmpdir(), "cv-"));
  try {
    await cp(CV_DIR, dir, { recursive: true });
    for (const [rel, content] of Object.entries(overrides || {})) {
      if (!TAILORABLE.includes(rel)) continue; // whitelist: ignore anything not tailorable
      const dest = join(dir, rel);
      if (!normalize(dest).startsWith(normalize(dir))) continue; // defense-in-depth against traversal
      await writeFile(dest, String(content), "utf8");
    }
    await new Promise((resolve, reject) =>
      execFile("tectonic", [ENTRY, "--outfmt", "pdf", "--chatter", "minimal"], { cwd: dir, timeout: 180_000, maxBuffer: 1 << 25 },
        (err, _o, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve())),
    );
    const pdfName = ENTRY.replace(/\.tex$/, "") + ".pdf";
    return await readFile(join(dir, pdfName));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return res.writeHead(200).end("ok");
  if (TOKEN && (req.headers.authorization || "").replace(/^Bearer\s+/i, "") !== TOKEN) return res.writeHead(401).end("unauthorized");

  if (req.method === "GET" && req.url === "/source") {
    try { await access(join(CV_DIR, ENTRY)); } catch { return json(res, 500, { error: `no CV project at ${CV_DIR} (missing ${ENTRY})` }); }
    return json(res, 200, { entry: ENTRY, tailorable: TAILORABLE, files: await readSource() });
  }

  if (req.method === "POST" && req.url.startsWith("/compile")) {
    let body;
    try { body = JSON.parse((await readBody(req)).toString("utf8") || "{}"); }
    catch { return json(res, 400, { error: "invalid JSON body" }); }
    try {
      const pdf = await compile(body.overrides);
      return res.writeHead(200, { "content-type": "application/pdf", "content-length": pdf.length }).end(pdf);
    } catch (err) {
      return res.writeHead(500, { "content-type": "text/plain" }).end(String(err.message || err).slice(0, 4000));
    }
  }

  res.writeHead(404).end("not found");
});

server.listen(PORT, () => console.log(`latex-compiler on :${PORT} (cv=${CV_DIR}, entry=${ENTRY})`));
