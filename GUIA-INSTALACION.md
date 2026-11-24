# CRISS’ STORE · Guía de instalación

Sigue los pasos en este orden. Si algo ya lo hiciste antes, salta ese paso.

## Qué trae esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La tienda que ven tus clientes |
| `admin.html`, `admin.js`, `admin2.js`, `admin3.js`, `admin4.js`, `admin5.js`, `admin6.js`, `admin7.js`, `admin8.js`, `admin9.js`, `admin10.js`, `admin11.js`, `baraja.js`, `juegos.js` | Tu panel de administrador (se abre en `/admin.html`) |
| `mascota.png` | La imagen de la portada, el ícono de la pestaña y el respaldo de la mascota |
| `mascota.js` | **La mascota animada** (cuatro estados). La tienda la necesita para moverse |
| `mascota-pixel.js` y `mascota-pixel-alegre.gif`, `-canta.gif`, `-asoma.gif`, `-reposo.gif` | **La mascota pixelada animada**, de 64 × 64 píxeles y mostrada a 128 px (la tienda necesita los 5 archivos) |
| `mascota.svg` | La mascota interactiva como imagen animada suelta (opcional) |
| `mascota-demo.html` | Página para ver y probar sus movimientos (opcional) |
| `config.js` | La conexión con Supabase (**ya lo tienes en GitHub con tus datos; no lo reemplaces**) |
| `supabase.sql` a `supabase_v21.sql` | La base de datos, en 21 partes |
| `verificar_supabase.sql` | Te dice cuáles de esas partes ya ejecutaste |
| `README.md`, `GUIA-INSTALACION.md` | Documentación |

## Paso 1 · Supabase: la base de datos

1. Entra a **supabase.com** y abre tu proyecto.
2. Abre **SQL Editor** (icono `>_`) y pulsa **New query**.
3. Pega el contenido de `verificar_supabase.sql` y pulsa **Run**. Verás una fila con veintiuna columnas: `true` significa que esa parte ya está instalada y `false` que falta.
4. Ejecuta **solo los archivos que dicen `false`**, en este orden: `supabase.sql`, `supabase_v2.sql`, `supabase_v3.sql`, `supabase_v4.sql`, `supabase_v5.sql`, `supabase_v6.sql`, `supabase_v7.sql`, `supabase_v8.sql`, `supabase_v9.sql`, `supabase_v10.sql`, `supabase_v11.sql`, `supabase_v12.sql`, `supabase_v13.sql`, `supabase_v14.sql`, `supabase_v15.sql`, `supabase_v16.sql`, `supabase_v17.sql`, `supabase_v18.sql`, `supabase_v19.sql`, `supabase_v20.sql`, `supabase_v21.sql`.
   - Para cada uno: **New query**, pega todo el contenido y pulsa **Run**. Debe decir **Success**.
   - Si sale un aviso de "destructive operations", pulsa **Run this query**.
   - **No repitas** un archivo que ya ejecutaste: daría errores de "already exists".
5. Vuelve a ejecutar `verificar_supabase.sql`: las veintiuna columnas deben decir `true`.

## Paso 2 · Supabase: tu usuario administrador

1. **Authentication → Users → Add user → Create new user**.
2. Escribe tu correo y una contraseña, marca **Auto Confirm User** y pulsa **Create user**.
3. En **Authentication → Sign In / Providers**, desactiva **Allow new users to sign up**.

## Paso 3 · GitHub: subir los archivos

1. Abre tu repositorio en github.com.
2. **Add file → Upload files**.
3. Arrastra **todos los archivos menos `config.js`** (los archivos, no la carpeta).
4. Pulsa **Commit changes**.

Los archivos que ya existen se reemplazan solos. Revisa que en la raíz estén `index.html`, `admin.html`, `admin.js`, `admin2.js`, `admin3.js`, `admin4.js`, `admin5.js`, `admin6.js`, `admin7.js`, `admin8.js`, `admin9.js`, `admin10.js`, `admin11.js`, `baraja.js`, `juegos.js`, `mascota.png`, `mascota.js`, `mascota-pixel.js` y los cuatro `mascota-pixel-*.gif`, y que no queden archivos con nombres raros como `index (1).html`.

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

## Locales: casa madre y sucursales

