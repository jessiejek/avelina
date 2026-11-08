-- ============================================================
-- Pre-order dates (DRAFT — Jessie runs this himself; no agent ran it)
--
--   * recipe_preorder_dates: up to 5 dates per product (trigger-enforced)
--     RLS: anyone can read, only admins (is_admin()) can write
--   * orders.preorder_date (nullable) + index
--   * place_order(): new optional p_preorder_date.
--       - must be >= today in Asia/Manila
--       - every item must have that date in recipe_preorder_dates
--       - pre-order items skip the is_available (sold-out) check
--         but still require is_for_sale
--       - written to orders.preorder_date
--     Everything else is identical to 20260909001000_place_order_rpc.sql.
-- ============================================================

-- ── 1. dates table ──
CREATE TABLE IF NOT EXISTS public.recipe_preorder_dates (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipe_id   text NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  date        date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipe_preorder_dates_recipe_date_key UNIQUE (recipe_id, date)
);
CREATE INDEX IF NOT EXISTS recipe_preorder_dates_date_idx ON public.recipe_preorder_dates (date);

CREATE OR REPLACE FUNCTION public.enforce_max_preorder_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- serialise concurrent inserts for the same product
  PERFORM pg_advisory_xact_lock(hashtext('preorder:' || NEW.recipe_id));
  IF (SELECT count(*) FROM public.recipe_preorder_dates
       WHERE recipe_id = NEW.recipe_id AND id IS DISTINCT FROM NEW.id) >= 5 THEN
    RAISE EXCEPTION 'A product can have at most 5 pre-order dates.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_max_preorder_dates ON public.recipe_preorder_dates;
CREATE TRIGGER trg_max_preorder_dates
  BEFORE INSERT OR UPDATE OF recipe_id ON public.recipe_preorder_dates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_preorder_dates();

-- ── 2. RLS ──
ALTER TABLE public.recipe_preorder_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON public.recipe_preorder_dates;
DROP POLICY IF EXISTS "admin all"   ON public.recipe_preorder_dates;
CREATE POLICY "public read" ON public.recipe_preorder_dates
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin all" ON public.recipe_preorder_dates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.recipe_preorder_dates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.recipe_preorder_dates TO authenticated;

