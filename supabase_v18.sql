-- CRISS' STORE · Ampliación 18: corregir precios mal cargados y compras a proveedor mal digitadas
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v17.sql.

-- ============ REGISTRO DE CORRECCIONES ============
create table if not exists public.correcciones (
  id              bigint generated always as identity primary key,
  tipo            text not null check (tipo in ('precio_venta', 'compra_proveedor')),
  producto_id     bigint references public.productos(id),
  producto_nombre text,
  ref_id          bigint,                              -- id de la compra a proveedor corregida
  valor_anterior  numeric(12,4),                       -- precio anterior o total anterior de la compra
  valor_nuevo     numeric(12,4),
  costo_anterior  numeric(12,4),
  costo_nuevo     numeric(12,4),
  afectados       int not null default 0,              -- pedidos o ventas que se corrigieron
  detalle         text,
  motivo          text not null check (motivo in ('cambio_precio', 'error_carga', 'error_digitacion', 'factura_distinta', 'otro')),
  comentario      text check (comentario is null or length(trim(comentario)) >= 5),
  foto_path       text,
  fecha           timestamptz not null default now()
);
alter table public.correcciones enable row level security;
-- Solo lectura para el administrador: se crean únicamente con las funciones de abajo
create policy "admin ve correcciones" on public.correcciones for select to authenticated using (true);

-- ============ PRECIO DE VENTA ============
-- Vista previa: cuántos pedidos pendientes se corregirían y cuántos no se tocan por tener pagos
create or replace function public.vista_correccion_precio(p_producto bigint, p_precio numeric, p_desde date)
returns table (pendientes bigint, diferencia numeric, con_pagos bigint)
language sql stable as $$
  select count(*) filter (where c.pagado = 0 and not c.pagada),
         coalesce(sum(c.cantidad * p_precio - c.monto) filter (where c.pagado = 0 and not c.pagada), 0),
         count(*) filter (where c.pagado > 0 or c.pagada)
  from public.compras c
  where c.producto_id = p_producto and not c.historico
    and c.fecha >= (p_desde::timestamp at time zone 'America/Panama');
$$;
revoke execute on function public.vista_correccion_precio(bigint, numeric, date) from public, anon;
grant execute on function public.vista_correccion_precio(bigint, numeric, date) to authenticated;

