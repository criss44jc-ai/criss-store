-- CRISS' STORE · Ampliación 17: cambiar el nombre de un producto (con justificación) y curva de ventas diarias
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v16.sql.

-- =====================================================================
-- 1 · CAMBIO DE NOMBRE DE UN PRODUCTO, SIEMPRE CON JUSTIFICACIÓN
-- =====================================================================
create table if not exists public.cambios_nombre (
  id              bigint generated always as identity primary key,
  producto_id     bigint not null references public.productos(id),
  nombre_anterior text not null,
  nombre_nuevo    text not null,
  motivo          text not null check (motivo in ('error_escritura', 'presentacion', 'nuevo_nombre', 'otro')),
  comentario      text not null check (length(trim(comentario)) >= 5),
  fecha           timestamptz not null default now()
);
alter table public.cambios_nombre enable row level security;
-- Solo lectura para el administrador: los cambios se crean únicamente con renombrar_producto()
create policy "admin ve cambios de nombre" on public.cambios_nombre for select to authenticated using (true);

-- Cambia el nombre y lo deja registrado. También actualiza el nombre en las ventas, compras,
-- pérdidas y reglas de premio de ese producto, para que tus reportes no se separen en dos.
create or replace function public.renombrar_producto(p_producto bigint, p_nombre text, p_motivo text, p_comentario text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.productos%rowtype; v_nuevo text;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  v_nuevo := trim(coalesce(p_nombre, ''));
  if length(v_nuevo) < 2 or length(v_nuevo) > 80 then raise exception 'El nombre debe tener entre 2 y 80 letras'; end if;
  if p_motivo is null or p_motivo not in ('error_escritura', 'presentacion', 'nuevo_nombre', 'otro') then
    raise exception 'Motivo no válido';
  end if;
  if p_comentario is null or length(trim(p_comentario)) < 5 then
    raise exception 'La justificación es obligatoria (mínimo 5 letras)';
  end if;

  select * into v from public.productos where id = p_producto for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if v.nombre = v_nuevo then raise exception 'El nombre nuevo es igual al actual'; end if;
  if exists (select 1 from public.productos x
              where x.activo and x.id <> v.id and lower(x.nombre) = lower(v_nuevo)
                and coalesce(lower(x.marca), '') = coalesce(lower(v.marca), '')) then
    raise exception 'Ya existe otro producto con ese nombre y esa marca';
  end if;

  perform set_config('app.renombrando', 'si', true);
  insert into public.cambios_nombre (producto_id, nombre_anterior, nombre_nuevo, motivo, comentario)
  values (v.id, v.nombre, v_nuevo, p_motivo, trim(p_comentario));

  update public.productos set nombre = v_nuevo where id = v.id;
  update public.compras  set producto_nombre = v_nuevo where producto_id = v.id;
  update public.entradas set producto_nombre = v_nuevo where producto_id = v.id;
  update public.perdidas set producto_nombre = v_nuevo where producto_id = v.id;
  update public.reglas_premio set producto = v_nuevo where producto = v.nombre;
end $$;
revoke execute on function public.renombrar_producto(bigint, text, text, text) from public, anon;
grant execute on function public.renombrar_producto(bigint, text, text, text) to authenticated;

-- El nombre ya no se puede cambiar "a mano": solo con renombrar_producto() (que exige la justificación)
create or replace function public.trg_nombre_protegido()
returns trigger language plpgsql as $$
begin
  if new.nombre is distinct from old.nombre and coalesce(current_setting('app.renombrando', true), '') <> 'si' then
    raise exception 'El nombre de un producto solo se cambia con su justificación (botón "Cambiar nombre")';
  end if;
  return new;
end $$;
drop trigger if exists trg_nombre_protegido on public.productos;
create trigger trg_nombre_protegido before update of nombre on public.productos
  for each row execute function public.trg_nombre_protegido();

-- =====================================================================
-- 2 · VENTAS DÍA POR DÍA (para la curva de ventas)
-- =====================================================================
create or replace function public.ventas_diarias(p_desde date, p_hasta date, p_sucursal bigint default null)
returns table (dia date, pedidos bigint, unidades bigint, ventas numeric, ganancia numeric)
language sql stable as $$
  with d as (
    select (p_desde + g)::date as dia from generate_series(0, p_hasta - p_desde) as g
  ), v as (
    select (c.fecha at time zone 'America/Panama')::date as dia,
           count(*) as pedidos, sum(c.cantidad)::bigint as unidades,
           sum(c.monto) as ventas, sum(c.monto - c.cantidad * c.costo_unit) as ganancia
    from public.compras c
    where not c.historico
      and (c.fecha at time zone 'America/Panama')::date between p_desde and p_hasta
      and (p_sucursal is null or c.sucursal_id = p_sucursal)
    group by 1
  )
  select d.dia, coalesce(v.pedidos, 0), coalesce(v.unidades, 0), coalesce(v.ventas, 0), coalesce(v.ganancia, 0)
  from d left join v on v.dia = d.dia
  order by d.dia;
$$;
revoke execute on function public.ventas_diarias(date, date, bigint) from public, anon;
grant execute on function public.ventas_diarias(date, date, bigint) to authenticated;