En `/admin.html` → **Locales**:
- La **casa madre** es el inventario que ya tienes. Puedes cambiarle el nombre, y agregar y renombrar las sucursales que quieras.
- **Inventario por local:** una tabla con la existencia de cada producto en la casa madre, en cada sucursal y el total.
- **Enviar mercancía:** eliges desde dónde y hacia dónde, armas la lista de productos y cantidades, y la envías a autorización. **La existencia no se mueve hasta que la casa madre pulsa Autorizar.** También puede rechazarse, con un motivo. Con esto también puedes devolver mercancía a la casa madre.
- **¿De qué local sale cada venta?** Cada local tiene su **propio enlace de venta** (se ve en Locales, con botón para copiarlo). Lo que el cliente compre por ese enlace descuenta del inventario de ese local, y la tienda le muestra solo lo que hay allí, con el nombre del local arriba. El enlace general usa el **local por defecto** que elijas en Locales.
- **QR por local:** en Inventario eliges "Generar los QR para vender desde" y cada QR del producto lleva el local.
- **Pedido desde el panel:** al crear un pedido para un cliente eliges de qué local sale.
- **Ventas por local:** en Locales, una tabla con los pedidos, unidades, ventas, ganancia y lo que falta por cobrar de cada local (hoy, este mes o todo el tiempo). El informe del día también las separa por local.
- Si anulas un pedido, la mercancía vuelve al local de donde salió.

## Ventanas emergentes en baraja

Si tienes **más de una** ventana de propaganda vigente, el cliente las ve como una **baraja**: las cartas apiladas, una tras otra. Se pasa a la siguiente deslizando con el dedo, con las flechas ‹ › o con el teclado; los puntos y el contador (2 / 4) muestran cuántas hay. La tienda recibe hasta **6** vigentes, de la más nueva a la más vieja. Cada carta respeta su propia frecuencia (una vez al día, cada vez, o una sola vez). Con una sola ventana se ve como antes. En **Más → Ventana emergente de propaganda**, el botón **Ver la baraja** te muestra cómo quedan todas las vigentes.

## Encuestas con premio

En `/admin.html` → **Juegos 🎮 → Encuestas** armas preguntas cortas (hasta 6): **elegir una opción**, **estrellas de 1 a 5** o **texto libre**. Pones el premio por participar, los **pedidos mínimos** para poder responder (esto anima a pedir por la página: "haz 2 pedidos más para responder"), el local y las fechas. Cada cliente responde **una sola vez**. En **Resultados** ves los porcentajes por opción, el promedio de estrellas y los comentarios con el nombre de quien los escribió.

## Juegos y ruleta

En **Juegos 🎮 → Juegos** publicas un juego para tus clientes. Hay tres:
- 🥤 **¿Dónde está la mascota?** Los vasos se mezclan y hay que adivinar bajo cuál quedó la mascota.
- 🃏 **Memoria.** Encontrar las 6 parejas con pocos movimientos.
- 🐾 **Atrapa a la mascota.** Tocarla las veces necesarias en 15 segundos.

Eliges la **dificultad**, el **premio**, cuántas personas ganan en la ruleta (**1, 2 o 3**), los **intentos** por cliente, los **pedidos mínimos** para jugar, una **encuesta para responder después de jugar** (opcional), el local y las fechas. El cliente juega desde **☰ → Juegos y premios** o desde el aviso amarillo de la tienda.

En **Ruleta 🎡** eliges el juego (o una encuesta), decides si entran **solo los que ganaron** y **solo los que respondieron la encuesta**, y giras. El **servidor** escoge al azar a los ganadores, la rueda solo lo muestra, y queda anotado en **Sorteos hechos**, donde marcas cada premio como **entregado**. Quien ya ganó en un juego no vuelve a entrar en su siguiente giro. El cliente ve un aviso **"¡Ganaste en la ruleta!"** la próxima vez que abre la tienda, y sus premios en el panel de juegos.

**Seguridad:** en los vasos el servidor decide cómo se mezcla y revisa la respuesta; en memoria y atrapa revisa que el resultado sea posible (tiempo, movimientos y toques). Aun así, ganar un juego solo da entrada a la ruleta: el ganador final lo decide el azar del servidor.

## Avatar del cliente

Cuando el cliente elige su nombre, aparece su avatar con el botón **Elegir avatar**. Puede escoger entre 58 imágenes (caras, animales, comida, deportes…) y un color de fondo. Se guarda en su perfil y lo ves en el panel junto a su nombre. Si tú le pones una foto o un avatar en **Clientes**, el tuyo se usa primero.

## La mascota se mueve por toda la pantalla

