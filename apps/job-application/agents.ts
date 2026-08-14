import { Agent, run, setDefaultOpenAIKey } from "@openai/agents";
import { z } from "zod";
import { config, OPENAI_MODEL } from "./config.js";
import { cvFileName, type GeneratedCv, type JobAnalysis, type MatchReport } from "./pipeline.js";
import { compileCv, type CvFiles } from "./latex.js";

// Multi-agent pipeline on the OpenAI Agents SDK. Three specialized agents run in
// sequence: Analyst (JD -> structure), Matcher (CV sections + structure -> fit),
// CV Tailor (edit the tailorable LaTeX section files to fit the job). The owner's
// CV is the only evidence; agents must not fabricate anything not present in it.

let keyConfigured = false;
function ensureKey(): void {
  const key = config().openaiApiKey;
  if (!key) throw new Error("OPENAI_API_KEY is not set; add it as an Encore secret");
  if (!keyConfigured) {
    setDefaultOpenAIKey(key);
    keyConfigured = true;
  }
}

function renderFiles(files: CvFiles): string {
  return Object.entries(files).map(([path, content]) => `=== FILE: ${path} ===\n${content}`).join("\n\n");
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

const TailoredFilesSchema = z.object({
  files: z.array(z.object({ path: z.string(), content: z.string() })),
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
    "You assess how well a candidate fits a job. The candidate's evidence is the provided LaTeX section files of their CV. Given those and the structured job analysis, produce a 0..1 fit score, concrete strengths that map CV evidence to the job's requirements, and honest gaps. Ground every strength in the CV; never fabricate experience.",
  outputType: MatchReportSchema,
});

const tailor = new Agent({
  name: "CV Tailor",
  model: OPENAI_MODEL,
  instructions: [
    "You tailor a candidate's CV to a specific job by editing ONLY the LaTeX section files provided. You are given those files, the job analysis, and the match report.",
    "Return every provided file back, edited to fit the job: refine the title/headline, rewrite the summary/objective, reorder and emphasize skills, and re-emphasize existing experience/project bullets. Mirror the job's keywords where truthful.",
    "STRICT RULES: Use ONLY facts already present in the provided files. Do not invent employers, roles, dates, degrees, skills, or achievements. Preserve each file's LaTeX commands, macros (e.g. \\cvsection), and structure so the project still compiles. Keep each file self-contained as a \\input fragment (no \\documentclass or \\begin{document}).",
    "Return each file with its exact original path and the full new content.",
  ].join("\n"),
  outputType: TailoredFilesSchema,
});

export async function analyzeJobDescription(url: string, jobText: string): Promise<JobAnalysis> {
  ensureKey();
  const result = await run(analyst, `Job URL: ${url}\n\nJob posting text:\n${jobText}`);
  if (!result.finalOutput) throw new Error("JD Analyst returned no output");
  return result.finalOutput;
}

export async function matchCandidate(analysis: JobAnalysis, source: CvFiles): Promise<MatchReport> {
  ensureKey();
  const input = `Candidate CV section files:\n${renderFiles(source)}\n\nJob analysis (JSON):\n${JSON.stringify(analysis, null, 2)}`;
  const result = await run(matcher, input);
  if (!result.finalOutput) throw new Error("Candidate Matcher returned no output");
  return result.finalOutput;
}

/** Tailor the editable CV section files to the job and compile the project to PDF. */
export async function buildCv(analysis: JobAnalysis, match: MatchReport, source: CvFiles): Promise<GeneratedCv> {
  ensureKey();
  const input = [
    `Editable CV section files:\n${renderFiles(source)}`,
    `Job analysis (JSON):\n${JSON.stringify(analysis)}`,
    `Match report (JSON):\n${JSON.stringify(match)}`,
    `Return the tailored files now.`,
  ].join("\n\n");
  const result = await run(tailor, input);
  if (!result.finalOutput) throw new Error("CV Tailor returned no output");

  // Only accept edits to files the service exposed as tailorable; ignore anything else.
  const overrides: CvFiles = {};
  for (const f of result.finalOutput.files) {
    if (f.path in source) overrides[f.path] = f.content;
  }
  if (Object.keys(overrides).length === 0) throw new Error("CV Tailor returned no known section files");

  const contentBase64 = await compileCv(overrides);
  return { fileName: cvFileName(analysis.company), mimeType: "application/pdf", contentBase64 };
}
