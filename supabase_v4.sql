-- CRISS' STORE · Ampliación 4: asistente que aconseja compras
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v3.sql.

-- ============ CATEGORÍA DE PRODUCTO ============
alter table public.productos add column if not exists categoria text not null default 'snack';
alter table public.productos drop constraint if exists productos_categoria_chk;
alter table public.productos add constraint productos_categoria_chk
  check (categoria in ('bebida', 'snack', 'comida', 'otro'));

-- Clasificación inicial automática por nombre (puedes corregirla en el panel, en cada producto)
update public.productos set categoria = 'bebida'
 where nombre ~* '(soda|agua|jugo|refresco|bebida|malta|cola|batido|energ)';

-- ============ CATÁLOGO (ahora incluye la categoría) ============
drop function if exists public.catalogo();
create function public.catalogo()
returns table (codigo text, nombre text, marca text, especificacion text,
               imagen_url text, disponible boolean, categoria text)
language sql security definer set search_path = public stable as $$
  select p.codigo, p.nombre, p.marca, p.especificacion, p.imagen_url, p.stock > 0, p.categoria
  from public.productos p where p.activo order by p.nombre;
$$;
grant execute on function public.catalogo() to anon, authenticated;

-- ============ FAVORITOS DEL CLIENTE (sin precios) ============
create or replace function public.mis_favoritos(p_cliente text)
returns table (codigo text, nombre text, categoria text, unidades bigint)
language sql security definer set search_path = public stable as $$
  select p.codigo, p.nombre, p.categoria, sum(c.cantidad)::bigint
  from public.compras c
  join public.productos p on p.id = c.producto_id
  where c.cliente_id = p_cliente and p.activo
  group by p.codigo, p.nombre, p.categoria
  order by 4 desc, 2
  limit 5;
$$;
grant execute on function public.mis_favoritos(text) to anon, authenticated;
