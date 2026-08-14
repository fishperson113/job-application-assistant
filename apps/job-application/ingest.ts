import log from "encore.dev/log";
import { config } from "./config.js";
import { appendSheetRows, getTelegramUpdates, sendTelegramMessage, uploadDriveFile } from "./corsair.js";
import { extractUrl, newApplicationId, type JobApplication } from "./domain.js";
import { fetchJobText } from "./pipeline.js";
import { fetchCvSource } from "./latex.js";
import { analyzeJobDescription, buildCv, matchCandidate } from "./agents.js";
import { claimUpdate, createApplication, getOffset, setOffset, updateApplication } from "./store.js";

/** Walk one application through the pipeline, making all provider calls through Corsair. */
export async function processApplication(app: JobApplication): Promise<void> {
  const cfg = config();
  try {
    await updateApplication(app.id, { status: "analyzing" });
    const [jobText, source] = await Promise.all([fetchJobText(app.sourceUrl), fetchCvSource()]);
    const analysis = await analyzeJobDescription(app.sourceUrl, jobText);
    await updateApplication(app.id, { title: analysis.title, company: analysis.company });

    await updateApplication(app.id, { status: "matched" });
    const match = await matchCandidate(analysis, source.files);

    await updateApplication(app.id, { status: "generating" });
    const cv = await buildCv(analysis, match, source.files);
    const file = await uploadDriveFile({ connectionId: cfg.googleConnectionId, name: cv.fileName, mimeType: cv.mimeType, contentBase64: cv.contentBase64 });
    await updateApplication(app.id, { status: "packaged", cvDriveFileId: file.id, cvDriveLink: file.webViewLink ?? null });

    const appliedAt = new Date().toISOString();
    await appendSheetRows({
      connectionId: cfg.googleConnectionId,
      spreadsheetId: cfg.trackerSpreadsheetId,
      range: "A1",
      values: [[appliedAt, analysis.company, analysis.title, app.sourceUrl, "applied", file.webViewLink ?? ""]],
    });
    await updateApplication(app.id, { status: "delivered", trackerRow: appliedAt });

    await sendTelegramMessage({
      connectionId: cfg.telegramConnectionId,
      chatId: app.sourceChatId,
      text: `✅ ${analysis.title} — ${analysis.company}\nCV: ${file.webViewLink ?? "(stored in Drive)"}`,
    });
    log.info("application delivered", { id: app.id, company: analysis.company });
  } catch (err) {
    const message = err instanceof Error ? err.message : "pipeline failed";
    await updateApplication(app.id, { status: "failed", error: message });
    log.error("pipeline failed", { id: app.id, error: message });
    await sendTelegramMessage({ connectionId: cfg.telegramConnectionId, chatId: app.sourceChatId, text: `⚠️ Could not process ${app.sourceUrl}: ${message}` }).catch(() => undefined);
  }
}

/** Poll Corsair for new Telegram messages, create applications for URLs, and process them. */
export async function pollOnce(): Promise<{ polled: number; created: number }> {
  const cfg = config();
  const offset = await getOffset();
  const updates = await getTelegramUpdates({ connectionId: cfg.telegramConnectionId, offset: offset || undefined, timeout: 0 });

  let created = 0;
  let maxUpdateId = offset > 0 ? offset - 1 : 0;
  for (const u of updates) {
    maxUpdateId = Math.max(maxUpdateId, u.updateId);
    const isNew = await claimUpdate(u.updateId);
    if (!isNew) continue;

    const url = extractUrl(u.message?.text);
    const chatId = u.message?.chat.id;
    if (!url || chatId === undefined) continue;

    const app = await createApplication(newApplicationId(), String(chatId), url);
    created++;
    await sendTelegramMessage({ connectionId: cfg.telegramConnectionId, chatId, text: `📥 Received: ${url}\nProcessing…` }).catch(() => undefined);
    await processApplication(app);
  }

  if (updates.length > 0) await setOffset(maxUpdateId + 1);
  return { polled: updates.length, created };
}
