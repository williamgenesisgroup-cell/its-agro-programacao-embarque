export const RENDER_SHARED_STATE_MIGRATION = `
create extension if not exists pgcrypto;

create table if not exists public.app_state (
  id integer primary key,
  state jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'web-app',
  last_source text not null default 'ONLINE'
);

create table if not exists public.app_state_audit (
  id bigserial primary key,
  state_version bigint not null,
  action text not null,
  source text not null,
  actor_id text,
  entity_counts jsonb not null default '{}'::jsonb,
  changed_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, state, version, updated_by, last_source)
values (
  1,
  jsonb_build_object(
    'people', '[]'::jsonb,
    'locations', '[]'::jsonb,
    'schedules', '[]'::jsonb,
    'dailyPlans', '[]'::jsonb,
    'suggestions', '[]'::jsonb,
    'costPerKm', 1.2
  ),
  1,
  'database-bootstrap',
  'ONLINE'
)
on conflict (id) do nothing;

alter table public.app_state enable row level security;
alter table public.app_state force row level security;
alter table public.app_state_audit enable row level security;
alter table public.app_state_audit force row level security;
alter table public.settings enable row level security;
alter table public.settings force row level security;

drop policy if exists app_state_api_access on public.app_state;
create policy app_state_api_access on public.app_state
  for all
  using (current_setting('app.access_granted', true) = 'true')
  with check (current_setting('app.access_granted', true) = 'true');

drop policy if exists app_state_audit_api_access on public.app_state_audit;
create policy app_state_audit_api_access on public.app_state_audit
  for all
  using (current_setting('app.access_granted', true) = 'true')
  with check (current_setting('app.access_granted', true) = 'true');

drop policy if exists settings_api_access on public.settings;
create policy settings_api_access on public.settings
  for all
  using (current_setting('app.access_granted', true) = 'true')
  with check (current_setting('app.access_granted', true) = 'true');
`;
