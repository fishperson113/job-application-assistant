import { config } from "./config.js";

// Thin typed adapter over the Corsair workload API. Mirrors the shapes of
// Corsair's /api/telegram/* and /api/google/* endpoints. The client never sees
// provider tokens — every call is addressed by a Corsair connectionId.

export class CorsairError extends Error {
  constructor(readonly status: number, message: string) {
    super(`Corsair ${status}: ${message}`);
    this.name = "CorsairError";
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const cfg = config();
  const response = await fetch(`${cfg.corsairUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.corsairApiKey}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new CorsairError(response.status, await response.text());
  return (await response.json()) as T;
}

export interface SentMessage { messageId: number; chatId: number; date: number }

export function sendTelegramMessage(input: { connectionId: string; chatId: string | number; text: string; parseMode?: "Markdown" | "MarkdownV2" | "HTML"; disableWebPagePreview?: boolean }): Promise<SentMessage> {
  return post<SentMessage>("/api/telegram/send", input);
}

export interface TelegramUpdate {
  updateId: number;
  message?: {
    messageId: number;
    date: number;
    text?: string;
    chat: { id: number; type: string; username?: string; title?: string };
    from?: { id: number; username?: string; firstName?: string };
  };
}

export async function getTelegramUpdates(input: { connectionId: string; offset?: number; limit?: number; timeout?: number }): Promise<TelegramUpdate[]> {
  const body = await post<{ updates: TelegramUpdate[] }>("/api/telegram/updates", input);
  return body.updates;
}

export interface DriveFile { id: string; name: string; webViewLink?: string; webContentLink?: string }

export function uploadDriveFile(input: { connectionId: string; name: string; mimeType: string; contentBase64: string; parents?: string[] }): Promise<DriveFile> {
  return post<DriveFile>("/api/google/drive/upload", input);
}

export type SheetValue = string | number | boolean | null;

export function appendSheetRows(input: { connectionId: string; spreadsheetId: string; range: string; values: SheetValue[][] }): Promise<{ updatedRange?: string; updatedRows?: number }> {
  return post("/api/google/sheets/append", input);
}

export function getSheetValues(input: { connectionId: string; spreadsheetId: string; range: string }): Promise<{ range?: string; values: SheetValue[][] }> {
  return post("/api/google/sheets/get", input);
}
