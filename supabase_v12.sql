-- CRISS' STORE · Ampliación 12: casa madre, sucursales, traslados y anulación de pagos con motivo
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v11.sql.

-- =====================================================================
-- PARTE 1 · LOCALES: casa madre + sucursales
-- La existencia que ya tienes en "productos" pasa a ser la de la CASA MADRE.
-- =====================================================================
create table if not exists public.sucursales (
  id       bigint generated always as identity primary key,
  nombre   text not null check (length(trim(nombre)) > 0),
  es_madre boolean not null default false,
  activa   boolean not null default true,
  creado   timestamptz not null default now()
);
create unique index if not exists sucursales_una_madre on public.sucursales (es_madre) where es_madre;
insert into public.sucursales (nombre, es_madre)
select 'Casa madre', true where not exists (select 1 from public.sucursales where es_madre);

-- Existencia de cada producto en cada sucursal (la de la casa madre sigue en productos.stock)
create table if not exists public.stock_sucursal (
  sucursal_id bigint not null references public.sucursales(id),
  producto_id bigint not null references public.productos(id),
  cantidad    int not null default 0 check (cantidad >= 0),
  primary key (sucursal_id, producto_id)
);

-- Traslados: se piden y la casa madre los autoriza antes de mover la mercancía
create table if not exists public.traslados (
  id          bigint generated always as identity primary key,
  origen_id   bigint not null references public.sucursales(id),
  destino_id  bigint not null references public.sucursales(id),
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'autorizado', 'rechazado')),
  nota        text,
  motivo      text,                       -- por qué se rechazó
  creado      timestamptz not null default now(),
  resuelto_en timestamptz,
  check (origen_id <> destino_id)
);
create table if not exists public.traslado_items (
  id          bigint generated always as identity primary key,
  traslado_id bigint not null references public.traslados(id) on delete cascade,
  producto_id bigint not null references public.productos(id),
  cantidad    int not null check (cantidad > 0)
);

alter table public.sucursales     enable row level security;
alter table public.stock_sucursal enable row level security;
alter table public.traslados      enable row level security;
alter table public.traslado_items enable row level security;
create policy "admin sucursales"     on public.sucursales     for all to authenticated using (true) with check (true);
create policy "admin stock sucursal" on public.stock_sucursal for all to authenticated using (true) with check (true);
create policy "admin traslados"      on public.traslados      for all to authenticated using (true) with check (true);
create policy "admin traslado items" on public.traslado_items for all to authenticated using (true) with check (true);

-- Crea el traslado en estado "pendiente". NO mueve nada todavía.
create or replace function public.crear_traslado(p_origen bigint, p_destino bigint, p_items jsonb, p_nota text default null)
returns bigint language plpgsql as $$
declare v_id bigint; x record;
begin
  if p_origen = p_destino then raise exception 'El origen y el destino deben ser distintos'; end if;
  if not exists (select 1 from public.sucursales where id = p_origen and activa)
     or not exists (select 1 from public.sucursales where id = p_destino and activa) then
    raise exception 'Local no válido';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto';
  end if;
  insert into public.traslados (origen_id, destino_id, nota) values (p_origen, p_destino, left(p_nota, 300)) returning id into v_id;
  for x in select * from jsonb_to_recordset(p_items) as t(producto_id bigint, cantidad int) loop
    if x.cantidad is null or x.cantidad < 1 then raise exception 'Cantidad no válida'; end if;
    if not exists (select 1 from public.productos where id = x.producto_id) then raise exception 'Producto no válido'; end if;
    insert into public.traslado_items (traslado_id, producto_id, cantidad) values (v_id, x.producto_id, x.cantidad);
  end loop;
  return v_id;
end $$;

-- La casa madre AUTORIZA: recién aquí se mueve la existencia (todo o nada)
create or replace function public.autorizar_traslado(p_id bigint)
returns void language plpgsql as $$
declare t public.traslados%rowtype; it record; v_madre bigint; v_disp int; v_nom text;
begin
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

