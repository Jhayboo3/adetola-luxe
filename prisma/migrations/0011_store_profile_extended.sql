-- Extended store profile fields.
-- Extends the existing Store table (no new tables) so every store — existing or
-- new — carries the richer profile used on applications, admin review and the
-- public storefront. All new columns are nullable/defaulted so existing stores
-- keep working with empty values.
ALTER TABLE "Store" ADD COLUMN "coverImage" TEXT;
ALTER TABLE "Store" ADD COLUMN "category" TEXT;
ALTER TABLE "Store" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Store" ADD COLUMN "country" TEXT;
ALTER TABLE "Store" ADD COLUMN "state" TEXT;
ALTER TABLE "Store" ADD COLUMN "city" TEXT;
ALTER TABLE "Store" ADD COLUMN "area" TEXT;
ALTER TABLE "Store" ADD COLUMN "physicalAddress" TEXT;
ALTER TABLE "Store" ADD COLUMN "mapLocation" TEXT;
ALTER TABLE "Store" ADD COLUMN "pickupAvailable" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Store" ADD COLUMN "deliveryAvailable" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Store" ADD COLUMN "email" TEXT;
ALTER TABLE "Store" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "Store" ADD COLUMN "preferredContactMethod" TEXT;
ALTER TABLE "Store" ADD COLUMN "aboutStore" TEXT;
ALTER TABLE "Store" ADD COLUMN "productsDescription" TEXT;
ALTER TABLE "Store" ADD COLUMN "openingHours" TEXT;
ALTER TABLE "Store" ADD COLUMN "deliveryAreas" TEXT;
ALTER TABLE "Store" ADD COLUMN "pickupInformation" TEXT;
ALTER TABLE "Store" ADD COLUMN "paymentMethods" TEXT;
ALTER TABLE "Store" ADD COLUMN "returnPolicy" TEXT;
