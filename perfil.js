/* CRISS’ STORE · Perfil del cliente (foto, pedidos por pagar y cómo pagar) y botones a otras sucursales.
   Solo define funciones: la tienda llama a pfMontar() al arrancar. */
const PF = { pedidos: [], metodos: [] };
const pfq = id => document.getElementById(id);
const pfMoney = n => '$' + Number(n || 0).toFixed(2);
const pfHoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
const pfDdmm = s => { const d = new Date(s + 'T00:00:00'); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };

function pfEstilos() {
  if (pfq('pf-css')) return;
  const st = document.createElement('style'); st.id = 'pf-css';
  st.textContent = `
  .pf-sheet{position:fixed;inset:0;background:rgba(18,38,58,.55);display:flex;align-items:flex-end;justify-content:center;z-index:7}
  .pf-sheet>div{background:#fff;width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:18px;max-height:92vh;overflow:auto}
  .pf-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}.pf-h h2{margin:0}
  .pf-x{width:36px;height:36px;border-radius:50%;border:2px solid var(--ink,#12263a);background:#fff;font-size:20px;cursor:pointer}
  .pf-top{display:flex;gap:14px;align-items:center;margin:8px 0 6px}
  .pf-top .avc{width:92px;height:92px;font-size:48px;background-size:cover;background-position:center}
  .pf-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pf-btns .btn{margin:0}
  .pf-sheet h3{margin:16px 0 6px;font-size:17px}
  .pf-res{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0 10px}
  .pf-res div{background:#f4f6f9;border-radius:12px;padding:10px 6px;text-align:center}
  .pf-res b{display:block;font-size:17px}.pf-res span{font-size:12px;color:#5d6b7a}
  .pf-res .mal{background:#ffe3e3}.pf-res .mal b{color:#c92a2a}
  .pf-ped{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border:2px solid var(--ln,#dde3ea);border-radius:12px;padding:10px;margin:6px 0}
  .pf-ped.venc{border-color:#ffa8a8;background:#fff5f5}
  .pf-ped .mu{font-size:13px}
  .pf-b{display:inline-block;font-size:12px;font-weight:700;border-radius:8px;padding:2px 8px;background:#e9edf2;margin-top:3px}
  .pf-b.mal{background:#ffc9c9;color:#a61e1e}.pf-b.ok{background:#d3f9d8;color:#2b8a3e}.pf-b.hoy{background:#fff3bf;color:#8a5a00}
  .pf-met{border:2px solid var(--ln,#dde3ea);border-radius:14px;padding:12px;margin:8px 0}
  .pf-met img{display:block;max-width:220px;width:100%;margin:8px auto;border-radius:10px}
  .pf-met .tx{white-space:pre-line;background:#f4f6f9;border-radius:10px;padding:10px;margin-top:6px;font-size:15px}
  .suc-card{border:2px solid var(--ink,#12263a);border-radius:14px;background:#fff;padding:12px 14px;margin:12px 0}
  .suc-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.suc-btns .btn{margin:0;text-decoration:none;display:inline-block}`;
  document.head.appendChild(st);
}

/* ---------------- montaje ---------------- */
function pfMontar() {
  pfEstilos();
  const d = document.createElement('div');
  d.innerHTML = `<div id="pfsheet" class="pf-sheet hide"><div>
    <div class="pf-h"><h2>👤 Mi perfil</h2><button class="pf-x" id="pfx" aria-label="Cerrar">×</button></div>
    <div class="pf-top"><div id="pfav" class="avc"></div><div style="min-width:0"><b id="pfnom" style="font-size:19px"></b><div class="mu" id="pfid"></div>
      <div class="pf-btns"><label class="btn sm" style="cursor:pointer">📷 Subir mi foto<input type="file" id="pffoto" accept="image/*" hidden></label>
        <button class="btn sm" id="pfquitar">Quitar foto</button><button class="btn sm" id="pfavatar">Elegir avatar</button></div></div></div>
    <div class="msg" id="pfmsg"></div>
    <h3>💳 Pedidos por pagar</h3><div id="pfresumen"></div><div id="pfpend"></div>
    <button class="btn go" id="pfpagar" style="width:100%;margin-top:6px">Pagar ahora</button>
    <h3>🏦 Cómo pagar</h3><div id="pfmet"></div>
    <details style="margin-top:10px"><summary><b>🧾 Mis últimos pedidos pagados</b></summary><div id="pfpag" style="margin-top:6px"></div></details>
  </div></div>`;
  while (d.firstChild) document.body.appendChild(d.firstChild);
  pfq('pfx').onclick = () => pfq('pfsheet').classList.add('hide');
  pfq('pfsheet').onclick = e => { if (e.target === pfq('pfsheet')) pfq('pfsheet').classList.add('hide'); };
  pfq('pfavatar').onclick = () => { pfq('pfsheet').classList.add('hide'); pfq('avbtn').click(); };
  pfq('pfpagar').onclick = () => { pfq('pfsheet').classList.add('hide'); abrirPago(); };
  pfq('pffoto').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) pfSubirFoto(f); };
  pfq('pfquitar').onclick = pfQuitarFoto;
  pfq('pfsheet').addEventListener('click', async e => {
    const b = e.target.closest('[data-pfcopiar]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.pfcopiar); b.textContent = 'Copiado ✓'; } catch (err) { b.textContent = 'No se pudo copiar'; }
    setTimeout(() => { b.textContent = 'Copiar datos'; }, 1800);
  });
  ['pfbtn', 'pfbtn2'].forEach(i => { const b = pfq(i); if (b) b.onclick = pfAbrir; });
}