La mascota ya no está anclada: el cliente la **arrastra con el dedo o el mouse** a cualquier lugar y la tienda recuerda dónde la dejó en ese teléfono. Un toque sin arrastrar la hace hablar como siempre. El globo de texto cambia de lado según dónde esté para no salirse de la pantalla. En el menú lateral hay un botón **Mascota: volver a su lugar**.

Tú decides dónde aparece al principio: en `/admin.html` → **Más → Mascota de la tienda → Dónde aparece la mascota**, arrastra la mascota dentro de la pantalla de ejemplo y pulsa **Guardar posición**. También puedes quitar la casilla **Los clientes pueden mover la mascota** si prefieres dejarla fija en el lugar que elegiste.

## Ventana emergente de propaganda

En **Más → Ventana emergente de propaganda 📣** creas una ventana que sale sobre la tienda cuando el cliente entra. Puede llevar título, texto, una **imagen**, un **video** o un enlace de **YouTube**, y un botón que abre un producto, abre un enlace o solo cierra. Eliges en qué local sale (o en todos), **cuántas veces** (una vez al día por cliente, cada vez que entra, o una sola vez) y fechas opcionales de inicio y fin. **Vista previa** te muestra cómo la verá el cliente. Cada ventana se puede pausar, activar o quitar. Si hay varias vigentes, sale la más reciente.

## Qué ve cada local

En `/admin.html` → **Locales → Qué ve cada local**: una tabla con tus productos en filas y tus locales en columnas. Marca los productos que cada local puede mostrar y vender, y quita la marca de los que no. Los botones ✔ y ✖ de cada columna muestran u ocultan todos los productos de ese local.

Un producto oculto en un local **no aparece en la tienda de ese local, no se puede comprar allí (ni con su QR) y sus promociones tampoco se muestran**. Su existencia no cambia, y los demás locales lo siguen viendo. En **Inventario**, cada producto avisa en qué locales no se ve, y al crear un pedido desde el panel solo se ofrece lo que ese local puede vender. Los productos nuevos se ven en todos los locales hasta que los ocultes.

## Corregir un precio mal cargado

En **Inventario**, el botón **Cambiar precio** de cada producto tiene dos opciones:
- **Cambiar desde ahora:** el precio nuevo vale para los pedidos futuros. Los anteriores conservan el suyo.
- **Corregir un error de carga:** además arregla los **pedidos pendientes que todavía no tienen ningún pago**, hechos desde la fecha que elijas. Antes de guardar ves cuántos pedidos se corregirán, cuánto cambia lo que deben tus clientes y cuántos no se tocan por tener pagos. Pide motivo y una justificación obligatoria.

Los pedidos que ya tienen pagos conservan el monto cobrado, para que lo registrado coincida con el dinero que entró.

## Corregir una compra a proveedor mal digitada

En **Inventario → Compra a proveedor → Últimas compras**, cada compra tiene un botón **Corregir**. Escribes el total correcto de la factura y el sistema te muestra el costo por unidad que resulta. Con la casilla marcada, también corrige el **costo del producto** y el **costo de sus ventas desde la fecha que elijas**, para que tus **ganancias** queden bien. Pide motivo, justificación obligatoria y una foto opcional. Si hubo otras compras correctas después de la errónea, elige una fecha posterior a ellas.

Todo queda anotado en **Inventario → Correcciones de precios y costos**.

## Curva de ventas

En `/admin.html` → **Resumen → Curva de ventas**: una gráfica con el comportamiento día a día. Eliges el **período** (7, 14, 30, 90 días o el mes), qué **mostrar** (ventas, ganancia, unidades o pedidos) y el **local**. La línea punteada es el **período anterior**, para comparar. Al pasar el mouse o el dedo por la curva ves el detalle de cada día. Debajo: total, promedio por día, comparación con el período anterior, mejor y peor día, días con ventas, y el promedio por día de la semana (para saber cuál es tu mejor día). No incluye los pedidos anteriores al sistema.

## Cambiar el nombre de un producto

En **Inventario**, el botón **Cambiar nombre** de cada producto pide el nombre nuevo, un **motivo** y una **justificación obligatoria**. El cambio queda anotado en **Inventario → Cambios de nombre** y se aplica también a las ventas, compras y pérdidas de ese producto, para que tus reportes no se separen en dos nombres. Ya no se puede cambiar un nombre de otra forma.

## Menú lateral de la tienda

