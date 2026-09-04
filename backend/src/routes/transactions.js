import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { serializeMoney } from "../serializers.js";
import { authRequired, officerOnly } from "../middleware/auth.js";
import { parseMoney, moneyToString } from "../money.js";

const router = Router();
router.use(authRequired);
router.use(officerOnly);

const createSchema = z.object({
  sellerDealerId: z.string().uuid(),
  buyerDealerId: z.string().uuid(),
  totalAmount: z.string().or(z.number()).refine((v) => parseMoney(v).gt(0), {
    message: "totalAmount must be > 0",
  }),
  productDescription: z.string().nullable().optional(),
  transactionDate: z.string().optional(),
  photos: z.array(z.string()).optional(),
});

// All fields optional (PATCH-like) but each individually validated.
const updateSchema = z
  .object({
    sellerDealerId: z.string().uuid().optional(),
    buyerDealerId: z.string().uuid().optional(),
    totalAmount: z
      .string()
      .or(z.number())
      .optional()
      .refine((v) => v === undefined || parseMoney(v).gt(0), {
        message: "totalAmount must be > 0",
      }),
    productDescription: z.string().nullable().optional(),
    transactionDate: z.string().optional(),
    photos: z.array(z.string()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

function buildWhere(query, officerId) {
  const clauses = [];
  const values = [];
  const push = (sql, v) => {
    clauses.push(sql);
    values.push(v);
  };

  push(`s.officer_id = $${values.length + 1}::uuid`, officerId);

  if (query.dealerId) {
    push(
      `(s.seller_dealer_id = $${values.length + 1}::uuid OR s.buyer_dealer_id = $${values.length + 1}::uuid)`,
      query.dealerId
    );
  } else {
    if (query.sellerDealerId) push(`s.seller_dealer_id = $${values.length + 1}::uuid`, query.sellerDealerId);
    if (query.buyerDealerId) push(`s.buyer_dealer_id = $${values.length + 1}::uuid`, query.buyerDealerId);
  }
  if (query.status) push(`s.status = $${values.length + 1}`, query.status);
  if (query.dateFrom) push(`s.transaction_date >= $${values.length + 1}::date`, query.dateFrom);
  if (query.dateTo) push(`s.transaction_date <= $${values.length + 1}::date`, query.dateTo);

  return {
    sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { sql, values } = buildWhere(req.query, req.officer.id);
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT s.* FROM transaction_summary s${sql}
       ORDER BY s.transaction_date DESC, s.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      ...values
    );
    const countRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM transaction_summary s${sql}`,
      ...values
    );

    res.json({ transactions: rows.map(serializeMoney), total: countRows[0].count });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const {
      sellerDealerId,
      buyerDealerId,
      totalAmount,
      productDescription,
      transactionDate,
      photos,
    } = parsed.data;

    if (sellerDealerId === buyerDealerId) {
      return res.status(400).json({ error: "Seller and buyer dealers must be different" });
    }

    const transaction = await prisma.transaction.create({
      data: {
        sellerDealerId,
        buyerDealerId,
        officerId: req.officer.id,
        totalAmount: moneyToString(totalAmount),
        productDescription: productDescription ?? null,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        photos: photos || [],
      },
    });
    res.status(201).json({ transaction: serializeMoney(transaction) });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const summary = await prisma.$queryRawUnsafe(
      `SELECT s.* FROM transaction_summary s WHERE s.id = $1::uuid AND s.officer_id = $2::uuid`,
      id,
      req.officer.id
    );
    if (!summary.length) return res.status(404).json({ error: "Transaction not found" });

    const [collections, disbursements] = await Promise.all([
      prisma.collection.findMany({
        where: { transactionId: id },
        orderBy: { collectedAt: "asc" },
        include: { recordedByOfficer: { select: { name: true } } },
      }),
      prisma.disbursement.findMany({
        where: { transactionId: id },
        orderBy: { disbursedAt: "asc" },
        include: { recordedByOfficer: { select: { name: true } } },
      }),
    ]);

    let cRun = parseMoney(0);
    let dRun = parseMoney(0);
    const signed = (row) => parseMoney(row.amount);

    const collWithRun = collections.map((c) => {
      cRun = cRun.plus(signed(c));
      return { ...serializeMoney(c), runningTotal: moneyToString(cRun) };
    });
    const disbWithRun = disbursements.map((d) => {
      dRun = dRun.plus(signed(d));
      return { ...serializeMoney(d), runningTotal: moneyToString(dRun) };
    });

    res.json({
      summary: serializeMoney(summary[0]),
      collections: collWithRun,
      disbursements: disbWithRun,
    });
  } catch (e) {
    next(e);
  }
});

// Edit transaction metadata (seller, buyer, amount, product, date).
router.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const owner = await prisma.transaction.findFirst({
      where: { id: req.params.id, officerId: req.officer.id },
      select: { id: true, sellerDealerId: true, buyerDealerId: true, totalAmount: true },
    });
    if (!owner) return res.status(404).json({ error: "Transaction not found" });

    const sellerId = parsed.data.sellerDealerId ?? owner.sellerDealerId;
    const buyerId = parsed.data.buyerDealerId ?? owner.buyerDealerId;
    if (sellerId === buyerId) {
      return res.status(400).json({ error: "Seller and buyer dealers must be different" });
    }

    const data = {};
    if (parsed.data.sellerDealerId !== undefined) data.sellerDealerId = parsed.data.sellerDealerId;
    if (parsed.data.buyerDealerId !== undefined) data.buyerDealerId = parsed.data.buyerDealerId;
    if (parsed.data.totalAmount !== undefined) data.totalAmount = moneyToString(parsed.data.totalAmount);
    if (parsed.data.productDescription !== undefined) data.productDescription = parsed.data.productDescription;
    if (parsed.data.transactionDate !== undefined) data.transactionDate = new Date(parsed.data.transactionDate);
    if (parsed.data.photos !== undefined) data.photos = parsed.data.photos;

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ transaction: serializeMoney(transaction) });
  } catch (e) {
    next(e);
  }
});

export default router;
