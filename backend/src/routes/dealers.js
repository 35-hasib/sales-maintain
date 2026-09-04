import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { parseMoney, moneyToString } from "../money.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

const dealerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * pageSize;

    const where = {
      ownerOfficer: req.officer.id,
      ...(req.query.q
        ? {
            OR: [
              { name: { contains: req.query.q, mode: "insensitive" } },
              { phone: { contains: req.query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [dealers, total] = await Promise.all([
      prisma.dealer.findMany({
        where,
        orderBy: { name: "asc" },
        take: pageSize,
        skip: offset,
        include: {
          _count: { select: { transactionsAsSeller: true, transactionsAsBuyer: true } },
        },
      }),
      prisma.dealer.count({ where }),
    ]);

    res.json({ dealers, total, page, pageSize });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const dealer = await prisma.dealer.findFirst({
      where: { id: req.params.id, ownerOfficer: req.officer.id },
    });
    if (!dealer) return res.status(404).json({ error: "Dealer not found" });

    const [asSeller, asBuyer] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT s.* FROM transaction_summary s
         WHERE s.seller_dealer_id = $1::uuid AND s.officer_id = $2::uuid
         ORDER BY s.transaction_date DESC`,
        req.params.id,
        req.officer.id
      ),
      prisma.$queryRawUnsafe(
        `SELECT s.* FROM transaction_summary s
         WHERE s.buyer_dealer_id = $1::uuid AND s.officer_id = $2::uuid
         ORDER BY s.transaction_date DESC`,
        req.params.id,
        req.officer.id
      ),
    ]);

    // Balance summary
    let owedByThem = parseMoney(0); // as buyer: outstanding due FROM them
    let owedToThem = parseMoney(0); // as seller: outstanding due TO them
    for (const r of asBuyer) owedByThem = owedByThem.plus(parseMoney(r.amount_due_from_buyer));
    for (const r of asSeller) owedToThem = owedToThem.plus(parseMoney(r.amount_due_to_seller));

    res.json({
      dealer,
      asSeller,
      asBuyer,
      summary: {
        owedByThem: moneyToString(owedByThem),
        owedToThem: moneyToString(owedToThem),
        net: moneyToString(owedToThem.minus(owedByThem)),
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = dealerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const dealer = await prisma.dealer.create({
      data: { ...parsed.data, ownerOfficer: req.officer.id },
    });
    res.status(201).json({ dealer });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const parsed = dealerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const owner = await prisma.dealer.findFirst({
      where: { id: req.params.id, ownerOfficer: req.officer.id },
      select: { id: true },
    });
    if (!owner) return res.status(404).json({ error: "Dealer not found" });
    const dealer = await prisma.dealer.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json({ dealer });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const dealer = await prisma.dealer.findFirst({
      where: { id: req.params.id, ownerOfficer: req.officer.id },
      select: { id: true },
    });
    if (!dealer) return res.status(404).json({ error: "Dealer not found" });
    const hasTx = await prisma.transaction.count({
      where: {
        officerId: req.officer.id,
        OR: [{ sellerDealerId: req.params.id }, { buyerDealerId: req.params.id }],
      },
    });
    if (hasTx > 0) {
      return res.status(409).json({ error: "Cannot delete dealer with existing transactions" });
    }
    await prisma.dealer.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
