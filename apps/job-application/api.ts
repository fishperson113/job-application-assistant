import { api } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { pollOnce } from "./ingest.js";
import { getApplication, listApplications } from "./store.js";
import type { JobStatus } from "./domain.js";

export const health = api(
  { method: "GET", path: "/health", expose: true },
  async (): Promise<{ status: string; system: string; version: string }> => ({ status: "ok", system: "job-application-assistant", version: "0.1.0" }),
);

interface ApplicationDTO {
  id: string;
  status: JobStatus;
  sourceUrl: string;
  title: string | null;
  company: string | null;
  cvDriveLink: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export const applications = api(
  { method: "GET", path: "/applications", expose: true },
  async (): Promise<{ applications: ApplicationDTO[] }> => {
    const rows = await listApplications();
    return {
      applications: rows.map((a) => ({
        id: a.id,
        status: a.status,
        sourceUrl: a.sourceUrl,
        title: a.title,
        company: a.company,
        cvDriveLink: a.cvDriveLink,
        error: a.error,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    };
  },
);

export const application = api(
  { method: "GET", path: "/applications/:id", expose: true },
  async ({ id }: { id: string }): Promise<{ found: boolean; status?: JobStatus; sourceUrl?: string; cvDriveLink?: string | null; error?: string | null }> => {
    const a = await getApplication(id);
    if (!a) return { found: false };
    return { found: true, status: a.status, sourceUrl: a.sourceUrl, cvDriveLink: a.cvDriveLink, error: a.error };
  },
);

// Poll Corsair for new Telegram messages and process any job URLs found.
// Runs on a schedule and can also be triggered manually for testing.
export const pollTelegram = api(
  { method: "POST", path: "/ingest/poll", expose: true },
  async (): Promise<{ polled: number; created: number }> => pollOnce(),
);

const _pollCron = new CronJob("poll-telegram", {
  title: "Poll Telegram via Corsair",
  every: "1m",
  endpoint: pollTelegram,
});
