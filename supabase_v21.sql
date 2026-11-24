-- CRISS' STORE · Ampliación 21: encuestas con premio, juegos, ruleta y baraja de ventanas emergentes
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v20.sql.

-- =====================================================================
-- 1 · ENCUESTAS
-- =====================================================================
create table if not exists public.encuestas (
  id           bigint generated always as identity primary key,
  titulo       text not null check (length(trim(titulo)) > 0),
  descripcion  text,
  premio       text,                                   -- lo que se gana por participar
  preguntas    jsonb not null default '[]'::jsonb,     -- [{"t":"opcion","p":"..","o":["a","b"]},{"t":"estrellas","p":".."},{"t":"texto","p":".."}]
  min_pedidos  int  not null default 0 check (min_pedidos between 0 and 50),   -- pedidos hechos desde que empieza para poder responder
  sucursal_id  bigint references public.sucursales(id) on delete set null,     -- null = todos los locales
  inicia       date,
  termina      date,
  activo       boolean not null default true,
  creada       timestamptz not null default now()
);
create table if not exists public.encuesta_respuestas (
  id          bigint generated always as identity primary key,
  encuesta_id bigint not null references public.encuestas(id) on delete cascade,
  cliente_id  text   not null references public.clientes(id),
  respuestas  jsonb  not null,
  creada      timestamptz not null default now(),
  unique (encuesta_id, cliente_id)
);

-- =====================================================================
-- 2 · JUEGOS (vasos, memoria, atrapa a la mascota)
-- =====================================================================
create table if not exists public.juegos (
  id           bigint generated always as identity primary key,
  titulo       text not null check (length(trim(titulo)) > 0),
  tipo         text not null check (tipo in ('vasos', 'memoria', 'atrapa')),
  premio       text,
  ganadores    int  not null default 1 check (ganadores between 1 and 3),     -- cuántas personas ganan en la ruleta
  dificultad   text not null default 'normal' check (dificultad in ('facil', 'normal', 'dificil')),
  intentos     int  not null default 1 check (intentos between 1 and 3),      -- intentos por cliente
  min_pedidos  int  not null default 0 check (min_pedidos between 0 and 50),
  encuesta_id  bigint references public.encuestas(id) on delete set null,     -- encuesta para responder después de jugar
  sucursal_id  bigint references public.sucursales(id) on delete set null,
  inicia       date,
  termina      date,
  activo       boolean not null default true,
  creado       timestamptz not null default now()
);
create table if not exists public.juego_intentos (
  id         bigint generated always as identity primary key,
  juego_id   bigint not null references public.juegos(id) on delete cascade,
  cliente_id text   not null references public.clientes(id),
  iniciado   timestamptz not null default now(),
  terminado  timestamptz,
  secreto    jsonb,
  resultado  jsonb,
  gano       boolean
);
create index if not exists juego_intentos_idx on public.juego_intentos (juego_id, cliente_id);

-- =====================================================================
-- 3 · RULETA (sorteos y sus ganadores)
-- =====================================================================
create table if not exists public.sorteos (
  id            bigint generated always as identity primary key,
  origen        text not null check (origen in ('juego', 'encuesta')),
  origen_id     bigint not null,
  titulo        text,
  premio        text,
  participantes int not null,
  creado        timestamptz not null default now()
);
create table if not exists public.sorteo_ganadores (
  id         bigint generated always as identity primary key,
  sorteo_id  bigint not null references public.sorteos(id) on delete cascade,
  cliente_id text   not null references public.clientes(id),
  nombre     text,
  entregado  boolean not null default false
);

-- Solo el administrador toca estas tablas; los clientes usan las funciones de abajo
alter table public.encuestas           enable row level security;
alter table public.encuesta_respuestas enable row level security;
alter table public.juegos              enable row level security;
alter table public.juego_intentos      enable row level security;
alter table public.sorteos             enable row level security;
alter table public.sorteo_ganadores    enable row level security;
create policy "admin encuestas"  on public.encuestas           for all to authenticated using (true) with check (true);
create policy "admin respuestas" on public.encuesta_respuestas for all to authenticated using (true) with check (true);
create policy "admin juegos"     on public.juegos              for all to authenticated using (true) with check (true);
create policy "admin intentos"   on public.juego_intentos      for all to authenticated using (true) with check (true);
create policy "admin sorteos"    on public.sorteos             for all to authenticated using (true) with check (true);
create policy "admin ganadores"  on public.sorteo_ganadores    for all to authenticated using (true) with check (true);

-- =====================================================================
-- 4 · FUNCIONES PARA LA TIENDA
-- =====================================================================
-- Pedidos reales (sin los anteriores al sistema) hechos desde una fecha
create or replace function public.pedidos_desde(p_cliente text, p_desde timestamptz)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.compras c
  where c.cliente_id = p_cliente and not c.historico and c.fecha >= p_desde;
$$;

-- Lo que hay disponible hoy para un cliente en un local: encuestas y juegos, con su estado
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
          'intentos', j.intentos, 'min_pedidos', j.min_pedidos, 'encuesta_id', j.encuesta_id,
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

