-- IT'S AGRO | Programação de Embarque
-- Migration compatível com Supabase/PostgreSQL.
-- A aplicação local usa localStorage para prototipação; esta migration é o contrato de produção.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'OPERAÇÃO' check (role in ('ADMIN', 'OPERAÇÃO', 'CONSULTA')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  cpf text,
  address text not null,
  number text,
  neighborhood text,
  city text not null,
  uf char(2) not null,
  cep text,
  complement text,
  reference_point text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  current_location text,
  last_location_update timestamptz,
  supervisor text,
  operational_status text not null default 'Disponível' check (operational_status in ('Disponível', 'Programado', 'Em deslocamento', 'No local', 'Finalizado', 'Indisponível')),
  notes text,
  active boolean not null default true,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cpf)
);

create table if not exists public.boarding_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type text not null default 'Aeroporto',
  address text not null,
  number text,
  neighborhood text,
  city text not null,
  uf char(2) not null,
  cep text,
  complement text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  notes text,
  active boolean not null default true,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  boarding_location_id uuid not null references public.boarding_locations(id) on delete restrict,
  boarding_date date not null,
  boarding_time time not null,
  description text,
  notes text,
  arrival_lead_minutes integer not null default 30 check (arrival_lead_minutes between 0 and 180),
  stop_buffer_minutes integer not null default 8 check (stop_buffer_minutes between 0 and 60),
  status text not null default 'Rascunho' check (status in ('Rascunho', 'Programado', 'Finalizado', 'Cancelado')),
  estimated_km numeric(10, 2),
  estimated_minutes integer,
  route_provider text not null default 'coordinate-estimate',
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_people (
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete restrict,
  stop_order integer not null check (stop_order > 0),
  address_snapshot text not null,
  lat_snapshot numeric(10, 7),
  lng_snapshot numeric(10, 7),
  pickup_time time,
  distance_km numeric(10, 2),
  duration_minutes integer,
  primary key (schedule_id, person_id),
  unique (schedule_id, stop_order)
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null unique references public.schedules(id) on delete cascade,
  provider text not null default 'coordinate-estimate',
  provider_route_id text,
  polyline text,
  total_km numeric(10, 2),
  total_minutes integer,
  is_approximate boolean not null default true,
  calculated_at timestamptz not null default now()
);

create table if not exists public.route_stops (
  route_id uuid not null references public.routes(id) on delete cascade,
  stop_order integer not null check (stop_order > 0),
  kind text not null check (kind in ('PESSOA', 'DESTINO')),
  person_id uuid references public.people(id) on delete set null,
  label text not null,
  address text not null,
  lat numeric(10, 7),
  lng numeric(10, 7),
  pickup_time time,
  distance_km numeric(10, 2),
  duration_minutes integer,
  primary key (route_id, stop_order)
);

create table if not exists public.suggestion_history (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.schedules(id) on delete set null,
  original_person_id uuid references public.people(id) on delete set null,
  suggested_person_id uuid references public.people(id) on delete set null,
  original_km numeric(10, 2) not null,
  suggested_km numeric(10, 2) not null,
  economy_km numeric(10, 2) generated always as (original_km - suggested_km) stored,
  original_minutes integer,
  suggested_minutes integer,
  decision text not null check (decision in ('APLICADA', 'IGNORADA')),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists people_city_status_idx on public.people (city, operational_status) where active = true;
create index if not exists people_supervisor_idx on public.people (supervisor) where active = true;
create index if not exists schedules_date_time_idx on public.schedules (boarding_date, boarding_time);
create index if not exists schedule_people_person_idx on public.schedule_people (person_id);
create index if not exists suggestion_history_schedule_idx on public.suggestion_history (schedule_id, created_at desc);

alter table public.app_users enable row level security;
alter table public.people enable row level security;
alter table public.boarding_locations enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_people enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.suggestion_history enable row level security;

-- O app deve autenticar o operador antes de trocar o localStorage por estas tabelas.
-- As policies abaixo preservam isolamento por usuário e permitem administradores.
create policy "authenticated users can read people" on public.people for select to authenticated using (true);
create policy "authenticated users can write people" on public.people for all to authenticated using (true) with check (true);
create policy "authenticated users can read locations" on public.boarding_locations for select to authenticated using (true);
create policy "authenticated users can write locations" on public.boarding_locations for all to authenticated using (true) with check (true);
create policy "authenticated users can read schedules" on public.schedules for select to authenticated using (true);
create policy "authenticated users can write schedules" on public.schedules for all to authenticated using (true) with check (true);
create policy "authenticated users can read schedule people" on public.schedule_people for select to authenticated using (true);
create policy "authenticated users can write schedule people" on public.schedule_people for all to authenticated using (true) with check (true);
create policy "authenticated users can read routes" on public.routes for select to authenticated using (true);
create policy "authenticated users can write routes" on public.routes for all to authenticated using (true) with check (true);
create policy "authenticated users can read route stops" on public.route_stops for select to authenticated using (true);
create policy "authenticated users can write route stops" on public.route_stops for all to authenticated using (true) with check (true);
create policy "authenticated users can read suggestions" on public.suggestion_history for select to authenticated using (true);
create policy "authenticated users can write suggestions" on public.suggestion_history for all to authenticated using (true) with check (true);
