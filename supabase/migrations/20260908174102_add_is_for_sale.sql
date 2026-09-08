-- Phase 1 — Storefront catalog
-- `is_for_sale` controls whether a product is LISTED on the public home page at all.
-- It is distinct from `is_available` (in stock vs. sold out): a sold-out product can
-- still be listed (shown greyed), but an `is_for_sale = false` product is hidden entirely.
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_for_sale boolean DEFAULT true;

-- Backfill: everything currently in the catalog stays visible.
UPDATE recipes SET is_for_sale = true WHERE is_for_sale IS NULL;
