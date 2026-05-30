import { Router, type IRouter } from "express";
import { eq, or, and } from "drizzle-orm";
import { db, usersTable, demoUsersTable } from "@workspace/db";
import { LoginBody, RegisterBody, CreateDemoUserBody, UpdateDemoUserBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword } from "../lib/auth";

const router: IRouter = Router();

function requireAdmin(req: any, res: any): number | null {
  const userId = (req.session as Record<string, unknown>).userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  if ((req.session as any).isDemoUser) {
    res.status(403).json({ error: "Only administrators can perform this action" });
    return null;
  }
  return userId;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;

  // 1. Try to find the user in usersTable (admin user)
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (user) {
    if (!verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    (req.session as any).userId = user.id;
    (req.session as any).isDemoUser = false;
    res.json({
      user: { id: user.id, username: user.username, email: user.email, sheetLink: user.sheetLink, isDemoUser: false },
      message: "Logged in"
    });
    return;
  }

  // 2. Try to find the user in demoUsersTable (demo user)
  const [demoUser] = await db.select().from(demoUsersTable).where(eq(demoUsersTable.username, username));
  if (demoUser) {
    if (!demoUser.isActive) {
      res.status(401).json({ error: "Account has been deactivated by administrator" });
      return;
    }
    if (demoUser.expiresAt && new Date() > new Date(demoUser.expiresAt)) {
      res.status(401).json({ error: "Demo account has expired" });
      return;
    }
    if (!verifyPassword(password, demoUser.passwordHash)) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    // Fetch the admin user info to copy their email and sheetLink
    const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, demoUser.adminId));
    if (!admin) {
      res.status(401).json({ error: "Administrator account not found" });
      return;
    }

    (req.session as any).userId = admin.id; // Map to the admin user id so all generator queries scope to admin!
    (req.session as any).isDemoUser = true;
    (req.session as any).demoUserId = demoUser.id;
    (req.session as any).demoPermissions = demoUser.permissions;

    res.json({
      user: {
        id: admin.id,
        username: demoUser.username,
        email: admin.email,
        sheetLink: admin.sheetLink,
        isDemoUser: true,
        permissions: demoUser.permissions,
      },
      message: "Logged in as demo user"
    });
    return;
  }

  res.status(401).json({ error: "Invalid username or password" });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, email, password, sheetLink } = parsed.data;

  // Enforce unique username or email
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.username, username), eq(usersTable.email, email)));

  if (existing) {
    if (existing.username.toLowerCase() === username.toLowerCase()) {
      res.status(409).json({ error: "Username already taken" });
    } else {
      res.status(409).json({ error: "Email already registered" });
    }
    return;
  }

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({ username, email, passwordHash, sheetLink }).returning();
  (req.session as any).userId = user.id;
  (req.session as any).isDemoUser = false;

  res.status(201).json({
    user: { id: user.id, username: user.username, email: user.email, sheetLink: user.sheetLink, isDemoUser: false },
    message: "Registered"
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // If this is a demo user, check status in DB dynamically
  if ((req.session as any).isDemoUser) {
    const demoUserId = (req.session as any).demoUserId;
    const [demoUser] = await db.select().from(demoUsersTable).where(eq(demoUsersTable.id, demoUserId));
    if (!demoUser || !demoUser.isActive || (demoUser.expiresAt && new Date() > new Date(demoUser.expiresAt))) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Your demo session has expired or been deactivated" });
      return;
    }
    const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, demoUser.adminId));
    if (!admin) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Administrator account not found" });
      return;
    }
    res.json({
      id: admin.id,
      username: demoUser.username,
      email: admin.email,
      sheetLink: admin.sheetLink,
      isDemoUser: true,
      permissions: demoUser.permissions,
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, username: user.username, email: user.email, sheetLink: user.sheetLink, isDemoUser: false });
});

// Demo User CRUD routes
router.get("/auth/demo-users", async (req, res): Promise<void> => {
  const adminId = requireAdmin(req, res);
  if (adminId === null) return;

  const users = await db
    .select()
    .from(demoUsersTable)
    .where(eq(demoUsersTable.adminId, adminId))
    .orderBy(demoUsersTable.createdAt);

  res.json(users.map(u => ({
    id: u.id,
    username: u.username,
    permissions: u.permissions,
    isActive: u.isActive,
    expiresAt: u.expiresAt ? u.expiresAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  })));
});

