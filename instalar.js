/* CRISS’ STORE · Instalar como app (Android, iPhone y Mac) y aviso de "sin conexión".
   Se usa en la tienda y en el panel. Cualquier elemento con el atributo data-instalar abre la instalación. */
let instEvento = null;
const instEsApp = () => {
  try {
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) return true;   // app de la tienda de aplicaciones
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch (e) { return false; }
};

// el service worker solo funciona con https (Vercel) o en localhost
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
// Android y Chrome/Edge (Mac y PC) avisan cuando se puede instalar con un toque
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instEvento = e; });
window.addEventListener('appinstalled', () => { instEvento = null; instAviso('✅ ¡App instalada! Búscala en tu pantalla de inicio.'); instOcultar(); });

function instPlataforma() {
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const mac = !ios && /Macintosh/i.test(ua);
  const safari = /safari/i.test(ua) && !/chrome|crios|fxios|edg|opr|android/i.test(ua);
  return { ios, android, mac, safari };
}
async function instInstalar() {
  if (instEsApp()) { instAviso('Ya estás usando la app instalada. 🎉'); return; }
  if (instEvento) {
    const ev = instEvento; instEvento = null; ev.prompt();
    try { await ev.userChoice; } catch (e) {}
    return;
  }
  instAyuda();
}

function instEstilos() {
  if (document.getElementById('in-css')) return;
  const st = document.createElement('style'); st.id = 'in-css';
  st.textContent = `
  .in-ov{position:fixed;inset:0;z-index:70;background:rgba(18,38,58,.62);display:flex;align-items:flex-end;justify-content:center}
  .in-box{background:#fff;color:#12263a;width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:20px 18px calc(env(safe-area-inset-bottom,0px) + 18px);max-height:90vh;overflow:auto;font:16px/1.45 system-ui,-apple-system,sans-serif}
  .in-box h2{margin:0 0 4px;font-size:21px}
  .in-box ol{margin:10px 0 12px;padding-left:22px}.in-box li{margin:8px 0}
  .in-box .in-t{background:#fff8db;border:1px solid #ffd23f;border-radius:10px;padding:10px;font-size:14px}
  .in-box button{width:100%;margin-top:12px;padding:13px;border:0;border-radius:12px;background:#12263a;color:#fff;font-size:16px;font-weight:700;cursor:pointer}
  .in-icono{width:64px;height:64px;border-radius:16px;display:block;margin:0 0 10px}
  #in-aviso{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 24px);transform:translateX(-50%);z-index:80;background:#12263a;color:#fff;padding:12px 18px;border-radius:14px;max-width:90vw;font:15px/1.35 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35)}
  #in-ban{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 104px);z-index:6;width:min(94vw,440px);display:flex;align-items:center;gap:8px;background:#12263a;color:#fff;border-radius:14px;padding:10px 10px 10px 14px;font:14px/1.3 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35)}
  #in-ban span{flex:1}#in-ban button{border:0;border-radius:10px;padding:9px 12px;font-weight:700;font-size:14px;cursor:pointer;background:#ffd23f;color:#12263a}#in-ban #in-ban-x{background:transparent;color:#fff;font-size:20px;padding:4px 8px}
  #in-off{position:fixed;left:0;right:0;top:0;z-index:90;background:#d64045;color:#fff;text-align:center;padding:calc(env(safe-area-inset-top,0px) + 6px) 12px 6px;font:14px/1.3 system-ui,sans-serif}`;
  document.head.appendChild(st);
}
function instAviso(txt) {
  instEstilos();
  let a = document.getElementById('in-aviso'); if (a) a.remove();
  a = document.createElement('div'); a.id = 'in-aviso'; a.textContent = txt; document.body.appendChild(a);
  setTimeout(() => { if (a.parentNode) a.remove(); }, 4500);
}
function instAyuda() {
  instEstilos();
  const p = instPlataforma(), icono = (document.querySelector('link[rel="apple-touch-icon"]') || {}).href || 'mascota.png', nombre = document.title || 'CRISS’ STORE';
  let titulo, pasos, nota = '';
  if (p.ios) {
    titulo = 'Instalar en tu iPhone o iPad';
    pasos = ['Toca el botón <b>Compartir</b> (el cuadrito con una flecha hacia arriba) en la barra de Safari.', 'Baja y toca <b>Agregar a pantalla de inicio</b>.', 'Toca <b>Agregar</b>. ¡Listo! Ábrela desde su ícono.'];
    if (!p.safari) nota = 'Si no ves esa opción, abre esta misma página en <b>Safari</b> y repite los pasos.';
  } else if (p.android) {
    titulo = 'Instalar en tu Android';
    pasos = ['Toca el menú <b>⋮</b> de tu navegador (arriba a la derecha).', 'Toca <b>Instalar aplicación</b> (o <b>Agregar a la pantalla de inicio</b>).', 'Toca <b>Instalar</b>. ¡Listo! Ábrela desde su ícono.'];
    nota = 'Funciona mejor con <b>Chrome</b>.';
  } else if (p.mac && p.safari) {
    titulo = 'Instalar en tu Mac';
    pasos = ['En la barra de menús de Safari, abre <b>Archivo</b>.', 'Elige <b>Agregar al Dock…</b>.', 'Toca <b>Agregar</b>. Se abrirá como una app, con su propio ícono.'];
    nota = 'Requiere macOS Sonoma o más nuevo. En versiones anteriores usa Chrome.';
  } else {
    titulo = p.mac ? 'Instalar en tu Mac' : 'Instalar en tu computadora';
    pasos = ['Busca el ícono de <b>instalar ⊕</b> al final de la barra de direcciones, o abre el menú <b>⋮</b>.', 'Elige <b>Instalar ' + nombre.replace(/</g, '') + '</b>.', 'Confirma con <b>Instalar</b>. Se abrirá como una app, con su propio ícono.'];
    nota = 'Funciona con Chrome y Edge.';
  }
  const ov = document.createElement('div'); ov.className = 'in-ov';
  ov.innerHTML = `<div class="in-box"><img class="in-icono" src="${icono}" alt=""><h2>${titulo}</h2><div class="mu">Se abre en pantalla completa, con su ícono, como cualquier app.</div>
    <ol>${pasos.map(x => `<li>${x}</li>`).join('')}</ol>${nota ? `<div class="in-t">${nota}</div>` : ''}<button type="button">Entendido</button></div>`;
  ov.onclick = e => { if (e.target === ov || e.target.tagName === 'BUTTON') ov.remove(); };
  document.body.appendChild(ov);
}

