import { Router, type IRouter } from "express";
import { eq, ilike, and, gte, lte, or } from "drizzle-orm";
import { db, generatorsTable } from "@workspace/db";
import {
  ListGeneratorsQueryParams,
  CreateGeneratorBody,
  GetGeneratorParams,
  UpdateGeneratorParams,
  UpdateGeneratorBody,
  DeleteGeneratorParams,
} from "@workspace/api-zod";
import { syncSheetFromDb } from "../lib/sheets";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = (req.session as Record<string, unknown>).userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return userId;
}

async function getAllRowsForSync() {
  return db
    .select()
    .from(generatorsTable)
    .orderBy(generatorsTable.tDate, generatorsTable.generatorId);
}

router.get("/generators", async (req, res): Promise<void> => {
  if (requireAuth(req, res) === null) return;

  const qp = ListGeneratorsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const { search, status, generatorId, dateFrom, dateTo } = qp.data;
  const conditions = [];

  if (status) conditions.push(eq(generatorsTable.status, status));
  if (generatorId) conditions.push(ilike(generatorsTable.generatorId, `%${generatorId}%`));
  if (dateFrom) conditions.push(gte(generatorsTable.tDate, dateFrom));
  if (dateTo) conditions.push(lte(generatorsTable.tDate, dateTo));
  if (search) {
    conditions.push(
      or(
        ilike(generatorsTable.generatorId, `%${search}%`),
        ilike(generatorsTable.tDate, `%${search}%`),
        ilike(generatorsTable.remarks, `%${search}%`)
      )!
    );
  }

  const rows = await db
    .select()
    .from(generatorsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(generatorsTable.tDate, generatorsTable.generatorId);

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.get("/generators/stats", async (req, res): Promise<void> => {
  if (requireAuth(req, res) === null) return;

  const all = await db.select().from(generatorsTable);
  const total = all.length;

  const statusMap: Record<string, number> = {};
  let hoursSum = 0;
  let hoursCount = 0;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentCutoff = sevenDaysAgo.toISOString().split("T")[0];
  let recentCount = 0;

  for (const r of all) {
    statusMap[r.status] = (statusMap[r.status] ?? 0) + 1;
    if (r.hours != null) {
      hoursSum += r.hours;
      hoursCount++;
    }
    if (r.tDate >= recentCutoff) recentCount++;
  }

  const byStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));
  const avgHours = hoursCount > 0 ? Math.round((hoursSum / hoursCount) * 10) / 10 : null;
  const currentDelivery = all.filter((r) => r.deliveryStatus === "current").length;
  const previousDelivery = all.filter((r) => r.deliveryStatus === "previous").length;

  res.json({ total, byStatus, avgHours, recentCount, currentDelivery, previousDelivery });
});

router.post("/generators", async (req, res): Promise<void> => {
  if (requireAuth(req, res) === null) return;

  const parsed = CreateGeneratorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [record] = await db.insert(generatorsTable).values(parsed.data).returning();

  // Rebuild sheet from full DB state
  getAllRowsForSync().then(rows => syncSheetFromDb(rows)).catch(() => {});

  res.status(201).json({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
});

router.get("/generators/:id", async (req, res): Promise<void> => {
  if (requireAuth(req, res) === null) return;

  const params = GetGeneratorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db.select().from(generatorsTable).where(eq(generatorsTable.id, params.data.id));
  if (!record) {
    res.status(404).json({ error: "Generator record not found" });
    return;
  }

  res.json({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
});

router.patch("/generators/:id", async (req, res): Promise<void> => {
  if (requireAuth(req, res) === null) return;

  const params = UpdateGeneratorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGeneratorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [record] = await db
    .update(generatorsTable)
    .set(parsed.data)
    .where(eq(generatorsTable.id, params.data.id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Generator record not found" });
    return;
  }

  // Rebuild sheet from full DB state
  getAllRowsForSync().then(rows => syncSheetFromDb(rows)).catch(() => {});

  res.json({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
});

router.delete("/generators/:id", async (req, res): Promise<void> => {
  if (requireAuth(req, res) === null) return;

  const params = DeleteGeneratorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db
    .delete(generatorsTable)
    .where(eq(generatorsTable.id, params.data.id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Generator record not found" });
    return;
  }

  // Rebuild sheet from remaining DB rows — if empty, sheet will only have headers
  getAllRowsForSync().then(rows => syncSheetFromDb(rows)).catch(() => {});

  res.json({ message: "Deleted" });
});

export default router;
