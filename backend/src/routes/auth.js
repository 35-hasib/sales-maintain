import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { signToken, authRequired, requireRole } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;
    const officer = await prisma.officer.findUnique({ where: { email: email.toLowerCase() } });
    if (!officer || !(await bcrypt.compare(password, officer.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = signToken(officer);
    res.json({
      token,
      officer: {
        id: officer.id,
        name: officer.name,
        email: officer.email,
        role: officer.role,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get("/me", authRequired, async (req, res) => {
  res.json({ officer: req.officer });
});

// --- Officer management (admin only) ---
const createOfficerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().default("officer"),
});

router.get("/", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const [officers, total] = await Promise.all([
      prisma.officer.findMany({
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      prisma.officer.count(),
    ]);
    res.json({ officers, total, page, pageSize });
  } catch (e) {
    next(e);
  }
});

router.post("/", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const parsed = createOfficerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { name, email, password, role } = parsed.data;
    const exists = await prisma.officer.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ error: "Email already registered" });
    const officer = await prisma.officer.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 10),
        role,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.status(201).json({ officer });
  } catch (e) {
    next(e);
  }
});

const updateOfficerSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    role: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

router.put("/:id", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const parsed = updateOfficerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { name, email, password, role } = parsed.data;
    const exists = await prisma.officer.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.status(404).json({ error: "Officer not found" });
    if (email) {
      const conflict = await prisma.officer.findFirst({
        where: { email: email.toLowerCase(), NOT: { id: req.params.id } },
      });
      if (conflict) return res.status(409).json({ error: "Email already registered" });
    }
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email.toLowerCase();
    if (role !== undefined) data.role = role;
    if (password !== undefined) data.passwordHash = await bcrypt.hash(password, 10);
    const officer = await prisma.officer.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.json({ officer });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const exists = await prisma.officer.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.status(404).json({ error: "Officer not found" });

    const hasTransactions = await prisma.transaction.count({
      where: { officerId: req.params.id },
    });
    if (hasTransactions > 0) {
      return res.status(409).json({
        error: "Cannot delete this officer — they have transactions. Their data must be preserved for the audit trail.",
      });
    }

    // Remove their dealers (and any other owned data) before the officer.
    await prisma.dealer.deleteMany({ where: { ownerOfficer: req.params.id } });

    const officer = await prisma.officer.delete({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.json({ officer });
  } catch (e) {
    next(e);
  }
});

export default router;
