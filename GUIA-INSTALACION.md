# CRISS’ STORE · Guía de instalación

Sigue los pasos en este orden. Si algo ya lo hiciste antes, salta ese paso.

## Qué trae esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La tienda que ven tus clientes |
| `admin.html`, `admin.js`, `admin2.js` | Tu panel de administrador (se abre en `/admin.html`) |
| `mascota.png` | La imagen de la portada, el ícono de la pestaña y el respaldo de la mascota |
| `mascota.js` | **La mascota animada** (cuatro estados). La tienda la necesita para moverse |
| `mascota-pixel.js` y `mascota-pixel-alegre.gif`, `-canta.gif`, `-asoma.gif`, `-reposo.gif` | **La mascota pixelada animada**, de 64 × 64 píxeles y mostrada a 128 px (la tienda necesita los 5 archivos) |
| `mascota.svg` | La mascota interactiva como imagen animada suelta (opcional) |
| `mascota-demo.html` | Página para ver y probar sus movimientos (opcional) |
| `config.js` | La conexión con Supabase (**ya lo tienes en GitHub con tus datos; no lo reemplaces**) |
| `supabase.sql` a `supabase_v10.sql` | La base de datos, en 10 partes |
| `verificar_supabase.sql` | Te dice cuáles de esas partes ya ejecutaste |
| `README.md`, `GUIA-INSTALACION.md` | Documentación |

## Paso 1 · Supabase: la base de datos

1. Entra a **supabase.com** y abre tu proyecto.
2. Abre **SQL Editor** (icono `>_`) y pulsa **New query**.
3. Pega el contenido de `verificar_supabase.sql` y pulsa **Run**. Verás una fila con diez columnas: `true` significa que esa parte ya está instalada y `false` que falta.
4. Ejecuta **solo los archivos que dicen `false`**, en este orden: `supabase.sql`, `supabase_v2.sql`, `supabase_v3.sql`, `supabase_v4.sql`, `supabase_v5.sql`, `supabase_v6.sql`, `supabase_v7.sql`, `supabase_v8.sql`, `supabase_v9.sql`, `supabase_v10.sql`.
   - Para cada uno: **New query**, pega todo el contenido y pulsa **Run**. Debe decir **Success**.
   - Si sale un aviso de "destructive operations", pulsa **Run this query**.
   - **No repitas** un archivo que ya ejecutaste: daría errores de "already exists".
5. Vuelve a ejecutar `verificar_supabase.sql`: las diez columnas deben decir `true`.

## Paso 2 · Supabase: tu usuario administrador

1. **Authentication → Users → Add user → Create new user**.
2. Escribe tu correo y una contraseña, marca **Auto Confirm User** y pulsa **Create user**.
3. En **Authentication → Sign In / Providers**, desactiva **Allow new users to sign up**.

## Paso 3 · GitHub: subir los archivos

1. Abre tu repositorio en github.com.
2. **Add file → Upload files**.
3. Arrastra **todos los archivos menos `config.js`** (los archivos, no la carpeta).
4. Pulsa **Commit changes**.

Los archivos que ya existen se reemplazan solos. Revisa que en la raíz estén `index.html`, `admin.html`, `admin.js`, `admin2.js`, `mascota.png`, `mascota.js`, `mascota-pixel.js` y los cuatro `mascota-pixel-*.gif`, y que no queden archivos con nombres raros como `index (1).html`.

## Paso 4 · Vercel: publicar

1. Vercel publica solo cuando cambia GitHub.
2. En **Deployments**, espera a que el último diga **Ready**.
3. Abre tu dirección `.vercel.app` (tienda) y `tu-dirección.vercel.app/admin.html` (panel). Recarga con `Cmd + Shift + R`.

## Paso 5 · Configurar tu tienda (una sola vez)

En `/admin.html`, con tu correo y contraseña:

1. **Más → Datos de pago:** escribe tu cuenta y sube tu QR de Yappy.
2. **Inventario → Cargar producto nuevo:** crea tus productos con foto, precio, costo, categoría y, si quieres, una frase para la mascota.
3. **Inventario → Compra a proveedor:** registra tus facturas de compra para que el sistema calcule tus costos y ganancias.
4. **Cobros → Cargar pedido anterior:** pasa lo que tus clientes te deben de antes del sistema.
5. **Más → Frases de la mascota:** crea lo que quieres que diga.
6. **Inventario:** imprime los QR de tus productos **después** de abrir el sitio desde su dirección final.

## Paso 6 · Prueba completa

1. En la tienda, elige un cliente, toca un producto y escoge "Pago inmediato". Debe salir la pantalla de pago y la mascota.
2. Sube una captura de prueba: en el panel debe aparecer en **Cobros → Comprobantes por verificar**.
3. Registra el pago y revisa que la cuenta quede en cero.
4. Abre **Resumen → Informe del día** y revisa los números.
5. Si hiciste pedidos de prueba, anúlalos en **Resumen → Últimas ventas** para devolver el inventario.

## Si algo falla

- **"No se pudo cargar el catálogo":** revisa `config.js` en GitHub (URL y llave reales, sin puntos suspensivos) y que hayas ejecutado `supabase.sql`.
- **Avisos "Falta ejecutar supabase_vX.sql":** ejecuta ese archivo en Supabase.
- **No entra al panel:** confirma que el usuario existe en **Authentication → Users**.
- **La página se ve igual que antes:** espera a que Vercel diga **Ready** y recarga con `Cmd + Shift + R`.
- **La tienda deja de cargar tras una semana sin uso:** los proyectos gratis de Supabase se pausan; reactívalo con el botón de su panel.

## Precios y pagos

- Los clientes ven el **último precio cargado** de cada producto, y el total según la cantidad que eligen.
- Al pulsar **Pagar ahora** ven el **monto a pagar**: lo que toca hoy y, si tienen más pendiente, pueden elegir pagar todo o adelantar.
- Para cambiar un precio: **Inventario → Cambiar precio**. Solo afecta pedidos nuevos; los ya hechos conservan su precio.

## La mascota animada

- Al abrir la tienda se **asoma al vidrio**, y cuando habla **canta**.
- Después se queda **alegre y pícara**: parpadea, guiña y mueve las cejas.
- Si pasan 35 segundos sin que nadie toque la pantalla, se **duerme**; al tocar, se asoma de nuevo.
- Para verla sin la tienda, abre `mascota-demo.html` con doble clic.
- Si `mascota.js` no está subido, la tienda muestra la imagen fija de siempre.
- **Cambiar de mascota:** en `/admin.html` → **Más → Mascota de la tienda** eliges **Interactiva (estilo cómic)**, **Pixelada (retro animada)** o **Imagen fija** y pulsas **Guardar**. Se aplica a todos tus clientes (necesita `supabase_v9.sql`). La interactiva y la pixelada se asoman, cantan y se duermen; la imagen fija solo se sacude al hablar.
- **La imagen de la portada** (`mascota.png`) no cambia con ninguna opción.

## Seguridad

- La llave `anon` de `config.js` es pública a propósito; la protección está en las reglas de los `.sql`.
- Nunca subas la llave `service_role` ni tu contraseña de administrador.
- Los comprobantes y las facturas de proveedor se guardan en espacios privados.
- Cualquier cliente puede elegir cualquier nombre de la lista. Si quieres un código personal por cliente, se puede agregar.
