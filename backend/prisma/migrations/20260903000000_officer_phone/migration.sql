-- Allow officers to sign in with a mobile number instead of (or in addition to) an email.
ALTER TABLE "officers" ADD COLUMN "phone" TEXT;
ALTER TABLE "officers" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "officers_phone_key" ON "officers"("phone");