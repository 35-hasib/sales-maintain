import { Router } from "express";
import { prisma } from "../prisma.js";
import { authRequired } from "../middleware/auth.js";
import { serializeMoney } from "../serializers.js";
import { moneyToString } from "../money.js";

const router = Router();
router.use(authRequired);

function buildWhere(query, officerId, isAdmin) {
  const clauses = [];
  const values = [];
  const push = (sql, v) => {
    clauses.push(sql);
    values.push(v);
  };
  // Each officer sees only their own book. Admins (who have no business data)
  // see the full ledger.
  if (!isAdmin) {
    push(`l.transaction_id IN (SELECT id FROM transactions t WHERE t.officer_id = $${values.length + 1}::uuid)`, officerId);
  }
  if (query.dealerId) {
    push(`l.dealer_id = $${values.length + 1}::uuid`, query.dealerId);
  }
  if (query.dateFrom) push(`l.occurred_at >= $${values.length + 1}::timestamptz`, query.dateFrom);
  if (query.dateTo) push(`l.occurred_at <= $${values.length + 1}::timestamptz`, query.dateTo + "T23:59:59.999Z");
  if (query.transactionId) push(`l.transaction_id = $${values.length + 1}::uuid`, query.transactionId);
  return { sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", values };
}

const SELECT = `
  SELECT
    l.id,
    l.transaction_id,
    l.entry_type,
    l.reference_id,
    l.dealer_id,
    l.amount,
    l.occurred_at,
    l.created_at,
    l.recorded_by,
    o.name AS officer_name,
    d.name AS dealer_name,
    t.total_amount,
    t.seller_dealer_id,
    t.buyer_dealer_id,
    COALESCE(c.note, ds.note) AS note
  FROM ledger_entries l
  JOIN transactions t ON t.id = l.transaction_id
  JOIN officers o ON o.id = l.recorded_by
  LEFT JOIN dealers d ON d.id = l.dealer_id
  LEFT JOIN collections c ON c.id = l.reference_id AND l.entry_type = 'collection'
  LEFT JOIN disbursements ds ON ds.id = l.reference_id AND l.entry_type = 'disbursement'
`;

router.get("/", async (req, res, next) => {
  try {
    const isAdmin = req.officer.role === "admin";
    const { sql, values } = buildWhere(req.query, req.officer.id, isAdmin);
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const rows = await prisma.$queryRawUnsafe(
      `${SELECT}${sql} ORDER BY l.occurred_at DESC, l.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      ...values
    );
    const countRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM ledger_entries l${sql}`,
      ...values
    );
    res.json({ entries: rows.map(serializeMoney), total: countRows[0].count });
  } catch (e) {
    next(e);
  }
});

// CSV export. If query.all=1, ignores filters and exports the whole ledger.
router.get("/export", async (req, res, next) => {
  try {
    const isAdmin = req.officer.role === "admin";
    const { sql, values } = req.query.all === "1"
      ? { sql: isAdmin ? "" : buildWhere({}, req.officer.id, isAdmin).sql, values: isAdmin ? [] : buildWhere({}, req.officer.id, isAdmin).values }
      : buildWhere(req.query, req.officer.id, isAdmin);
    const rows = await prisma.$queryRawUnsafe(
      `${SELECT}${sql} ORDER BY l.occurred_at DESC, l.created_at DESC`,
      ...values
    );

    const header = [
      "date",
      "type",
      "dealer",
      "transaction_id",
      "amount(BDT)",
      "note",
      "recorded_by",
    ];
    const lines = rows.map((r) => {
      const amount = r.amount !== null ? parseFloat(moneyToString(r.amount)) : "";
      const type =
        r.entry_type === "collection"
          ? "Collection"
          : r.entry_type === "disbursement"
          ? "Disbursement"
          : "Void/Adjustment";
      return [
        new Date(r.occurred_at).toISOString(),
        type,
        r.dealer_name || "",
        r.transaction_id,
        amount,
        r.note || "",
        r.officer_name || "",
      ];
    });

    const escape = (v) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header, ...lines].map((row) => row.map(escape).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ledger-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send("\uFEFF" + csv);
  } catch (e) {
    next(e);
  }
});

export default router;
