-- CRISS' STORE · ¿Qué partes de la base de datos ya están instaladas?
-- Pégalo en Supabase → SQL Editor → Run. Solo consulta; no cambia nada y se puede ejecutar las veces que quieras.
-- Cada columna dice true (ya está) o false (falta ejecutar ese archivo).

select
  to_regclass('public.productos') is not null                                              as "supabase.sql",
  to_regclass('public.promos') is not null and to_regclass('public.ajustes') is not null   as "supabase_v2.sql",
  to_regclass('public.pagos') is not null and to_regclass('public.entradas') is not null   as "supabase_v3.sql",
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'productos' and column_name = 'categoria') as "supabase_v4.sql",
  to_regclass('public.comprobantes') is not null                                           as "supabase_v5.sql",
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'cambiar_modalidad')                 as "supabase_v6.sql",
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'compras' and column_name = 'historico') as "supabase_v7.sql",
  to_regclass('public.frases') is not null                                                 as "supabase_v8.sql",
  exists (select 1 from pg_policies
           where schemaname = 'public' and tablename = 'ajustes' and policyname = 'ver modo de mascota') as "supabase_v9.sql",
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'catalogo'
             and pg_get_function_result(p.oid) like '%precio%')                                as "supabase_v10.sql",
  to_regclass('public.perfiles') is not null and to_regclass('public.premios') is not null   as "supabase_v11.sql",
  to_regclass('public.sucursales') is not null and to_regclass('public.anulaciones') is not null as "supabase_v12.sql",
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'compras' and column_name = 'sucursal_id') as "supabase_v13.sql",
  to_regclass('public.perdidas') is not null                                               as "supabase_v14.sql";
