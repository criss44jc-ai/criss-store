/* CRISS’ STORE · Administrador (parte 4): casa madre, sucursales y traslados con autorización */
let locales = [], stockSuc = [], traslados = [], lineasTr = [];
const FALTA12 = '<div class="mu">Falta ejecutar supabase_v12.sql en Supabase.</div>';
const madre = () => locales.find(l => l.es_madre);
const nomLocal = id => (locales.find(l => l.id == id) || {}).nombre || 'Local ' + id;
const nomProd = id => (prods.find(p => p.id == id) || {}).nombre || 'Producto ' + id;
const enSuc = (sid, pid) => { const r = stockSuc.find(x => x.sucursal_id == sid && x.producto_id == pid); return r ? Number(r.cantidad) : 0; };
// existencia de un producto en un local (la casa madre usa la existencia principal del inventario)
const disponibleEn = (lid, pid) => { const m = madre(); return m && lid == m.id ? Number((prods.find(p => p.id == pid) || {}).stock || 0) : enSuc(lid, pid); };

async function loadLocales() {
  const [s, st, t] = await Promise.all([
    sb.from('sucursales').select('*').eq('activa', true).order('id'),
    sb.from('stock_sucursal').select('*'),
    sb.from('traslados').select('*, traslado_items(producto_id, cantidad)').order('id', { ascending: false }).limit(40)
  ]);
  if (s.error) { $('locl').innerHTML = FALTA12; return; }
  locales = (s.data || []).sort((a, b) => (b.es_madre ? 1 : 0) - (a.es_madre ? 1 : 0) || a.id - b.id);
  stockSuc = st.data || []; traslados = t.data || [];
  renderLocales(); renderInventarioLocales(); llenarTraslado(); renderTraslados();
}

/* ---------- Mis locales ---------- */
function renderLocales() {
  $('locl').innerHTML = locales.map(l => `
    <div class="line"><div><b>${esc(l.nombre)}</b> ${l.es_madre ? '<span class="badge gold">Casa madre</span>' : '<span class="badge">Sucursal</span>'}</div>
      <div style="display:flex;gap:6px"><button class="btn sm" data-ren="${l.id}">Renombrar</button>${l.es_madre ? '' : `<button class="btn sm red" data-qui="${l.id}">Quitar</button>`}</div></div>`).join('');
}
$('locl').onclick = async e => {
  const r = e.target.closest('[data-ren]'), q = e.target.closest('[data-qui]');
  if (r) {
    const l = locales.find(x => x.id == r.dataset.ren), n = prompt('Nuevo nombre:', l.nombre);
    if (n === null || !n.trim()) return;
    const { error } = await sb.from('sucursales').update({ nombre: n.trim() }).eq('id', l.id);
    if (error) { alert('No se pudo cambiar: ' + error.message); return; }
    loadLocales();
  }
  if (q) {
    const l = locales.find(x => x.id == q.dataset.qui);
    if (stockSuc.some(x => x.sucursal_id == l.id && Number(x.cantidad) > 0)) { alert(`${l.nombre} todavía tiene mercancía. Devuélvela primero a la casa madre con un traslado.`); return; }
    if (traslados.some(t => t.estado === 'pendiente' && (t.origen_id == l.id || t.destino_id == l.id))) { alert(`${l.nombre} tiene traslados pendientes. Resuélvelos primero.`); return; }
    if (!confirm(`¿Quitar ${l.nombre}?`)) return;
    await sb.from('sucursales').update({ activa: false }).eq('id', l.id); loadLocales();
  }
};
$('locadd').onclick = async () => {
  const n = $('locn').value.trim();
  if (!n) { say('locmsg', 'Escribe el nombre de la sucursal.', true); return; }
  const { error } = await sb.from('sucursales').insert({ nombre: n });
  if (error) { say('locmsg', 'No se pudo agregar: ' + error.message, true); return; }
  $('locn').value = ''; say('locmsg', `${n} agregada.`); loadLocales();
};

/* ---------- Inventario por local ---------- */
function renderInventarioLocales() {
  const m = madre(), sucs = locales.filter(l => !l.es_madre);
  if (!m) { $('locinv').innerHTML = FALTA12; return; }
  if (!prods.length) { $('locinv').innerHTML = '<div class="mu">Aún no hay productos.</div>'; return; }
  $('locinv').innerHTML = `<table class="mtab"><tr><th>Producto</th><th>${esc(m.nombre)}</th>${sucs.map(s => `<th>${esc(s.nombre)}</th>`).join('')}<th>Total</th></tr>` +
    prods.map(p => {
      const v = sucs.map(s => enSuc(s.id, p.id)), tot = Number(p.stock) + v.reduce((a, b) => a + b, 0);
      return `<tr><td>${esc(p.nombre)}</td><td>${p.stock}</td>${v.map(x => `<td>${x}</td>`).join('')}<td><b>${tot}</b></td></tr>`;
    }).join('') + '</table>' +
    '<div class="mu" style="margin-top:8px">La tienda en línea descuenta de la casa madre. Total = suma de todos los locales.</div>';
}