create or replace function public.rechazar_traslado(p_id bigint, p_motivo text default null)
returns void language plpgsql as $$
begin
  update public.traslados
     set estado = 'rechazado', motivo = left(coalesce(nullif(trim(p_motivo), ''), 'Sin motivo'), 300), resuelto_en = now()
   where id = p_id and estado = 'pendiente';
  if not found then raise exception 'El traslado no existe o ya fue resuelto'; end if;
end $$;

revoke execute on function public.crear_traslado(bigint, bigint, jsonb, text) from public, anon;
revoke execute on function public.autorizar_traslado(bigint) from public, anon;
revoke execute on function public.rechazar_traslado(bigint, text) from public, anon;
grant execute on function public.crear_traslado(bigint, bigint, jsonb, text) to authenticated;
grant execute on function public.autorizar_traslado(bigint) to authenticated;
grant execute on function public.rechazar_traslado(bigint, text) to authenticated;

-- =====================================================================
-- PARTE 2 · ANULAR UN PAGO: ahora exige motivo, comentario y deja registro
-- =====================================================================
create table if not exists public.anulaciones (
  id         bigint generated always as identity primary key,
  tipo       text not null default 'pago',
  ref_id     bigint,
  cliente_id text references public.clientes(id),
  monto      numeric(10,2),
  detalle    text,                         -- fecha · método · nota del pago que se quitó
  motivo     text not null check (motivo in ('duplicado', 'no_pago', 'monto', 'otro')),
  comentario text not null check (length(trim(comentario)) >= 5),
  foto_path  text,                         -- foto que respalda la acción (opcional)
  fecha      timestamptz not null default now()
);
alter table public.anulaciones enable row level security;
-- Solo lectura para el administrador: los registros se crean únicamente desde anular_pago()
create policy "admin ve anulaciones" on public.anulaciones for select to authenticated using (true);

-- Bucket PRIVADO para las fotos de respaldo
insert into storage.buckets (id, name, public) values ('evidencias', 'evidencias', false)
  on conflict (id) do nothing;
create policy "admin sube evidencias" on storage.objects for insert to authenticated with check (bucket_id = 'evidencias');
create policy "admin ve evidencias"   on storage.objects for select to authenticated using (bucket_id = 'evidencias');

-- Ya no se puede borrar un pago directamente: solo con anular_pago() (que deja registro)
drop policy if exists "admin pagos" on public.pagos;
create policy "admin ve pagos"   on public.pagos for select to authenticated using (true);
create policy "admin crea pagos" on public.pagos for insert to authenticated with check (true);

drop function if exists public.anular_pago(bigint);
create function public.anular_pago(p_pago bigint, p_motivo text, p_comentario text, p_foto_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v public.pagos%rowtype; v_comp bigint;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_motivo is null or p_motivo not in ('duplicado', 'no_pago', 'monto', 'otro') then raise exception 'Motivo no válido'; end if;
  if p_comentario is null or length(trim(p_comentario)) < 5 then raise exception 'El comentario es obligatorio (mínimo 5 letras)'; end if;
  select * into v from public.pagos where id = p_pago for update;
  if not found then raise exception 'Pago no encontrado'; end if;

  insert into public.anulaciones (tipo, ref_id, cliente_id, monto, detalle, motivo, comentario, foto_path)
  values ('pago', v.id, v.cliente_id, v.monto,
          concat_ws(' · ', to_char(v.fecha at time zone 'America/Panama', 'DD/MM/YYYY'), v.metodo, v.nota),
          p_motivo, trim(p_comentario), p_foto_path);

  -- si el pago vino de un comprobante del cliente, ese comprobante deja de contar como verificado
  v_comp := nullif(substring(coalesce(v.nota, '') from 'Comprobante #([0-9]+)'), '')::bigint;
  if v_comp is not null then update public.comprobantes set estado = 'rechazado' where id = v_comp; end if;

  delete from public.pagos where id = v.id;
  perform public.reaplicar_pagos(v.cliente_id);
end $$;

revoke execute on function public.anular_pago(bigint, text, text, text) from public, anon;
grant execute on function public.anular_pago(bigint, text, text, text) to authenticated;
