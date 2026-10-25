-- CRISS' STORE · Ampliación 9: elegir la mascota (interactiva o imagen fija)
-- Ejecútalo UNA sola vez en Supabase → SQL Editor, DESPUÉS de supabase_v8.sql.

-- Los clientes pueden leer SOLO este ajuste (el resto de "ajustes" sigue siendo privado del administrador)
create policy "ver modo de mascota" on public.ajustes for select to anon, authenticated
  using (clave = 'mascota_modo');

-- Valor inicial: mascota interactiva
insert into public.ajustes (clave, valor) values ('mascota_modo', 'animada')
  on conflict (clave) do nothing;
