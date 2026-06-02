create extension if not exists pg_cron;

create or replace function public.cleanup_old_notifications()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.notifications
  where created_at < now() - interval '90 days';
$$;

revoke all on function public.cleanup_old_notifications() from public;

do $$
begin
  perform cron.unschedule('cleanup-old-notifications');
exception when others then null;
end $$;

select cron.schedule(
  'cleanup-old-notifications',
  '15 3 * * *',
  $$ select public.cleanup_old_notifications(); $$
);