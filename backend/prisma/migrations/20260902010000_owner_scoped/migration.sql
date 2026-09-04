-- Add owner_officer_id to dealers to isolate each officer's dealer book.
ALTER TABLE "dealers" ADD COLUMN "owner_officer_id" UUID;

-- Backfill existing dealers to the first non-admin officer (preserves existing data).
UPDATE "dealers" d
SET owner_officer_id = (
  SELECT o.id FROM "officers" o
  WHERE o.role <> 'admin'
  ORDER BY o."created_at" ASC
  LIMIT 1
)
WHERE owner_officer_id IS NULL;

ALTER TABLE "dealers" ALTER COLUMN "owner_officer_id" SET NOT NULL;

CREATE INDEX "idx_dealers_owner" ON "dealers"("owner_officer_id");

ALTER TABLE "dealers"
  ADD CONSTRAINT "dealers_owner_officer_id_fkey"
  FOREIGN KEY ("owner_officer_id") REFERENCES "officers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
