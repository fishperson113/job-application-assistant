import { Agent, run, setDefaultOpenAIKey } from "@openai/agents";
import { z } from "zod";
import { config, OPENAI_MODEL } from "./config.js";
import { CANDIDATE_PROFILE, cvFileName, type GeneratedCv, type JobAnalysis, type MatchReport } from "./pipeline.js";

// Multi-agent pipeline on the OpenAI Agents SDK: three specialized agents run
// in sequence — Analyst (JD -> structure), Matcher (structure + candidate ->
// fit), Writer (-> tailored CV). Deterministic orchestration; each agent has a
// single role and typed (zod) output where structure matters.

let keyConfigured = false;
function ensureKey(): void {
  const key = config().openaiApiKey;
  if (!key) throw new Error("OPENAI_API_KEY is not set; add it as an Encore secret");
  if (!keyConfigured) {
    setDefaultOpenAIKey(key);
    keyConfigured = true;
  }
}

const JobAnalysisSchema = z.object({
  title: z.string(),
  company: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(z.string()),
  keywords: z.array(z.string()),
  seniority: z.string(),
});

const MatchReportSchema = z.object({
  score: z.number().min(0).max(1),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});

const analyst = new Agent({
  name: "JD Analyst",
  model: OPENAI_MODEL,
  instructions:
    "You extract structured intelligence from a job posting. Return the role title, hiring company, key responsibilities, hard requirements, notable keywords/technologies, and seniority. Be faithful to the text; do not invent requirements that are not stated.",
  outputType: JobAnalysisSchema,
});

const matcher = new Agent({
  name: "Candidate Matcher",
  model: OPENAI_MODEL,
  instructions:
    "You assess how well a candidate fits a job. Given the candidate profile and the structured job analysis, produce a 0..1 fit score, concrete strengths that map candidate evidence to requirements, and honest gaps. Ground every strength in the provided profile; never fabricate experience.",
  outputType: MatchReportSchema,
});

const writer = new Agent({
  name: "CV Writer",
  model: OPENAI_MODEL,
  instructions:
    "You write a concise, tailored one-page CV in Markdown for a specific job. Use ONLY facts present in the candidate profile — invent no employers, dates, or achievements. Emphasize the strengths from the match report and mirror the job's keywords where truthful.",
});

export async function analyzeJobDescription(url: string, jobText: string): Promise<JobAnalysis> {
  ensureKey();
  const result = await run(analyst, `Job URL: ${url}\n\nJob posting text:\n${jobText}`);
  if (!result.finalOutput) throw new Error("JD Analyst returned no output");
  return result.finalOutput;
}

export async function matchCandidate(analysis: JobAnalysis): Promise<MatchReport> {
  ensureKey();
  const input = `Candidate profile:\n${CANDIDATE_PROFILE}\n\nJob analysis (JSON):\n${JSON.stringify(analysis, null, 2)}`;
  const result = await run(matcher, input);
  if (!result.finalOutput) throw new Error("Candidate Matcher returned no output");
  return result.finalOutput;
}

export async function buildCv(analysis: JobAnalysis, match: MatchReport): Promise<GeneratedCv> {
  ensureKey();
  const input = [
    `Candidate profile:\n${CANDIDATE_PROFILE}`,
    `Job analysis (JSON):\n${JSON.stringify(analysis)}`,
    `Match report (JSON):\n${JSON.stringify(match)}`,
    `Write the tailored CV now.`,
  ].join("\n\n");
  const result = await run(writer, input);
  const markdown = result.finalOutput?.trim() || "# CV\n\n(No content generated.)";
  return {
    fileName: cvFileName(analysis.company),
    mimeType: "text/markdown",
    contentBase64: Buffer.from(markdown, "utf8").toString("base64"),
  };
}
