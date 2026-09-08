-- Orders were being created with zero line items: the customer checkout inserts
-- into `orders` (which succeeds) and then `order_items` (which was failing
-- silently). Most likely cause is a missing / restrictive RLS policy on
-- `order_items` so the anon/authenticated insert is rejected.
--
-- Re-assert the same permissive policy the rest of the app relies on.

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON order_items;
CREATE POLICY "allow_all" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- Same safety net for the orders table itself.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON orders;
CREATE POLICY "allow_all" ON orders FOR ALL USING (true) WITH CHECK (true);
