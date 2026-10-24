-- CRISS' STORE · Ampliación 6: corregir la fecha de pago de un pedido
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v5.sql.

-- Cambia un pedido entre pago inmediato, el 15 o el 30 del mes en que se hizo el pedido
create or replace function public.cambiar_modalidad(p_compra bigint, p_modalidad text)
returns void language plpgsql as $$
declare v public.compras%rowtype; v_ini date; v_fin date; v_vence date;
begin
  select * into v from public.compras where id = p_compra for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v.pagada then raise exception 'Este pedido ya está pagado'; end if;

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

revoke execute on function public.cambiar_modalidad(bigint, text) from public, anon;
grant execute on function public.cambiar_modalidad(bigint, text) to authenticated;
