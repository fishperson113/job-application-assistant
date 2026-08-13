import { secret } from "encore.dev/config";

// Corsair endpoint + workload Bearer key. The client only ever knows the
// Corsair URL/key and connection IDs — never provider OAuth tokens or secrets.
const corsairUrl = secret<"CORSAIR_URL">("CORSAIR_URL");
const corsairApiKey = secret<"CORSAIR_API_KEY">("CORSAIR_API_KEY");
const telegramConnectionId = secret<"TELEGRAM_CONNECTION_ID">("TELEGRAM_CONNECTION_ID");
const googleConnectionId = secret<"GOOGLE_CONNECTION_ID">("GOOGLE_CONNECTION_ID");
const trackerSpreadsheetId = secret<"TRACKER_SPREADSHEET_ID">("TRACKER_SPREADSHEET_ID");
const ownerChatId = secret<"OWNER_CHAT_ID">("OWNER_CHAT_ID");
const openaiApiKey = secret<"OPENAI_API_KEY">("OPENAI_API_KEY");
// The owner's canonical CV in LaTeX. Stored as a secret (not committed) so it
// stays private and out of the bundle. Set with: encore secret set CV_TEX < cv.tex
const cvTex = secret<"CV_TEX">("CV_TEX");
// URL of the self-hosted tectonic compile service (POST LaTeX -> PDF).
const latexCompileUrl = secret<"LATEX_COMPILE_URL">("LATEX_COMPILE_URL");

export interface WorkloadConfig {
  corsairUrl: string;
  corsairApiKey: string;
  telegramConnectionId: string;
  googleConnectionId: string;
  trackerSpreadsheetId: string;
  ownerChatId: string;
  openaiApiKey: string;
  cvTex: string;
  latexCompileUrl: string;
}

export function config(): WorkloadConfig {
  return {
    corsairUrl: corsairUrl() || "http://127.0.0.1:4000",
    corsairApiKey: corsairApiKey(),
    telegramConnectionId: telegramConnectionId(),
    googleConnectionId: googleConnectionId(),
    trackerSpreadsheetId: trackerSpreadsheetId(),
    ownerChatId: ownerChatId(),
    openaiApiKey: openaiApiKey(),
    cvTex: cvTex(),
    latexCompileUrl: latexCompileUrl(),
  };
}

// LLM model for the agent pipeline. Change here if your OpenAI key has access
// to a different model.
export const OPENAI_MODEL = "gpt-4o-mini";
