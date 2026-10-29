/* CRISS’ STORE · Administrador (parte 4): casa madre, sucursales y traslados con autorización */
let locales = [], stockSuc = [], traslados = [], lineasTr = [], localVenta = '';
const FALTA12 = '<div class="mu">Falta ejecutar supabase_v12.sql en Supabase.</div>';
const madre = () => locales.find(l => l.es_madre);
const nomLocal = id => (locales.find(l => l.id == id) || {}).nombre || 'Local ' + id;
const nomProd = id => (prods.find(p => p.id == id) || {}).nombre || 'Producto ' + id;
const enSuc = (sid, pid) => { const r = stockSuc.find(x => x.sucursal_id == sid && x.producto_id == pid); return r ? Number(r.cantidad) : 0; };
// existencia de un producto en un local (la casa madre usa la existencia principal del inventario)
const disponibleEn = (lid, pid) => { const m = madre(); return m && lid == m.id ? Number((prods.find(p => p.id == pid) || {}).stock || 0) : enSuc(lid, pid); };

async function loadLocales() {
  const [s, st, t, lv] = await Promise.all([
    sb.from('sucursales').select('*').eq('activa', true).order('id'),
    sb.from('stock_sucursal').select('*'),
    sb.from('traslados').select('*, traslado_items(producto_id, cantidad)').order('id', { ascending: false }).limit(40),
    sb.from('ajustes').select('*').eq('clave', 'local_venta')
  ]);
  if (s.error) { $('locl').innerHTML = FALTA12; return; }
  locales = (s.data || []).sort((a, b) => (b.es_madre ? 1 : 0) - (a.es_madre ? 1 : 0) || a.id - b.id);
  stockSuc = st.data || []; traslados = t.data || [];
  localVenta = (lv.data && lv.data[0] && lv.data[0].valor) || '';
  renderLocales(); renderInventarioLocales(); llenarTraslado(); renderTraslados(); llenarSelectorVenta(); loadVentasLocal();
}

/* ---------- Mis locales ---------- */
function renderLocales() {
  $('locl').innerHTML = locales.map(l => `
    <div class="line" style="align-items:flex-start"><div><b>${esc(l.nombre)}</b> ${l.es_madre ? '<span class="badge gold">Casa madre</span>' : '<span class="badge">Sucursal</span>'}
        ${String(localVenta) === String(l.id) || (!localVenta && l.es_madre) ? '<span class="badge ok">Vende en línea por defecto</span>' : ''}
        <div class="mu" style="word-break:break-all;margin-top:2px">Enlace de venta: ${esc(urlLocal(l.id))}</div>
        <button class="btn sm" style="margin-top:4px" data-cpl="${esc(urlLocal(l.id))}">Copiar enlace</button></div>
      <div style="display:flex;gap:6px"><button class="btn sm" data-ren="${l.id}">Renombrar</button>${l.es_madre ? '' : `<button class="btn sm red" data-qui="${l.id}">Quitar</button>`}</div></div>`).join('');
}
const urlLocal = id => location.origin + '/?l=' + id;
$('locl').onclick = async e => {
  const cp = e.target.closest('[data-cpl]');
  if (cp) { try { await navigator.clipboard.writeText(cp.dataset.cpl); cp.textContent = 'Copiado ✓'; } catch (err) { cp.textContent = 'No se pudo copiar'; } setTimeout(() => cp.textContent = 'Copiar enlace', 1800); return; }
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
    '<div class="mu" style="margin-top:8px">Cada venta descuenta del local por cuyo enlace o QR compró el cliente. Total = suma de todos los locales.</div>';
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

/* ---------- ¿De qué local sale la venta? ---------- */
function llenarSelectorVenta() {
  const o = locales.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join(''), m = madre();
  const porDefecto = localVenta && locales.some(l => l.id == localVenta) ? localVenta : (m ? m.id : '');
  $('lvs').innerHTML = o; $('lvs').value = porDefecto;
  const vn = $('npl').value;
  $('npl').innerHTML = o; $('npl').value = vn && locales.some(l => l.id == vn) ? vn : porDefecto;
  const vq = $('qrloc').value;
  $('qrloc').innerHTML = '<option value="">El local por defecto de la tienda</option>' + o;
  $('qrloc').value = vq && locales.some(l => l.id == vq) ? vq : '';
  llenarProductosPedido();
  if (typeof renderProds === 'function') renderProds();
}
function llenarProductosPedido() {
  const lid = $('npl').value || (madre() ? madre().id : ''), v = $('npp').value;
  $('npp').innerHTML = prods.filter(p => disponibleEn(lid, p.id) > 0)
    .map(p => `<option value="${p.id}">${esc(p.nombre)}${p.marca ? ' · ' + esc(p.marca) : ''} (${disponibleEn(lid, p.id)}) · ${money(p.precio)}</option>`).join('');
  if (v) $('npp').value = v;
}
$('npl').onchange = llenarProductosPedido;
$('lvsb').onclick = async () => {
  const { error } = await sb.from('ajustes').upsert({ clave: 'local_venta', valor: String($('lvs').value) });
  if (error) { say('lvmsg', 'No se pudo guardar: ' + error.message, true); return; }
  localVenta = String($('lvs').value); ajustes.local_venta = localVenta;
  say('lvmsg', `Listo. El enlace general de la tienda ahora vende desde ${nomLocal(localVenta)}.`); renderLocales();
};

/* ---------- Ventas por local ---------- */
function desdeVentas() {
  const n = new Date(), v = $('vlp').value;
  if (v === 'hoy') return new Date(n.getFullYear(), n.getMonth(), n.getDate()).toISOString();
  if (v === 'mes') return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
  return null;
}
async function loadVentasLocal() {
  const { data, error } = await sb.rpc('ventas_por_local', { p_desde: desdeVentas() });
  if (error) { $('vloc').innerHTML = '<div class="mu">Falta ejecutar supabase_v13.sql en Supabase.</div>'; return; }
  const f = data || [], suma = k => f.reduce((s, x) => s + Number(x[k]), 0);
  $('vloc').innerHTML = `<table class="mtab"><tr><th>Local</th><th>Pedidos</th><th>Unid.</th><th>Ventas</th><th>Ganancia</th><th>Por cobrar</th></tr>` +
    f.map(x => `<tr><td>${esc(x.nombre)}${x.es_madre ? ' 🏠' : ''}</td><td>${x.pedidos}</td><td>${x.unidades}</td><td>${money(x.ventas)}</td><td><b>${money(x.ganancia)}</b></td><td>${money(x.por_cobrar)}</td></tr>`).join('') +
    `<tr><td><b>Total</b></td><td><b>${suma('pedidos')}</b></td><td><b>${suma('unidades')}</b></td><td><b>${money(suma('ventas'))}</b></td><td><b>${money(suma('ganancia'))}</b></td><td><b>${money(suma('por_cobrar'))}</b></td></tr></table>` +
    '<div class="mu" style="margin-top:8px">No incluye los pedidos anteriores al sistema.</div>';
}
$('vlp').onchange = loadVentasLocal;
