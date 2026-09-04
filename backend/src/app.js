import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import dealerRoutes from "./routes/dealers.js";
import transactionRoutes from "./routes/transactions.js";
import collectionRoutes from "./routes/collections.js";
import disbursementRoutes from "./routes/disbursements.js";
import ledgerRoutes from "./routes/ledger.js";
import dashboardRoutes from "./routes/dashboard.js";
import uploadRoutes from "./routes/upload.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: (process.env.CORS_ORIGIN || "").split(",").filter(Boolean) }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/dealers", dealerRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/collections", collectionRoutes);
  app.use("/api/disbursements", disbursementRoutes);
  app.use("/api/ledger", ledgerRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/upload", uploadRoutes);

  // 404 for unknown api routes
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // Central error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    const message =
      status === 500 ? "Internal server error" : err.message || "Something went wrong";
    res.status(status).json({ error: message });
  });

  return app;
}
