-- Add photo attachments to transactions, collections and disbursements.
-- Photos are stored as an array of Cloudinary URLs.

ALTER TABLE "transactions" ADD COLUMN "photos" TEXT[] DEFAULT '{}';
ALTER TABLE "collections" ADD COLUMN "photos" TEXT[] DEFAULT '{}';
ALTER TABLE "disbursements" ADD COLUMN "photos" TEXT[] DEFAULT '{}';

-- Recreate the transaction_summary view to expose the transaction's photos.
DROP VIEW IF EXISTS "transaction_summary";

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