-- Responder una encuesta (una sola vez por cliente)
create or replace function public.responder_encuesta(p_encuesta bigint, p_cliente text, p_respuestas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare e public.encuestas%rowtype; v_hoy date := (now() at time zone 'America/Panama')::date; q jsonb; a jsonb; i int := 0; v_ped int;
begin
  if not exists (select 1 from public.clientes c where c.id = p_cliente) then raise exception 'Cliente no válido'; end if;
  select * into e from public.encuestas
   where id = p_encuesta and activo and (inicia is null or inicia <= v_hoy) and (termina is null or termina >= v_hoy);
  if not found then raise exception 'Esta encuesta ya no está disponible'; end if;
  v_ped := public.pedidos_desde(p_cliente, coalesce(e.inicia::timestamp at time zone 'America/Panama', e.creada));
  if v_ped < e.min_pedidos then raise exception 'Te faltan % pedido(s) para responder esta encuesta', e.min_pedidos - v_ped; end if;
  if exists (select 1 from public.encuesta_respuestas x where x.encuesta_id = e.id and x.cliente_id = p_cliente) then
    raise exception 'Ya respondiste esta encuesta';
  end if;
  if p_respuestas is null or jsonb_typeof(p_respuestas) <> 'array' or jsonb_array_length(p_respuestas) <> jsonb_array_length(e.preguntas) then
    raise exception 'Faltan respuestas';
  end if;
  for q in select value from jsonb_array_elements(e.preguntas) loop
    a := p_respuestas -> i;
    if q->>'t' = 'opcion' then
      if jsonb_typeof(a) <> 'number' or (a #>> '{}')::int < 0 or (a #>> '{}')::int >= coalesce(jsonb_array_length(q->'o'), 0) then
        raise exception 'Elige una opción en cada pregunta';
      end if;
    elsif q->>'t' = 'estrellas' then
      if jsonb_typeof(a) <> 'number' or (a #>> '{}')::int not between 1 and 5 then raise exception 'Pon de 1 a 5 estrellas'; end if;
    else
      if a is null or jsonb_typeof(a) not in ('string', 'null') or length(coalesce(a #>> '{}', '')) > 300 then
        raise exception 'Respuesta de texto no válida';
      end if;
    end if;
    i := i + 1;
  end loop;
  insert into public.encuesta_respuestas (encuesta_id, cliente_id, respuestas) values (e.id, p_cliente, p_respuestas);
end $$;

-- Empezar a jugar: revisa que pueda y guarda el intento (en "vasos" el servidor decide dónde empieza la mascota y cómo se mezclan)
create or replace function public.juego_iniciar(p_juego bigint, p_cliente text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare j public.juegos%rowtype; v_hoy date := (now() at time zone 'America/Panama')::date; v_ped int; v_usados int;
        v_id bigint; v_inicio int := 0; v_swaps jsonb := '[]'::jsonb; v_n int; a int; b int; k int;
begin
  if not exists (select 1 from public.clientes c where c.id = p_cliente) then raise exception 'Cliente no válido'; end if;
  select * into j from public.juegos
   where id = p_juego and activo and (inicia is null or inicia <= v_hoy) and (termina is null or termina >= v_hoy);
  if not found then raise exception 'Este juego ya no está disponible'; end if;
  v_ped := public.pedidos_desde(p_cliente, coalesce(j.inicia::timestamp at time zone 'America/Panama', j.creado));
  if v_ped < j.min_pedidos then raise exception 'Te faltan % pedido(s) para jugar', j.min_pedidos - v_ped; end if;
  select count(*) into v_usados from public.juego_intentos i where i.juego_id = j.id and i.cliente_id = p_cliente;
  if v_usados >= j.intentos then raise exception 'Ya usaste tus intentos en este juego'; end if;
  if j.tipo = 'vasos' then
    v_inicio := floor(random() * 3)::int;
    v_n := case j.dificultad when 'facil' then 6 when 'normal' then 9 else 13 end;
    for k in 1..v_n loop
      a := floor(random() * 3)::int;
      b := (a + 1 + floor(random() * 2)::int) % 3;
      v_swaps := v_swaps || jsonb_build_array(jsonb_build_array(a, b));
    end loop;
  end if;
  insert into public.juego_intentos (juego_id, cliente_id, secreto)
  values (j.id, p_cliente, case when j.tipo = 'vasos' then jsonb_build_object('inicio', v_inicio, 'swaps', v_swaps) else null end)
  returning id into v_id;
  return jsonb_build_object('intento', v_id, 'inicio', v_inicio, 'swaps', v_swaps);
end $$;

-- Terminar de jugar: el servidor decide si ganó (en "vasos" repite las mezclas; en los otros revisa que el resultado sea posible)
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
    v_lim := case j.dificultad when 'facil' then 18 when 'normal' then 13 else 10 end;
    v_gano := v_movs between 6 and v_lim and v_seg >= 6;
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

-- Premios que ganó un cliente en la ruleta
create or replace function public.mis_sorteos(p_cliente text)
returns table (sorteo_id bigint, titulo text, premio text, creado timestamptz, entregado boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.titulo, s.premio, s.creado, g.entregado
  from public.sorteo_ganadores g join public.sorteos s on s.id = g.sorteo_id
  where g.cliente_id = p_cliente order by s.id desc limit 10;
$$;

grant execute on function public.pedidos_desde(text, timestamptz)           to anon, authenticated;
grant execute on function public.campanas_tienda(text, bigint)              to anon, authenticated;
grant execute on function public.responder_encuesta(bigint, text, jsonb)    to anon, authenticated;
grant execute on function public.juego_iniciar(bigint, text)                to anon, authenticated;
grant execute on function public.juego_terminar(bigint, text, jsonb)        to anon, authenticated;
grant execute on function public.mis_sorteos(text)                          to anon, authenticated;

-- =====================================================================
-- 5 · RULETA: SOLO EL ADMINISTRADOR (el azar lo pone el servidor)
-- =====================================================================
-- Quiénes entran a la ruleta (no repite a quien ya ganó antes en esa misma campaña)
create or replace function public.participantes_sorteo(p_origen text, p_id bigint,
                                                       p_solo_ganadores boolean default true, p_solo_respondieron boolean default true)
returns table (cliente_id text, nombre text)
language plpgsql stable security definer set search_path = public as $$
declare v_enc bigint;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_origen = 'juego' then
    select j.encuesta_id into v_enc from public.juegos j where j.id = p_id;
    return query
      select c.id, c.nombre from public.clientes c
      where exists (select 1 from public.juego_intentos i
                     where i.juego_id = p_id and i.cliente_id = c.id and i.terminado is not null and (not p_solo_ganadores or i.gano))
        and (not p_solo_respondieron or v_enc is null
             or exists (select 1 from public.encuesta_respuestas x where x.encuesta_id = v_enc and x.cliente_id = c.id))
        and not exists (select 1 from public.sorteo_ganadores g join public.sorteos s on s.id = g.sorteo_id
                         where s.origen = 'juego' and s.origen_id = p_id and g.cliente_id = c.id)
      order by c.nombre;
  elsif p_origen = 'encuesta' then
    return query
      select c.id, c.nombre from public.clientes c
      where exists (select 1 from public.encuesta_respuestas x where x.encuesta_id = p_id and x.cliente_id = c.id)
        and not exists (select 1 from public.sorteo_ganadores g join public.sorteos s on s.id = g.sorteo_id
                         where s.origen = 'encuesta' and s.origen_id = p_id and g.cliente_id = c.id)
      order by c.nombre;
  else
    raise exception 'Origen no válido';
  end if;
end $$;

-- Gira la ruleta: elige al azar (gen_random_uuid) y guarda quiénes ganaron
create or replace function public.sortear_campana(p_origen text, p_id bigint, p_ganadores int default null,
                                                  p_solo_ganadores boolean default true, p_solo_respondieron boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int; v_tit text; v_premio text; v_total int; v_id bigint; v_gan jsonb;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_origen = 'juego' then
    select j.ganadores, j.titulo, j.premio into v_n, v_tit, v_premio from public.juegos j where j.id = p_id;
  elsif p_origen = 'encuesta' then
    select 1, e.titulo, e.premio into v_n, v_tit, v_premio from public.encuestas e where e.id = p_id;
  else
    raise exception 'Origen no válido';
  end if;
  if v_tit is null then raise exception 'No se encontró la campaña'; end if;
  if p_ganadores is not null then v_n := least(greatest(p_ganadores, 1), 3); end if;
  select count(*) into v_total from public.participantes_sorteo(p_origen, p_id, p_solo_ganadores, p_solo_respondieron);
  if v_total = 0 then raise exception 'No hay participantes para la ruleta'; end if;
  v_n := least(v_n, v_total);
  select coalesce(jsonb_agg(jsonb_build_object('cliente_id', x.cliente_id, 'nombre', x.nombre)), '[]'::jsonb) into v_gan
  from (select pp.cliente_id, pp.nombre
        from public.participantes_sorteo(p_origen, p_id, p_solo_ganadores, p_solo_respondieron) pp
        order by gen_random_uuid() limit v_n) x;
  insert into public.sorteos (origen, origen_id, titulo, premio, participantes)
  values (p_origen, p_id, v_tit, v_premio, v_total) returning id into v_id;
  insert into public.sorteo_ganadores (sorteo_id, cliente_id, nombre)
  select v_id, g->>'cliente_id', g->>'nombre' from jsonb_array_elements(v_gan) g;
  return jsonb_build_object('sorteo', v_id, 'participantes', v_total, 'ganadores', v_gan);
end $$;

revoke execute on function public.participantes_sorteo(text, bigint, boolean, boolean) from public, anon;
revoke execute on function public.sortear_campana(text, bigint, int, boolean, boolean) from public, anon;
grant  execute on function public.participantes_sorteo(text, bigint, boolean, boolean) to authenticated;
grant  execute on function public.sortear_campana(text, bigint, int, boolean, boolean) to authenticated;

-- =====================================================================
-- 6 · VENTANAS EMERGENTES COMO BARAJA: ahora la tienda recibe hasta 6 vigentes
-- =====================================================================
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
    limit 6;
end $$;
