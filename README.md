# CRISS’ STORE

Control de compras, cobros e inventario en línea. Sitio estático (sin compilar) con Supabase como base de datos, almacenamiento de fotos y acceso del administrador.

## Archivos (todos en la raíz del repositorio)

- `index.html`: tienda para los clientes.
- `admin.html`, `admin.js`, `admin2.js`: panel del administrador (se abre en `/admin.html`).
- `mascota.png`: imagen de la mascota (portada, ícono y respaldo).
- `mascota.js`, `mascota.svg`, `mascota-demo.html`: la mascota interactiva en estilo cómic.
- `mascota-pixel.js` y `mascota-pixel-*.gif`: la mascota pixelada animada.
- `config.js`: URL y llave pública de Supabase (no lo reemplaces si ya tiene tus datos).
- `supabase.sql`, `supabase_v2.sql`, `supabase_v3.sql`, `supabase_v4.sql`, `supabase_v5.sql`, `supabase_v6.sql`, `supabase_v7.sql`, `supabase_v8.sql`, `supabase_v9.sql`: base de datos. Se ejecutan **una sola vez cada uno y en ese orden** en Supabase → SQL Editor.

## Qué hace

- **Clientes:** eligen su nombre (C-001…), tocan el producto o escanean el QR, y escogen pago inmediato, el 15 o el 30 del mes en curso. Solo ven productos, cantidades y fechas de pago, nunca precios.
- **Cobros:** el administrador registra pagos completos o abonos; el sistema los aplica a las compras más antiguas. Ve qué está pendiente y qué está vencido.
- **Facturas de proveedor:** cada compra de mercancía sube la existencia, guarda la foto o PDF de la factura (en un espacio privado) y calcula el costo promedio.
- **Ganancias:** ganancia por producto, producto estrella con consejos, y resumen mensual de ventas, costos, gastos y dinero cobrado.
- **Estado de cuenta:** se comparte por WhatsApp, PDF, JPG o captura, con tus datos de pago.

## Seguridad

- La llave `anon` es pública a propósito; la protección está en las reglas de los archivos `.sql`.
- Desactiva **Allow new users to sign up** en Supabase para que solo exista tu usuario administrador.
- Nunca subas la llave `service_role` ni tu contraseña.

## Guía paso a paso

Lee `GUIA-INSTALACION.md`. Para saber qué partes de la base de datos ya ejecutaste, corre `verificar_supabase.sql`.
