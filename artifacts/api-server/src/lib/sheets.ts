import { google } from "googleapis";
import { logger } from "./logger";

const SPREADSHEET_ID = "1Px5UEwvvkg0fJJcRXOdJnIIspOqf9EwWPKkHIPrzSmY";
const SHEET_NAME = "Sheet1";
const DELIVERY_SHEET_NAME = "Delivery Records";
const HEADERS = ["Date", "Generator ID", "Status", "Rating", "Hours", "Remarks"];
const DELIVERY_HEADERS = ["Date", "Generator ID", "Status", "Rating", "Hours", "Remarks", "Delivery Status"];

export const PANEL_SHEETS = [
  { id: "C7",  title: "C7 - ECW",         prefixes: ["ECW"] },
  { id: "C9",  title: "C9 - LX9",         prefixes: ["LX9"] },
  { id: "C13", title: "C13 - DH40",        prefixes: ["DH40"] },
  { id: "C15", title: "C15 - LXJ/2S300",   prefixes: ["LXJ", "2S300"] },
  { id: "C18", title: "C18 - LXK",         prefixes: ["LXK"] },
] as const;

/** Maps a Generator ID prefix to its C Panel ID, or "Other" if unrecognised. */
export function getGeneratorPanel(generatorId: string): string {
  const id = (generatorId || "").toUpperCase().trim();
  if (id.startsWith("ECW"))  return "C7";
  if (id.startsWith("LX9"))  return "C9";
  if (id.startsWith("DH40")) return "C13";
  if (id.startsWith("LXJ") || id.startsWith("2S300")) return "C15";
  if (id.startsWith("LXK"))  return "C18";
  return "Other";
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/** Safely quote a sheet name for use in A1 range notation. */
function q(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

type SheetRow = {
  tDate: string;
  generatorId: string;
  status: string;
  rating?: string | null;
  hours?: number | null;
  remarks?: string | null;
  deliveryStatus?: string | null;
};

function toValues(rows: SheetRow[]): string[][] {
  return [
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
}

function toDeliveryValues(rows: SheetRow[]): string[][] {
  return [
    DELIVERY_HEADERS,
    ...rows.map((r) => [
      r.tDate ?? "",
      r.generatorId ?? "",
      r.status ?? "",
      r.rating ?? "",
      r.hours != null ? String(r.hours) : "",
      r.remarks ?? "",
      r.deliveryStatus === "current" ? "Current Delivery" : "Previous Delivery",
    ]),
  ];
}

/** In-memory flag so we only check for missing sub-sheets once per server start. */
let sheetsReady = false;

async function ensureAllSheets(sheets: ReturnType<typeof google.sheets>): Promise<void> {
  if (sheetsReady) return;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = new Set<string>(
    meta.data.sheets?.map((s) => s.properties?.title ?? "") ?? []
  );

  const allNeeded = [
    ...PANEL_SHEETS.map((p) => p.title),
    DELIVERY_SHEET_NAME,
  ];
  const toCreate = allNeeded.filter((title) => !existing.has(title));

  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: toCreate.map((title) => ({
          addSheet: { properties: { title } },
        })),
      },
    });
  }
  sheetsReady = true;
}

async function writeSheet(
  sheets: ReturnType<typeof google.sheets>,
  title: string,
  values: string[][]
): Promise<void> {
  const rangeRef = title === SHEET_NAME ? SHEET_NAME : q(title);
  const startRef = title === SHEET_NAME ? `${SHEET_NAME}!A1` : `${q(title)}!A1`;
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: rangeRef,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: startRef,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/**
 * Fully rebuilds Sheet1, all C Panel sub-sheets, and the Delivery Records sheet
 * from the current DB rows. Sub-sheets are created automatically on first call.
 */
export async function syncSheetFromDb(rows: SheetRow[]): Promise<void> {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    await ensureAllSheets(sheets);

    // Main sheet — all records
    await writeSheet(sheets, SHEET_NAME, toValues(rows));

    // C Panel sub-sheets — filtered by Generator ID prefix
    for (const panel of PANEL_SHEETS) {
      const panelRows = rows.filter((r) => {
        const id = (r.generatorId || "").toUpperCase().trim();
        return panel.prefixes.some((prefix) => id.startsWith(prefix.toUpperCase()));
      });
      await writeSheet(sheets, panel.title, toValues(panelRows));
    }

    // Delivery Records sheet — only current + previous delivery rows
    const deliveryRows = rows.filter(
      (r) => r.deliveryStatus === "current" || r.deliveryStatus === "previous"
    );
    await writeSheet(sheets, DELIVERY_SHEET_NAME, toDeliveryValues(deliveryRows));
  } catch (err) {
    logger.error({ err }, "Failed to sync sheet from DB");
  }
}
