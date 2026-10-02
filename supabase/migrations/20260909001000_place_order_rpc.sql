-- ============================================================
-- place_order() RPC (review findings C3 / H3 / M1)
--
-- The ONLY way customers create orders (direct INSERTs on orders/order_items
-- are blocked by RLS). In one transaction it:
--   * requires a signed-in caller (auth.uid())
--   * validates contact / fulfillment / payment fields
--   * validates items: 1..50 lines, integer qty 1..100 per product,
--     product exists, is_for_sale and is_available
--   * takes prices from public.recipes (client prices are ignored)
--   * upserts the caller's public.users row (never touches role; never
--     blanks an existing address)
--   * generates an unguessable order id: 'MJ-' + 10 random hex chars
--   * inserts the order and all its items atomically
-- Returns: {"id": "MJ-…", "total": <numeric>}
--
-- Because order + items commit together, the notify-order webhook (pg_net
-- sends after commit) and realtime INSERT listeners always see the items.
-- ============================================================

CREATE OR REPLACE FUNCTION public.place_order(
  p_items             jsonb,
  p_customer_name     text,
  p_customer_phone    text,
  p_customer_social   text DEFAULT NULL,
  p_fulfillment_type  text DEFAULT 'pickup',
  p_delivery_address  text DEFAULT NULL,
  p_notes             text DEFAULT NULL,
  p_payment_method    text DEFAULT 'cash',
  p_gcash_reference   text DEFAULT NULL
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

  -- Normalise + aggregate (duplicate lines for the same product are summed).
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

  SELECT string_agg(r.name, ', ' ORDER BY r.name) INTO v_unavail
  FROM _po_items i
  JOIN public.recipes r ON r.id::text = i.recipe_id
  WHERE r.is_for_sale IS FALSE OR r.is_available IS FALSE;
  IF v_unavail IS NOT NULL THEN
    RAISE EXCEPTION 'Sorry, these items are currently unavailable: %', v_unavail USING ERRCODE = '22023';
  END IF;

  -- ── customer profile (role is protected by trigger) ──
  INSERT INTO public.users (id, name, phone, address)
  VALUES (v_uid, v_name, v_phone, v_address)
  ON CONFLICT (id) DO UPDATE
    SET name    = EXCLUDED.name,
        phone   = EXCLUDED.phone,
        address = COALESCE(EXCLUDED.address, public.users.address);

  -- ── unguessable id, retry on the (astronomically unlikely) collision ──
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
    customer_social, delivery_address, notes, placed_at, payment_method, gcash_reference
  ) VALUES (
    v_id, v_uid, 'pending', v_fulfil, v_name, v_phone,
    v_social, CASE WHEN v_fulfil = 'delivery' THEN v_address END, v_notes, now(),
    v_payment, CASE WHEN v_payment = 'gcash' THEN v_gcash END
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

REVOKE ALL ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text, text, text) TO authenticated;