/* ---------------- abrir el perfil ---------------- */
async function pfAbrir() {
  const c = pfq('cl').value;
  if (!c) { say('bm', 'Primero elige tu nombre.', true); return; }
  say('pfmsg', ''); pfPintarCabecera(c);
  pfq('pfpend').innerHTML = '<div class="mu">Cargando…</div>'; pfq('pfmet').innerHTML = ''; pfq('pfsheet').classList.remove('hide');
  const [ped, met] = await Promise.all([sb.rpc('mis_pedidos', { p_cliente: c }), pfCargarMetodos(c)]);
  if (ped.error) { pfq('pfpend').innerHTML = '<div class="mu">No se pudieron cargar tus pedidos. Revisa tu internet.</div>'; }
  else { PF.pedidos = ped.data || []; pfPintarPedidos(); }
  pfq('pfmet').innerHTML = pfHtmlMetodos(met.lista);
}
function pfPintarCabecera(c) {
  const chip = pfq('miavc'), el = pfq('pfav');
  pfq('pfnom').textContent = nombreDe(c); pfq('pfid').textContent = c;
  const foto = chip.dataset.foto, av = chip.dataset.av, col = chip.dataset.col;
  el.style.backgroundImage = foto ? `url("${foto}")` : '';
  el.textContent = foto ? '' : (av || (nombreDe(c) || '?').charAt(0).toUpperCase());
  el.style.background = foto ? '' : (av ? (col || '#dde3ea') : '#5d6b7a');
  if (foto) { el.style.backgroundImage = `url("${foto}")`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
  pfq('pfquitar').classList.toggle('hide', !foto);
}

/* ---------------- pedidos por pagar ---------------- */
function pfPintarPedidos() {
  const hoy = pfHoy(), debe = p => Math.max(0, Number(p.monto) - Number(p.pagado || 0));
  const pend = PF.pedidos.filter(p => !p.pagada).sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : a.id - b.id));
  const pag = PF.pedidos.filter(p => p.pagada).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const total = pend.reduce((s, p) => s + debe(p), 0), venc = pend.filter(p => p.vence < hoy).reduce((s, p) => s + debe(p), 0), toca = pend.filter(p => p.vence <= hoy).reduce((s, p) => s + debe(p), 0);
  pfq('pfresumen').innerHTML = pend.length ? `<div class="pf-res"><div><b>${pfMoney(total)}</b><span>Total por pagar</span></div><div class="${toca > 0 ? 'mal' : ''}"><b>${pfMoney(toca)}</b><span>Toca pagar hoy</span></div><div class="${venc > 0 ? 'mal' : ''}"><b>${pfMoney(venc)}</b><span>Vencido</span></div></div>` : '';
  pfq('pfpend').innerHTML = pend.length ? pend.map(p => {
    const v = p.vence, tarde = v < hoy, dias = tarde ? Math.round((new Date(hoy + 'T00:00:00') - new Date(v + 'T00:00:00')) / 86400000) : 0;
    const badge = p.historico ? `<span class="pf-b ${tarde ? 'mal' : ''}">Pedido anterior · pagar el ${pfDdmm(v)}</span>`
      : tarde ? `<span class="pf-b mal">Vencido hace ${dias} día${dias === 1 ? '' : 's'}</span>`
      : v === hoy ? '<span class="pf-b hoy">Toca pagar hoy</span>'
      : p.modalidad === 'inmediato' ? '<span class="pf-b hoy">Pago inmediato</span>' : `<span class="pf-b">Pagar el ${pfDdmm(v)}</span>`;
    const parcial = Number(p.pagado) > 0 ? `<div class="mu">Ya abonaste ${pfMoney(p.pagado)} de ${pfMoney(p.monto)}</div>` : '';
    return `<div class="pf-ped ${tarde ? 'venc' : ''}"><div style="min-width:0"><b>${esc(p.producto)} × ${p.cantidad}</b><div class="mu">${esc(p.factura || '')} · pedido del ${pfDdmm(String(p.fecha).slice(0, 10))}</div>${parcial}${badge}</div><b style="white-space:nowrap">${pfMoney(debe(p))}</b></div>`;
  }).join('') : '<div class="jg-ok" style="margin:8px 0;font-weight:700;color:#0b7a75">✅ ¡Estás al día! No tienes pagos pendientes. 🎉</div>';
  pfq('pfpagar').classList.toggle('hide', !pend.length);
  pfq('pfpag').innerHTML = pag.length ? pag.map(p => `<div class="pf-ped"><div style="min-width:0"><b>${esc(p.producto)} × ${p.cantidad}</b><div class="mu">${esc(p.factura || '')} · ${pfDdmm(String(p.fecha).slice(0, 10))}</div></div><b>${pfMoney(p.monto)}</b></div>`).join('') : '<div class="mu">Todavía no tienes pedidos pagados.</div>';
}

