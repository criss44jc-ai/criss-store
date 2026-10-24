-- CRISS' STORE · Ampliación 8: frases de la mascota
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v7.sql.

create table if not exists public.frases (
  id      bigint generated always as identity primary key,
  texto   text not null check (length(texto) between 3 and 200),
  momento text not null default 'entrada' check (momento in ('entrada', 'compra', 'azar')),
  codigo  text,                         -- producto relacionado (opcional), ej: P-0001
  activa  boolean not null default true,
  creado  timestamptz not null default now()
);

alter table public.frases enable row level security;
-- Los clientes solo leen las frases activas; el administrador las maneja todas
create policy "ver frases activas" on public.frases for select to anon, authenticated using (activa);
create policy "admin frases" on public.frases for all to authenticated using (true) with check (true);
