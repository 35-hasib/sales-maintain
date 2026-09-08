import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const force = process.argv.includes("--force");

  const existing = await prisma.dealer.count();
  if (existing > 0 && !force) {
    console.log("Database already has dealers. Skipping seed. Use --force to reseed.");
    return;
  }

  if (force) {
    await prisma.ledgerEntry.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.disbursement.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.dealer.deleteMany();
    await prisma.officer.deleteMany();
  }

  const admin = await prisma.officer.create({
    data: {
      name: "Admin",
      email: "admin@salesmaintain.test",
      phone: "01711111111",
      passwordHash: await bcrypt.hash("admin123", 10),
      role: "admin",
    },
  });

  const officer = await prisma.officer.create({
    data: {
      name: "Rahim Uddin",
      email: "officer@salesmaintain.test",
      phone: "01722222222",
      passwordHash: await bcrypt.hash("officer123", 10),
      role: "officer",
    },
  });

  const [d1, d2, d3, d4] = await Promise.all([
    prisma.dealer.create({
      data: { ownerOfficer: admin.id, name: "Alauddin Agro Traders", phone: "0171-1111111", address: "Dhaka", notes: "Rice & pulses wholesaler" },
    }),
    prisma.dealer.create({
      data: { ownerOfficer: admin.id, name: "Sobhan Rice Mills", phone: "0172-2222222", address: "Narayanganj", notes: "Rice mill owner" },
    }),
    prisma.dealer.create({
      data: { ownerOfficer: admin.id, name: "Karim General Store", phone: "0181-3333333", address: "Chittagong", notes: "General merchant" },
    }),
    prisma.dealer.create({
      data: { ownerOfficer: admin.id, name: "Fertilizer Supply Co.", phone: "0191-4444444", address: "Comilla", notes: "Fertilizer supplier" },
    }),
  ]);

  const t1 = await prisma.transaction.create({
    data: {
      sellerDealerId: d2.id,
      buyerDealerId: d1.id,
      officerId: officer.id,
      productDescription: "Basmati rice 5-ton lot",
      totalAmount: "125000.00",
      transactionDate: new Date("2026-08-01"),
    },
  });
  const t2 = await prisma.transaction.create({
    data: {
      sellerDealerId: d4.id,
      buyerDealerId: d3.id,
      officerId: officer.id,
      productDescription: "UREA fertilizer 3-ton",
      totalAmount: "48000.00",
      transactionDate: new Date("2026-08-10"),
    },
  });
  const t3 = await prisma.transaction.create({
    data: {
      sellerDealerId: d2.id,
      buyerDealerId: d3.id,
      officerId: officer.id,
      productDescription: "Puffed rice 2-ton",
      totalAmount: "60000.00",
      transactionDate: new Date("2026-08-20"),
    },
  });

  // Partial collections on t1 (total 125000)
  const c1 = await prisma.collection.create({
    data: {
      transactionId: t1.id,
      amount: "50000.00",
      collectedAt: new Date("2026-08-03"),
      paymentMethod: "bank",
      note: "First instalment",
      recordedBy: officer.id,
    },
  });
  const c2 = await prisma.collection.create({
    data: {
      transactionId: t1.id,
      amount: "40000.00",
      collectedAt: new Date("2026-08-15"),
      paymentMethod: "cash",
      note: "Second instalment",
      recordedBy: officer.id,
    },
  });
  // Disburse part to seller (they have collected 90000)
  const d1disb = await prisma.disbursement.create({
    data: {
      transactionId: t1.id,
      amount: "85000.00",
      disbursedAt: new Date("2026-08-16"),
      paymentMethod: "cash",
      note: "Partial payout to seller",
      recordedBy: officer.id,
    },
  });

  // Collection fully on t2 (48000)
  const c3 = await prisma.collection.create({
    data: {
      transactionId: t2.id,
      amount: "48000.00",
      collectedAt: new Date("2026-08-12"),
      paymentMethod: "mobile_banking",
      note: "Full payment",
      recordedBy: officer.id,
    },
  });

  // No money on t3 yet.

  // Ledger entries mirroring the activity (kept minimal; real app inserts them transactionally)
  await prisma.ledgerEntry.createMany({
    data: [
      {
        transactionId: t1.id,
        entryType: "collection",
        referenceId: c1.id,
        dealerId: d1.id,
        amount: "50000.00",
        occurredAt: new Date("2026-08-03"),
        recordedBy: officer.id,
      },
      {
        transactionId: t1.id,
        entryType: "collection",
        referenceId: c2.id,
        dealerId: d1.id,
        amount: "40000.00",
        occurredAt: new Date("2026-08-15"),
        recordedBy: officer.id,
      },
      {
        transactionId: t1.id,
        entryType: "disbursement",
        referenceId: d1disb.id,
        dealerId: d2.id,
        amount: "85000.00",
        occurredAt: new Date("2026-08-16"),
        recordedBy: officer.id,
      },
      {
        transactionId: t2.id,
        entryType: "collection",
        referenceId: c3.id,
        dealerId: d3.id,
        amount: "48000.00",
        occurredAt: new Date("2026-08-12"),
        recordedBy: officer.id,
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Admin login:   admin@salesmaintain.test or 01711111111 / admin123");
  console.log("Officer login: officer@salesmaintain.test or 01722222222 / officer123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
