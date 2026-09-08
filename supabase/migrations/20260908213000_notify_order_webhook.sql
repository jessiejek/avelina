-- Fire the `notify-order` Edge Function (Firebase Cloud Messaging) on order events.
-- Equivalent to a Supabase Database Webhook; written as a trigger so it lives in
-- migrations. Requires the pg_net extension (enable in Database → Extensions).

create extension if not exists pg_net;

create or replace function public.notify_order_changed()
returns trigger language plpgsql security definer as $$
begin
  perform net.http_post(
    url := 'https://kejlewiqfkegelfwixhp.supabase.co/functions/v1/notify-order',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', row_to_json(new),
      'old_record', case when tg_op = 'UPDATE' then row_to_json(old) else null end
    )
  );
  return new;
end $$;

drop trigger if exists notify_order_changed on public.orders;
create trigger notify_order_changed
after insert or update on public.orders
for each row execute function public.notify_order_changed();
