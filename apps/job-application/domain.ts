// Pure JobApplication domain: status model, transition rules, and message
// parsing. No I/O here so it is unit-testable without Encore or a database.

export type JobStatus =
  | "received"    // URL captured from Telegram
  | "analyzing"   // JD intelligence running
  | "matched"     // candidate-to-job match produced
  | "generating"  // CV / cover letter being built
  | "packaged"    // artifacts rendered and stored in Drive
  | "delivered"   // owner notified via Telegram
  | "failed";     // pipeline error, terminal until retried

/** Allowed forward transitions of the pipeline state machine. */
const TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  received: ["analyzing", "failed"],
  analyzing: ["matched", "failed"],
  matched: ["generating", "failed"],
  generating: ["packaged", "failed"],
  packaged: ["delivered", "failed"],
  delivered: [],
  failed: ["analyzing"], // retry re-enters the pipeline from analysis
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The next happy-path status after `current`, or null if terminal. */
export function nextStatus(current: JobStatus): JobStatus | null {
  const [next] = TRANSITIONS[current].filter((s) => s !== "failed");
  return next ?? null;
}

export const PIPELINE_ORDER: readonly JobStatus[] = ["received", "analyzing", "matched", "generating", "packaged", "delivered"];

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/i;

/** Extract the first URL from a Telegram message, if any. */
export function extractUrl(text: string | undefined): string | null {
  if (!text) return null;
  const match = text.match(URL_PATTERN);
  return match ? match[0] : null;
}

export interface JobApplication {
  id: string;
  sourceChatId: string;
  sourceUrl: string;
  status: JobStatus;
  title: string | null;
  company: string | null;
  cvDriveFileId: string | null;
  cvDriveLink: string | null;
  trackerRow: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

let counter = 0;
/** Generate a sortable-ish application id. */
export function newApplicationId(now: number = Date.now()): string {
  counter = (counter + 1) % 1000;
  return `app-${now.toString(36)}-${counter.toString(36).padStart(2, "0")}`;
}