-- Live updates on the storefront / admin (skip if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_preorder_dates;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

-- ── 3. orders column ──
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS preorder_date date;
CREATE INDEX IF NOT EXISTS orders_preorder_date_idx
  ON public.orders (preorder_date) WHERE preorder_date IS NOT NULL;

-- ── 4. place_order with p_preorder_date ──
DROP FUNCTION IF EXISTS public.place_order(jsonb, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.place_order(
  p_items             jsonb,
  p_customer_name     text,
  p_customer_phone    text,
  p_customer_social   text DEFAULT NULL,
  p_fulfillment_type  text DEFAULT 'pickup',
  p_delivery_address  text DEFAULT NULL,
  p_notes             text DEFAULT NULL,
  p_payment_method    text DEFAULT 'cash',
  p_gcash_reference   text DEFAULT NULL,
  p_preorder_date     date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_name      text := btrim(coalesce(p_customer_name, ''));
  v_phone     text := btrim(coalesce(p_customer_phone, ''));
  v_social    text := nullif(btrim(coalesce(p_customer_social, '')), '');
  v_fulfil    text := lower(btrim(coalesce(p_fulfillment_type, 'pickup')));
  v_address   text := nullif(btrim(coalesce(p_delivery_address, '')), '');
  v_notes     text := nullif(btrim(coalesce(p_notes, '')), '');
  v_payment   text := lower(btrim(coalesce(p_payment_method, 'cash')));
  v_gcash     text := nullif(btrim(coalesce(p_gcash_reference, '')), '');
  v_today     date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_lines     int;
  v_bad       int;
  v_missing   int;
  v_unavail   text;
  v_id        text;
  v_total     numeric;
  v_attempt   int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in to place an order.' USING ERRCODE = '28000';
  END IF;

  -- ── contact / options ──
  IF v_name = '' OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Please enter your full name (max 120 characters).' USING ERRCODE = '22023';
  END IF;
  IF v_phone = '' OR length(v_phone) > 40 THEN
    RAISE EXCEPTION 'Please enter a valid phone number.' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_social, '')) > 300 THEN
    RAISE EXCEPTION 'Facebook / Instagram is too long.' USING ERRCODE = '22023';
  END IF;
  IF v_fulfil NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Invalid fulfillment type.' USING ERRCODE = '22023';
  END IF;
  IF v_fulfil = 'delivery' AND v_address IS NULL THEN
    RAISE EXCEPTION 'Please enter a delivery address.' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_address, '')) > 500 THEN
    RAISE EXCEPTION 'Address is too long.' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'Notes are too long (max 1000 characters).' USING ERRCODE = '22023';
  END IF;
  IF v_payment NOT IN ('cash', 'gcash') THEN
    RAISE EXCEPTION 'Invalid payment method.' USING ERRCODE = '22023';
  END IF;
  IF v_payment = 'gcash' AND v_gcash IS NULL THEN
    RAISE EXCEPTION 'Please enter your GCash reference number.' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_gcash, '')) > 64 THEN
    RAISE EXCEPTION 'GCash reference is too long.' USING ERRCODE = '22023';
  END IF;
  IF p_preorder_date IS NOT NULL AND p_preorder_date < v_today THEN
    RAISE EXCEPTION 'The pre-order date % has already passed.', to_char(p_preorder_date, 'Mon DD') USING ERRCODE = '22023';
  END IF;

  -- ── items ──
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Your cart is empty.' USING ERRCODE = '22023';
  END IF;
  v_lines := jsonb_array_length(p_items);
  IF v_lines = 0 THEN
    RAISE EXCEPTION 'Your cart is empty.' USING ERRCODE = '22023';
  END IF;
  IF v_lines > 50 THEN
    RAISE EXCEPTION 'Too many items in one order.' USING ERRCODE = '22023';
  END IF;

  CREATE TEMP TABLE _po_items ON COMMIT DROP AS
  SELECT e->>'recipe_id' AS recipe_id,
         sum(
           CASE WHEN jsonb_typeof(e->'qty') = 'number'
                 AND (e->>'qty') ~ '^[0-9]{1,4}$'
                THEN (e->>'qty')::int
                ELSE NULL END
         ) AS qty,
         bool_or(
           NOT (jsonb_typeof(e->'qty') = 'number' AND (e->>'qty') ~ '^[0-9]{1,4}$')
         ) AS bad_qty
  FROM jsonb_array_elements(p_items) AS e
  GROUP BY e->>'recipe_id';

  SELECT count(*) INTO v_bad
  FROM _po_items
  WHERE recipe_id IS NULL OR bad_qty OR qty IS NULL OR qty < 1 OR qty > 100;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Each item needs a quantity between 1 and 100.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_missing
  FROM _po_items i
  WHERE NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.id::text = i.recipe_id);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Some items in your cart are no longer on the menu. Please remove them and try again.'
      USING ERRCODE = '22023';
  END IF;

  IF p_preorder_date IS NULL THEN
    SELECT string_agg(r.name, ', ' ORDER BY r.name) INTO v_unavail
    FROM _po_items i
    JOIN public.recipes r ON r.id::text = i.recipe_id
    WHERE r.is_for_sale IS FALSE OR r.is_available IS FALSE;
    IF v_unavail IS NOT NULL THEN
      RAISE EXCEPTION 'Sorry, these items are currently unavailable: %', v_unavail USING ERRCODE = '22023';
    END IF;
  ELSE
    -- pre-order: must still be for sale, and must be open on that date
    SELECT string_agg(r.name, ', ' ORDER BY r.name) INTO v_unavail
    FROM _po_items i
    JOIN public.recipes r ON r.id::text = i.recipe_id
    WHERE r.is_for_sale IS FALSE
       OR NOT EXISTS (SELECT 1 FROM public.recipe_preorder_dates d
                       WHERE d.recipe_id = r.id::text AND d.date = p_preorder_date);
    IF v_unavail IS NOT NULL THEN
      RAISE EXCEPTION 'Sorry, these items can''t be pre-ordered for %: %', to_char(p_preorder_date, 'Mon DD'), v_unavail
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ── customer profile (role is protected by trigger) ──
  INSERT INTO public.users (id, name, phone, address)
  VALUES (v_uid, v_name, v_phone, v_address)
  ON CONFLICT (id) DO UPDATE
    SET name    = EXCLUDED.name,
        phone   = EXCLUDED.phone,
        address = COALESCE(EXCLUDED.address, public.users.address);

  LOOP
    v_attempt := v_attempt + 1;
    v_id := 'MJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE id = v_id);
    IF v_attempt >= 5 THEN
      RAISE EXCEPTION 'Could not allocate an order number, please try again.';
    END IF;
  END LOOP;

  INSERT INTO public.orders (
    id, user_id, status, fulfillment_type, customer_name, customer_phone,
    customer_social, delivery_address, notes, placed_at, payment_method, gcash_reference,
    preorder_date
  ) VALUES (
    v_id, v_uid, 'pending', v_fulfil, v_name, v_phone,
    v_social, CASE WHEN v_fulfil = 'delivery' THEN v_address END, v_notes, now(),
    v_payment, CASE WHEN v_payment = 'gcash' THEN v_gcash END,
    p_preorder_date
  );

  INSERT INTO public.order_items (order_id, recipe_id, qty, unit_price)
  SELECT v_id, r.id, i.qty, coalesce(r.price, 0)
  FROM _po_items i
  JOIN public.recipes r ON r.id::text = i.recipe_id;

  SELECT coalesce(sum(oi.qty * oi.unit_price), 0) INTO v_total
  FROM public.order_items oi WHERE oi.order_id = v_id;

  DROP TABLE IF EXISTS _po_items;

  RETURN jsonb_build_object('id', v_id, 'total', v_total);
END $$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text, text, text, date) TO authenticated;