-- Cambia el precio. Sin "corregir": vale desde ahora. Con "corregir": además arregla los pedidos
-- PENDIENTES (sin ningún pago) hechos desde la fecha indicada. Los que ya tienen pagos no se tocan.
create or replace function public.corregir_precio(p_producto bigint, p_precio numeric, p_corregir boolean default false,
                                                  p_desde date default null, p_motivo text default null, p_comentario text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.productos%rowtype; v_n int := 0; v_con bigint := 0; v_desde timestamptz; v_corr boolean := coalesce(p_corregir, false);
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_precio is null or p_precio < 0 or p_precio > 100000 then raise exception 'Precio no válido'; end if;
  select * into v from public.productos where id = p_producto for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if v.precio = p_precio and not v_corr then raise exception 'El precio nuevo es igual al actual'; end if;
  if v_corr then
    if p_motivo is null or p_motivo not in ('error_carga', 'error_digitacion', 'otro') then raise exception 'Motivo no válido'; end if;
    if p_comentario is null or length(trim(p_comentario)) < 5 then raise exception 'La justificación es obligatoria (mínimo 5 letras)'; end if;
    v_desde := coalesce(p_desde, current_date)::timestamp at time zone 'America/Panama';
  end if;

  update public.productos set precio = p_precio where id = v.id;
  if v_corr then
    update public.compras set monto = cantidad * p_precio
     where producto_id = v.id and not historico and pagado = 0 and not pagada and fecha >= v_desde;
    get diagnostics v_n = row_count;
    select count(*) into v_con from public.compras
     where producto_id = v.id and not historico and (pagado > 0 or pagada) and fecha >= v_desde;
  end if;

  insert into public.correcciones (tipo, producto_id, producto_nombre, valor_anterior, valor_nuevo, afectados, detalle, motivo, comentario)
  values ('precio_venta', v.id, v.nombre, v.precio, p_precio, v_n,
          case when v_corr then v_n || ' pedido(s) pendiente(s) corregido(s); ' || v_con || ' con pagos sin cambio' else 'Desde ahora' end,
          case when v_corr then p_motivo else 'cambio_precio' end,
          nullif(trim(coalesce(p_comentario, '')), ''));
  return jsonb_build_object('corregidos', v_n, 'con_pagos', v_con);
end $$;
revoke execute on function public.corregir_precio(bigint, numeric, boolean, date, text, text) from public, anon;
grant execute on function public.corregir_precio(bigint, numeric, boolean, date, text, text) to authenticated;

-- ============ COMPRA A PROVEEDOR MAL DIGITADA ============
-- Corrige el total de la factura (tus gastos del mes quedan bien) y, si lo eliges, el costo del producto
-- y el costo de las ventas desde la fecha indicada (tus ganancias quedan bien).
create or replace function public.corregir_entrada(p_entrada bigint, p_costo_total numeric, p_aplicar_costo boolean default false,
                                                   p_costo_unit numeric default null, p_desde date default null,
                                                   p_motivo text default null, p_comentario text default null, p_foto_path text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.entradas%rowtype; v public.productos%rowtype; v_n int := 0; v_desde timestamptz; v_apl boolean := coalesce(p_aplicar_costo, false);
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_costo_total is null or p_costo_total < 0 or p_costo_total > 1000000 then raise exception 'Total no válido'; end if;
  if p_motivo is null or p_motivo not in ('error_digitacion', 'factura_distinta', 'otro') then raise exception 'Motivo no válido'; end if;
  if p_comentario is null or length(trim(p_comentario)) < 5 then raise exception 'La justificación es obligatoria (mínimo 5 letras)'; end if;

  select * into e from public.entradas where id = p_entrada for update;
  if not found then raise exception 'Compra no encontrada'; end if;
  select * into v from public.productos where id = e.producto_id for update;
  if e.costo_total = p_costo_total and not v_apl then raise exception 'No hay nada que corregir'; end if;
  if v_apl then
    if p_costo_unit is null or p_costo_unit < 0 or p_costo_unit > 100000 then raise exception 'Costo por unidad no válido'; end if;
    v_desde := coalesce(p_desde::timestamp at time zone 'America/Panama', e.fecha);
  end if;

  update public.entradas set costo_total = p_costo_total where id = e.id;
  if v_apl then
    update public.productos set costo = round(p_costo_unit, 4) where id = v.id;
    update public.compras set costo_unit = round(p_costo_unit, 4)
     where producto_id = v.id and not historico and fecha >= v_desde;
    get diagnostics v_n = row_count;
  end if;

  insert into public.correcciones (tipo, producto_id, producto_nombre, ref_id, valor_anterior, valor_nuevo, costo_anterior, costo_nuevo,
                                   afectados, detalle, motivo, comentario, foto_path)
  values ('compra_proveedor', v.id, v.nombre, e.id, e.costo_total, p_costo_total, v.costo,
          case when v_apl then round(p_costo_unit, 4) else null end, v_n,
          e.cantidad || ' unidades · ' || case when v_apl then v_n || ' venta(s) con el costo corregido' else 'solo se corrigió la factura' end,
          p_motivo, trim(p_comentario), p_foto_path);
  return jsonb_build_object('ventas_ajustadas', v_n);
end $$;
revoke execute on function public.corregir_entrada(bigint, numeric, boolean, numeric, date, text, text, text) from public, anon;
grant execute on function public.corregir_entrada(bigint, numeric, boolean, numeric, date, text, text, text) to authenticated;