router.post("/auth/demo-users", async (req, res): Promise<void> => {
  const adminId = requireAdmin(req, res);
  if (adminId === null) return;

  const parsed = CreateDemoUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, permissions, isActive, duration } = parsed.data;

  // 1. Enforce max limit of 5 demo users
  const existingUsers = await db
    .select()
    .from(demoUsersTable)
    .where(eq(demoUsersTable.adminId, adminId));

  if (existingUsers.length >= 5) {
    res.status(400).json({ error: "Maximum limit of 5 demo users reached" });
    return;
  }

  // 2. Enforce unique username globally or for the demo user
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));
  if (existingUser) {
    res.status(400).json({ error: "Username already taken by an administrator account" });
    return;
  }

  const [existingDemo] = await db
    .select()
    .from(demoUsersTable)
    .where(eq(demoUsersTable.username, username));
  if (existingDemo) {
    res.status(400).json({ error: "Username already taken by a demo user account" });
    return;
  }

  // 3. Compute expiresAt
  let expiresAt: Date | null = null;
  if (duration && duration !== "none") {
    expiresAt = new Date();
    if (duration === "1h") {
      expiresAt.setHours(expiresAt.getHours() + 1);
    } else if (duration === "5h") {
      expiresAt.setHours(expiresAt.getHours() + 5);
    } else if (duration === "24h") {
      expiresAt.setHours(expiresAt.getHours() + 24);
    } else if (duration === "1w") {
      expiresAt.setDate(expiresAt.getDate() + 7);
    } else if (duration === "1m") {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }
  }

  const passwordHash = hashPassword(password);
  const [newDemo] = await db
    .insert(demoUsersTable)
    .values({
      adminId,
      username,
      passwordHash,
      permissions,
      isActive,
      expiresAt,
    })
    .returning();

  res.status(201).json({
    id: newDemo.id,
    username: newDemo.username,
    permissions: newDemo.permissions,
    isActive: newDemo.isActive,
    expiresAt: newDemo.expiresAt ? newDemo.expiresAt.toISOString() : null,
    createdAt: newDemo.createdAt.toISOString(),
  });
});

router.patch("/auth/demo-users/:id", async (req, res): Promise<void> => {
  const adminId = requireAdmin(req, res);
  if (adminId === null) return;

  const demoId = parseInt(req.params.id);
  if (isNaN(demoId)) {
    res.status(400).json({ error: "Invalid demo user ID" });
    return;
  }

  const parsed = UpdateDemoUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(demoUsersTable)
    .where(and(eq(demoUsersTable.id, demoId), eq(demoUsersTable.adminId, adminId)));

  if (!existing) {
    res.status(404).json({ error: "Demo user not found" });
    return;
  }

  const updateData: any = {};
  if (parsed.data.permissions !== undefined) {
    updateData.permissions = parsed.data.permissions;
  }
  if (parsed.data.isActive !== undefined) {
    updateData.isActive = parsed.data.isActive;
  }
  if (parsed.data.password !== undefined && parsed.data.password !== "") {
    updateData.passwordHash = hashPassword(parsed.data.password);
  }
  if (parsed.data.duration !== undefined) {
    let expiresAt: Date | null = null;
    if (parsed.data.duration !== "none") {
      expiresAt = new Date();
      if (parsed.data.duration === "1h") {
        expiresAt.setHours(expiresAt.getHours() + 1);
      } else if (parsed.data.duration === "5h") {
        expiresAt.setHours(expiresAt.getHours() + 5);
      } else if (parsed.data.duration === "24h") {
        expiresAt.setHours(expiresAt.getHours() + 24);
      } else if (parsed.data.duration === "1w") {
        expiresAt.setDate(expiresAt.getDate() + 7);
      } else if (parsed.data.duration === "1m") {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }
    }
    updateData.expiresAt = expiresAt;
  }

  const [updated] = await db
    .update(demoUsersTable)
    .set(updateData)
    .where(eq(demoUsersTable.id, demoId))
    .returning();

  res.json({
    id: updated.id,
    username: updated.username,
    permissions: updated.permissions,
    isActive: updated.isActive,
    expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/auth/demo-users/:id", async (req, res): Promise<void> => {
  const adminId = requireAdmin(req, res);
  if (adminId === null) return;

  const demoId = parseInt(req.params.id);
  if (isNaN(demoId)) {
    res.status(400).json({ error: "Invalid demo user ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(demoUsersTable)
    .where(and(eq(demoUsersTable.id, demoId), eq(demoUsersTable.adminId, adminId)));

  if (!existing) {
    res.status(404).json({ error: "Demo user not found" });
    return;
  }

  await db
    .delete(demoUsersTable)
    .where(eq(demoUsersTable.id, demoId));

  res.json({ message: "Demo user deleted successfully" });
});

export default router;
