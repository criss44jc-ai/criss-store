/* CRISS’ STORE · Baraja de ventanas emergentes (la usan la tienda y el panel del administrador)
   bjMostrar(cartas, { onAccion(carta), onCerrar(), z }) → { cerrar() }
   Cada carta: { titulo, texto, imagen_url, video_url, video_externo, boton_texto, codigo, enlace } */
const bjEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bjYt = u => { const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/.exec(u || ''); return m ? m[1] : ''; };

function bjEstilos() {
  if (document.getElementById('bj-css')) return;
  const st = document.createElement('style'); st.id = 'bj-css';
  st.textContent = `
  .bj-ov{position:fixed;inset:0;background:rgba(18,38,58,.66);display:flex;align-items:center;justify-content:center;padding:18px 16px 26px}
  .bj-wrap{position:relative;width:min(400px,100%)}
  .bj-stack{display:grid;margin-bottom:26px}
  .bj-card{grid-area:1/1;background:#fff;color:#12263a;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,.38);
    transition:transform .35s ease,opacity .35s ease;touch-action:pan-y;max-height:80vh;overflow-y:auto;will-change:transform;user-select:none;-webkit-user-select:none}
  .bj-card img,.bj-card video{width:100%;display:block;max-height:52vh;object-fit:cover;background:#000;pointer-events:none}
  .bj-card video{pointer-events:auto;object-fit:contain}
  .bj-card iframe{width:100%;aspect-ratio:16/9;display:block;border:0}
  .bj-body{padding:16px}
  .bj-body h2{margin:0 0 6px;font-size:21px;line-height:1.2}
  .bj-body p{margin:0 0 12px;font-size:15px;color:#4a5b6c;white-space:pre-line}
  .bj-btn{width:100%;padding:13px;border:0;border-radius:12px;background:#0b7a75;color:#fff;font-size:16px;font-weight:700;cursor:pointer}
  .bj-x{position:absolute;top:-12px;right:-6px;z-index:50;width:40px;height:40px;border-radius:50%;border:2px solid #fff;background:#12263a;color:#fff;font-size:22px;line-height:1;cursor:pointer}
  .bj-multi .bj-stack{margin-bottom:88px}
  .bj-nav{position:absolute;left:0;right:0;bottom:14px;display:flex;align-items:center;justify-content:center;gap:14px;color:#fff;font-size:14px}
  .bj-nav button{width:38px;height:38px;border-radius:50%;border:2px solid #fff;background:rgba(255,255,255,.14);color:#fff;font-size:20px;cursor:pointer;line-height:1}
  .bj-dots{display:flex;gap:6px;align-items:center}
  .bj-dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.45);transition:all .25s}
  .bj-dots i.on{background:#ffd23f;width:20px;border-radius:6px}
  .bj-cnt{min-width:42px;text-align:center}`;
  document.head.appendChild(st);
}

function bjCarta(c) {
  const yt = bjYt(c.video_externo);
  const media = c.video_url ? `<video src="${bjEsc(c.video_url)}" muted loop playsinline controls preload="metadata"></video>`
    : yt ? `<div class="bj-yt" data-yt="${yt}" data-t="${bjEsc(c.titulo)}" style="aspect-ratio:16/9;background:#000"></div>`
    : c.imagen_url ? `<img src="${bjEsc(c.imagen_url)}" alt="" draggable="false">` : '';
  const txtBtn = c.boton_texto || (c.codigo || c.enlace ? 'Ver más' : '');
  return `<div class="bj-card">${media}<div class="bj-body"><h2>${bjEsc(c.titulo)}</h2>${c.texto ? `<p>${bjEsc(c.texto)}</p>` : ''}${txtBtn ? `<button class="bj-btn">${bjEsc(txtBtn)}</button>` : ''}</div></div>`;
}

