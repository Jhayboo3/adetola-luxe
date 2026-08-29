-- Store vendor contact fields.
-- Each store carries its own WhatsApp/phone used for order notifications so a
-- marketplace dispatch reaches the correct vendor, not a single platform number.
ALTER TABLE "Store" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "Store" ADD COLUMN "phone" TEXT;
