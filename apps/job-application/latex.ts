import { config } from "./config.js";

// Compile LaTeX to PDF via the owner's self-hosted tectonic service. The CV
// never leaves infrastructure the owner controls. The service accepts the raw
// LaTeX as the request body and returns application/pdf.

export async function compileToPdf(tex: string): Promise<string> {
  const url = config().latexCompileUrl;
  if (!url) throw new Error("LATEX_COMPILE_URL is not set");
  const response = await fetch(url.replace(/\/$/, "") + "/compile", {
    method: "POST",
    headers: { "content-type": "application/x-latex", accept: "application/pdf" },
    body: tex,
  });
  if (!response.ok) throw new Error(`LaTeX compile failed: ${response.status} ${await response.text().catch(() => "")}`.trim());
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("LaTeX compile returned an empty PDF");
  return bytes.toString("base64");
}
