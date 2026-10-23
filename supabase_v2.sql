-- CRISS' STORE · Ampliación (promociones, datos de pago y ranking)
-- Ejecútalo UNA vez en Supabase → SQL Editor, DESPUÉS de supabase.sql.

-- ============ FECHA DE PAGO (para medir el pago rápido) ============
alter table public.compras add column if not exists pagada_en timestamptz;

create or replace function public.set_pagada_en() returns trigger language plpgsql as $$
begin
  if new.pagada and not old.pagada then
    new.pagada_en := now();
  elsif not new.pagada then
    new.pagada_en := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_pagada_en on public.compras;
create trigger trg_pagada_en before update on public.compras
  for each row execute function public.set_pagada_en();

-- ============ PROMOCIONES ============
create table if not exists public.promos (
  id         bigint generated always as identity primary key,
  titulo     text not null,
  texto      text,
  imagen_url text,
  codigo     text,                       -- producto relacionado (opcional)
  activa     boolean not null default true,
  creado     timestamptz not null default now()
);
alter table public.promos enable row level security;
create policy "ver promos activas" on public.promos for select to anon, authenticated using (activa);
create policy "admin promos" on public.promos for all to authenticated using (true) with check (true);

-- ============ DATOS DE PAGO (solo administrador) ============
create table if not exists public.ajustes (
  clave text primary key,
  valor text
);
alter table public.ajustes enable row level security;
create policy "admin ajustes" on public.ajustes for all to authenticated using (true) with check (true);

-- ============ RANKING (solo administrador) ============
create or replace function public.ranking(p_desde timestamptz default null)
returns table (cliente_id text, nombre text, n_compras bigint, unidades bigint,
               total numeric, pagadas bigint, horas_pago numeric)
language sql stable as $$
  select c.cliente_id, cl.nombre, count(*), sum(c.cantidad)::bigint, sum(c.monto),
         count(c.pagada_en),
         avg(extract(epoch from (c.pagada_en - c.fecha)) / 3600.0)
  from public.compras c
  join public.clientes cl on cl.id = c.cliente_id
  where p_desde is null or c.fecha >= p_desde
  group by c.cliente_id, cl.nombre;
$$;
grant execute on function public.ranking(timestamptz) to authenticated;
