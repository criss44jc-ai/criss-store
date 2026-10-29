-- CRISS' STORE · Ampliación 13: ventas por local
-- Cada venta sale del inventario de UN local (casa madre o sucursal) y se puede ver cuánto vende cada uno.
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v12.sql.

-- ============ CADA VENTA GUARDA DE QUÉ LOCAL SALIÓ ============
alter table public.compras add column if not exists sucursal_id bigint references public.sucursales(id);
-- todo lo vendido hasta ahora salió de la casa madre
update public.compras set sucursal_id = (select id from public.sucursales where es_madre limit 1) where sucursal_id is null;

-- ============ ¿DESDE QUÉ LOCAL VENDE LA TIENDA? ============
-- Si el enlace trae un local (…/?l=2) se usa ese; si no, el que elijas en el panel; si no, la casa madre.
create or replace function public.local_tienda(p_local bigint default null)
returns table (id bigint, nombre text, varios boolean)
language plpgsql security definer set search_path = public stable as $$
declare v bigint;
begin
  select s.id into v from public.sucursales s where s.id = p_local and s.activa;
  if v is null then
    select nullif(a.valor, '')::bigint into v from public.ajustes a where a.clave = 'local_venta';
    if v is not null and not exists (select 1 from public.sucursales s where s.id = v and s.activa) then v := null; end if;
  end if;
  if v is null then select s.id into v from public.sucursales s where s.es_madre limit 1; end if;
  return query
    select s.id, s.nombre, (select count(*) from public.sucursales x where x.activa) > 1
    from public.sucursales s where s.id = v;
end $$;

-- ============ CATÁLOGO: la disponibilidad es la del local que vende ============
drop function if exists public.catalogo();
create or replace function public.catalogo(p_sucursal bigint default null)
returns table (codigo text, nombre text, marca text, especificacion text,
               imagen_url text, disponible boolean, categoria text, precio numeric)
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
           p.categoria, p.precio
    from public.productos p where p.activo order by p.nombre;
end $$;

-- ============ REGISTRAR UNA VENTA: descuenta del local que vende ============
drop function if exists public.registrar_compra(text, text, int, text);
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

grant execute on function public.local_tienda(bigint) to anon, authenticated;
grant execute on function public.catalogo(bigint) to anon, authenticated;
grant execute on function public.registrar_compra(text, text, int, text, bigint) to anon, authenticated;

-- ============ ANULAR UN PEDIDO: la mercancía vuelve al local de donde salió ============
create or replace function public.anular_compra(p_compra bigint)
returns void language plpgsql as $$
declare v public.compras%rowtype; v_madre bigint;
begin
  select * into v from public.compras where id = p_compra for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v.pagado > 0 then
    raise exception 'Este pedido ya tiene pagos aplicados. Primero anula el pago desde "Pagos recibidos" y luego anula el pedido.';
  end if;
  if not v.historico then
    select s.id into v_madre from public.sucursales s where s.es_madre limit 1;
    if v.sucursal_id is null or v.sucursal_id = v_madre then
      update public.productos set stock = stock + v.cantidad where id = v.producto_id;
    else
      insert into public.stock_sucursal (sucursal_id, producto_id, cantidad)
      values (v.sucursal_id, v.producto_id, v.cantidad)
      on conflict (sucursal_id, producto_id) do update set cantidad = public.stock_sucursal.cantidad + excluded.cantidad;
    end if;
  end if;
  delete from public.compras where id = v.id;
end $$;

-- ============ VENTAS POR LOCAL (solo administrador) ============
create or replace function public.ventas_por_local(p_desde timestamptz default null)
returns table (sucursal_id bigint, nombre text, es_madre boolean, pedidos bigint, unidades bigint,
               ventas numeric, ganancia numeric, por_cobrar numeric)
language sql stable as $$
  select s.id, s.nombre, s.es_madre, count(c.id), coalesce(sum(c.cantidad), 0)::bigint,
         coalesce(sum(c.monto), 0), coalesce(sum(c.monto - c.cantidad * c.costo_unit), 0),
         coalesce(sum(c.monto - c.pagado) filter (where not c.pagada), 0)
  from public.sucursales s
  left join public.compras c on c.sucursal_id = s.id and not c.historico and (p_desde is null or c.fecha >= p_desde)
  where s.activa
  group by s.id, s.nombre, s.es_madre
  order by s.es_madre desc, s.id;
$$;
revoke execute on function public.ventas_por_local(timestamptz) from public, anon;
grant execute on function public.ventas_por_local(timestamptz) to authenticated;
