-- Customers can optionally leave a Facebook or Instagram link/handle so the
-- bakery has a second way to reach them (phone is still required).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_social text;
