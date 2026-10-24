-- CRISS' STORE · Ampliación 7: pedidos anteriores
-- Para cargar cuentas por cobrar de antes de usar el sistema, sin tocar el inventario ni las ganancias.
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v6.sql.

-- ============ MARCA DE PEDIDO ANTERIOR ============
alter table public.compras add column if not exists historico boolean not null default false;
alter table public.compras alter column producto_id drop not null;   -- el producto anterior puede no existir hoy
alter table public.compras drop constraint if exists compras_modalidad_chk;
alter table public.compras add constraint compras_modalidad_chk
  check (modalidad in ('inmediato', 'quincena15', 'quincena30', 'anterior'));

-- ============ CARGAR UN PEDIDO ANTERIOR (solo administrador) ============
-- No descuenta inventario. Queda como cuenta por cobrar con su fecha original.
create or replace function public.cargar_pedido_anterior(
  p_cliente text, p_producto text, p_cantidad int, p_monto numeric, p_fecha date, p_vence date)
returns text language plpgsql as $$
declare v_fact text;
begin
  if not exists (select 1 from public.clientes where id = p_cliente) then
    raise exception 'Cliente no válido';
  end if;
  if p_producto is null or length(trim(p_producto)) = 0 then raise exception 'Escribe el producto'; end if;
  if p_cantidad is null or p_cantidad < 1 then raise exception 'Cantidad no válida'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'Monto no válido'; end if;
  if p_fecha is null or p_vence is null then raise exception 'Faltan las fechas'; end if;
  if p_fecha > (now() at time zone 'America/Panama')::date then
    raise exception 'La fecha del pedido anterior no puede ser futura';
  end if;

  insert into public.compras (cliente_id, producto_id, producto_nombre, cantidad, monto,
                              modalidad, vence, costo_unit, historico, fecha)
  values (p_cliente, null, trim(p_producto), p_cantidad, p_monto,
          'anterior', p_vence, 0, true, (p_fecha + time '12:00') at time zone 'America/Panama')
  returning factura into v_fact;
  return v_fact;
end $$;

revoke execute on function public.cargar_pedido_anterior(text, text, int, numeric, date, date) from public, anon;
grant execute on function public.cargar_pedido_anterior(text, text, int, numeric, date, date) to authenticated;

-- ============ AJUSTES A FUNCIONES EXISTENTES ============
-- Anular: un pedido anterior no devuelve unidades al inventario
create or replace function public.anular_compra(p_compra bigint)
returns void language plpgsql as $$
declare v public.compras%rowtype;
begin
  select * into v from public.compras where id = p_compra for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v.pagado > 0 then
    raise exception 'Este pedido ya tiene pagos aplicados. Primero anula el pago desde "Pagos recibidos" y luego anula el pedido.';
  end if;
  if not v.historico then
    update public.productos set stock = stock + v.cantidad where id = v.producto_id;
  end if;
  delete from public.compras where id = v.id;
end $$;

-- Cambiar modalidad: no aplica a pedidos anteriores (se anulan y se cargan de nuevo)
create or replace function public.cambiar_modalidad(p_compra bigint, p_modalidad text)
returns void language plpgsql as $$
declare v public.compras%rowtype; v_ini date; v_fin date; v_vence date;
begin
  select * into v from public.compras where id = p_compra for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v.pagada then raise exception 'Este pedido ya está pagado'; end if;
  if v.historico then
    raise exception 'Los pedidos anteriores no cambian de modalidad. Anúlalo y cárgalo de nuevo con la fecha correcta.';
  end if;
  v_ini := date_trunc('month', v.fecha at time zone 'America/Panama')::date;
  v_fin := (v_ini + interval '1 month' - interval '1 day')::date;
  if p_modalidad = 'inmediato' then
    v_vence := (v.fecha at time zone 'America/Panama')::date;
  elsif p_modalidad = 'quincena15' then
    v_vence := v_ini + 14;
  elsif p_modalidad = 'quincena30' then
    v_vence := least(v_ini + 29, v_fin);
  else
    raise exception 'Modalidad no válida';
  end if;
  update public.compras set modalidad = p_modalidad, vence = v_vence where id = v.id;
end $$;

-- Ranking, ganancias y resumen mensual: los pedidos anteriores no cuentan como ventas del sistema
create or replace function public.ranking(p_desde timestamptz default null)
returns table (cliente_id text, nombre text, n_compras bigint, unidades bigint,
               total numeric, pagadas bigint, horas_pago numeric)
language sql stable as $$
  select c.cliente_id, cl.nombre, count(*), sum(c.cantidad)::bigint, sum(c.monto),
         count(c.pagada_en),
         avg(extract(epoch from (c.pagada_en - c.fecha)) / 3600.0)
  from public.compras c
  join public.clientes cl on cl.id = c.cliente_id
  where not c.historico and (p_desde is null or c.fecha >= p_desde)
  group by c.cliente_id, cl.nombre;
$$;

create or replace function public.ganancias_producto(p_desde timestamptz default null)
returns table (producto text, unidades bigint, ventas numeric, costo numeric,
               ganancia numeric, margen numeric, sin_costo boolean)
language sql stable as $$
  select c.producto_nombre, sum(c.cantidad)::bigint, sum(c.monto),
         sum(c.cantidad * c.costo_unit), sum(c.monto - c.cantidad * c.costo_unit),
         case when sum(c.monto) > 0
              then round(100 * sum(c.monto - c.cantidad * c.costo_unit) / sum(c.monto), 1) else 0 end,
         bool_or(c.costo_unit = 0)
  from public.compras c
  where not c.historico and (p_desde is null or c.fecha >= p_desde)
  group by c.producto_nombre;
$$;

create or replace function public.resumen_mensual()
returns table (mes date, ventas numeric, costo_vendido numeric, ganancia numeric,
               gastos numeric, cobrado numeric)
language sql stable as $$
  with m as (
    select date_trunc('month', fecha at time zone 'America/Panama')::date as mes,
           monto as ventas, cantidad * costo_unit as costo, 0::numeric as gasto, 0::numeric as cobrado
      from public.compras where not historico
    union all
    select date_trunc('month', fecha at time zone 'America/Panama')::date, 0, 0, costo_total, 0
      from public.entradas
    union all
    select date_trunc('month', fecha at time zone 'America/Panama')::date, 0, 0, 0, monto
      from public.pagos
  )
  select mes, sum(ventas), sum(costo), sum(ventas) - sum(costo), sum(gasto), sum(cobrado)
  from m group by mes order by mes desc limit 12;
$$;
