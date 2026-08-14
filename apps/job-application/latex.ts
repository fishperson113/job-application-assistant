import { config } from "./config.js";

// Talk to the owner's self-hosted Tectonic service. The service holds the full
// multi-file CV project; we read the tailorable section files, tailor them, and
// post them back for compilation. The CV never leaves the owner's infra.

export type CvFiles = Record<string, string>;

function baseUrl(): string {
  const url = config().latexCompileUrl;
  if (!url) throw new Error("LATEX_COMPILE_URL is not set");
  return url.replace(/\/$/, "");
}

/** Fetch the CV's tailorable section files (path -> LaTeX content). */
export async function fetchCvSource(): Promise<{ entry: string; tailorable: string[]; files: CvFiles }> {
  const response = await fetch(`${baseUrl()}/source`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`CV source fetch failed: ${response.status} ${await response.text().catch(() => "")}`.trim());
  return (await response.json()) as { entry: string; tailorable: string[]; files: CvFiles };
}

/** Compile the CV with the given tailored section overrides and return a base64 PDF. */
export async function compileCv(overrides: CvFiles): Promise<string> {
  const response = await fetch(`${baseUrl()}/compile`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/pdf" },
    body: JSON.stringify({ overrides }),
  });
  if (!response.ok) throw new Error(`LaTeX compile failed: ${response.status} ${await response.text().catch(() => "")}`.trim());
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("LaTeX compile returned an empty PDF");
  return bytes.toString("base64");
}
