import { prisma } from "../prisma.js";
import { cacheDelPrefix } from "./responseCache.js";

export async function deleteOfficerAndData(officerId) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `DELETE FROM ledger_entries
       WHERE recorded_by = $1::uuid
          OR transaction_id IN (SELECT id FROM transactions WHERE officer_id = $1::uuid)
          OR dealer_id IN (SELECT id FROM dealers WHERE owner_officer_id = $1::uuid)`,
      officerId
    );

    await tx.$executeRawUnsafe(
      `DELETE FROM disbursements
       WHERE recorded_by = $1::uuid
          OR transaction_id IN (SELECT id FROM transactions WHERE officer_id = $1::uuid)`,
      officerId
    );

    await tx.$executeRawUnsafe(
      `DELETE FROM collections
       WHERE recorded_by = $1::uuid
          OR transaction_id IN (SELECT id FROM transactions WHERE officer_id = $1::uuid)`,
      officerId
    );

    await tx.$executeRawUnsafe(`DELETE FROM transactions WHERE officer_id = $1::uuid`, officerId);

    await tx.$executeRawUnsafe(`DELETE FROM dealers WHERE owner_officer_id = $1::uuid`, officerId);

    const deleted = await tx.$executeRawUnsafe(`DELETE FROM officers WHERE id = $1::uuid`, officerId);

    cacheDelPrefix(`dashboard:${officerId}`);

    return { deleted };
  });
}