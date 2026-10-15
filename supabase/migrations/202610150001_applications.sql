create table public.applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id uuid not null unique,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254 and email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  school text not null check (char_length(btrim(school)) between 1 and 200),
  study_year text not null check (char_length(btrim(study_year)) between 1 and 80),
  preferred_role text not null check (preferred_role in ('graphics','video_photo','events','undecided')),
  motivation text not null check (char_length(btrim(motivation)) between 1 and 2000),
  experience text not null default '' check (char_length(experience) <= 2000),
  status text not null default 'new' check (status in ('new','reviewing','accepted','rejected')),
  internal_notes text not null default '',
  consent_at timestamptz not null default now(),
  consent_version text not null check (consent_version = 'recruitment-v1')
);
create index applications_review_idx on public.applications (status, created_at desc);
alter table public.applications enable row level security;
revoke all on public.applications from anon, authenticated;
grant select, insert on public.applications to service_role;
comment on table public.applications is 'Private recruitment submissions. Review through authorized Supabase dashboard access.';