/* ---------- Nuevo traslado ---------- */
function llenarTraslado() {
  const o = locales.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join(''), m = madre();
  const vo = $('tro').value, vd = $('trd').value;
  $('tro').innerHTML = o; $('trd').innerHTML = o;
  $('tro').value = vo && locales.some(l => l.id == vo) ? vo : (m ? m.id : '');
  const primeraSuc = locales.find(l => !l.es_madre);
  $('trd').value = vd && locales.some(l => l.id == vd) ? vd : (primeraSuc ? primeraSuc.id : '');
  llenarProductosTraslado(); renderLineas();
}
function llenarProductosTraslado() {
  const lid = $('tro').value, v = $('trp').value;
  $('trp').innerHTML = prods.map(p => `<option value="${p.id}">${esc(p.nombre)} (hay ${disponibleEn(lid, p.id)})</option>`).join('');
  if (v) $('trp').value = v;
}
$('tro').onchange = () => { lineasTr = []; llenarProductosTraslado(); renderLineas(); };
function renderLineas() {
  $('trlista').innerHTML = lineasTr.length ? lineasTr.map((l, i) => `<div class="line"><span>${l.q} × ${esc(nomProd(l.pid))}</span><button class="btn sm red" data-trq="${i}">Quitar</button></div>`).join('') : '';
}
$('tradd').onclick = () => {
  const pid = Number($('trp').value), q = parseInt($('trq').value, 10), lid = $('tro').value;
  if (!pid || !(q > 0)) { say('trmsg', 'Elige el producto y la cantidad.', true); return; }
  const ya = lineasTr.filter(l => l.pid === pid).reduce((s, l) => s + l.q, 0);
  if (ya + q > disponibleEn(lid, pid)) { say('trmsg', `En ${nomLocal(lid)} solo hay ${disponibleEn(lid, pid)} de ${nomProd(pid)}.`, true); return; }
  const ex = lineasTr.find(l => l.pid === pid); if (ex) ex.q += q; else lineasTr.push({ pid, q });
  say('trmsg', ''); $('trq').value = 1; renderLineas();
};
$('trlista').onclick = e => { const b = e.target.closest('[data-trq]'); if (b) { lineasTr.splice(Number(b.dataset.trq), 1); renderLineas(); } };
$('trenv').onclick = async () => {
  const o = Number($('tro').value), d = Number($('trd').value);
  if (!o || !d || o === d) { say('trmsg', 'Elige un origen y un destino distintos.', true); return; }
  if (!lineasTr.length) { say('trmsg', 'Agrega al menos un producto a la lista.', true); return; }
  $('trenv').disabled = true;
  const { error } = await sb.rpc('crear_traslado', { p_origen: o, p_destino: d, p_items: lineasTr.map(l => ({ producto_id: l.pid, cantidad: l.q })), p_nota: $('trn').value.trim() || null });
  $('trenv').disabled = false;
  if (error) { say('trmsg', /crear_traslado/.test(error.message) ? 'Falta ejecutar supabase_v12.sql en Supabase.' : error.message, true); return; }
  lineasTr = []; $('trn').value = ''; say('trmsg', 'Enviado. Queda pendiente hasta que la casa madre lo autorice.');
  loadLocales();
};

/* ---------- Autorización y recientes ---------- */
const itemsTxt = t => (t.traslado_items || []).map(i => `${i.cantidad} × ${nomProd(i.producto_id)}`).join(', ');
function renderTraslados() {
  const m = madre(), pend = traslados.filter(t => t.estado === 'pendiente'), rec = traslados.filter(t => t.estado !== 'pendiente').slice(0, 12);
  $('trpend').innerHTML = pend.length ? pend.map(t => `
    <div class="line" style="align-items:flex-start"><div><b>${esc(nomLocal(t.origen_id))} → ${esc(nomLocal(t.destino_id))}</b>
      <div>${esc(itemsTxt(t))}</div><div class="mu">${fdate(t.creado)}${t.nota ? ' · ' + esc(t.nota) : ''}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn sm" style="background:#0b7a75;color:#fff;border-color:#0b7a75" data-tra="${t.id}">✅ Autorizar${m ? ' (' + esc(m.nombre) + ')' : ''}</button><button class="btn sm red" data-trr="${t.id}">Rechazar</button></div></div>`).join('')
    : '<div class="mu">No hay traslados esperando autorización.</div>';
  $('trrec').innerHTML = rec.length ? rec.map(t => `
    <div class="line" style="align-items:flex-start"><div><b>${esc(nomLocal(t.origen_id))} → ${esc(nomLocal(t.destino_id))}</b>
      <div>${esc(itemsTxt(t))}</div><div class="mu">${fdate(t.resuelto_en || t.creado)}${t.nota ? ' · ' + esc(t.nota) : ''}${t.motivo ? ' · Motivo: ' + esc(t.motivo) : ''}</div></div>
      <span class="badge ${t.estado === 'autorizado' ? 'ok' : 'mal'}">${t.estado === 'autorizado' ? 'Autorizado' : 'Rechazado'}</span></div>`).join('')
    : '<div class="mu">Todavía no hay traslados resueltos.</div>';
}
$('trpend').onclick = async e => {
  const a = e.target.closest('[data-tra]'), r = e.target.closest('[data-trr]');
  if (a) {
    const t = traslados.find(x => x.id == a.dataset.tra);
    if (!confirm(`¿Autorizar este traslado?\n\n${nomLocal(t.origen_id)} → ${nomLocal(t.destino_id)}\n${itemsTxt(t)}\n\nLa existencia se moverá ahora.`)) return;
    a.disabled = true;
    const { error } = await sb.rpc('autorizar_traslado', { p_id: t.id });
    if (error) { alert(error.message); a.disabled = false; return; }
    await loadAll(); loadLocales();
  }
  if (r) {
    const motivo = prompt('¿Por qué lo rechazas? (opcional)');
    if (motivo === null) return;
    const { error } = await sb.rpc('rechazar_traslado', { p_id: Number(r.dataset.trr), p_motivo: motivo.trim() || null });
    if (error) { alert(error.message); return; }
    loadLocales();
  }
};
