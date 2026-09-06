-- Performance: the app's read queries (dashboard, transaction lists, ledger)
-- filter transactions by officer_id; this index makes those lookups fast as
-- the transactions table grows.
CREATE INDEX IF NOT EXISTS "transactions_officer_id_idx" ON "transactions" ("officer_id");