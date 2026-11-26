# CRISS’ STORE como app en el celular y en la Mac

Tu tienda y tu panel ya se pueden **instalar como app** en **Android, iPhone y Mac**, sin pasar por ninguna tienda de aplicaciones y sin pagar nada. Quedan con su propio ícono, se abren en pantalla completa (sin la barra del navegador) y abren aunque el internet se caiga un momento. Se actualizan solas cada vez que subes cambios a GitHub.

## Cómo instalar la tienda (lo que haces tú y lo que le dices a tus clientes)

Abre el enlace de tu tienda (el de Vercel) en el celular o la Mac:

| Aparato | Cómo se instala |
|---|---|
| **Android** (Chrome) | Sale solo un aviso amarillo **“Instala la app”** abajo; tócalo y luego **Instalar**. Si no sale: menú **⋮** → **Instalar aplicación**. |
| **iPhone / iPad** (Safari) | Toca **Compartir** (el cuadrito con la flecha) → **Agregar a pantalla de inicio** → **Agregar**. En iPhone **siempre** son esos pasos: Apple no permite instalarla con un solo botón. |
| **Mac** (Safari 17 o más nuevo) | Menú **Archivo** → **Agregar al Dock…** |
| **Mac o PC** (Chrome o Edge) | Ícono **⊕** al final de la barra de direcciones → **Instalar**. |

Dentro de la tienda también hay un botón **☰ → 📲 Instalar la app** que te muestra los pasos exactos para tu aparato.

## Cómo instalar el panel del administrador

Abre `tu-sitio.vercel.app/admin.html`, inicia sesión y entra a **Más → 📲 Instalar el panel como app**. Es una app aparte (“CRISS’ Admin”) con un ícono azul, para que no la confundas con la de los clientes.

## Detalles útiles

- **Locales (sucursales):** si compartes el enlace de un local (`?l=2`), quien instale la app desde ese enlace la verá siempre con ese local.
- **Sin internet:** la app abre y avisa “Sin conexión”, pero para pedir, ver precios, jugar o ver tus datos necesita internet.
- **Cámara (escanear QR):** pide permiso la primera vez. Funciona en Android y en iPhone 14.5 o más nuevo.
- **Actualizaciones:** subes los archivos a GitHub y, cuando Vercel dice **Ready**, la app se actualiza sola la próxima vez que se abre con internet.
- **iPhone:** la app instalada guarda sus datos aparte de Safari (por ejemplo, tendrá que elegir su nombre otra vez).

## Archivos nuevos que debes subir a GitHub

`manifest.webmanifest`, `manifest-admin.webmanifest`, `sw.js`, `instalar.js`, `vercel.json`, y los íconos `icono-192.png`, `icono-512.png`, `icono-maskable-512.png`, `apple-touch-icon.png`, `icono-admin-192.png`, `icono-admin-512.png`, `icono-admin-maskable-512.png`, `apple-touch-icon-admin.png`. Cambiaron `index.html` y `admin.html`. **No subas `config.js`.**

## ¿Y publicarla en Google Play o en la App Store?

Es posible, pero **no es necesario** para tener una app y tiene costo y trabajo:

| | Google Play | App Store (Apple) |
|---|---|---|
| Costo | $25 una sola vez | $99 al año |
| Qué necesitas | Una computadora cualquiera | Una **Mac** con Xcode |
| Dificultad | Media | Alta |
| Riesgo | Bajo | Apple puede rechazar apps que son solo una página web empaquetada |

- **Camino más fácil para Android:** entrar a **pwabuilder.com**, pegar el enlace de tu tienda y descargar el paquete para Google Play.
- **Camino con más control (Android e iPhone):** la carpeta **`app-nativa`** (en `criss-store-app-nativa.zip`) trae una plantilla lista con Capacitor; su `GUIA-APP-NATIVA.md` explica los pasos.
- Para ambas tiendas necesitarás una **política de privacidad** publicada (pides nombre y contacto a tus clientes). Como vendes productos físicos, no tienes que usar los pagos de Apple ni de Google: tu Yappy sigue igual.

Mi recomendación: empieza con la instalación directa (gratis, ya funciona) y publica en las tiendas solo si luego lo necesitas para que te encuentren ahí.
