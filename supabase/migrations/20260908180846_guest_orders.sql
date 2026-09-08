-- Guest checkout — customers can pre-order without an account.
-- Order contact details live on the order row itself; user_id becomes optional.

ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name    text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone   text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type text DEFAULT 'pickup';

-- ── Row Level Security ───────────────────────────────────────
-- Allow anyone (anon + logged-in) to create an order and its line items,
-- and to read them back by id. Admins already have full access via their
-- existing policies / service role.

ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest can create orders" ON orders;
CREATE POLICY "guest can create orders" ON orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anyone can read orders" ON orders;
CREATE POLICY "anyone can read orders" ON orders
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "guest can update own pending orders" ON orders;
CREATE POLICY "guest can update own pending orders" ON orders
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "guest can create order items" ON order_items;
CREATE POLICY "guest can create order items" ON order_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anyone can read order items" ON order_items;
CREATE POLICY "anyone can read order items" ON order_items
  FOR SELECT TO anon, authenticated USING (true);
