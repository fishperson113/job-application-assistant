// Pipeline types + pure helpers (no LLM, no Encore) so they stay unit-testable.
// The LLM-backed agent implementations live in agents.ts.

export interface JobAnalysis {
  title: string;
  company: string;
  responsibilities: string[];
  requirements: string[];
  keywords: string[];
  seniority: string;
}

export interface MatchReport {
  score: number; // 0..1
  strengths: string[];
  gaps: string[];
}

export interface GeneratedCv {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** Strip HTML to readable plain text: drop script/style, remove tags, decode a few entities, collapse whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sanitized CV PDF file name for a company. */
export function cvFileName(company: string): string {
  const slug = company.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "role";
  return `cv-${slug}.pdf`;
}

/** Fetch a job posting and return bounded plain text for the analyst agent. */
export async function fetchJobText(url: string, maxChars = 8000): Promise<string> {
  const response = await fetch(url, { headers: { "user-agent": "job-application-assistant/0.1 (+corsair)" } });
  if (!response.ok) throw new Error(`Could not fetch job posting: ${response.status}`);
  const text = stripHtml(await response.text());
  return text.slice(0, maxChars);
}

/** Strip a Markdown/code fence if the model wrapped its LaTeX output in one. */
export function unwrapCodeFence(text: string): string {
  const fence = text.match(/^\s*```(?:latex|tex)?\s*\n([\s\S]*?)\n```\s*$/i);
  return (fence ? fence[1]! : text).trim();
}