function bjMostrar(cartas, op) {
  op = op || {}; bjEstilos();
  const previo = document.getElementById('bj-ov'); if (previo) previo.remove();
  const n = cartas.length; if (!n) return { cerrar() {} };
  const ov = document.createElement('div'); ov.id = 'bj-ov'; ov.className = 'bj-ov'; ov.style.zIndex = op.z || 60;
  ov.innerHTML = `<div class="bj-wrap${n > 1 ? ' bj-multi' : ''}"><button class="bj-x" aria-label="Cerrar">×</button>
    <div class="bj-stack">${cartas.map(bjCarta).join('')}</div>
    ${n > 1 ? `<div class="bj-nav"><button data-d="-1" aria-label="Anterior">‹</button><div class="bj-dots">${cartas.map(() => '<i></i>').join('')}</div><span class="bj-cnt"></span><button data-d="1" aria-label="Siguiente">›</button></div>` : ''}</div>`;
  document.body.appendChild(ov);
  const el = [...ov.querySelectorAll('.bj-card')], dots = [...ov.querySelectorAll('.bj-dots i')], cnt = ov.querySelector('.bj-cnt');
  let cur = 0, bloqueado = false, drag = null;

  function pos() {
    el.forEach((c, i) => {
      const r = (i - cur + n) % n;
      if (r === 0) { c.style.transform = 'none'; c.style.opacity = 1; c.style.zIndex = n + 1; c.style.pointerEvents = 'auto'; }
      else if (r <= 2) { c.style.transform = `translateY(${r * 13}px) scale(${1 - r * 0.045}) rotate(${r % 2 ? 2.4 : -2.4}deg)`; c.style.opacity = 1 - r * 0.1; c.style.zIndex = n - r; c.style.pointerEvents = 'none'; }
      else { c.style.transform = 'translateY(32px) scale(.88)'; c.style.opacity = 0; c.style.zIndex = 0; c.style.pointerEvents = 'none'; }
      const v = c.querySelector('video'); if (v) { if (r === 0) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause(); }
      const y = c.querySelector('.bj-yt');                                    // YouTube se carga solo cuando le toca
      if (y && r === 0 && !y.firstChild) y.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${y.dataset.yt}?playsinline=1&rel=0" allow="encrypted-media; picture-in-picture" allowfullscreen title="${bjEsc(y.dataset.t)}"></iframe>`;
      else if (y && r !== 0) y.innerHTML = '';
    });
    dots.forEach((d, i) => d.classList.toggle('on', i === cur));
    if (cnt) cnt.textContent = (cur + 1) + ' / ' + n;
  }
  function ir(dir) {                                                          // dir = 1: pasa la de arriba al fondo; dir = -1: vuelve la anterior
    if (n < 2 || bloqueado) return; bloqueado = true;
    if (dir > 0) {
      const top = el[cur]; top.style.transition = 'transform .28s ease,opacity .28s ease';
      top.style.transform = 'translateX(-125%) rotate(-14deg)'; top.style.opacity = 0;
      setTimeout(() => { top.style.transition = 'none'; cur = (cur + 1) % n; pos(); void top.offsetWidth; top.style.transition = ''; bloqueado = false; }, 290);
    } else { cur = (cur - 1 + n) % n; pos(); setTimeout(() => { bloqueado = false; }, 360); }
  }
  function cerrar() { document.removeEventListener('keydown', tecla); el.forEach(c => { const v = c.querySelector('video'); if (v) v.pause(); }); ov.remove(); if (op.onCerrar) op.onCerrar(); }
  const tecla = e => { if (e.key === 'Escape') cerrar(); else if (e.key === 'ArrowRight') ir(1); else if (e.key === 'ArrowLeft') ir(-1); };
  document.addEventListener('keydown', tecla);

  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('.bj-x')) { cerrar(); return; }
    const d = e.target.closest('[data-d]'); if (d) { ir(Number(d.dataset.d)); return; }
    const b = e.target.closest('.bj-btn'); if (b) { const c = cartas[cur]; cerrar(); if (op.onAccion) op.onAccion(c); }
  });
  // deslizar la carta de arriba con el dedo o el mouse
  const stack = ov.querySelector('.bj-stack');
  stack.addEventListener('pointerdown', e => { if (n < 2 || bloqueado || e.target.closest('video,button')) return; drag = { x: e.clientX, dx: 0, mov: false }; });
  stack.addEventListener('pointermove', e => {
    if (!drag) return; drag.dx = e.clientX - drag.x;
    if (!drag.mov && Math.abs(drag.dx) < 8) return;
    if (!drag.mov) { drag.mov = true; try { stack.setPointerCapture(e.pointerId); } catch (err) {} }
    const top = el[cur]; top.style.transition = 'none'; top.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx / 22}deg)`;
  });
  const soltar = () => {
    if (!drag) return; const d = drag; drag = null; if (!d.mov) return;
    const top = el[cur]; top.style.transition = '';
    if (Math.abs(d.dx) > 70) { top.style.transition = 'transform .28s ease,opacity .28s ease'; bloqueado = true; top.style.transform = `translateX(${d.dx > 0 ? 125 : -125}%) rotate(${d.dx > 0 ? 14 : -14}deg)`; top.style.opacity = 0;
      setTimeout(() => { top.style.transition = 'none'; cur = (cur + 1) % n; pos(); void top.offsetWidth; top.style.transition = ''; bloqueado = false; }, 290); }
    else pos();
  };
  stack.addEventListener('pointerup', soltar); stack.addEventListener('pointercancel', soltar);
  pos();
  return { cerrar };
}
