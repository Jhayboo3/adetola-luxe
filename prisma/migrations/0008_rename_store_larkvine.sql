-- Rename the platform's store to "Larkvine".
-- Keeps the existing store row (same id) so products, categories, orders,
-- order items and discount codes remain linked; only the display name and the
-- public slug change. The storefront URL moves from /tnc-collections to /larkvine.
UPDATE "Store"
SET "name" = 'Larkvine',
    "slug" = 'larkvine',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'tnc-collections';
