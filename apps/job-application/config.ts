import { secret } from "encore.dev/config";

// Corsair endpoint + workload Bearer key. The client only ever knows the
// Corsair URL/key and connection IDs — never provider OAuth tokens or secrets.
const corsairUrl = secret<"CORSAIR_URL">("CORSAIR_URL");
const corsairApiKey = secret<"CORSAIR_API_KEY">("CORSAIR_API_KEY");
const telegramConnectionId = secret<"TELEGRAM_CONNECTION_ID">("TELEGRAM_CONNECTION_ID");
const googleConnectionId = secret<"GOOGLE_CONNECTION_ID">("GOOGLE_CONNECTION_ID");
const trackerSpreadsheetId = secret<"TRACKER_SPREADSHEET_ID">("TRACKER_SPREADSHEET_ID");
const ownerChatId = secret<"OWNER_CHAT_ID">("OWNER_CHAT_ID");

export interface WorkloadConfig {
  corsairUrl: string;
  corsairApiKey: string;
  telegramConnectionId: string;
  googleConnectionId: string;
  trackerSpreadsheetId: string;
  ownerChatId: string;
}

export function config(): WorkloadConfig {
  return {
    corsairUrl: corsairUrl() || "http://127.0.0.1:4000",
    corsairApiKey: corsairApiKey(),
    telegramConnectionId: telegramConnectionId(),
    googleConnectionId: googleConnectionId(),
    trackerSpreadsheetId: trackerSpreadsheetId(),
    ownerChatId: ownerChatId(),
  };
}
