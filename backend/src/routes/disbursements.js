import { Router } from "express";
import { z } from "zod";
import { serializeMoney } from "../serializers.js";
import { authRequired } from "../middleware/auth.js";
import { recordDisbursement, updateEntry } from "../services/moneyMovement.js";

const router = Router();
router.use(authRequired);

const createSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.string().or(z.number()),
  disbursedAt: z.string().optional(),
  paymentMethod: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  photos: z.array(z.string()).optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { disbursement } = await recordDisbursement({
      ...parsed.data,
      recordedBy: req.officer.id,
      officerId: req.officer.id,
    });
    res.status(201).json({ disbursement: serializeMoney(disbursement) });
  } catch (e) {
    next(e);
  }
});

const updateSchema = z
  .object({
    amount: z.string().or(z.number()).optional(),
    disbursedAt: z.string().optional(),
    paymentMethod: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    photos: z.array(z.string()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// Edit an active disbursement entry (amount, date, method, note).
router.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const result = await updateEntry({
      type: "disbursement",
      entryId: req.params.id,
      ...parsed.data,
      recordedBy: req.officer.id,
      officerId: req.officer.id,
    });
    res.json({ disbursement: serializeMoney(result.disbursement) });
  } catch (e) {
    next(e);
  }
});

export default router;