// aviso discreto (solo en la tienda): invita a instalar y no vuelve a salir por 14 días si lo cierran
function instBanner() {
  if (!document.body || !document.body.hasAttribute('data-instalar-banner') || instEsApp() || document.getElementById('in-ban')) return;
  const p = instPlataforma(); if (!instEvento && !p.ios) return;      // Android/PC: solo si el navegador permite instalar; iPhone: se muestran los pasos
  try { if (Date.now() < Number(localStorage.getItem('inst_banner_hasta') || 0)) return; } catch (e) {}
  instEstilos();
  const b = document.createElement('div'); b.id = 'in-ban';
  b.innerHTML = '<span>📲 <b>Instala la app</b> y abre la tienda con un toque</span><button type="button" data-instalar>Instalar</button><button type="button" id="in-ban-x" aria-label="Cerrar">×</button>';
  document.body.appendChild(b);
  const ocultar = dias => { b.remove(); try { localStorage.setItem('inst_banner_hasta', String(Date.now() + dias * 86400000)); } catch (e) {} };
  b.querySelector('#in-ban-x').onclick = () => ocultar(14);
  b.querySelector('[data-instalar]').addEventListener('click', () => ocultar(7));
}
window.addEventListener('beforeinstallprompt', () => setTimeout(instBanner, 8000));
window.addEventListener('load', () => { if (instPlataforma().ios) setTimeout(instBanner, 10000); });

// los botones "Instalar" se esconden si ya estás dentro de la app
function instOcultar() { document.querySelectorAll('[data-instalar-oculto]').forEach(x => x.classList.toggle('hide', instEsApp())); }
document.addEventListener('click', e => { if (e.target.closest('[data-instalar]')) instInstalar(); });
document.addEventListener('DOMContentLoaded', instOcultar);

// aviso cuando se cae el internet
function instRed() {
  if (!document.body) return;
  instEstilos();
  let b = document.getElementById('in-off');
  if (!b) { b = document.createElement('div'); b.id = 'in-off'; b.textContent = '📡 Sin conexión: algunas cosas no funcionarán hasta que vuelva el internet.'; document.body.appendChild(b); }
  b.style.display = navigator.onLine ? 'none' : 'block';
}
window.addEventListener('online', instRed); window.addEventListener('offline', instRed); document.addEventListener('DOMContentLoaded', instRed);
