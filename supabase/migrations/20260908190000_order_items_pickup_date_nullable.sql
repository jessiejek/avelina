-- Orders were being created with zero line items after pickup dates were removed
-- from the checkout flow.
--
-- Root cause: order_items.pickup_date is NOT NULL with no default. Once the
-- checkout stopped sending pickup_date, every order_items insert failed the
-- constraint and was silently dropped (the old loop ignored the error), so the
-- order row was created but had no items.
--
-- Fix: pickup dates are no longer part of the product, so make the column
-- nullable. Existing data is untouched.

ALTER TABLE order_items ALTER COLUMN pickup_date DROP NOT NULL;
