-- CRISS' STORE · Ampliación 19: qué productos ve cada local
-- Puedes ocultar un producto en uno o varios locales: deja de verse y de poder comprarse allí.
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v18.sql.

-- Productos ocultos por local (si un producto no aparece aquí, se ve en todos los locales)
create table if not exists public.producto_oculto (
  sucursal_id bigint not null references public.sucursales(id) on delete cascade,
  producto_id bigint not null references public.productos(id) on delete cascade,
  primary key (sucursal_id, producto_id)
);
alter table public.producto_oculto enable row level security;
create policy "admin producto oculto" on public.producto_oculto for all to authenticated using (true) with check (true);

-- El catálogo de cada local solo trae lo que ese local puede ver
create or replace function public.catalogo(p_sucursal bigint default null)
returns table (codigo text, nombre text, marca text, especificacion text, imagen_url text,
               disponible boolean, categoria text, precio numeric, grupo text, grupo_orden int)
language plpgsql security definer set search_path = public stable as $$
declare v bigint; v_madre bigint;
begin
  select l.id into v from public.local_tienda(p_sucursal) l;
  select s.id into v_madre from public.sucursales s where s.es_madre limit 1;
  return query
    select p.codigo, p.nombre, p.marca, p.especificacion, p.imagen_url,
           (case when v = v_madre then p.stock
                 else coalesce((select ss.cantidad from public.stock_sucursal ss
                                 where ss.sucursal_id = v and ss.producto_id = p.id), 0) end) > 0,
           p.categoria, p.precio, g.nombre, g.orden
    from public.productos p
    left join public.grupos g on g.id = p.grupo_id and g.activo
    where p.activo
      and not exists (select 1 from public.producto_oculto o where o.sucursal_id = v and o.producto_id = p.id)
    order by p.nombre;
end $$;

-- Y no se puede comprar un producto oculto en ese local (ni escaneando su QR)
create or replace function public.registrar_compra(p_cliente text, p_codigo text, p_cantidad int,
                                                   p_modalidad text default 'inmediato', p_sucursal bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_prod  public.productos%rowtype;
  v_fact  text;
  v_loc   bigint;
  v_madre bigint;
  v_disp  int;
  v_hoy   date := (now() at time zone 'America/Panama')::date;
  v_ini   date := date_trunc('month', now() at time zone 'America/Panama')::date;
  v_fin   date;
  v_vence date;
begin
  perform set_config('app.motivo', 'venta', true);
  v_fin := (v_ini + interval '1 month' - interval '1 day')::date;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 50 then raise exception 'Cantidad no válida'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente) then raise exception 'Cliente no válido'; end if;

  if p_modalidad = 'inmediato' then
    v_vence := v_hoy;
  elsif p_modalidad = 'quincena15' then
    v_vence := v_ini + 14;
    if v_vence <= v_hoy then raise exception 'Ya pasó el 15 de este mes'; end if;
  elsif p_modalidad = 'quincena30' then
    v_vence := least(v_ini + 29, v_fin);
    if v_vence <= v_hoy then raise exception 'Ya pasó el 30 de este mes'; end if;
  else
    raise exception 'Modalidad de pago no válida';
  end if;

  select l.id into v_loc from public.local_tienda(p_sucursal) l;
  select s.id into v_madre from public.sucursales s where s.es_madre limit 1;

  select * into v_prod from public.productos where codigo = p_codigo and activo for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if exists (select 1 from public.producto_oculto o where o.sucursal_id = v_loc and o.producto_id = v_prod.id) then
    raise exception 'Este producto no está disponible en este local';
  end if;

  if v_loc = v_madre then
    if v_prod.stock < p_cantidad then raise exception 'Solo quedan % en existencia', v_prod.stock; end if;
    update public.productos set stock = stock - p_cantidad where id = v_prod.id;
  else
    select ss.cantidad into v_disp from public.stock_sucursal ss
     where ss.sucursal_id = v_loc and ss.producto_id = v_prod.id for update;
    if coalesce(v_disp, 0) < p_cantidad then raise exception 'Solo quedan % en existencia', coalesce(v_disp, 0); end if;
    update public.stock_sucursal set cantidad = cantidad - p_cantidad
     where sucursal_id = v_loc and producto_id = v_prod.id;
  end if;

  insert into public.compras (cliente_id, producto_id, producto_nombre, cantidad, monto,
                              modalidad, vence, costo_unit, sucursal_id)
  values (p_cliente, v_prod.id, v_prod.nombre, p_cantidad, p_cantidad * v_prod.precio,
          p_modalidad, v_vence, v_prod.costo, v_loc)
  returning factura into v_fact;

  return jsonb_build_object('factura', v_fact, 'producto', v_prod.nombre,
                            'cantidad', p_cantidad, 'vence', v_vence);
end $$;
