import { Router } from "express";
import { prisma } from "../prisma.js";
import { authRequired } from "../middleware/auth.js";
import { serializeMoney } from "../serializers.js";
import { parseMoney, moneyToString } from "../money.js";
import { cacheGet, cacheSet, cacheKey } from "../services/responseCache.js";

const router = Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const cacheId = cacheKey(["dashboard", req.officer.id]);
    const cached = cacheGet(cacheId);
    if (cached !== undefined) return res.json(cached);

    const [agg, unsettled, recentRaw] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT
           COALESCE(SUM(officer_held_balance),0) AS float_held,
           COALESCE(SUM(amount_due_from_buyer),0) AS total_due_from_buyers,
           COALESCE(SUM(amount_due_to_seller),0) AS total_due_to_sellers,
           COUNT(*)::int AS total_transactions
         FROM transaction_summary
         WHERE officer_id = $1::uuid`,
        req.officer.id
      ),
      prisma.$queryRawUnsafe(
        `SELECT s.* FROM transaction_summary s
         WHERE s.officer_id = $1::uuid AND s.status <> 'settled'
         ORDER BY s.transaction_date ASC, s.created_at ASC
         LIMIT 200`,
        req.officer.id
      ),
      prisma.$queryRawUnsafe(
        `SELECT
           l.id, l.transaction_id, l.entry_type, l.reference_id, l.dealer_id,
           l.amount, l.occurred_at, l.recorded_by,
           o.name AS officer_name, d.name AS dealer_name
         FROM ledger_entries l
         JOIN transactions t ON t.id = l.transaction_id
         JOIN officers o ON o.id = l.recorded_by
         LEFT JOIN dealers d ON d.id = l.dealer_id
         WHERE t.officer_id = $1::uuid
         ORDER BY l.occurred_at DESC, l.created_at DESC
         LIMIT 10`,
        req.officer.id
      ),
    ]);

    const a = agg[0];
    const body = {
      floatHeld: moneyToString(parseMoney(a.float_held)),
      totalDueFromBuyers: moneyToString(parseMoney(a.total_due_from_buyers)),
      totalDueToSellers: moneyToString(parseMoney(a.total_due_to_sellers)),
      totalTransactions: a.total_transactions,
      recentActivity: recentRaw.map(serializeMoney),
      unsettledTransactions: unsettled.map(serializeMoney),
    };
    cacheSet(cacheId, body);
    res.json(body);
  } catch (e) {
    next(e);
  }
});

router.get("/breakdown", async (req, res, next) => {
  try {
    const type = req.query.type;
    let where = "";
    let dealerExpr = "";

    if (type === "held") {
      // Cash in hand: where collections were received (net held per transaction).
      where = "s.officer_held_balance > 0";
      dealerExpr = "b.name AS dealer_name, b.id AS dealer_id";
    } else if (type === "buyers") {
      where = "s.amount_due_from_buyer > 0";
      dealerExpr = "b.name AS dealer_name, b.id AS dealer_id";
    } else if (type === "sellers") {
      where = "s.amount_due_to_seller > 0";
      dealerExpr = "s2.name AS dealer_name, s2.id AS dealer_id";
    } else {
      return res.status(400).json({ error: "type must be held, buyers or sellers" });
    }

    const amountExpr =
      type === "held"
        ? "s.officer_held_balance"
        : type === "buyers"
          ? "s.amount_due_from_buyer"
          : "s.amount_due_to_seller";

    const cached = cacheGet(cacheKey(["dashboard", req.officer.id, "breakdown", type]));
    if (cached !== undefined) return res.json(cached);

    const rows = await prisma.$queryRawUnsafe(
      `SELECT
         s.id AS transaction_id,
         s.product_description,
         s.transaction_date,
         s.status,
         s.seller_name,
         s.buyer_name,
         ${dealerExpr},
         ${amountExpr}::numeric(14,2) AS amount
       FROM transaction_summary s
       JOIN dealers b ON b.id = s.buyer_dealer_id
       LEFT JOIN dealers s2 ON s2.id = s.seller_dealer_id
       WHERE s.officer_id = $1::uuid AND ${where}
       ORDER BY amount DESC, s.transaction_date ASC`,
      req.officer.id
    );

    const body = { type, breakdown: rows.map(serializeMoney) };
    cacheSet(cacheKey(["dashboard", req.officer.id, "breakdown", type]), body);
    res.json(body);
  } catch (e) {
    next(e);
  }
});

export default router;
