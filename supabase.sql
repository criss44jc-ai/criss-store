-- CRISS' STORE · Base de datos (Supabase)
-- Pégalo completo en Supabase → SQL Editor → Run.

-- ============ TABLAS ============
create table public.clientes (
  id     text primary key,          -- número de serie: C-001, C-002...
  nombre text not null
);

insert into public.clientes (id, nombre) values
 ('C-001','Yelenis'),('C-002','Yarlenis'),('C-003','Valery'),('C-004','Moises'),
 ('C-005','Diego'),('C-006','Deivis'),('C-007','Yeraldine'),('C-008','Vicyi'),
 ('C-009','Ashley'),('C-010','Erick'),('C-011','Miguel'),('C-012','Ingri'),
 ('C-013','Jessy'),('C-014','Shelina'),('C-015','Diana'),('C-016','Maryorie'),
 ('C-017','Litzy'),('C-018','Jeniffer'),('C-019','Orit'),('C-020','Hanna'),
 ('C-021','Carlos'),('C-022','Jose'),('C-023','Eloisa'),('C-024','Yarelis'),
 ('C-025','Lirit'),('C-026','Zelided'),('C-027','Rosalinda'),('C-028','Cristian'),
 ('C-029','Arnulfo');

create table public.productos (
  id             bigint generated always as identity primary key,
  codigo         text unique,                       -- P-0001 (lo genera el sistema)
  nombre         text not null,
  marca          text,
  especificacion text,                              -- ej: 355 ml, bolsa 40 g
  precio         numeric(10,2) not null check (precio >= 0),
  stock          int not null default 0 check (stock >= 0),
  umbral         int not null default 2,            -- avisar cuando queden esta cantidad o menos
  imagen_url     text,
  activo         boolean not null default true,
  creado         timestamptz not null default now()
);

create table public.compras (
  id              bigint generated always as identity primary key,
  factura         text unique,                      -- F-0001 (lo genera el sistema)
  cliente_id      text not null references public.clientes(id),
  producto_id     bigint not null references public.productos(id),
  producto_nombre text not null,
  cantidad        int not null check (cantidad > 0),
  monto           numeric(10,2) not null,
  pagada          boolean not null default false,
  fecha           timestamptz not null default now()
);

-- ============ CÓDIGOS AUTOMÁTICOS ============
create function public.set_codigo() returns trigger language plpgsql as $$
begin new.codigo := 'P-' || lpad(new.id::text, 4, '0'); return new; end $$;
create trigger trg_codigo before insert on public.productos
  for each row execute function public.set_codigo();

create function public.set_factura() returns trigger language plpgsql as $$
begin new.factura := 'F-' || lpad(new.id::text, 4, '0'); return new; end $$;
create trigger trg_factura before insert on public.compras
  for each row execute function public.set_factura();

-- ============ FUNCIONES PARA LOS CLIENTES (sin ver precios) ============
-- Catálogo sin precio ni cantidades
create function public.catalogo()
returns table (codigo text, nombre text, marca text, especificacion text, imagen_url text, disponible boolean)
language sql security definer set search_path = public stable as $$
  select p.codigo, p.nombre, p.marca, p.especificacion, p.imagen_url, p.stock > 0
  from public.productos p where p.activo order by p.nombre;
$$;

-- Registra el retiro: descuenta existencia y crea la factura pendiente (monto calculado aquí)
create function public.registrar_compra(p_cliente text, p_codigo text, p_cantidad int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_prod public.productos%rowtype; v_fact text;
begin
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 50 then
    raise exception 'Cantidad no válida';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente) then
    raise exception 'Cliente no válido';
  end if;
  select * into v_prod from public.productos
   where codigo = p_codigo and activo for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if v_prod.stock < p_cantidad then
    raise exception 'Solo quedan % en existencia', v_prod.stock;
  end if;
  update public.productos set stock = stock - p_cantidad where id = v_prod.id;
  insert into public.compras (cliente_id, producto_id, producto_nombre, cantidad, monto)
  values (p_cliente, v_prod.id, v_prod.nombre, p_cantidad, p_cantidad * v_prod.precio)
  returning factura into v_fact;
  return jsonb_build_object('factura', v_fact, 'producto', v_prod.nombre, 'cantidad', p_cantidad);
end $$;

-- Cuenta pendiente del cliente: producto y cantidad, nunca precio
create function public.mi_cuenta(p_cliente text)
returns table (producto text, cantidad bigint)
language sql security definer set search_path = public stable as $$
  select c.producto_nombre, sum(c.cantidad)::bigint
  from public.compras c
  where c.cliente_id = p_cliente and not c.pagada
  group by c.producto_nombre order by 1;
$$;

grant execute on function public.catalogo() to anon, authenticated;
grant execute on function public.registrar_compra(text, text, int) to anon, authenticated;
grant execute on function public.mi_cuenta(text) to anon, authenticated;

-- ============ SEGURIDAD (RLS) ============
alter table public.clientes  enable row level security;
alter table public.productos enable row level security;
alter table public.compras   enable row level security;

-- Cualquiera puede ver la lista de nombres para elegir el suyo
create policy "ver clientes" on public.clientes for select to anon, authenticated using (true);
-- Solo el administrador (usuario con sesión) toca productos, compras y clientes
create policy "admin clientes"  on public.clientes  for all to authenticated using (true) with check (true);
create policy "admin productos" on public.productos for all to authenticated using (true) with check (true);
create policy "admin compras"   on public.compras   for all to authenticated using (true) with check (true);

-- ============ IMÁGENES ============
insert into storage.buckets (id, name, public) values ('productos', 'productos', true)
  on conflict (id) do nothing;
create policy "admin sube imagenes"  on storage.objects for insert to authenticated with check (bucket_id = 'productos');
create policy "admin edita imagenes" on storage.objects for update to authenticated using (bucket_id = 'productos');
create policy "admin borra imagenes" on storage.objects for delete to authenticated using (bucket_id = 'productos');
