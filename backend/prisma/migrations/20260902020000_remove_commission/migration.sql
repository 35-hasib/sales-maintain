-- Remove Officer commission from the financial model.
-- Commission no longer affects officer-held balance or seller dues.

-- Drop the view (it references commission_amount) so we can drop the column.
DROP VIEW IF EXISTS "transaction_summary";

-- Recreate the status trigger function without commission logic.
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

  SELECT COALESCE(SUM(
    CASE WHEN status='active' AND reversal_of IS NULL THEN amount
         WHEN status='active' AND reversal_of IS NOT NULL THEN -amount ELSE 0 END), 0)
    INTO v_collected
  FROM collections WHERE transaction_id = tid;

  SELECT COALESCE(SUM(
    CASE WHEN status='active' AND reversal_of IS NULL THEN amount
         WHEN status='active' AND reversal_of IS NOT NULL THEN -amount ELSE 0 END), 0)
    INTO v_disbursed
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

-- Drop existing triggers (they are recreated below against the new function).
DROP TRIGGER IF EXISTS "trg_transaction_status_collections" ON "collections";
DROP TRIGGER IF EXISTS "trg_transaction_status_disbursements" ON "disbursements";

-- Drop commission column and its auto-generated constraints.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_commission_amount_check";
ALTER TABLE "transactions" DROP COLUMN "commission_amount";

-- Recreate the summary view without commission. Officer-held balance is now
-- simply collected minus disbursed; seller due equals total minus disbursed.
CREATE OR REPLACE VIEW "transaction_summary" AS
WITH collected AS (
  SELECT
    transaction_id,
    COALESCE(SUM(
      CASE
        WHEN status = 'active' AND reversal_of IS NULL THEN amount
        WHEN status = 'active' AND reversal_of IS NOT NULL THEN -amount
        ELSE 0
      END
    ), 0) AS total
  FROM collections
  GROUP BY transaction_id
),
disbursed AS (
  SELECT
    transaction_id,
    COALESCE(SUM(
      CASE
        WHEN status = 'active' AND reversal_of IS NULL THEN amount
        WHEN status = 'active' AND reversal_of IS NOT NULL THEN -amount
        ELSE 0
      END
    ), 0) AS total
  FROM disbursements
  GROUP BY transaction_id
)
SELECT
  t.id,
  t.seller_dealer_id,
  t.buyer_dealer_id,
  t.officer_id,
  t.product_description,
  t.total_amount,
  t.transaction_date,
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

CREATE TRIGGER trg_transaction_status_collections
AFTER INSERT OR UPDATE ON collections
FOR EACH ROW EXECUTE FUNCTION update_transaction_status();

CREATE TRIGGER trg_transaction_status_disbursements
AFTER INSERT OR UPDATE ON disbursements
FOR EACH ROW EXECUTE FUNCTION update_transaction_status();
