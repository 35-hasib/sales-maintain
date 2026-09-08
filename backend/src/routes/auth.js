import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { signToken, authRequired, requireRole } from "../middleware/auth.js";
import { deleteOfficerAndData } from "../services/officerCleanup.js";

const router = Router();

const loginSchema = z
  .object({
    identifier: z.string().min(1).optional(),
    email: z.string().min(1).optional(),
    password: z.string().min(1),
  })
  .refine((v) => v.identifier || v.email, { message: "identifier (email or mobile) is required" });

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { password } = parsed.data;
    const raw = (parsed.data.identifier ?? parsed.data.email ?? "").trim();
    const officer = await prisma.officer.findFirst({
      where: {
        OR: [{ email: raw.toLowerCase() }, { phone: raw }],
      },
    });
    if (!officer || !(await bcrypt.compare(password, officer.passwordHash))) {
      return res.status(401).json({ error: "Invalid email/phone or password" });
    }
    const token = signToken(officer);
    res.json({
      token,
      officer: {
        id: officer.id,
        name: officer.name,
        email: officer.email,
        phone: officer.phone,
        role: officer.role,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get("/me", authRequired, async (req, res, next) => {
  try {
    const officer = await prisma.officer.findUnique({
      where: { id: req.officer.id },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    });
    if (!officer) return res.status(401).json({ error: "Account no longer exists" });
    res.json({ officer });
  } catch (e) {
    next(e);
  }
});

// --- Officer management (admin only) ---
const createOfficerSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    password: z.string().min(6),
    role: z.string().default("officer"),
  })
  .refine((v) => v.email || v.phone, { message: "Provide an email or a mobile number" });

router.get("/", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const [officers, total] = await Promise.all([
      prisma.officer.findMany({
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
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
    const { name, email, phone, password, role } = parsed.data;
    const data = {
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role,
    };
    if (email !== undefined) data.email = email.toLowerCase();
    if (phone !== undefined) data.phone = phone;

    const conflict = await prisma.officer.findFirst({
      where: {
        OR: [
          ...(data.email ? [{ email: data.email }] : []),
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
    });
    if (conflict) return res.status(409).json({ error: "Email or mobile number already registered" });

    const officer = await prisma.officer.create({
      data,
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
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
    phone: z.string().min(1).nullable().optional(),
    password: z.string().min(6).optional(),
    role: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

router.put("/:id", authRequired, async (req, res, next) => {
  try {
    // Admins may update anyone; officers may only update their own account.
    if (req.officer.role !== "admin" && req.officer.id !== req.params.id) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const parsed = updateOfficerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { name, email, phone, password, role } = parsed.data;
    if (role !== undefined && req.officer.role !== "admin") {
      return res.status(403).json({ error: "Only an admin can change the role" });
    }
    const exists = await prisma.officer.findUnique({ where: { id: req.params.id } });
    if (!exists) return res.status(404).json({ error: "Officer not found" });

    const data = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role;
    if (password !== undefined) data.passwordHash = await bcrypt.hash(password, 10);

    const checkOr = [];
    if (email !== undefined) {
      const em = email.toLowerCase();
      data.email = em;
      checkOr.push({ email: em });
    }
    if (phone !== undefined) {
      data.phone = phone;
      checkOr.push({ phone });
    }
    if (checkOr.length) {
      const conflict = await prisma.officer.findFirst({
        where: {
          OR: checkOr,
          NOT: { id: req.params.id },
        },
      });
      if (conflict) return res.status(409).json({ error: "Email or mobile number already registered" });
    }

    const officer = await prisma.officer.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    });
    res.json({ officer });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", authRequired, async (req, res, next) => {
  try {
    // Admins may delete anyone (except themselves); officers may delete only their own account.
    if (req.officer.role !== "admin" && req.officer.id !== req.params.id) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const target = await prisma.officer.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    });
    if (!target) return res.status(404).json({ error: "Officer not found" });

    if (target.id === req.officer.id && target.role === "admin") {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    if (target.role === "admin") {
      const adminCount = await prisma.officer.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return res.status(409).json({ error: "Cannot delete the last admin account" });
      }
    }

    await deleteOfficerAndData(target.id);

    res.json({ officer: target });
  } catch (e) {
    next(e);
  }
});

export default router;
