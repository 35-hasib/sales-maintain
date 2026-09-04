import { prisma } from "../prisma.js";
import { parseMoney, moneyToString, gt } from "../money.js";

// Returns the current summary row for a transaction (from the view).
async function getSummary(tx, transactionId) {
  const rows = await tx.$queryRawUnsafe(
    `SELECT * FROM transaction_summary WHERE id = $1::uuid`,
    transactionId
  );
  return rows[0] || null;
}

function assertOwnership(summary, officerId) {
  if (summary && officerId && summary.officer_id !== officerId) {
    throw Object.assign(new Error("Transaction not found"), { status: 404 });
  }
}

// --- Collections (money received FROM the buyer dealer) ---
export async function recordCollection({
  transactionId,
  amount,
  collectedAt,
  paymentMethod,
  note,
  photos,
  recordedBy,
  officerId,
}) {
  return prisma.$transaction(async (tx) => {
    const summary = await getSummary(tx, transactionId);
    if (!summary) throw Object.assign(new Error("Transaction not found"), { status: 404 });
    assertOwnership(summary, officerId);

    const amountD = parseMoney(amount);
    if (!(amountD.gt(0))) {
      throw Object.assign(new Error("Amount must be > 0"), { status: 400 });
    }

    const remainingDue = parseMoney(summary.amount_due_from_buyer);
    const exceedsDue = gt(amountD, remainingDue) && remainingDue.gt(0);

    const coll = await tx.collection.create({
      data: {
        transactionId,
        amount: moneyToString(amountD),
        collectedAt: collectedAt ? new Date(collectedAt) : new Date(),
        paymentMethod: paymentMethod || null,
        note: note || null,
        photos: photos || [],
        recordedBy,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        transactionId,
        entryType: "collection",
        referenceId: coll.id,
        dealerId: summary.buyer_dealer_id,
        amount: moneyToString(amountD),
        occurredAt: coll.collectedAt,
        recordedBy,
      },
    });

    return { collection: coll, warning: exceedsDue ? "amount exceeds remaining due from buyer" : null };
  });
}

// --- Disbursements (money paid OUT to the seller dealer) ---
export async function recordDisbursement({
  transactionId,
  amount,
  disbursedAt,
  paymentMethod,
  note,
  photos,
  recordedBy,
  officerId,
}) {
  return prisma.$transaction(async (tx) => {
    const summary = await getSummary(tx, transactionId);
    if (!summary) throw Object.assign(new Error("Transaction not found"), { status: 404 });
    assertOwnership(summary, officerId);

    const amountD = parseMoney(amount);
    if (!(amountD.gt(0))) {
      throw Object.assign(new Error("Amount must be > 0"), { status: 400 });
    }

    // Available to disburse to seller = amount currently held (collected - already disbursed)
    const availableHeld =
      parseMoney(summary.total_collected).minus(parseMoney(summary.total_disbursed));

    if (gt(amountD, availableHeld)) {
      throw Object.assign(
        new Error(
          `Cannot disburse more than currently held. Available to pay out: ৳${availableHeld.toFixed(2)}`
        ),
        { status: 400 }
      );
    }

    const disb = await tx.disbursement.create({
      data: {
        transactionId,
        amount: moneyToString(amountD),
        disbursedAt: disbursedAt ? new Date(disbursedAt) : new Date(),
        paymentMethod: paymentMethod || null,
        note: note || null,
        photos: photos || [],
        recordedBy,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        transactionId,
        entryType: "disbursement",
        referenceId: disb.id,
        dealerId: summary.seller_dealer_id,
        amount: moneyToString(amountD),
        occurredAt: disb.disbursedAt,
        recordedBy,
      },
    });

    return { disbursement: disb };
  });
}

/**
 * Update an existing entry (collection or disbursement). Edits update the
 * entry fields and keep the corresponding ledger entry in sync.
 *  - type       : "collection" | "disbursement"
 *  - entryId    : id of the entry to update
 *  - amount     : (optional) new amount, must be > 0
 *  - date       : (optional) new occurred-at date
 *  - paymentMethod: (optional) new payment method
 *  - note       : (optional) new note
 *  - photos     : (optional) new photo list
 */
export async function updateEntry({ type, entryId, amount, date, paymentMethod, note, photos, recordedBy, officerId }) {
  return prisma.$transaction(async (tx) => {
    const model = type === "disbursement" ? tx.disbursement : tx.collection;
    const entry = await model.findUnique({ where: { id: entryId } });
    if (!entry) throw Object.assign(new Error(`${type} entry not found`), { status: 404 });

    const summaryRows = await tx.$queryRawUnsafe(
      `SELECT * FROM transaction_summary WHERE id = $1::uuid`,
      entry.transactionId
    );
    const summary = summaryRows[0];
    assertOwnership(summary, officerId);

    const dateField = type === "disbursement" ? "disbursedAt" : "collectedAt";
    const ledgerEntryType = type === "disbursement" ? "disbursement" : "collection";

    // Determine the new amount (default to current).
    const newAmount = amount === undefined || amount === null ? parseMoney(entry.amount) : parseMoney(amount);
    if (!newAmount.gt(0)) {
      throw Object.assign(new Error("Amount must be > 0"), { status: 400 });
    }

    // For disbursements, the adjusted amount must not exceed the currently held balance.
    if (type === "disbursement") {
      const availableHeld =
        parseMoney(summary.total_collected).minus(parseMoney(summary.total_disbursed));

      // Add back the old amount of this entry since it's part of current disbursed total,
      // then check the new amount against what is actually available.
      const otherDisbursed = availableHeld.plus(parseMoney(entry.amount));
      if (newAmount.gt(otherDisbursed)) {
        throw Object.assign(
          new Error(
            `Cannot disburse more than currently held. Available to pay out: ৳${otherDisbursed.toFixed(2)}`
          ),
          { status: 400 }
        );
      }
    }

    const newDate = date ? new Date(date) : entry[dateField];

    const data = { [dateField]: newDate };
    if (amount !== undefined && amount !== null) data.amount = moneyToString(newAmount);
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod || null;
    if (note !== undefined) data.note = note || null;
    if (photos !== undefined) data.photos = photos;

    const updated = await model.update({
      where: { id: entry.id },
      data,
    });

    // Keep the matching ledger entry (collection/disbursement) in sync.
    const ledger = await tx.ledgerEntry.findFirst({
      where: { entryType: ledgerEntryType, referenceId: entry.id },
    });
    if (ledger) {
      await tx.ledgerEntry.update({
        where: { id: ledger.id },
        data: { amount: moneyToString(newAmount), occurredAt: newDate },
      });
    }

    return { [type]: updated };
  });
}

export { getSummary };
