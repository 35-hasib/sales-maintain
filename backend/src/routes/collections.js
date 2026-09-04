import { Router } from "express";
import { z } from "zod";
import { serializeMoney } from "../serializers.js";
import { authRequired } from "../middleware/auth.js";
import { recordCollection, updateEntry } from "../services/moneyMovement.js";

const router = Router();
router.use(authRequired);

const createSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.string().or(z.number()),
  collectedAt: z.string().optional(),
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
    const { collection, warning } = await recordCollection({
      ...parsed.data,
      recordedBy: req.officer.id,
      officerId: req.officer.id,
    });
    res.status(201).json({ collection: serializeMoney(collection), warning });
  } catch (e) {
    next(e);
  }
});

const updateSchema = z
  .object({
    amount: z.string().or(z.number()).optional(),
    collectedAt: z.string().optional(),
    paymentMethod: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    photos: z.array(z.string()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// Edit an active collection entry (amount, date, method, note).
router.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const result = await updateEntry({
      type: "collection",
      entryId: req.params.id,
      ...parsed.data,
      recordedBy: req.officer.id,
      officerId: req.officer.id,
    });
    res.json({ collection: serializeMoney(result.collection) });
  } catch (e) {
    next(e);
  }
});

export default router;
