/* CRISS’ STORE · Service worker: hace que la página se instale como app y abra aunque falle el internet un momento.
   - Páginas y programas (html, js, css): primero la red, así siempre ves lo más nuevo; si no hay red, usa la copia guardada.
   - Imágenes y librerías con versión fija: primero la copia guardada (rápido).
   - Supabase, YouTube y todo lo demás: siempre directo a internet (los datos nunca se guardan aquí). */
const VERSION = 'v1';
const CACHE = 'criss-' + VERSION;
const BASE = ['./', 'index.html', 'admin.html', 'config.js', 'baraja.js', 'juegos.js', 'perfil.js', 'instalar.js', 'mascota.js', 'mascota-pixel.js',
  'mascota.png', 'mascota-pixel-reposo.gif', 'mascota-pixel-alegre.gif', 'mascota-pixel-canta.gif', 'mascota-pixel-asoma.gif',
  'manifest.webmanifest', 'manifest-admin.webmanifest', 'icono-192.png', 'icono-admin-192.png',
  'admin.js', 'admin2.js', 'admin3.js', 'admin4.js', 'admin5.js', 'admin6.js', 'admin7.js', 'admin8.js', 'admin9.js', 'admin10.js', 'admin11.js', 'admin12.js'];
const CDN = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(BASE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('criss-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    if (CDN.includes(url.hostname)) e.respondWith(primeroGuardado(req));
    return;
  }
  if (/\.(png|gif|jpe?g|svg|webp|ico|woff2?)$/i.test(url.pathname)) { e.respondWith(primeroGuardado(req)); return; }
  e.respondWith(primeroRed(req));
});
async function primeroRed(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const inicio = await caches.match('index.html'); if (inicio) return inicio; }
    throw err;
  }
}
async function primeroGuardado(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
  return res;
}
