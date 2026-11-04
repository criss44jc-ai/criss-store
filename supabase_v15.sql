-- CRISS' STORE · Ampliación 15: inventario por día y por local
-- Registra cada movimiento de existencia (ventas, compras, traslados, pérdidas) para saber
-- cómo empezó y cómo terminó el inventario de cada local en cualquier día.
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v14.sql.

-- ============ REGISTRO DE MOVIMIENTOS ============
create table if not exists public.movimientos_stock (
  id          bigint generated always as identity primary key,
  fecha       timestamptz not null default now(),
  sucursal_id bigint not null references public.sucursales(id),
  producto_id bigint not null references public.productos(id),
  delta       int not null,                          -- + entra, − sale
  motivo      text not null default 'ajuste'         -- venta, anulacion, compra_proveedor, traslado, perdida, inicial, ajuste
);
create index if not exists movimientos_stock_idx on public.movimientos_stock (sucursal_id, producto_id, fecha);
alter table public.movimientos_stock enable row level security;
create policy "admin ve movimientos" on public.movimientos_stock for select to authenticated using (true);

-- Desde cuándo existe el registro (antes de esta fecha no se puede reconstruir el inventario de un día)
insert into public.ajustes (clave, valor) values ('ledger_desde', now()::text) on conflict (clave) do nothing;

-- Cada cambio en la existencia de la casa madre queda anotado
create or replace function public.trg_stock_productos()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_madre bigint; v_delta int; v_motivo text;
begin
  select s.id into v_madre from public.sucursales s where s.es_madre limit 1;
  if v_madre is null then return new; end if;
  if tg_op = 'INSERT' then v_delta := new.stock; else v_delta := new.stock - old.stock; end if;
  if v_delta <> 0 then
    v_motivo := coalesce(nullif(current_setting('app.motivo', true), ''), case when tg_op = 'INSERT' then 'inicial' else 'ajuste' end);
    insert into public.movimientos_stock (sucursal_id, producto_id, delta, motivo) values (v_madre, new.id, v_delta, v_motivo);
  end if;
  return new;
end $$;
drop trigger if exists trg_mov_productos on public.productos;
create trigger trg_mov_productos after insert or update of stock on public.productos
  for each row execute function public.trg_stock_productos();

-- Cada cambio en la existencia de una sucursal también
create or replace function public.trg_stock_sucursal()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_delta int; v_motivo text; v_suc bigint; v_prod bigint;
begin
  if tg_op = 'DELETE' then
    v_delta := -old.cantidad; v_suc := old.sucursal_id; v_prod := old.producto_id;
  elsif tg_op = 'INSERT' then
    v_delta := new.cantidad; v_suc := new.sucursal_id; v_prod := new.producto_id;
  else
    v_delta := new.cantidad - old.cantidad; v_suc := new.sucursal_id; v_prod := new.producto_id;
  end if;
  if v_delta <> 0 then
    v_motivo := coalesce(nullif(current_setting('app.motivo', true), ''), 'ajuste');
    insert into public.movimientos_stock (sucursal_id, producto_id, delta, motivo) values (v_suc, v_prod, v_delta, v_motivo);
  end if;
  return null;
end $$;
drop trigger if exists trg_mov_stock_sucursal on public.stock_sucursal;
create trigger trg_mov_stock_sucursal after insert or update or delete on public.stock_sucursal
  for each row execute function public.trg_stock_sucursal();

-- ============ LAS OPERACIONES AHORA ANOTAN EL MOTIVO DEL MOVIMIENTO ============
-- (son las mismas funciones de antes; solo se agrega una línea que indica el motivo)
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

create or replace function public.anular_compra(p_compra bigint)
returns void language plpgsql as $$
declare v public.compras%rowtype; v_madre bigint;
begin
  perform set_config('app.motivo', 'anulacion', true);
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

create or replace function public.registrar_entrada(p_producto bigint, p_cantidad int, p_costo_total numeric,
                                                    p_proveedor text, p_nota text, p_factura_path text)
returns void language plpgsql as $$
declare v public.productos%rowtype;
begin
  perform set_config('app.motivo', 'compra_proveedor', true);
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

