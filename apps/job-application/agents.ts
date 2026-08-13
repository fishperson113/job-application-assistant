import { Agent, run, setDefaultOpenAIKey } from "@openai/agents";
import { z } from "zod";
import { config, OPENAI_MODEL } from "./config.js";
import { cvFileName, unwrapCodeFence, type GeneratedCv, type JobAnalysis, type MatchReport } from "./pipeline.js";
import { compileToPdf } from "./latex.js";

// Multi-agent pipeline on the OpenAI Agents SDK. Three specialized agents run in
// sequence: Analyst (JD -> structure), Matcher (CV + structure -> fit), Writer
// (tailor the owner's real cv.tex to the job). The owner's LaTeX CV is the only
// evidence; agents must not fabricate anything not present in it.

let keyConfigured = false;
function ensureKey(): void {
  const key = config().openaiApiKey;
  if (!key) throw new Error("OPENAI_API_KEY is not set; add it as an Encore secret");
  if (!keyConfigured) {
    setDefaultOpenAIKey(key);
    keyConfigured = true;
  }
}

function baseCv(): string {
  const tex = config().cvTex;
  if (!tex.trim()) throw new Error("CV_TEX is not set; store your cv.tex as an Encore secret");
  return tex;
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
    "You assess how well a candidate fits a job. The candidate's evidence is their LaTeX CV. Given that CV and the structured job analysis, produce a 0..1 fit score, concrete strengths that map CV evidence to the job's requirements, and honest gaps. Ground every strength in the CV; never fabricate experience.",
  outputType: MatchReportSchema,
});

const writer = new Agent({
  name: "CV Tailor",
  model: OPENAI_MODEL,
  instructions: [
    "You tailor an existing LaTeX CV to a specific job. You are given the owner's complete cv.tex, the job analysis, and the match report.",
    "Edit ONLY to fit the job: the headline/title, the objective/summary, the ordering and emphasis of skills, and which existing experience bullets are highlighted. Rephrase existing content to mirror the job's keywords where truthful.",
    "STRICT RULES: Do not invent employers, roles, dates, degrees, or achievements. Every fact must already exist in the provided CV. Keep the same LaTeX document class, packages, and overall structure so it still compiles. Do not add commentary.",
    "Return ONLY the complete tailored LaTeX document — no Markdown fences, no explanation.",
  ].join("\n"),
});

export async function analyzeJobDescription(url: string, jobText: string): Promise<JobAnalysis> {
  ensureKey();
  const result = await run(analyst, `Job URL: ${url}\n\nJob posting text:\n${jobText}`);
  if (!result.finalOutput) throw new Error("JD Analyst returned no output");
  return result.finalOutput;
}

export async function matchCandidate(analysis: JobAnalysis): Promise<MatchReport> {
  ensureKey();
  const input = `Candidate CV (LaTeX):\n${baseCv()}\n\nJob analysis (JSON):\n${JSON.stringify(analysis, null, 2)}`;
  const result = await run(matcher, input);
  if (!result.finalOutput) throw new Error("Candidate Matcher returned no output");
  return result.finalOutput;
}

/** Tailor the owner's cv.tex to the job and compile it to a PDF via the self-hosted service. */
export async function buildCv(analysis: JobAnalysis, match: MatchReport): Promise<GeneratedCv> {
  ensureKey();
  const input = [
    `Owner's base CV (cv.tex):\n${baseCv()}`,
    `Job analysis (JSON):\n${JSON.stringify(analysis)}`,
    `Match report (JSON):\n${JSON.stringify(match)}`,
    `Produce the tailored cv.tex now.`,
  ].join("\n\n");
  const result = await run(writer, input);
  const tex = unwrapCodeFence(result.finalOutput ?? "");
  if (!tex.includes("\\documentclass")) throw new Error("CV Tailor did not return a full LaTeX document");
  const contentBase64 = await compileToPdf(tex);
  return { fileName: cvFileName(analysis.company), mimeType: "application/pdf", contentBase64 };
}
