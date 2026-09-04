import "dotenv/config";
import { createApp } from "./app.js";
import { prisma } from "./prisma.js";

const port = parseInt(process.env.PORT, 10) || 4000;

const app = createApp();

app.listen(port, () => {
  console.log(`SalesMaintain API listening on http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
