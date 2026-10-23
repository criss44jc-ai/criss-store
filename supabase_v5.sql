-- CRISS' STORE · Ampliación 5
-- Anular pedidos y pagos, pago con Yappy/cuenta para el cliente y comprobantes de pago.
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v4.sql.

-- ============ ANULAR PEDIDOS Y PAGOS (solo administrador) ============

-- Reparte de nuevo los pagos de un cliente entre sus compras, de la más antigua a la más nueva
create or replace function public.reaplicar_pagos(p_cliente text)
returns void language plpgsql as $$
declare v_total numeric; r record; v_aplica numeric; v_pag boolean;
begin
  select coalesce(sum(monto), 0) into v_total from public.pagos where cliente_id = p_cliente;
  for r in select id, monto, pagado, pagada from public.compras
           where cliente_id = p_cliente order by vence, id for update
  loop
    v_aplica := least(r.monto, greatest(v_total, 0));
    v_total := v_total - v_aplica;
    v_pag := v_aplica >= r.monto - 0.004;
    if r.pagado is distinct from v_aplica or r.pagada is distinct from v_pag then
      update public.compras set pagado = v_aplica, pagada = v_pag where id = r.id;
    end if;
  end loop;
end $$;

-- Anula un pedido y devuelve las unidades al inventario
create or replace function public.anular_compra(p_compra bigint)
returns void language plpgsql as $$
declare v public.compras%rowtype;
begin
  select * into v from public.compras where id = p_compra for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v.pagado > 0 then
    raise exception 'Este pedido ya tiene pagos aplicados. Primero anula el pago desde "Pagos recibidos" y luego anula el pedido.';
  end if;
  update public.productos set stock = stock + v.cantidad where id = v.producto_id;
  delete from public.compras where id = v.id;
end $$;

-- Anula un pago y vuelve a calcular lo que debe el cliente
create or replace function public.anular_pago(p_pago bigint)
returns void language plpgsql as $$
declare v public.pagos%rowtype;
begin
  select * into v from public.pagos where id = p_pago for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  delete from public.pagos where id = v.id;
  perform public.reaplicar_pagos(v.cliente_id);
end $$;

revoke execute on function public.reaplicar_pagos(text) from public, anon;
revoke execute on function public.anular_compra(bigint) from public, anon;
revoke execute on function public.anular_pago(bigint) from public, anon;
grant execute on function public.reaplicar_pagos(text) to authenticated;
grant execute on function public.anular_compra(bigint) to authenticated;
grant execute on function public.anular_pago(bigint) to authenticated;

-- ============ COMPROBANTES DE PAGO ============
create table if not exists public.comprobantes (
  id           bigint generated always as identity primary key,
  cliente_id   text not null references public.clientes(id),
  monto        numeric(10,2) not null default 0,     -- lo que debía pagar hoy al enviarlo
  archivo_path text not null,
  nota         text,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'verificado', 'rechazado')),
  fecha        timestamptz not null default now()
);
alter table public.comprobantes enable row level security;
create policy "admin comprobantes" on public.comprobantes for all to authenticated using (true) with check (true);

-- Bucket PRIVADO: los clientes solo pueden subir; únicamente el administrador puede ver o borrar
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "clientes suben comprobantes" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'comprobantes');
create policy "admin ve comprobantes" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes');
create policy "admin borra comprobantes" on storage.objects for delete to authenticated
  using (bucket_id = 'comprobantes');

-- ============ FUNCIONES PARA CLIENTES ============
-- Datos para pagar (QR, cuenta y lo que toca pagar hoy). Solo responde si el cliente tiene algo pendiente.
create or replace function public.datos_pago(p_cliente text)
returns table (texto text, imagen text, a_pagar numeric)
language sql security definer set search_path = public stable as $$
  select (select valor from public.ajustes where clave = 'pago_texto'),
         (select valor from public.ajustes where clave = 'pago_imagen'),
         coalesce((select sum(c.monto - c.pagado) from public.compras c
                    where c.cliente_id = p_cliente and not c.pagada
                      and c.vence <= (now() at time zone 'America/Panama')::date), 0)
  where exists (select 1 from public.compras where cliente_id = p_cliente and not pagada);
$$;

-- El cliente avisa que pagó y deja la ruta de su captura
create or replace function public.reportar_pago(p_cliente text, p_path text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_monto numeric;
begin
  if not exists (select 1 from public.clientes where id = p_cliente) then
    raise exception 'Cliente no válido';
  end if;
  if p_path is null or left(p_path, length(p_cliente) + 1) <> p_cliente || '/' then
    raise exception 'Archivo no válido';
  end if;
  if not exists (select 1 from public.compras where cliente_id = p_cliente and not pagada) then
    raise exception 'No tienes pagos pendientes';
  end if;
  if (select count(*) from public.comprobantes where cliente_id = p_cliente and estado = 'pendiente') >= 5 then
    raise exception 'Ya tienes comprobantes por verificar. Espera a que los revisemos.';
  end if;
  select coalesce(sum(monto - pagado), 0) into v_monto
    from public.compras
   where cliente_id = p_cliente and not pagada
     and vence <= (now() at time zone 'America/Panama')::date;
  insert into public.comprobantes (cliente_id, monto, archivo_path, nota)
  values (p_cliente, v_monto, p_path, left(p_nota, 200));
end $$;

grant execute on function public.datos_pago(text) to anon, authenticated;
grant execute on function public.reportar_pago(text, text, text) to anon, authenticated;
