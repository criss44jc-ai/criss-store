-- CRISS' STORE · Ampliación 20: avatar del cliente, posición de la mascota y ventana emergente de propaganda
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v19.sql.

-- =====================================================================
-- 1 · AVATAR QUE ELIGE EL CLIENTE
-- =====================================================================
alter table public.perfiles
  add column if not exists avatar_cliente text,
  add column if not exists avatar_color   text;

-- El cliente elige uno de los avatares permitidos (la lista está fija aquí para que nadie guarde otra cosa)
create or replace function public.elegir_avatar(p_cliente text, p_avatar text, p_color text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.clientes c where c.id = p_cliente) then raise exception 'Cliente no válido'; end if;
  if p_avatar is null or not (p_avatar = any (array['😀', '😎', '🤠', '🥳', '😋', '🤩', '😏', '🧐', '😇', '🤓', '😺', '🦊', '🐯', '🐼', '🦁', '🐸', '🐵', '🦄', '🐶', '🐱', '🐰', '🐻', '🐨', '🐮', '🐷', '🐔', '🦉', '🦋', '🐢', '🐙', '🍌', '🥤', '🍿', '🍕', '🍔', '🌮', '🍩', '🍉', '🍓', '🥑', '🌽', '⚽', '🏀', '🎸', '🎮', '🚀', '🌈', '⭐', '🔥', '💎', '👑', '🎧', '🌻', '🍀', '🌙', '🍒', '🍦', '🥨'])) then raise exception 'Avatar no válido'; end if;
  if p_color is not null and not (p_color = any (array['#e8590c', '#2f9e44', '#1971c2', '#9c36b5', '#c2255c', '#0c8599', '#f08c00', '#5f3dc4'])) then raise exception 'Color no válido'; end if;
  insert into public.perfiles (cliente_id, avatar_cliente, avatar_color)
  values (p_cliente, p_avatar, p_color)
  on conflict (cliente_id) do update
     set avatar_cliente = excluded.avatar_cliente, avatar_color = excluded.avatar_color, actualizado = now();
end $$;

create or replace function public.mi_avatar(p_cliente text)
returns table (avatar text, color text)
language sql security definer set search_path = public stable as $$
  select pf.avatar_cliente, pf.avatar_color from public.perfiles pf where pf.cliente_id = p_cliente;
$$;
grant execute on function public.elegir_avatar(text, text, text) to anon, authenticated;
grant execute on function public.mi_avatar(text) to anon, authenticated;

-- =====================================================================
-- 2 · AJUSTES PÚBLICOS DE LA TIENDA (posición inicial de la mascota y si el cliente puede moverla)
-- =====================================================================
create or replace function public.config_tienda()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'mascota_pos',   (select a.valor from public.ajustes a where a.clave = 'mascota_pos'),
    'mascota_mover', coalesce((select a.valor from public.ajustes a where a.clave = 'mascota_mover'), 'si'));
$$;
grant execute on function public.config_tienda() to anon, authenticated;

-- =====================================================================
-- 3 · VENTANA EMERGENTE DE PROPAGANDA
-- =====================================================================
create table if not exists public.popups (
  id             bigint generated always as identity primary key,
  titulo         text not null check (length(trim(titulo)) > 0),
  texto          text,
  imagen_url     text,
  video_url      text,
  video_externo  text,
  boton_texto    text,
  codigo         text,                              -- el botón abre este producto
  enlace         text check (enlace is null or enlace ~* '^https?://'),
  sucursal_id    bigint references public.sucursales(id) on delete set null,   -- null = todos los locales
  frecuencia     text not null default 'dia' check (frecuencia in ('siempre', 'dia', 'una_vez')),
  inicia         date,
  termina        date,
  activo         boolean not null default true,
  creado         timestamptz not null default now()
);
alter table public.popups enable row level security;
create policy "admin popups" on public.popups for all to authenticated using (true) with check (true);

-- La tienda pide la ventana que corresponde hoy a su local (la más reciente)
create or replace function public.popup_tienda(p_sucursal bigint default null)
returns table (id bigint, titulo text, texto text, imagen_url text, video_url text, video_externo text,
               boton_texto text, codigo text, enlace text, frecuencia text)
language plpgsql security definer set search_path = public stable as $$
declare v bigint; v_hoy date := (now() at time zone 'America/Panama')::date;
begin
  select l.id into v from public.local_tienda(p_sucursal) l;
  return query
    select p.id, p.titulo, p.texto, p.imagen_url, p.video_url, p.video_externo, p.boton_texto, p.codigo, p.enlace, p.frecuencia
    from public.popups p
    where p.activo
      and (p.inicia is null or p.inicia <= v_hoy)
      and (p.termina is null or p.termina >= v_hoy)
      and (p.sucursal_id is null or p.sucursal_id = v)
    order by p.id desc
    limit 1;
end $$;
grant execute on function public.popup_tienda(bigint) to anon, authenticated;
