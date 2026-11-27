-- CRISS' STORE · Ampliación 22: perfil del cliente, métodos de pago, botones a otras sucursales y memoria con más cartas
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v21.sql.

-- =====================================================================
-- 1 · PERFIL DEL CLIENTE: su propia foto
-- =====================================================================
alter table public.perfiles add column if not exists foto_cliente text;    -- foto pequeña (JPEG) que sube el cliente

-- Guarda o quita la foto del cliente (solo imágenes JPEG pequeñas)
create or replace function public.guardar_foto_perfil(p_cliente text, p_foto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.clientes c where c.id = p_cliente) then raise exception 'Cliente no válido'; end if;
  if p_foto is not null and (length(p_foto) > 90000 or p_foto !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then
    raise exception 'Foto no válida';
  end if;
  insert into public.perfiles (cliente_id, foto_cliente) values (p_cliente, p_foto)
  on conflict (cliente_id) do update set foto_cliente = excluded.foto_cliente, actualizado = now();
end $$;

create or replace function public.mi_perfil(p_cliente text)
returns table (avatar text, color text, foto text)
language sql security definer set search_path = public stable as $$
  select pf.avatar_cliente, pf.avatar_color, pf.foto_cliente from public.perfiles pf where pf.cliente_id = p_cliente;
$$;

-- Sus pedidos: todos los que debe y los últimos 15 que ya pagó
create or replace function public.mis_pedidos(p_cliente text)
returns table (id bigint, factura text, producto text, cantidad int, monto numeric, pagado numeric,
               fecha timestamptz, vence date, modalidad text, pagada boolean, historico boolean)
language sql stable security definer set search_path = public as $$
  (select c.id, c.factura, c.producto_nombre, c.cantidad, c.monto, c.pagado, c.fecha, c.vence, c.modalidad, c.pagada, c.historico
     from public.compras c where c.cliente_id = p_cliente and not c.pagada order by c.vence, c.id)
  union all
  (select c.id, c.factura, c.producto_nombre, c.cantidad, c.monto, c.pagado, c.fecha, c.vence, c.modalidad, c.pagada, c.historico
     from public.compras c where c.cliente_id = p_cliente and c.pagada order by c.fecha desc limit 15);
$$;

-- =====================================================================
-- 2 · MÉTODOS DE PAGO (varios: Yappy, transferencia, efectivo…)
-- =====================================================================
create table if not exists public.metodos_pago (
  id            bigint generated always as identity primary key,
  nombre        text not null check (length(trim(nombre)) > 0),
  instrucciones text,
  imagen_url    text,                                  -- QR u otra imagen
  orden         int  not null default 0,
  activo        boolean not null default true
);
alter table public.metodos_pago enable row level security;
create policy "admin metodos pago" on public.metodos_pago for all to authenticated using (true) with check (true);

create or replace function public.metodos_pago_tienda()
returns table (id bigint, nombre text, instrucciones text, imagen_url text)
language sql security definer set search_path = public stable as $$
  select m.id, m.nombre, m.instrucciones, m.imagen_url from public.metodos_pago m where m.activo order by m.orden, m.id;
$$;

-- =====================================================================
-- 3 · BOTONES A OTRAS SUCURSALES (los agregas tú en cualquier sucursal)
-- =====================================================================
create table if not exists public.sucursal_enlaces (
  id          bigint generated always as identity primary key,
  sucursal_id bigint not null references public.sucursales(id) on delete cascade,   -- donde aparece el botón
  destino_id  bigint not null references public.sucursales(id) on delete cascade,   -- a dónde lleva
  etiqueta    text,
  orden       int not null default 0,
  unique (sucursal_id, destino_id),
  check (sucursal_id <> destino_id)
);
alter table public.sucursal_enlaces enable row level security;
create policy "admin enlaces sucursal" on public.sucursal_enlaces for all to authenticated using (true) with check (true);

create or replace function public.enlaces_sucursal(p_sucursal bigint default null)
returns table (destino_id bigint, nombre text, etiqueta text)
language plpgsql stable security definer set search_path = public as $$
declare v bigint;
begin
  select l.id into v from public.local_tienda(p_sucursal) l;
  return query
    select e.destino_id, s.nombre, coalesce(nullif(trim(e.etiqueta), ''), s.nombre)
    from public.sucursal_enlaces e join public.sucursales s on s.id = e.destino_id
    where e.sucursal_id = v and s.activa
    order by e.orden, e.id;
end $$;

-- =====================================================================
-- 4 · MEMORIA CON MÁS CARTAS (6, 8, 10 o 12 parejas)
-- =====================================================================
alter table public.juegos add column if not exists pares int not null default 6;
alter table public.juegos drop constraint if exists juegos_pares_check;
alter table public.juegos add constraint juegos_pares_check check (pares in (6, 8, 10, 12));

create or replace function public.campanas_tienda(p_cliente text default null, p_sucursal bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v bigint; v_hoy date := (now() at time zone 'America/Panama')::date; r jsonb;
begin
  select l.id into v from public.local_tienda(p_sucursal) l;
  select jsonb_build_object(
    'encuestas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', e.id, 'titulo', e.titulo, 'descripcion', e.descripcion, 'premio', e.premio, 'preguntas', e.preguntas,
          'min_pedidos', e.min_pedidos,
          'pedidos', case when p_cliente is null then 0 else public.pedidos_desde(p_cliente, coalesce(e.inicia::timestamp at time zone 'America/Panama', e.creada)) end,
          'respondida', exists (select 1 from public.encuesta_respuestas x where x.encuesta_id = e.id and x.cliente_id = p_cliente)
        ) order by e.id desc)
      from public.encuestas e
      where e.activo and (e.inicia is null or e.inicia <= v_hoy) and (e.termina is null or e.termina >= v_hoy)
        and (e.sucursal_id is null or e.sucursal_id = v)), '[]'::jsonb),
    'juegos', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', j.id, 'titulo', j.titulo, 'tipo', j.tipo, 'premio', j.premio, 'ganadores', j.ganadores, 'dificultad', j.dificultad,
          'intentos', j.intentos, 'pares', j.pares, 'min_pedidos', j.min_pedidos, 'encuesta_id', j.encuesta_id,
          'pedidos', case when p_cliente is null then 0 else public.pedidos_desde(p_cliente, coalesce(j.inicia::timestamp at time zone 'America/Panama', j.creado)) end,
          'usados', (select count(*) from public.juego_intentos i where i.juego_id = j.id and i.cliente_id = p_cliente),
          'gano', exists (select 1 from public.juego_intentos i where i.juego_id = j.id and i.cliente_id = p_cliente and i.gano),
          'encuesta_respondida', case when j.encuesta_id is null then null
                                      else exists (select 1 from public.encuesta_respuestas x where x.encuesta_id = j.encuesta_id and x.cliente_id = p_cliente) end
        ) order by j.id desc)
      from public.juegos j
      where j.activo and (j.inicia is null or j.inicia <= v_hoy) and (j.termina is null or j.termina >= v_hoy)
        and (j.sucursal_id is null or j.sucursal_id = v)), '[]'::jsonb)
  ) into r;
  return r;
