# CRISS’ STORE

Control de compras e inventario en línea. Sitio estático (sin compilar) con Supabase como base de datos, almacenamiento de fotos y acceso del administrador.

## Archivos

- `index.html`: la aplicación (clientes y administrador).
- `config.js`: URL y llave pública de Supabase.
- `supabase.sql`: tablas, reglas de seguridad y funciones.

## Puesta en marcha

### 1. Supabase (gratis)
1. Crea un proyecto en supabase.com.
2. Ve a **SQL Editor**, pega todo `supabase.sql` y pulsa **Run**.
3. Ve a **Authentication → Users → Add user** y crea tu usuario (correo y contraseña). Ese es el acceso de administrador.
4. Ve a **Authentication → Sign In / Providers** y desactiva el registro público (**Allow new users to sign up**). Así nadie más puede crearse un usuario administrador.
5. Ve a **Project Settings → API**, copia la **Project URL** y la llave **anon public**, y pégalas en `config.js`.

### 2. GitHub
1. Crea un repositorio nuevo y sube estos archivos (`index.html`, `config.js`, `supabase.sql`, `README.md`).

### 3. Vercel
1. En vercel.com pulsa **Add New → Project** e importa el repositorio.
2. **Framework Preset:** Other. Sin comando de compilación ni carpeta de salida.
3. Pulsa **Deploy**. La dirección que te da Vercel es la que abren los clientes.

## Cómo se usa

- **Clientes:** abren la página, eligen su nombre (número de serie C-001 a C-029) y tocan el producto, o escanean el QR de la hoja. Confirman la cantidad y se crea la factura pendiente. Solo ven productos y cantidades, nunca precios.
- **Administrador:** entra con su correo y contraseña. Carga productos con foto, marca y especificación, ve el QR de cada uno para imprimirlo, repone existencia y cobra las cuentas.
- **Alerta de inventario:** cada producto avisa cuando le quedan 2 unidades o menos (se puede cambiar por producto al cargarlo). El aviso muestra marca y especificación para reponer lo mismo.

## Cosas a tener en cuenta

- Los QR llevan la dirección del sitio donde se muestran. Imprime los QR **después** del primer despliegue, abriendo el sitio desde su dirección final de Vercel (o de tu dominio).
- Cualquier persona puede elegir cualquier nombre de la lista. Si quieres que cada cliente tenga un código personal, se puede agregar.
- La llave `anon` es pública a propósito. La protección está en las reglas del archivo `supabase.sql`: los clientes solo pueden ver el catálogo sin precios, registrar retiros y ver su propia cuenta por producto y cantidad.