create or replace function public.autorizar_traslado(p_id bigint)
returns void language plpgsql as $$
declare t public.traslados%rowtype; it record; v_madre bigint; v_disp int; v_nom text;
begin
  perform set_config('app.motivo', 'traslado', true);
  select * into t from public.traslados where id = p_id for update;
  if not found then raise exception 'Traslado no encontrado'; end if;
  if t.estado <> 'pendiente' then raise exception 'Este traslado ya fue %', t.estado; end if;
  select id into v_madre from public.sucursales where es_madre limit 1;

  for it in select * from public.traslado_items where traslado_id = p_id loop
    select nombre into v_nom from public.productos where id = it.producto_id;
    -- sacar del origen
    if t.origen_id = v_madre then
      select stock into v_disp from public.productos where id = it.producto_id for update;
      if coalesce(v_disp, 0) < it.cantidad then
        raise exception 'No hay suficiente "%" en el origen (hay %, piden %)', v_nom, coalesce(v_disp, 0), it.cantidad;
      end if;
      update public.productos set stock = stock - it.cantidad where id = it.producto_id;
    else
      select cantidad into v_disp from public.stock_sucursal
       where sucursal_id = t.origen_id and producto_id = it.producto_id for update;
      if coalesce(v_disp, 0) < it.cantidad then
        raise exception 'No hay suficiente "%" en el origen (hay %, piden %)', v_nom, coalesce(v_disp, 0), it.cantidad;
      end if;
      update public.stock_sucursal set cantidad = cantidad - it.cantidad
       where sucursal_id = t.origen_id and producto_id = it.producto_id;
    end if;
    -- meter al destino
    if t.destino_id = v_madre then
      update public.productos set stock = stock + it.cantidad where id = it.producto_id;
    else
      insert into public.stock_sucursal (sucursal_id, producto_id, cantidad)
      values (t.destino_id, it.producto_id, it.cantidad)
      on conflict (sucursal_id, producto_id) do update set cantidad = public.stock_sucursal.cantidad + excluded.cantidad;
    end if;
  end loop;
  update public.traslados set estado = 'autorizado', resuelto_en = now() where id = p_id;
end $$;

create or replace function public.registrar_perdida(p_producto bigint, p_sucursal bigint, p_cantidad int,
                                                    p_motivo text, p_comentario text, p_foto_path text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v public.productos%rowtype; v_madre bigint; v_loc bigint; v_disp int; v_id bigint;
begin
  perform set_config('app.motivo', 'perdida', true);
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

-- ============ INVENTARIO POR PERÍODO (solo administrador) ============
-- Para cada local y producto: cómo empezó el día "desde", qué movimientos hubo y cómo terminó el día "hasta"
create or replace function public.inventario_periodo(p_desde date, p_hasta date)
returns table (sucursal_id bigint, producto_id bigint, producto text, inicio bigint, entradas bigint,
               ventas bigint, perdidas bigint, traslados bigint, otros bigint, fin bigint, completo boolean)
language plpgsql stable as $$
declare t0 timestamptz; t1 timestamptz; v_ini timestamptz;
begin
  t0 := p_desde::timestamp at time zone 'America/Panama';
  t1 := (p_hasta + 1)::timestamp at time zone 'America/Panama';
  select nullif(a.valor, '')::timestamptz into v_ini from public.ajustes a where a.clave = 'ledger_desde';
  return query
  with base as (
    select s.id as sid, p.id as pid, p.nombre as pn,
           (case when s.es_madre then p.stock else coalesce(ss.cantidad, 0) end)::bigint as actual
    from public.sucursales s
    cross join public.productos p
    left join public.stock_sucursal ss on ss.sucursal_id = s.id and ss.producto_id = p.id
    where s.activa and p.activo
  ), mv as (
    select m.sucursal_id as sid, m.producto_id as pid,
           coalesce(sum(m.delta) filter (where m.fecha >= t0), 0)::bigint as d0,
           coalesce(sum(m.delta) filter (where m.fecha >= t1), 0)::bigint as d1,
           coalesce(sum(m.delta) filter (where m.fecha >= t0 and m.fecha < t1 and m.motivo in ('compra_proveedor', 'inicial')), 0)::bigint as ent,
           coalesce(sum(m.delta) filter (where m.fecha >= t0 and m.fecha < t1 and m.motivo in ('venta', 'anulacion')), 0)::bigint as ven,
           coalesce(sum(m.delta) filter (where m.fecha >= t0 and m.fecha < t1 and m.motivo = 'perdida'), 0)::bigint as per,
           coalesce(sum(m.delta) filter (where m.fecha >= t0 and m.fecha < t1 and m.motivo = 'traslado'), 0)::bigint as tra
    from public.movimientos_stock m
    group by m.sucursal_id, m.producto_id
  )
  select b.sid, b.pid, b.pn,
         b.actual - coalesce(mv.d0, 0),
         coalesce(mv.ent, 0), coalesce(mv.ven, 0), coalesce(mv.per, 0), coalesce(mv.tra, 0),
         (coalesce(mv.d0, 0) - coalesce(mv.d1, 0)) - coalesce(mv.ent, 0) - coalesce(mv.ven, 0) - coalesce(mv.per, 0) - coalesce(mv.tra, 0),
         b.actual - coalesce(mv.d1, 0),
         (v_ini is not null and t0 >= v_ini)
  from base b
  left join mv on mv.sid = b.sid and mv.pid = b.pid
  order by b.sid, b.pn;
end $$;

revoke execute on function public.inventario_periodo(date, date) from public, anon;
grant execute on function public.inventario_periodo(date, date) to authenticated;
