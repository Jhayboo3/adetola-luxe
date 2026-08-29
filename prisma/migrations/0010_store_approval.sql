-- Store approval workflow: every store carries an application status.
--   pending  -> submitted, awaiting admin review (not publicly visible)
--   approved -> live on the marketplace (public storefront, dashboard, products)
--   rejected -> declined application (retained for administrative records)
--   suspended-> disabled by an admin after approval
-- Existing stores are treated as already approved so the marketplace keeps working.
ALTER TABLE "Store" ADD COLUMN "status" TEXT DEFAULT 'pending';
ALTER TABLE "Store" ADD COLUMN "description" TEXT;
ALTER TABLE "Store" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Store" ADD COLUMN "approvedAt" DATETIME;
UPDATE "Store" SET "status" = 'approved', "approvedAt" = "createdAt";