El comprador ve un botón ☰ (en el celular) o un menú fijo a la izquierda (en computadora) con las **secciones**: los grupos que creaste, o si no tienes grupos, Bebidas, Snacks, Comidas y Otros según la categoría de cada producto. Al elegir una sección salen solo sus productos. "Todos los productos" los muestra agrupados por sección. El menú también lleva a Promociones, Mi cuenta y Sugerencias y reclamos.

## Inventario por día

En `/admin.html` → **Locales → Inventario por día**: eliges un rango de fechas y un local (o todos) y ves, por producto, cómo **empezó** el primer día, lo que **entró**, lo que se **vendió**, lo que se **perdió**, los **traslados** y cómo **terminó** el último día. Hay atajos para hoy, ayer, los últimos 7 días y el mes. El registro empieza el día que instalas `supabase_v15.sql`: para fechas anteriores el sistema te avisa que las cifras de "Empezó" pueden no ser exactas.

## Personalizar cada local

En **Locales → Personalizar** (cada local, incluida la casa madre, tiene su botón): **nombre que ve el cliente**, **eslogan**, **logo**, **imagen de portada** y **colores** del encabezado y de los botones, con vista previa. La tienda aplica la marca del local por cuyo enlace entra el cliente. Si no personalizas nada, se ve como siempre.

## Promociones con video

En **Más → Promociones**: además de la imagen, puedes **subir un video** (hasta 50 MB; mejor corto, de 15 a 30 segundos) o pegar un **enlace de YouTube**, y elegir si se muestra **en todos los locales** o solo en uno. Si hay varias promociones, **pasan solas** cada pocos segundos; se detienen un rato si el cliente las toca. Los videos subidos se reproducen sin sonido solo cuando se ven en pantalla.

## Grupos de productos

En **Inventario → Grupos de productos** creas los grupos que quieras (Sodas, Snacks, Dulces…), los ordenas con ▲ ▼ y asignas cada producto a uno desde su tarjeta. En la tienda aparecen como botones para filtrar ("Todos", cada grupo y "Otros" para lo que no tiene grupo).

## Sugerencias y reclamos

Los clientes tienen en la tienda el botón **Escribir un mensaje**: eligen si es una sugerencia o un reclamo, escriben, y pueden dejar un teléfono o correo. Tú los ves en la pestaña **Buzón** (con el número de mensajes nuevos), y puedes ponerlos **en revisión**, **resolverlos** y dejar una nota.

## Pérdidas de inventario

En `/admin.html` → **Inventario → Registrar una pérdida** (o el botón **Pérdida** de cada producto):
- Eliges el **local**, el **producto** y la **cantidad**, y ves el **valor al costo** de lo perdido.
- El **motivo** puede ser robo, desaparecido, dañado, vencido u otro. El **comentario es obligatorio**, y puedes subir una **foto** de respaldo.
- La mercancía se descuenta del inventario de ese local y la pérdida queda registrada, sin forma de borrarla después.
- Las pérdidas aparecen en el historial de Inventario, en el **resumen mensual** (columna Pérdidas), en el indicador "Pérdidas del mes" y en el **informe del día**.

## Anular un pago

Al quitar un pago, el sistema pide un **motivo** (duplicado, marcado como pagado por error, monto o cliente equivocado, otro), un **comentario obligatorio** y una **foto de respaldo opcional**. Cada anulación queda guardada en **Cobros → Pagos anulados** y en el perfil del cliente. Los pagos ya no se pueden borrar de otra forma.

## Clientes, premios y tómbola

En `/admin.html` → **Clientes**:
- **Lista:** busca por nombre o número, ve quién debe, el producto favorito de cada uno y los cumpleaños de los próximos 30 días.
- **Perfil de cada cliente:** foto o avatar, contacto (teléfono, correo, redes, cumpleaños, notas), lo que ha comprado, su producto más comprado, cada cuántos días lo compra, cuánto tarda en pagar, sus pagos con el soporte, lo que debe y sus premios. Abajo de cada perfil, sugerencias para accionar.
- **Premios:** creas reglas (cumpleaños, comprar un producto, cliente que más compra, cliente que más compra un producto), pulsas **Ver quién gana** y tú decides a quién premiar. Puedes marcar cada premio como entregado.
- **Tómbola:** eliges el premio y quiénes participan, y el sistema sortea al azar. Registras el resultado y queda en el historial.
- Los datos personales (correo, teléfono, cumpleaños, fotos) están en tablas privadas que solo tú ves. Pide permiso a tus clientes antes de guardarlos.

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
