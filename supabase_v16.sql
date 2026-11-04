-- CRISS' STORE · Ampliación 16: marca por local, videos, grupos de productos y buzón
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v15.sql.

-- =====================================================================
-- 1 · MARCA DE CADA LOCAL (nombre que ve el cliente, eslogan, logo, portada y colores)
-- =====================================================================
alter table public.sucursales
  add column if not exists titulo           text,
  add column if not exists eslogan          text,
  add column if not exists logo_url         text,
  add column if not exists portada_url      text,
  add column if not exists color_encabezado text,
  add column if not exists color_acento     text;
alter table public.sucursales drop constraint if exists sucursales_colores_chk;
alter table public.sucursales add constraint sucursales_colores_chk check (
  (color_encabezado is null or color_encabezado ~ '^#[0-9a-fA-F]{6}$') and
  (color_acento is null or color_acento ~ '^#[0-9a-fA-F]{6}$'));

-- Espacio PÚBLICO para logos, portadas, videos e imágenes de propaganda (máximo 50 MB por archivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('multimedia', 'multimedia', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;
create policy "admin sube multimedia"   on storage.objects for insert to authenticated with check (bucket_id = 'multimedia');
create policy "admin edita multimedia"  on storage.objects for update to authenticated using (bucket_id = 'multimedia');
create policy "admin borra multimedia"  on storage.objects for delete to authenticated using (bucket_id = 'multimedia');

-- La tienda pregunta con qué marca se muestra el local que está vendiendo
drop function if exists public.local_tienda(bigint);
create function public.local_tienda(p_local bigint default null)
returns table (id bigint, nombre text, varios boolean, titulo text, eslogan text, logo_url text,
               portada_url text, color_encabezado text, color_acento text)
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
    select s.id, s.nombre, (select count(*) from public.sucursales x where x.activa) > 1,
           s.titulo, s.eslogan, s.logo_url, s.portada_url, s.color_encabezado, s.color_acento
    from public.sucursales s where s.id = v;
end $$;
grant execute on function public.local_tienda(bigint) to anon, authenticated;

-- =====================================================================
-- 2 · PROMOCIONES CON VIDEO (subido o enlace de YouTube) y por local
-- =====================================================================
alter table public.promos
  add column if not exists video_url     text,
  add column if not exists video_externo text,
  add column if not exists sucursal_id   bigint references public.sucursales(id) on delete set null;

-- =====================================================================
-- 3 · GRUPOS DE PRODUCTOS (Sodas, Snacks, Dulces… los que tú quieras)
-- =====================================================================
create table if not exists public.grupos (
  id     bigint generated always as identity primary key,
  nombre text not null check (length(trim(nombre)) > 0),
  orden  int not null default 0,
  activo boolean not null default true,
  creado timestamptz not null default now()
);
alter table public.grupos enable row level security;
create policy "admin grupos" on public.grupos for all to authenticated using (true) with check (true);
alter table public.productos add column if not exists grupo_id bigint references public.grupos(id) on delete set null;

-- El catálogo ahora también trae el grupo de cada producto
drop function if exists public.catalogo(bigint);
create function public.catalogo(p_sucursal bigint default null)
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
    order by p.nombre;
end $$;
grant execute on function public.catalogo(bigint) to anon, authenticated;

-- =====================================================================
-- 4 · BUZÓN: sugerencias y reclamos de los clientes
-- =====================================================================
create table if not exists public.buzon (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('sugerencia', 'reclamo')),
  mensaje     text not null check (length(trim(mensaje)) between 5 and 1000),
  cliente_id  text references public.clientes(id) on delete set null,
  contacto    text,
  sucursal_id bigint references public.sucursales(id) on delete set null,
  estado      text not null default 'nuevo' check (estado in ('nuevo', 'en_revision', 'resuelto')),
  respuesta   text,
  fecha       timestamptz not null default now(),
  resuelto_en timestamptz
);
alter table public.buzon enable row level security;
create policy "admin buzon" on public.buzon for all to authenticated using (true) with check (true);

-- Los clientes envían mensajes solo con esta función (con límites para evitar abusos)
create or replace function public.enviar_buzon(p_tipo text, p_mensaje text, p_cliente text default null,
                                               p_contacto text default null, p_sucursal bigint default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tipo is null or p_tipo not in ('sugerencia', 'reclamo') then raise exception 'Tipo no válido'; end if;
  if p_mensaje is null or length(trim(p_mensaje)) < 5 then raise exception 'Escribe tu mensaje (mínimo 5 letras)'; end if;
  if length(p_mensaje) > 1000 then raise exception 'El mensaje es muy largo (máximo 1000 letras)'; end if;
  if p_cliente is not null and not exists (select 1 from public.clientes c where c.id = p_cliente) then
    raise exception 'Cliente no válido';
  end if;
  if (select count(*) from public.buzon b where b.fecha > now() - interval '1 hour') >= 40 then
    raise exception 'Hay muchos mensajes en este momento. Intenta de nuevo más tarde.';
  end if;
  if p_cliente is not null and
     (select count(*) from public.buzon b where b.cliente_id = p_cliente and b.fecha > now() - interval '10 minutes') >= 3 then
    raise exception 'Ya enviaste varios mensajes. Espera unos minutos.';
  end if;
  insert into public.buzon (tipo, mensaje, cliente_id, contacto, sucursal_id)
  values (p_tipo, trim(p_mensaje), p_cliente, left(nullif(trim(coalesce(p_contacto, '')), ''), 120), p_sucursal);
end $$;
grant execute on function public.enviar_buzon(text, text, text, text, bigint) to anon, authenticated;
