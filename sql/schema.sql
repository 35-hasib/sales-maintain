-- CreateExtension on gen_random_uuid is core in PG13+; no extension needed.

-- ============================================================
-- Dealers (sellers and buyers use the same table)
-- ============================================================
CREATE TABLE "dealers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dealers_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- Officers (app users)
-- ============================================================
CREATE TABLE "officers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'officer',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "officers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "officers_email_key" UNIQUE ("email")
);

-- ============================================================
-- Transactions (a sale/deal between two dealers)
-- ============================================================
CREATE TABLE "transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_dealer_id" UUID NOT NULL,
  "buyer_dealer_id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "product_description" TEXT,
  "total_amount" NUMERIC(14,2) NOT NULL,
  "transaction_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "photos" TEXT[] NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transactions_total_amount_check" CHECK ("total_amount" > 0),
  CONSTRAINT "transactions_seller_dealer_id_fkey" FOREIGN KEY ("seller_dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "transactions_buyer_dealer_id_fkey" FOREIGN KEY ("buyer_dealer_id") REFERENCES "dealers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "transactions_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================
-- Collections (money received FROM buyer)
-- ============================================================
CREATE TABLE "collections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" UUID NOT NULL,
  "amount" NUMERIC(14,2) NOT NULL,
  "collected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payment_method" TEXT,
  "note" TEXT,
  "recorded_by" UUID NOT NULL,
  "photos" TEXT[] NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collections_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "collections_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "collections_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================
-- Disbursements (money paid OUT to seller)
-- ============================================================
CREATE TABLE "disbursements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" UUID NOT NULL,
  "amount" NUMERIC(14,2) NOT NULL,
  "disbursed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payment_method" TEXT,
  "note" TEXT,
  "recorded_by" UUID NOT NULL,
  "photos" TEXT[] NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "disbursements_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "disbursements_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "disbursements_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================
-- Ledger entries (single combined audit / activity feed)
-- ============================================================
CREATE TABLE "ledger_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" UUID NOT NULL,
  "entry_type" TEXT NOT NULL,
  "reference_id" UUID NOT NULL,
  "dealer_id" UUID,
  "amount" NUMERIC(14,2) NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recorded_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ledger_entries_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================
-- Indexes (from spec + useful extras)
-- ============================================================
CREATE INDEX "idx_transactions_seller" ON "transactions"("seller_dealer_id");
CREATE INDEX "idx_transactions_buyer" ON "transactions"("buyer_dealer_id");
CREATE INDEX "idx_collections_txn" ON "collections"("transaction_id");
CREATE INDEX "idx_disbursements_txn" ON "disbursements"("transaction_id");
CREATE INDEX "idx_ledger_txn" ON "ledger_entries"("transaction_id");
CREATE INDEX "idx_ledger_dealer" ON "ledger_entries"("dealer_id");
CREATE INDEX "idx_ledger_occurred" ON "ledger_entries"("occurred_at");

-- ============================================================
-- transaction_summary VIEW (single source of truth for reads)
-- ============================================================
CREATE OR REPLACE VIEW "transaction_summary" AS
WITH collected AS (
  SELECT transaction_id, COALESCE(SUM(amount), 0) AS total
  FROM collections GROUP BY transaction_id
),
disbursed AS (
  SELECT transaction_id, COALESCE(SUM(amount), 0) AS total
  FROM disbursements GROUP BY transaction_id
)
SELECT
  t.id,
  t.seller_dealer_id,
  t.buyer_dealer_id,
  t.officer_id,
  t.product_description,
  t.total_amount,
  t.transaction_date,
  t.photos,
  t.created_at,
  t.updated_at,
  COALESCE(c.total, 0) AS total_collected,
  COALESCE(d.total, 0) AS total_disbursed,
  (COALESCE(c.total, 0) - COALESCE(d.total, 0)) AS officer_held_balance,
  (t.total_amount - COALESCE(c.total, 0)) AS amount_due_from_buyer,
  (t.total_amount - COALESCE(d.total, 0)) AS amount_due_to_seller,
  CASE
    WHEN COALESCE(c.total, 0) >= t.total_amount
         AND COALESCE(d.total, 0) >= t.total_amount
      THEN 'settled'
    WHEN COALESCE(c.total, 0) = 0 AND COALESCE(d.total, 0) = 0 THEN 'pending'
    WHEN COALESCE(c.total, 0) >= t.total_amount THEN 'fully_collected'
    WHEN COALESCE(d.total, 0) > 0 THEN 'partially_disbursed'
    WHEN COALESCE(c.total, 0) > 0 THEN 'partially_collected'
    ELSE 'pending'
  END AS status,
  sd.name AS seller_name,
  bd.name AS buyer_name,
  o.name AS officer_name
FROM transactions t
LEFT JOIN collected c ON c.transaction_id = t.id
LEFT JOIN disbursed d ON d.transaction_id = t.id
LEFT JOIN dealers sd ON sd.id = t.seller_dealer_id
LEFT JOIN dealers bd ON bd.id = t.buyer_dealer_id
LEFT JOIN officers o ON o.id = t.officer_id;

-- ============================================================
-- Trigger: keep stored transactions.status in sync with view
-- ============================================================
CREATE OR REPLACE FUNCTION update_transaction_status() RETURNS TRIGGER AS $$
DECLARE
  tid UUID := COALESCE(NEW.transaction_id, OLD.transaction_id);
  v_collected NUMERIC(14,2);
  v_disbursed NUMERIC(14,2);
  v_total NUMERIC(14,2);
  new_status TEXT;
BEGIN
  SELECT t.total_amount INTO v_total
  FROM transactions t WHERE t.id = tid;

  SELECT COALESCE(SUM(amount), 0) INTO v_collected
  FROM collections WHERE transaction_id = tid;

  SELECT COALESCE(SUM(amount), 0) INTO v_disbursed
  FROM disbursements WHERE transaction_id = tid;

  IF v_collected >= v_total AND v_disbursed >= v_total THEN
    new_status := 'settled';
  ELSIF v_collected = 0 AND v_disbursed = 0 THEN
    new_status := 'pending';
  ELSIF v_collected >= v_total THEN
    new_status := 'fully_collected';
  ELSIF v_disbursed > 0 THEN
    new_status := 'partially_disbursed';
  ELSIF v_collected > 0 THEN
    new_status := 'partially_collected';
  ELSE
    new_status := 'pending';
  END IF;

  UPDATE transactions SET status = new_status, updated_at = CURRENT_TIMESTAMP WHERE id = tid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transaction_status_collections
AFTER INSERT OR UPDATE ON collections
FOR EACH ROW EXECUTE FUNCTION update_transaction_status();

CREATE TRIGGER trg_transaction_status_disbursements
AFTER INSERT OR UPDATE ON disbursements
FOR EACH ROW EXECUTE FUNCTION update_transaction_status();
