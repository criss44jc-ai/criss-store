-- CRISS' STORE · Ampliación 3
-- Pago inmediato / 15 / 30, abonos, facturas de proveedor y ganancias.
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase.sql y supabase_v2.sql.

-- ============ PRODUCTOS: costo promedio ============
alter table public.productos add column if not exists costo numeric(12,4) not null default 0;

-- ============ COMPRAS: modalidad, vencimiento, abonos y costo ============
alter table public.compras
  add column if not exists modalidad  text not null default 'inmediato',
  add column if not exists vence      date,
  add column if not exists pagado     numeric(10,2) not null default 0,
  add column if not exists costo_unit numeric(12,4) not null default 0;

alter table public.compras drop constraint if exists compras_modalidad_chk;
alter table public.compras add constraint compras_modalidad_chk
  check (modalidad in ('inmediato', 'quincena15', 'quincena30'));

update public.compras set vence = (fecha at time zone 'America/Panama')::date where vence is null;
update public.compras set pagado = monto where pagada and pagado = 0;
alter table public.compras alter column vence set default current_date;
alter table public.compras alter column vence set not null;

-- ============ PAGOS (abonos) ============
create table if not exists public.pagos (
  id         bigint generated always as identity primary key,
  cliente_id text not null references public.clientes(id),
  monto      numeric(10,2) not null check (monto > 0),
  metodo     text not null default 'efectivo',
  nota       text,
  fecha      timestamptz not null default now()
);
alter table public.pagos enable row level security;
create policy "admin pagos" on public.pagos for all to authenticated using (true) with check (true);

-- Pasa al historial los cobros que ya habías marcado antes
insert into public.pagos (cliente_id, monto, metodo, nota, fecha)
select cliente_id, monto, 'efectivo', 'Migrado: ' || factura, coalesce(pagada_en, fecha)
from public.compras where pagada;

-- ============ ENTRADAS: facturas de compra a proveedores ============
create table if not exists public.entradas (
  id              bigint generated always as identity primary key,
  producto_id     bigint not null references public.productos(id),
  producto_nombre text not null,
  cantidad        int not null check (cantidad > 0),
  costo_total     numeric(10,2) not null check (costo_total >= 0),
  proveedor       text,
  nota            text,
  factura_path    text,
  fecha           timestamptz not null default now()
);
alter table public.entradas enable row level security;
create policy "admin entradas" on public.entradas for all to authenticated using (true) with check (true);

-- Bucket PRIVADO para las fotos o PDF de las facturas
insert into storage.buckets (id, name, public) values ('facturas', 'facturas', false)
  on conflict (id) do nothing;
create policy "admin facturas" on storage.objects for all to authenticated
  using (bucket_id = 'facturas') with check (bucket_id = 'facturas');

-- ============ FUNCIONES PARA CLIENTES ============
-- Retiro con modalidad de pago (el servidor calcula la fecha y el monto)
drop function if exists public.registrar_compra(text, text, int);
create function public.registrar_compra(p_cliente text, p_codigo text, p_cantidad int,
                                        p_modalidad text default 'inmediato')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_prod public.productos%rowtype;
  v_fact text;
  v_hoy  date := (now() at time zone 'America/Panama')::date;
  v_ini  date := date_trunc('month', now() at time zone 'America/Panama')::date;
  v_fin  date;
  v_vence date;
begin
  v_fin := (v_ini + interval '1 month' - interval '1 day')::date;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 50 then
    raise exception 'Cantidad no válida';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente) then
    raise exception 'Cliente no válido';
  end if;

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

  select * into v_prod from public.productos where codigo = p_codigo and activo for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if v_prod.stock < p_cantidad then
    raise exception 'Solo quedan % en existencia', v_prod.stock;
  end if;

  update public.productos set stock = stock - p_cantidad where id = v_prod.id;
  insert into public.compras (cliente_id, producto_id, producto_nombre, cantidad, monto,
                              modalidad, vence, costo_unit)
  values (p_cliente, v_prod.id, v_prod.nombre, p_cantidad, p_cantidad * v_prod.precio,
          p_modalidad, v_vence, v_prod.costo)
  returning factura into v_fact;

  return jsonb_build_object('factura', v_fact, 'producto', v_prod.nombre,
                            'cantidad', p_cantidad, 'vence', v_vence);
end $$;

