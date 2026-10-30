-- CRISS' STORE · Ampliación 14: pérdidas de inventario (robos, desaparecidos, daños…)
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v13.sql.

-- ============ REGISTRO DE PÉRDIDAS ============
create table if not exists public.perdidas (
  id              bigint generated always as identity primary key,
  producto_id     bigint not null references public.productos(id),
  producto_nombre text not null,
  sucursal_id     bigint references public.sucursales(id),   -- local del que desapareció la mercancía
  cantidad        int not null check (cantidad > 0),
  costo_unit      numeric(12,4) not null default 0,          -- costo del producto al momento de la pérdida
  motivo          text not null check (motivo in ('robo', 'desaparecido', 'danado', 'vencido', 'otro')),
  comentario      text not null check (length(trim(comentario)) >= 5),
  foto_path       text,                                      -- foto que respalda la pérdida (opcional)
  fecha           timestamptz not null default now()
);
alter table public.perdidas enable row level security;
-- Solo lectura para el administrador: las pérdidas se crean únicamente con registrar_perdida()
create policy "admin ve perdidas" on public.perdidas for select to authenticated using (true);

-- Descuenta del inventario del local indicado y deja el registro (todo o nada)
create or replace function public.registrar_perdida(p_producto bigint, p_sucursal bigint, p_cantidad int,
                                                    p_motivo text, p_comentario text, p_foto_path text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v public.productos%rowtype; v_madre bigint; v_loc bigint; v_disp int; v_id bigint;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_cantidad is null or p_cantidad < 1 then raise exception 'Cantidad no válida'; end if;
  if p_motivo is null or p_motivo not in ('robo', 'desaparecido', 'danado', 'vencido', 'otro') then
    raise exception 'Motivo no válido';
  end if;
  if p_comentario is null or length(trim(p_comentario)) < 5 then
    raise exception 'El comentario es obligatorio (mínimo 5 letras)';
  end if;

  select * into v from public.productos where id = p_producto for update;
  if not found then raise exception 'Producto no encontrado'; end if;

  select s.id into v_madre from public.sucursales s where s.es_madre limit 1;
  v_loc := coalesce(p_sucursal, v_madre);
  if not exists (select 1 from public.sucursales s where s.id = v_loc and s.activa) then
    raise exception 'Local no válido';
  end if;

  if v_loc = v_madre then
    if v.stock < p_cantidad then raise exception 'Solo hay % de "%" en este local', v.stock, v.nombre; end if;
    update public.productos set stock = stock - p_cantidad where id = v.id;
  else
    select ss.cantidad into v_disp from public.stock_sucursal ss
     where ss.sucursal_id = v_loc and ss.producto_id = v.id for update;
    if coalesce(v_disp, 0) < p_cantidad then
      raise exception 'Solo hay % de "%" en este local', coalesce(v_disp, 0), v.nombre;
    end if;
    update public.stock_sucursal set cantidad = cantidad - p_cantidad
     where sucursal_id = v_loc and producto_id = v.id;
  end if;

  insert into public.perdidas (producto_id, producto_nombre, sucursal_id, cantidad, costo_unit, motivo, comentario, foto_path)
  values (v.id, v.nombre, v_loc, p_cantidad, v.costo, p_motivo, trim(p_comentario), p_foto_path)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.registrar_perdida(bigint, bigint, int, text, text, text) from public, anon;
grant execute on function public.registrar_perdida(bigint, bigint, int, text, text, text) to authenticated;

-- ============ RESUMEN MENSUAL: ahora también muestra las pérdidas ============
drop function if exists public.resumen_mensual();
create function public.resumen_mensual()
returns table (mes date, ventas numeric, costo_vendido numeric, ganancia numeric,
               gastos numeric, cobrado numeric, perdidas numeric)
language sql stable as $$
  with m as (
    select date_trunc('month', fecha at time zone 'America/Panama')::date as mes,
           monto as ventas, cantidad * costo_unit as costo, 0::numeric as gasto, 0::numeric as cobrado, 0::numeric as perdida
      from public.compras where not historico
    union all
    select date_trunc('month', fecha at time zone 'America/Panama')::date, 0, 0, costo_total, 0, 0
      from public.entradas
    union all
    select date_trunc('month', fecha at time zone 'America/Panama')::date, 0, 0, 0, monto, 0
      from public.pagos
    union all
    select date_trunc('month', fecha at time zone 'America/Panama')::date, 0, 0, 0, 0, cantidad * costo_unit
      from public.perdidas
  )
  select mes, sum(ventas), sum(costo), sum(ventas) - sum(costo), sum(gasto), sum(cobrado), sum(perdida)
  from m group by mes order by mes desc limit 12;
$$;
revoke execute on function public.resumen_mensual() from public, anon;
grant execute on function public.resumen_mensual() to authenticated;
