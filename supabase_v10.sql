-- CRISS' STORE · Ampliación 10: precios visibles y monto a pagar
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v9.sql.

-- ============ CATÁLOGO: ahora incluye el último precio cargado ============
drop function if exists public.catalogo();
create function public.catalogo()
returns table (codigo text, nombre text, marca text, especificacion text,
               imagen_url text, disponible boolean, categoria text, precio numeric)
language sql security definer set search_path = public stable as $$
  select p.codigo, p.nombre, p.marca, p.especificacion, p.imagen_url, p.stock > 0, p.categoria, p.precio
  from public.productos p where p.activo order by p.nombre;
$$;
grant execute on function public.catalogo() to anon, authenticated;

-- ============ DATOS DE PAGO: lo que toca hoy y el total pendiente ============
drop function if exists public.datos_pago(text);
create function public.datos_pago(p_cliente text)
returns table (texto text, imagen text, a_pagar numeric, total_pendiente numeric)
language sql security definer set search_path = public stable as $$
  select (select valor from public.ajustes where clave = 'pago_texto'),
         (select valor from public.ajustes where clave = 'pago_imagen'),
         coalesce((select sum(c.monto - c.pagado) from public.compras c
                    where c.cliente_id = p_cliente and not c.pagada
                      and c.vence <= (now() at time zone 'America/Panama')::date), 0),
         coalesce((select sum(c.monto - c.pagado) from public.compras c
                    where c.cliente_id = p_cliente and not c.pagada), 0)
  where exists (select 1 from public.compras where cliente_id = p_cliente and not pagada);
$$;
grant execute on function public.datos_pago(text) to anon, authenticated;

-- ============ AVISO DE PAGO: el cliente indica cuánto pagó ============
drop function if exists public.reportar_pago(text, text, text);
create function public.reportar_pago(p_cliente text, p_path text, p_nota text default null, p_monto numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_hoy numeric; v_total numeric; v_monto numeric;
begin
  if not exists (select 1 from public.clientes where id = p_cliente) then
    raise exception 'Cliente no válido';
  end if;
  if p_path is null or left(p_path, length(p_cliente) + 1) <> p_cliente || '/' then
    raise exception 'Archivo no válido';
  end if;
  select coalesce(sum(monto - pagado), 0),
         coalesce(sum(monto - pagado) filter (where vence <= (now() at time zone 'America/Panama')::date), 0)
    into v_total, v_hoy
    from public.compras where cliente_id = p_cliente and not pagada;
  if v_total <= 0 then raise exception 'No tienes pagos pendientes'; end if;
  if (select count(*) from public.comprobantes where cliente_id = p_cliente and estado = 'pendiente') >= 5 then
    raise exception 'Ya tienes comprobantes por verificar. Espera a que los revisemos.';
  end if;
  if p_monto is null then
    v_monto := v_hoy;
  elsif p_monto <= 0 or p_monto > v_total + 0.004 then
    raise exception 'Monto no válido';
  else
    v_monto := p_monto;
  end if;
  insert into public.comprobantes (cliente_id, monto, archivo_path, nota)
  values (p_cliente, v_monto, p_path, left(p_nota, 200));
end $$;
grant execute on function public.reportar_pago(text, text, text, numeric) to anon, authenticated;