end $$;

create or replace function public.juego_terminar(p_intento bigint, p_cliente text, p_resultado jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.juego_intentos%rowtype; j public.juegos%rowtype; v_gano boolean := false; v_pos int; s jsonb;
        v_seg numeric; v_lim int; v_meta int; v_max int; v_movs int; v_score int; v_resp boolean := null;
begin
  select * into i from public.juego_intentos where id = p_intento and cliente_id = p_cliente for update;
  if not found then raise exception 'Intento no válido'; end if;
  if i.terminado is not null then raise exception 'Este intento ya terminó'; end if;
  select * into j from public.juegos where id = i.juego_id;
  v_seg := extract(epoch from (now() - i.iniciado));
  if v_seg > 900 then
    v_gano := false;
  elsif j.tipo = 'vasos' then
    v_pos := (i.secreto->>'inicio')::int;
    for s in select value from jsonb_array_elements(i.secreto->'swaps') loop
      if v_pos = (s->>0)::int then v_pos := (s->>1)::int;
      elsif v_pos = (s->>1)::int then v_pos := (s->>0)::int;
      end if;
    end loop;
    v_gano := (p_resultado->>'copa') is not null and (p_resultado->>'copa')::int = v_pos and v_seg >= 3;
  elsif j.tipo = 'memoria' then
    v_movs := coalesce((p_resultado->>'movs')::int, 999);
    v_lim := case j.dificultad when 'facil' then j.pares * 3 when 'normal' then round(j.pares * 2.2)::int else round(j.pares * 1.7)::int end;
    v_gano := v_movs between j.pares and v_lim and v_seg >= 6;
  else
    v_score := coalesce((p_resultado->>'score')::int, -1);
    v_meta := case j.dificultad when 'facil' then 6 when 'normal' then 9 else 12 end;
    v_max  := case j.dificultad when 'facil' then 17 when 'normal' then 22 else 29 end;
    v_gano := v_score >= v_meta and v_score <= v_max and v_seg >= 14;
  end if;
  update public.juego_intentos set terminado = now(), resultado = p_resultado, gano = v_gano where id = i.id;
  if j.encuesta_id is not null then
    v_resp := exists (select 1 from public.encuesta_respuestas x where x.encuesta_id = j.encuesta_id and x.cliente_id = p_cliente);
  end if;
  return jsonb_build_object('gano', v_gano, 'encuesta_id', j.encuesta_id, 'encuesta_respondida', v_resp);
end $$;

grant execute on function public.guardar_foto_perfil(text, text) to anon, authenticated;
grant execute on function public.mi_perfil(text)                 to anon, authenticated;
grant execute on function public.mis_pedidos(text)               to anon, authenticated;
grant execute on function public.metodos_pago_tienda()           to anon, authenticated;
grant execute on function public.enlaces_sucursal(bigint)        to anon, authenticated;