-- Cuenta del cliente: producto, cantidad y fecha de pago (nunca precios)
drop function if exists public.mi_cuenta(text);
create function public.mi_cuenta(p_cliente text)
returns table (producto text, cantidad bigint, vence date, modalidad text)
language sql security definer set search_path = public stable as $$
  select c.producto_nombre, sum(c.cantidad)::bigint, c.vence, c.modalidad
  from public.compras c
  where c.cliente_id = p_cliente and not c.pagada
  group by c.producto_nombre, c.vence, c.modalidad
  order by c.vence, 1;
$$;

grant execute on function public.registrar_compra(text, text, int, text) to anon, authenticated;
grant execute on function public.mi_cuenta(text) to anon, authenticated;

-- ============ FUNCIONES DEL ADMINISTRADOR ============
-- Registra un pago (total o parcial) y lo aplica a las compras más antiguas primero
create or replace function public.registrar_pago(p_cliente text, p_monto numeric,
                                                 p_metodo text default 'efectivo', p_nota text default null)
returns numeric language plpgsql as $$
declare v_deuda numeric; v_resta numeric := p_monto; r record; v_debe numeric; v_aplica numeric;
begin
  if p_monto is null or p_monto <= 0 then raise exception 'Monto no válido'; end if;
  select coalesce(sum(monto - pagado), 0) into v_deuda
    from public.compras where cliente_id = p_cliente and not pagada;
  if p_monto > v_deuda + 0.004 then
    raise exception 'El pago (%) supera lo que debe el cliente (%)', p_monto, v_deuda;
  end if;
  insert into public.pagos (cliente_id, monto, metodo, nota) values (p_cliente, p_monto, p_metodo, p_nota);
  for r in select id, monto, pagado from public.compras
           where cliente_id = p_cliente and not pagada order by vence, id for update
  loop
    exit when v_resta <= 0;
    v_debe := r.monto - r.pagado;
    v_aplica := least(v_debe, v_resta);
    update public.compras
       set pagado = pagado + v_aplica,
           pagada = (pagado + v_aplica >= monto - 0.004)
     where id = r.id;
    v_resta := v_resta - v_aplica;
  end loop;
  return v_deuda - p_monto;   -- lo que todavía debe
end $$;

-- Registra una factura de compra a proveedor: sube existencia y recalcula el costo promedio
create or replace function public.registrar_entrada(p_producto bigint, p_cantidad int, p_costo_total numeric,
                                                    p_proveedor text, p_nota text, p_factura_path text)
returns void language plpgsql as $$
declare v public.productos%rowtype;
begin
  if p_cantidad is null or p_cantidad < 1 then raise exception 'Cantidad no válida'; end if;
  if p_costo_total is null or p_costo_total < 0 then raise exception 'Costo no válido'; end if;
  select * into v from public.productos where id = p_producto for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  insert into public.entradas (producto_id, producto_nombre, cantidad, costo_total, proveedor, nota, factura_path)
  values (v.id, v.nombre, p_cantidad, p_costo_total, p_proveedor, p_nota, p_factura_path);
  update public.productos
     set costo = round((v.stock * v.costo + p_costo_total) / (v.stock + p_cantidad), 4),
         stock = v.stock + p_cantidad
   where id = v.id;
end $$;

-- Ganancia por producto
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
  where p_desde is null or c.fecha >= p_desde
  group by c.producto_nombre;
$$;

-- Resumen mensual: ventas, costo de lo vendido, ganancia, gastos en compras y dinero cobrado
create or replace function public.resumen_mensual()
returns table (mes date, ventas numeric, costo_vendido numeric, ganancia numeric,
               gastos numeric, cobrado numeric)
language sql stable as $$
  with m as (
    select date_trunc('month', fecha at time zone 'America/Panama')::date as mes,
           monto as ventas, cantidad * costo_unit as costo, 0::numeric as gasto, 0::numeric as cobrado
      from public.compras
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

revoke execute on function public.registrar_pago(text, numeric, text, text) from public, anon;
revoke execute on function public.registrar_entrada(bigint, int, numeric, text, text, text) from public, anon;
revoke execute on function public.ganancias_producto(timestamptz) from public, anon;
revoke execute on function public.resumen_mensual() from public, anon;
grant execute on function public.registrar_pago(text, numeric, text, text) to authenticated;
grant execute on function public.registrar_entrada(bigint, int, numeric, text, text, text) to authenticated;
grant execute on function public.ganancias_producto(timestamptz) to authenticated;
grant execute on function public.resumen_mensual() to authenticated;
