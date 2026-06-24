-- ============================================================
-- AVELINA'S BAKERY — COMPLETE SCHEMA
-- Run this once in Supabase SQL editor.
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS guards.
-- ============================================================

-- ── users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name      text,
  phone     text,
  address   text,
  role      text NOT NULL DEFAULT 'customer'
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role    text NOT NULL DEFAULT 'customer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address text;

-- ── ingredients ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  sku           text,
  quantity      numeric NOT NULL DEFAULT 0,
  unit          text NOT NULL DEFAULT 'kg',
  cost_per_unit numeric NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'optimal',
  low_threshold numeric,
  shelf_life    integer,
  notes         text,
  icon          text,
  img           text
);
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS shelf_life    integer;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS notes         text;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS low_threshold numeric;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS icon          text;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS img           text;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS sku           text;

-- ── recipes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    text NOT NULL,
  category                text,
  yield                   text,
  time                    text,
  img                     text,
  description             text,
  prep_time               text,
  difficulty              text,
  price                   numeric DEFAULT 0,
  is_available            boolean DEFAULT true,
  finished_shelf_life_days integer
);
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS finished_shelf_life_days integer;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS description             text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS prep_time               text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS difficulty              text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_available            boolean DEFAULT true;

-- ── recipe_ingredients ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id     uuid REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id text REFERENCES ingredients(id) ON DELETE SET NULL,
  qty           numeric NOT NULL,
  unit          text NOT NULL
);

-- ── recipe_steps ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_steps (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id  uuid REFERENCES recipes(id) ON DELETE CASCADE,
  num        integer,
  title      text,
  description text,
  sort_order integer DEFAULT 0
);

-- ── orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               text PRIMARY KEY,
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending',
  placed_at        timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  notes            text,
  fulfilled_qty    numeric NOT NULL DEFAULT 0,
  fulfillment_type text NOT NULL DEFAULT 'pickup',
  payment_method   text DEFAULT 'cash',
  gcash_reference  text
);
-- Drop old constraint and recreate with all valid statuses
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','confirmed','baking','ready','completed','cancelled'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at     timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at     timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfilled_qty    numeric NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'pickup';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method   text DEFAULT 'cash';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gcash_reference  text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes            text;

-- ── order_items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    text REFERENCES orders(id) ON DELETE CASCADE,
  recipe_id   uuid REFERENCES recipes(id) ON DELETE SET NULL,
  qty         integer NOT NULL,
  pickup_date date,
  unit_price  numeric NOT NULL DEFAULT 0
);

-- ── order_edit_log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_edit_log (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      text REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  old_qty       integer,
  new_qty       integer,
  edited_by     text,
  edited_at     timestamptz DEFAULT now()
);

-- ── bake_entries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bake_entries (
  id         text PRIMARY KEY,
  recipe_id  uuid REFERENCES recipes(id) ON DELETE SET NULL,
  batch_id   text,
  baker      text,
  started_at timestamptz DEFAULT now(),
  qty        text,
  actual_qty numeric,
  status     text NOT NULL DEFAULT 'in_progress',
  img        text,
  order_id   text REFERENCES orders(id) ON DELETE SET NULL,
  cost       numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bake_entries ADD COLUMN IF NOT EXISTS actual_qty numeric;
ALTER TABLE bake_entries ADD COLUMN IF NOT EXISTS order_id   text REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE bake_entries ADD COLUMN IF NOT EXISTS cost       numeric DEFAULT 0;
ALTER TABLE bake_entries ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ── inventory_adjustments ────────────────────────────────────
DROP TABLE IF EXISTS inventory_adjustments;
CREATE TABLE inventory_adjustments (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id text REFERENCES ingredients(id) ON DELETE CASCADE,
  delta         numeric NOT NULL,
  unit          text,
  reason        text,
  notes         text,
  adjusted_by   text,
  created_at    timestamptz DEFAULT now()
);

-- ── finished_goods ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finished_goods (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id     uuid REFERENCES recipes(id) ON DELETE CASCADE,
  quantity      numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  unit          text NOT NULL DEFAULT 'units',
  baked_at      timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS finished_goods_recipe_id_idx ON finished_goods (recipe_id);

-- ── finished_goods_dispositions ──────────────────────────────
CREATE TABLE IF NOT EXISTS finished_goods_dispositions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id        uuid REFERENCES recipes(id) ON DELETE SET NULL,
  qty              numeric NOT NULL,
  unit             text DEFAULT 'units',
  reason           text,
  amount_collected numeric DEFAULT 0,
  writeoff_value   numeric DEFAULT 0,
  notes            text,
  disposed_at      timestamptz DEFAULT now()
);
ALTER TABLE finished_goods_dispositions ADD COLUMN IF NOT EXISTS writeoff_value   numeric DEFAULT 0;
ALTER TABLE finished_goods_dispositions ADD COLUMN IF NOT EXISTS amount_collected numeric DEFAULT 0;

-- ── expenses ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category      text,
  type          text,
  amount        numeric NOT NULL DEFAULT 0,
  description   text,
  note          text,
  ingredient_id text REFERENCES ingredients(id) ON DELETE SET NULL,
  qty           numeric,
  unit          text,
  created_by    text,
  created_at    timestamptz DEFAULT now(),
  recorded_at   timestamptz DEFAULT now()
);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category      text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type          text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description   text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS note          text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ingredient_id text REFERENCES ingredients(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qty           numeric;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unit          text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by    text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recorded_at   timestamptz DEFAULT now();

-- ============================================================
-- ROW LEVEL SECURITY — permissive policies for all tables
-- (tighten per-table when you add proper auth roles)
-- ============================================================
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','ingredients','recipes','recipe_ingredients','recipe_steps',
    'orders','order_items','order_edit_log','bake_entries',
    'inventory_adjustments','finished_goods','finished_goods_dispositions','expenses'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON %I', t);
    EXECUTE format('CREATE POLICY "allow_all" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
