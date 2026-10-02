-- ============================================================
-- notify-order webhook: authenticate with a shared secret (review C5)
--
-- The notify-order Edge Function now rejects any request that does not carry
-- the header `x-webhook-secret: <NOTIFY_WEBHOOK_SECRET>`. This trigger reads
-- the same secret (and the function URL) from Supabase Vault.
--
-- REQUIRED ONE-TIME SETUP (SQL editor, as postgres) — use your own values:
--   select vault.create_secret('<long-random-string>', 'notify_webhook_secret');
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/notify-order',
--                              'notify_order_url');
-- and set the SAME secret on the function:
--   supabase secrets set NOTIFY_WEBHOOK_SECRET=<long-random-string>
--
-- If either Vault secret is missing, the trigger logs a WARNING and skips the
-- notification — it never blocks order placement.
-- Requires extensions: pg_net, supabase_vault (both live-only; enabled by
-- default on Supabase / via Database → Extensions).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_order_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_secret text;
  v_url    text;
BEGIN
  -- Only INSERTs and real status changes are interesting to the function.
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'notify_webhook_secret' LIMIT 1;
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'notify_order_url' LIMIT 1;

    IF v_secret IS NULL OR v_url IS NULL THEN
      RAISE WARNING 'notify_order_changed: vault secrets notify_webhook_secret / notify_order_url not set; skipping push';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-webhook-secret', v_secret
                 ),
      body    := jsonb_build_object(
                   'type', TG_OP,
                   'table', TG_TABLE_NAME,
                   'schema', TG_TABLE_SCHEMA,
                   'record', row_to_json(NEW),
                   'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
                 )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let a notification problem roll back an order.
    RAISE WARNING 'notify_order_changed failed: %', SQLERRM;
  END;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.notify_order_changed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_order_changed ON public.orders;
CREATE TRIGGER notify_order_changed
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_changed();
