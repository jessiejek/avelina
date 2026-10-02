-- ============================================================
-- Data-integrity CHECKs + missing indexes (review M8)
--
-- CHECKs are added NOT VALID so this migration never fails on legacy rows;
-- they are enforced for all new/updated rows immediately. After cleaning any
-- bad legacy data, validate them, e.g.:
--   ALTER TABLE order_items VALIDATE CONSTRAINT order_items_qty_positive;
-- ============================================================

-- order_items
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_qty_positive;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_qty_positive
  CHECK (qty > 0) NOT VALID;

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_unit_price_nonneg;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_unit_price_nonneg
  CHECK (unit_price >= 0) NOT VALID;

-- recipes
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_price_nonneg;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_price_nonneg
  CHECK (price IS NULL OR price >= 0) NOT VALID;

-- orders
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_type_check
  CHECK (fulfillment_type IS NULL OR fulfillment_type IN ('pickup', 'delivery')) NOT VALID;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('cash', 'gcash')) NOT VALID;

-- users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'admin')) NOT VALID;

-- push_tokens
ALTER TABLE public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_role_check;
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_role_check
  CHECK (role IN ('customer', 'admin')) NOT VALID;

-- Indexes (FK columns are not indexed automatically in Postgres)
CREATE INDEX IF NOT EXISTS order_items_order_id_idx       ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_recipe_id_idx      ON public.order_items (recipe_id);
CREATE INDEX IF NOT EXISTS orders_placed_at_idx           ON public.orders (placed_at DESC);
CREATE INDEX IF NOT EXISTS orders_user_id_idx             ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx              ON public.orders (status);
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx  ON public.recipe_ingredients (recipe_id);
CREATE INDEX IF NOT EXISTS recipe_steps_recipe_idx        ON public.recipe_steps (recipe_id);
