-- CRISS' STORE · Ampliación 11: perfiles de clientes, premios y tómbola
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v10.sql.
-- Los datos personales (correo, teléfono, cumpleaños, foto) van en tablas PRIVADAS: solo el administrador las ve.

-- ============ PERFIL DE CADA CLIENTE ============
create table if not exists public.perfiles (
  cliente_id  text primary key references public.clientes(id) on delete cascade,
  avatar      text,          -- avatar (emoji) elegido por el administrador
  avatar_url  text,          -- foto pequeña (se guarda dentro de la tabla, no en un espacio público)
  correo      text,
  telefono    text,
  instagram   text,
  facebook    text,
  tiktok      text,
  otras       text,
  cumple      date,
  notas       text,
  actualizado timestamptz not null default now()
);
alter table public.perfiles enable row level security;
create policy "admin perfiles" on public.perfiles for all to authenticated using (true) with check (true);

-- ============ REGLAS DE PREMIO (las defines tú) ============
create table if not exists public.reglas_premio (
  id      bigint generated always as identity primary key,
  tipo    text not null check (tipo in ('cumpleanos', 'producto', 'mas_compra', 'mas_producto')),
  nombre  text not null,
  premio  text not null,
  producto text,                                   -- para "producto" y "mas_producto"
  minimo  int not null default 1,                  -- unidades mínimas (tipo "producto")
  periodo text not null default 'mes' check (periodo in ('mes', 'todo')),
  activa  boolean not null default true,
  creado  timestamptz not null default now()
);
alter table public.reglas_premio enable row level security;
create policy "admin reglas" on public.reglas_premio for all to authenticated using (true) with check (true);

-- ============ PREMIOS ENTREGADOS ============
create table if not exists public.premios (
  id          bigint generated always as identity primary key,
  cliente_id  text not null references public.clientes(id) on delete cascade,
  tipo        text not null default 'personalizado'
              check (tipo in ('personalizado', 'cumpleanos', 'producto', 'mas_compra', 'mas_producto', 'tombola')),
  descripcion text not null,
  regla_id    bigint references public.reglas_premio(id) on delete set null,
  entregado   boolean not null default false,
  nota        text,
  fecha       timestamptz not null default now()
);
alter table public.premios enable row level security;
create policy "admin premios" on public.premios for all to authenticated using (true) with check (true);

-- ============ REPORTES (solo administrador) ============
-- Una fila por cliente: cuánto compró, qué debe y cuál es su producto favorito
create or replace function public.resumen_clientes()
returns table (cliente_id text, nombre text, n_pedidos bigint, unidades bigint, total numeric,
               pendiente numeric, vencido numeric, ultima date, fav text, fav_unidades bigint)
language sql stable as $$
  with t as (
    select c.cliente_id,
           count(*) as n, sum(c.cantidad)::bigint as u, sum(c.monto) as total,
           coalesce(sum(c.monto - c.pagado) filter (where not c.pagada), 0) as pend,
           coalesce(sum(c.monto - c.pagado) filter (where not c.pagada
                    and c.vence < (now() at time zone 'America/Panama')::date), 0) as venc,
           max((c.fecha at time zone 'America/Panama')::date) as ult
    from public.compras c group by c.cliente_id
  ), f as (
    select distinct on (x.cliente_id) x.cliente_id, x.producto_nombre, x.u
    from (select c2.cliente_id, c2.producto_nombre, sum(c2.cantidad)::bigint as u
          from public.compras c2 group by c2.cliente_id, c2.producto_nombre) x
    order by x.cliente_id, x.u desc, x.producto_nombre
  )
  select cl.id, cl.nombre, coalesce(t.n, 0), coalesce(t.u, 0), coalesce(t.total, 0),
         coalesce(t.pend, 0), coalesce(t.venc, 0), t.ult, f.producto_nombre, f.u
  from public.clientes cl
  left join t on t.cliente_id = cl.id
  left join f on f.cliente_id = cl.id
  order by cl.id;
$$;

-- Compras por cliente y producto (sin pedidos anteriores): sirve para premios y tómbolas
create or replace function public.compras_por_cliente(p_desde timestamptz default null)
returns table (cliente_id text, producto text, unidades bigint, veces bigint, total numeric)
language sql stable as $$
  select c.cliente_id, c.producto_nombre, sum(c.cantidad)::bigint, count(*), sum(c.monto)
  from public.compras c
  where not c.historico and (p_desde is null or c.fecha >= p_desde)
  group by c.cliente_id, c.producto_nombre;
$$;

revoke execute on function public.resumen_clientes() from public, anon;
revoke execute on function public.compras_por_cliente(timestamptz) from public, anon;
grant execute on function public.resumen_clientes() to authenticated;
grant execute on function public.compras_por_cliente(timestamptz) to authenticated;
