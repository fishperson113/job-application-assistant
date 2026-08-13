// Tiny HTTP service: POST /compile with a LaTeX document body -> application/pdf.
// Uses only Node built-ins. Optionally protect it with COMPILE_TOKEN.
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.COMPILE_TOKEN || "";

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 2_000_000) reject(new Error("payload too large"));
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return res.writeHead(200).end("ok");
  if (req.method !== "POST" || !req.url.startsWith("/compile")) return res.writeHead(404).end("not found");
  if (TOKEN && (req.headers.authorization || "").replace(/^Bearer\s+/i, "") !== TOKEN) return res.writeHead(401).end("unauthorized");

  let tex;
  try {
    tex = (await readBody(req)).toString("utf8");
  } catch (err) {
    return res.writeHead(413).end(String(err.message || err));
  }
  if (!tex.includes("\\documentclass")) return res.writeHead(400).end("body must be a LaTeX document");

  const dir = await mkdtemp(join(tmpdir(), "tex-"));
  try {
    await writeFile(join(dir, "doc.tex"), tex, "utf8");
    await new Promise((resolve, reject) =>
      execFile("tectonic", ["doc.tex", "--outfmt", "pdf", "--chatter", "minimal"], { cwd: dir, timeout: 120_000, maxBuffer: 1 << 24 }, (err, _o, stderr) =>
        err ? reject(new Error(stderr || err.message)) : resolve(),
      ),
    );
    const pdf = await readFile(join(dir, "doc.pdf"));
    res.writeHead(200, { "content-type": "application/pdf", "content-length": pdf.length }).end(pdf);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" }).end(String(err.message || err).slice(0, 4000));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

server.listen(PORT, () => console.log(`latex-compiler listening on :${PORT}`));
