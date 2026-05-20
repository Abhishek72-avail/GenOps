import { google } from "googleapis";
import { logger } from "./logger";

const SPREADSHEET_ID = "1Px5UEwvvkg0fJJcRXOdJnIIspOqf9EwWPKkHIPrzSmY";
const SHEET_NAME = "Sheet1";
const HEADERS = ["Date", "Generator ID", "Status", "Rating", "Hours", "Remarks"];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

type SheetRow = {
  tDate: string;
  generatorId: string;
  status: string;
  rating?: string | null;
  hours?: number | null;
  remarks?: string | null;
};

/**
 * Fully rebuilds the Google Sheet from the current DB rows.
 * This is the only sync function used — no row-index guessing needed.
 * Row 1 = headers, rows 2+ = data sorted by date then generatorId.
 */
export async function syncSheetFromDb(rows: SheetRow[]): Promise<void> {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const values: string[][] = [
      HEADERS,
      ...rows.map((r) => [
        r.tDate ?? "",
        r.generatorId ?? "",
        r.status ?? "",
        r.rating ?? "",
        r.hours != null ? String(r.hours) : "",
        r.remarks ?? "",
      ]),
    ];

    // Clear entire sheet first
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}`,
    });

    // Write fresh data
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to sync sheet from DB");
  }
}
