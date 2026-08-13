import { db } from "./db.js";
import type { JobApplication, JobStatus } from "./domain.js";

interface Row {
  id: string;
  source_chat_id: string;
  source_url: string;
  status: string;
  title: string | null;
  company: string | null;
  cv_drive_file_id: string | null;
  cv_drive_link: string | null;
  tracker_row: string | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

function toApplication(row: Row): JobApplication {
  return {
    id: row.id,
    sourceChatId: row.source_chat_id,
    sourceUrl: row.source_url,
    status: row.status as JobStatus,
    title: row.title,
    company: row.company,
    cvDriveFileId: row.cv_drive_file_id,
    cvDriveLink: row.cv_drive_link,
    trackerRow: row.tracker_row,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createApplication(id: string, sourceChatId: string, sourceUrl: string): Promise<JobApplication> {
  const row = await db.queryRow<Row>`
    INSERT INTO job_applications (id, source_chat_id, source_url, status)
    VALUES (${id}, ${sourceChatId}, ${sourceUrl}, 'received')
    RETURNING *`;
  return toApplication(row!);
}

export interface ApplicationPatch {
  status?: JobStatus;
  title?: string | null;
  company?: string | null;
  cvDriveFileId?: string | null;
  cvDriveLink?: string | null;
  trackerRow?: string | null;
  error?: string | null;
}

export async function updateApplication(id: string, patch: ApplicationPatch): Promise<void> {
  await db.exec`
    UPDATE job_applications SET
      status = COALESCE(${patch.status ?? null}, status),
      title = COALESCE(${patch.title ?? null}, title),
      company = COALESCE(${patch.company ?? null}, company),
      cv_drive_file_id = COALESCE(${patch.cvDriveFileId ?? null}, cv_drive_file_id),
      cv_drive_link = COALESCE(${patch.cvDriveLink ?? null}, cv_drive_link),
      tracker_row = COALESCE(${patch.trackerRow ?? null}, tracker_row),
      error = ${patch.error ?? null},
      updated_at = now()
    WHERE id = ${id}`;
}

export async function listApplications(limit = 50): Promise<JobApplication[]> {
  const rows = await db.query<Row>`SELECT * FROM job_applications ORDER BY created_at DESC LIMIT ${limit}`;
  const out: JobApplication[] = [];
  for await (const row of rows) out.push(toApplication(row));
  return out;
}

export async function getApplication(id: string): Promise<JobApplication | null> {
  const row = await db.queryRow<Row>`SELECT * FROM job_applications WHERE id = ${id}`;
  return row ? toApplication(row) : null;
}

export async function getOffset(): Promise<number> {
  const row = await db.queryRow<{ telegram_offset: number }>`SELECT telegram_offset FROM poller_state WHERE id = 1`;
  return Number(row?.telegram_offset ?? 0);
}

export async function setOffset(offset: number): Promise<void> {
  await db.exec`UPDATE poller_state SET telegram_offset = ${offset} WHERE id = 1`;
}

/** Returns true if this update was newly recorded (i.e. not seen before). */
export async function claimUpdate(updateId: number): Promise<boolean> {
  const row = await db.queryRow<{ update_id: number }>`
    INSERT INTO processed_updates (update_id) VALUES (${updateId})
    ON CONFLICT (update_id) DO NOTHING
    RETURNING update_id`;
  return row !== null;
}
