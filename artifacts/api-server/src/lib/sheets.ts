import { google } from "googleapis";
import { logger } from "./logger";

const SPREADSHEET_ID = "1pKRp73v-fZmbCzVY-gjGZzUZNF9GA09v1U-EIWP93vY";
const SHEET_NAME = "Sheet1";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }
  const creds = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function appendRowToSheet(row: (string | number | null | undefined)[]) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row.map((v) => (v == null ? "" : String(v)))],
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to append row to Google Sheet");
  }
}

export async function updateRowInSheet(rowIndex: number, row: (string | number | null | undefined)[]) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    // rowIndex is 1-based, row 1 is header
    const range = `${SHEET_NAME}!A${rowIndex}:F${rowIndex}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row.map((v) => (v == null ? "" : String(v)))],
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to update row in Google Sheet");
  }
}

export async function deleteRowInSheet(rowIndex: number) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    // Get sheet ID first
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = meta.data.sheets?.find(
      (s) => s.properties?.title === SHEET_NAME
    );
    const sheetId = sheet?.properties?.sheetId ?? 0;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex - 1, // 0-based
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to delete row in Google Sheet");
  }
}

export async function getAllSheetRows(): Promise<string[][]> {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
    });
    return (res.data.values as string[][]) ?? [];
  } catch (err) {
    logger.error({ err }, "Failed to read rows from Google Sheet");
    return [];
  }
}
