-- ============================================================
-- GCash 50% down payment (Jessie runs this himself; no agent ran it)
-- Run AFTER 20261108140000_preorder_dates.sql.
--
--   * booking is never blocked by payment; admin only gets a warning
--   * no auto-cancel
--   * down_payment = ceil(total / 2) to the peso, computed server-side
--   * balance collected cash or GCash at the seller's discretion
--     (app sends p_payment_method = 'cash' behind the scenes)
--
-- RLS check (20260909000000_rls_lockdown.sql): customers only have
-- "own orders read" (SELECT) on orders; INSERT/UPDATE/DELETE are admin-only
-- ("admin all"). So customers can't write payment_* columns directly —
-- only through submit_payment_proof() below. No change needed.
-- ============================================================

-- ── 1. orders columns ──
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS down_payment          numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_status        text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_proof_path    text,
  ADD COLUMN IF NOT EXISTS payment_ref           text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_at   timestamptz,
  ADD COLUMN IF NOT EXISTS payment_note          text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'submitted', 'verified', 'rejected'));
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON public.orders (payment_status);

-- ── 2. down payment computed server-side ──
-- place_order() inserts the order then its items in one transaction; this
-- statement trigger sets down_payment from the DB-priced items.
CREATE OR REPLACE FUNCTION public.set_order_down_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.orders o
     SET down_payment = ceil(t.total / 2.0)
    FROM (SELECT oi.order_id, sum(oi.qty * oi.unit_price) AS total
            FROM public.order_items oi
           WHERE oi.order_id IN (SELECT DISTINCT order_id FROM new_rows)
           GROUP BY oi.order_id) t
   WHERE o.id = t.order_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_order_down_payment ON public.order_items;
CREATE TRIGGER trg_order_down_payment
  AFTER INSERT ON public.order_items
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.set_order_down_payment();

-- ── 3. backfill existing orders ──
UPDATE public.orders o
   SET down_payment = ceil(t.total / 2.0)
  FROM (SELECT order_id, sum(qty * unit_price) AS total
          FROM public.order_items GROUP BY order_id) t
 WHERE t.order_id = o.id AND o.down_payment IS NULL;

UPDATE public.orders
   SET payment_status = 'verified',
       payment_verified_at = coalesce(payment_verified_at, now()),
       payment_note = 'Backfilled: completed before GCash down payments'
 WHERE status = 'completed' AND payment_status = 'unpaid';

-- ── 4. private storage bucket for proofs ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs', 'payment-proofs', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- Path convention: <auth.uid()>/<timestamp>-<random>.<ext>
DROP POLICY IF EXISTS "payment proofs own upload"  ON storage.objects;
DROP POLICY IF EXISTS "payment proofs own read"    ON storage.objects;
DROP POLICY IF EXISTS "payment proofs admin read"  ON storage.objects;
DROP POLICY IF EXISTS "payment proofs admin delete" ON storage.objects;

CREATE POLICY "payment proofs own upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs'
              AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "payment proofs own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs'
         AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "payment proofs admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.is_admin());

CREATE POLICY "payment proofs admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.is_admin());
-- No UPDATE policy: proofs can't be overwritten; a re-upload is a new file.

-- ── 5. submit_payment_proof (customer; own orders only) ──
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  p_order_ids text[],
  p_path      text,
  p_ref       text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ref text := nullif(btrim(coalesce(p_ref, '')), '');
  v_n   int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in.' USING ERRCODE = '28000';
  END IF;
  IF p_order_ids IS NULL OR cardinality(p_order_ids) = 0 OR cardinality(p_order_ids) > 20 THEN
    RAISE EXCEPTION 'No orders selected.' USING ERRCODE = '22023';
  END IF;
  IF p_path IS NULL OR split_part(p_path, '/', 1) <> v_uid::text THEN
    RAISE EXCEPTION 'Invalid proof file.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'payment-proofs' AND name = p_path) THEN
    RAISE EXCEPTION 'Please upload the screenshot first.' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_ref, '')) > 64 THEN
    RAISE EXCEPTION 'Reference number is too long.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_order_ids) AS x(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = x.id AND o.user_id = v_uid
        AND o.status <> 'cancelled'
        AND o.payment_status IN ('unpaid', 'rejected', 'submitted')
    )
  ) THEN
    RAISE EXCEPTION 'Some of these orders can''t take a payment proof.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
     SET payment_status       = 'submitted',
         payment_proof_path   = p_path,
         payment_ref          = v_ref,
         payment_submitted_at = now(),
         payment_note         = NULL
   WHERE id = ANY (p_order_ids) AND user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.submit_payment_proof(text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(text[], text, text) TO authenticated;

-- ── 6. admin verify / reject ──
-- Done from the app with the existing "admin all" policy on orders:
--   verified: payment_status='verified', payment_verified_at=now(), payment_note=null
--   rejected: payment_status='rejected', payment_note='<reason shown to customer>'
-- Proof images are opened via short-lived signed URLs (createSignedUrl).