/* ---------------- métodos de pago ---------------- */
// Devuelve { lista, propios }: los métodos que definió el administrador o, si no hay, el QR y la cuenta de siempre
async function pfCargarMetodos(c, datos) {
  const { data, error } = await sb.rpc('metodos_pago_tienda');
  if (!error && data && data.length) { PF.metodos = data; return { lista: data, propios: true }; }
  let d = datos;
  if (!d) { const r = await sb.rpc('datos_pago', { p_cliente: c }); d = r.data && r.data[0]; }
  const lista = d && (d.texto || d.imagen) ? [{ id: 0, nombre: 'Yappy o cuenta', instrucciones: d.texto, imagen_url: d.imagen }] : [];
  PF.metodos = lista; return { lista, propios: false };
}
function pfHtmlMetodos(lista) {
  if (!lista || !lista.length) return '<div class="mu">Todavía no hay métodos de pago cargados. Pregunta en la tienda cómo pagar.</div>';
  return lista.map(m => `<div class="pf-met"><b>${esc(m.nombre)}</b>${m.imagen_url ? `<img src="${esc(m.imagen_url)}" alt="Código para pagar con ${esc(m.nombre)}">` : ''}
    ${m.instrucciones ? `<div class="tx">${esc(m.instrucciones)}</div><button class="btn sm" data-pfcopiar="${esc(m.instrucciones)}" style="margin-top:6px">Copiar datos</button>` : ''}</div>`).join('');
}

/* ---------------- foto del cliente ---------------- */
async function pfRecortar(file) {
  const bmp = await createImageBitmap(file), lado = Math.min(bmp.width, bmp.height), S = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  cv.getContext('2d').drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, S, S);
  let q = 0.82, url = cv.toDataURL('image/jpeg', q);
  while (url.length > 70000 && q > 0.35) { q -= 0.1; url = cv.toDataURL('image/jpeg', q); }
  return url;
}
async function pfSubirFoto(file) {
  const c = pfq('cl').value; if (!c) return;
  say('pfmsg', 'Guardando tu foto…');
  let url;
  try { url = await pfRecortar(file); } catch (e) { say('pfmsg', 'No se pudo leer esa imagen. Prueba con otra foto.', true); return; }
  const { error } = await sb.rpc('guardar_foto_perfil', { p_cliente: c, p_foto: url });
  const sinFuncion = error && /guardar_foto_perfil/.test(error.message);
  if (error && !sinFuncion) { say('pfmsg', error.message, true); return; }
  try { localStorage.setItem('foto_' + c, url); } catch (e) {}
  say('pfmsg', sinFuncion ? 'Tu foto quedó guardada solo en este teléfono.' : '¡Listo! Tu foto ya está en tu perfil. 📸');
  await cargarAvatar(); pfPintarCabecera(c);
  if (typeof habla === 'function') habla('¡Qué bonita foto, {cliente}! 📸');
}
async function pfQuitarFoto() {
  const c = pfq('cl').value; if (!c) return;
  await sb.rpc('guardar_foto_perfil', { p_cliente: c, p_foto: null });
  try { localStorage.removeItem('foto_' + c); } catch (e) {}
  say('pfmsg', 'Quitaste tu foto.'); await cargarAvatar(); pfPintarCabecera(c);
}

/* ---------------- botones a otras sucursales ---------------- */
let SUC = { lista: [] };
function sucUrl(id) { const u = new URL(location.href); u.searchParams.set('l', id); u.searchParams.delete('p'); return u.pathname + u.search; }
function sucItemsMenu() {
  return SUC.lista.length ? '<div style="height:1px;background:#dde3ea;margin:6px 0"></div>' + SUC.lista.map(s => `<button class="sitem" data-go="suc:${s.destino_id}"><span>📍 ${esc(s.etiqueta)}</span></button>`).join('') : '';
}
async function sucCargar() {
  const { data, error } = await sb.rpc('enlaces_sucursal', { p_sucursal: LOCINFO ? LOCINFO.id : LOCAL });
  SUC.lista = (!error && data) ? data : [];
  let box = pfq('sucbox');
  if (!SUC.lista.length) { if (box) box.remove(); }
  else {
    if (!box) { box = document.createElement('div'); box.id = 'sucbox'; box.className = 'suc-card'; const ref = pfq('jgbanner') || pfq('promos') || pfq('cat'); if (ref && ref.parentNode) ref.parentNode.insertBefore(box, ref.nextSibling); }
    box.innerHTML = `<b>🏬 También puedes pedir en:</b><div class="suc-btns">${SUC.lista.map(s => `<a class="btn" href="${sucUrl(s.destino_id)}">📍 ${esc(s.etiqueta)}</a>`).join('')}</div>`;
  }
  if (typeof cat !== 'undefined' && cat.length) renderMenu(secciones());
}
