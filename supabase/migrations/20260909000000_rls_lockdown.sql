-- ============================================================
-- RLS lockdown (review findings C1 / C5)
--
-- Replaces every permissive policy ("allow_all", the guest_orders "anyone"
-- policies, and any other leftover policy) on the app tables with explicit,
-- least-privilege policies:
--
--   recipes, recipe_categories ... anyone may read; only admins write
--   orders, order_items .......... customers read their OWN rows; admins all.
--                                  Customers never insert directly — orders are
--                                  created only by public.place_order() (see the
--                                  next migration).
--   users ........................ a user reads/inserts/updates only their own
--                                  row; admins read/update all. `role` can only
--                                  be changed by an admin or the service role
--                                  (enforced by trigger).
--   push_tokens .................. own rows only; `role` is derived from
--                                  users.role by trigger (never trusted from
--                                  the client). Registration goes through
--                                  public.register_push_token().
--   everything else .............. admins only.
--
-- NOTE: this DROPS ALL EXISTING POLICIES on the tables listed below before
-- recreating them, so no forgotten permissive policy can keep data open.
-- Tables that do not exist (live/schema drift) are skipped.
-- Storage bucket policies (storage.objects) are NOT touched here — review them
-- separately in the dashboard.
-- ============================================================

-- ── helper: is the current caller an admin? ──────────────────
-- SECURITY DEFINER so it can read public.users without recursing into the
-- users RLS policies.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- ── drop every existing policy on the app tables ─────────────
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'users','ingredients','recipes','recipe_categories','recipe_ingredients',
        'recipe_steps','orders','order_items','order_edit_log','bake_entries',
        'inventory_adjustments','finished_goods','finished_goods_dispositions',
        'expenses','push_tokens'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ── enable RLS everywhere (skip tables that don't exist) ─────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','ingredients','recipes','recipe_categories','recipe_ingredients',
    'recipe_steps','orders','order_items','order_edit_log','bake_entries',
    'inventory_adjustments','finished_goods','finished_goods_dispositions',
    'expenses','push_tokens'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ── catalog: public read, admin write ────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recipes','recipe_categories'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY "public read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
      EXECUTE format('CREATE POLICY "admin insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())', t);
      EXECUTE format('CREATE POLICY "admin update" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
      EXECUTE format('CREATE POLICY "admin delete" ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', t);
    END IF;
  END LOOP;
END $$;

-- ── admin-only tables ────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ingredients','recipe_ingredients','recipe_steps','order_edit_log',
    'bake_entries','inventory_adjustments','finished_goods',
    'finished_goods_dispositions','expenses'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY "admin all" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
    END IF;
  END LOOP;
END $$;

-- ── orders ───────────────────────────────────────────────────
-- No INSERT policy for customers: orders are created by place_order() only.
CREATE POLICY "own orders read" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admin all" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── order_items ──────────────────────────────────────────────
CREATE POLICY "own order items read" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
  ));

CREATE POLICY "admin all" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── users ────────────────────────────────────────────────────
CREATE POLICY "own row read" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "own row insert" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "own row update" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "admin delete" ON public.users
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Block privilege escalation: only admins / service role / SQL editor
-- (auth.uid() IS NULL) may set or change users.role.
CREATE OR REPLACE FUNCTION public.users_protect_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.role := 'customer';
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS users_protect_role ON public.users;
CREATE TRIGGER users_protect_role
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_protect_role();

-- ── push_tokens ──────────────────────────────────────────────
CREATE POLICY "own tokens read" ON public.push_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "own tokens insert" ON public.push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own tokens update" ON public.push_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "own tokens delete" ON public.push_tokens
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- role is always a snapshot of users.role, never client-supplied
CREATE OR REPLACE FUNCTION public.push_tokens_set_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.role := COALESCE((SELECT u.role FROM public.users u WHERE u.id = NEW.user_id), 'customer');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS push_tokens_set_role ON public.push_tokens;
CREATE TRIGGER push_tokens_set_role
  BEFORE INSERT OR UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.push_tokens_set_role();

-- Register (or re-assign) this device's FCM token to the CALLER.
-- A device token can move between accounts (shared device), which a plain
-- upsert can't do under own-row RLS, so this runs as definer and always
-- binds the token to auth.uid().
CREATE OR REPLACE FUNCTION public.register_push_token(p_token text, p_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 4096 THEN
    RAISE EXCEPTION 'Invalid push token' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.push_tokens (token, user_id, user_agent)
  VALUES (p_token, auth.uid(), left(p_user_agent, 300))
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        user_agent = EXCLUDED.user_agent;
END $$;

REVOKE ALL ON FUNCTION public.register_push_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, text) TO authenticated;
