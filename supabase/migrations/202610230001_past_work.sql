alter table public.applications
  add column work_description text not null default '' check (char_length(work_description) <= 1000),
  add column portfolio_url text not null default '' check (char_length(portfolio_url) <= 2000 and (portfolio_url = '' or portfolio_url ~ '^https?://')),
  add column work_files jsonb not null default '[]'::jsonb check (jsonb_typeof(work_files) = 'array' and jsonb_array_length(work_files) <= 3),
  add constraint creative_work_only check (preferred_role in ('graphics','video_photo') or (work_description = '' and portfolio_url = '' and work_files = '[]'::jsonb));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-work', 'application-work', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- No public upload/read policies: only the server and authorized dashboard users access files.

create function public.unreferenced_application_work()
returns table (name text)
language sql security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'application-work' and o.created_at < now() - interval '24 hours'
  and not exists (
    select 1 from public.applications a, jsonb_array_elements(a.work_files) f
    where f->>'path' = o.name
  )
  order by o.created_at limit 100;
$$;
revoke all on function public.unreferenced_application_work() from public, anon, authenticated;
grant execute on function public.unreferenced_application_work() to service_role;
