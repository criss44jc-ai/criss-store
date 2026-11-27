/* CRISS’ STORE · Administrador (parte 12): métodos de pago, botones entre sucursales, historial y evaluación de clientes */
const FALTA22 = '<div class="mu">Falta ejecutar supabase_v22.sql en Supabase.</div>';
const hoyPA = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
const fechaPA = f => new Date(f).toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
const sumaAd = (arr, f) => arr.reduce((s, x) => s + Number(f(x) || 0), 0);
const difDias = (a, b) => Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000);
async function traerPaginas(fn) {                                   // Supabase entrega 1000 filas por vez: se piden todas las páginas
  let todo = [], d = 0;
  for (;;) { const { data, error } = await fn(d, d + 999); if (error) throw error; todo = todo.concat(data || []); if (!data || data.length < 1000) break; d += 1000; }
  return todo;
}

/* ================= MÉTODOS DE PAGO ================= */
let metodosAd = [];
async function loadMetodos() {
  const { data, error } = await sb.from('metodos_pago').select('*').order('orden').order('id');
  if (error) { $('mp-list').innerHTML = FALTA22; return; }
  metodosAd = data || []; renderMetodos();
}
function renderMetodos() {
  $('mp-list').innerHTML = metodosAd.length ? metodosAd.map((m, i) => `<div class="line" style="align-items:flex-start;gap:10px">
    ${m.imagen_url ? `<img src="${esc(m.imagen_url)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex:none">` : '<div style="width:56px;height:56px;border-radius:10px;background:#dde3ea;display:grid;place-items:center;flex:none">🏦</div>'}
    <div style="flex:1;min-width:0"><b>${esc(m.nombre)}</b> <span class="badge ${m.activo ? 'ok' : ''}">${m.activo ? 'Visible' : 'Oculto'}</span>
      ${m.instrucciones ? `<div class="mu" style="white-space:pre-line">${esc(m.instrucciones.length > 120 ? m.instrucciones.slice(0, 120) + '…' : m.instrucciones)}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <button class="btn sm" data-mpu="${m.id}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn sm" data-mpd="${m.id}" ${i === metodosAd.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn sm" data-mpa="${m.id}">${m.activo ? 'Ocultar' : 'Mostrar'}</button><button class="btn sm" data-mpx="${m.id}">Quitar</button></div></div></div>`).join('')
    : '<div class="mu">Todavía no hay métodos. Mientras tanto, los clientes ven el QR y la cuenta de “Datos de pago” (más abajo).</div>';
}
$('mp-add').onclick = async () => {
  const nombre = $('mp-nom').value.trim(), ins = $('mp-ins').value.trim(), f = $('mp-img').files[0];
  if (!nombre) { say('mp-msg', 'Escribe el nombre del método (Yappy, Transferencia, Efectivo…).', true); return; }
  if (!ins && !f) { say('mp-msg', 'Agrega las instrucciones, un código QR, o ambos.', true); return; }
  $('mp-add').disabled = true; say('mp-msg', 'Guardando…');
  try {
    const imagen_url = f ? await subir(f, 'metodo', 700, 0.9) : null;
    const { error } = await sb.from('metodos_pago').insert({ nombre, instrucciones: ins || null, imagen_url, orden: metodosAd.length + 1 });
    if (error) throw error;
    ['mp-nom', 'mp-ins', 'mp-img'].forEach(i => $(i).value = ''); say('mp-msg', 'Método agregado. Los clientes ya lo ven al pagar.'); await loadMetodos();
  } catch (e) { say('mp-msg', /metodos_pago/.test(e.message || '') ? 'Falta ejecutar supabase_v22.sql en Supabase.' : (e.message || String(e)), true); }
  $('mp-add').disabled = false;
};
$('mp-list').onclick = async e => {
  const u = e.target.closest('[data-mpu]'), d = e.target.closest('[data-mpd]'), a = e.target.closest('[data-mpa]'), x = e.target.closest('[data-mpx]');
  const mover = async (id, dir) => {
    const i = metodosAd.findIndex(m => m.id == id), k = i + dir; if (k < 0 || k >= metodosAd.length) return;
    [metodosAd[i], metodosAd[k]] = [metodosAd[k], metodosAd[i]];
    await Promise.all(metodosAd.map((m, n) => sb.from('metodos_pago').update({ orden: n + 1 }).eq('id', m.id))); await loadMetodos();
  };
  if (u) await mover(u.dataset.mpu, -1); else if (d) await mover(d.dataset.mpd, 1);
  else if (a) { const m = metodosAd.find(z => z.id == a.dataset.mpa); await sb.from('metodos_pago').update({ activo: !m.activo }).eq('id', m.id); await loadMetodos(); }
  else if (x && confirm('¿Quitar este método de pago?')) { await sb.from('metodos_pago').delete().eq('id', Number(x.dataset.mpx)); await loadMetodos(); }
};

/* ================= BOTONES A OTRAS SUCURSALES ================= */
let enlacesAd = [];
const nomSuc = id => ((typeof locales !== 'undefined' ? locales : []).find(l => l.id === id) || {}).nombre || 'Local ' + id;
async function loadEnlacesSuc() {
  const { data, error } = await sb.from('sucursal_enlaces').select('*').order('orden').order('id');
  if (error) { $('sl-list').innerHTML = FALTA22; return; }
  enlacesAd = data || []; llenarSelectoresSuc(); renderEnlacesSuc();
}
function llenarSelectoresSuc() {
  const locs = typeof locales !== 'undefined' ? locales : [], vo = $('sl-origen').value;
  $('sl-origen').innerHTML = locs.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join(''); if (vo && locs.some(l => l.id == vo)) $('sl-origen').value = vo;
  const o = Number($('sl-origen').value), vd = $('sl-dest').value;
  $('sl-dest').innerHTML = locs.filter(l => l.id !== o).map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join(''); if (vd) $('sl-dest').value = vd;
}
function renderEnlacesSuc() {
  const o = Number($('sl-origen').value), mios = enlacesAd.filter(e => e.sucursal_id === o);
  $('sl-list').innerHTML = mios.length ? mios.map((e, i) => `<div class="line"><div><b>📍 ${esc(e.etiqueta || nomSuc(e.destino_id))}</b><div class="mu">Lleva a la tienda de ${esc(nomSuc(e.destino_id))}</div></div>
    <div style="display:flex;gap:6px"><button class="btn sm" data-slu="${e.id}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn sm" data-sld="${e.id}" ${i === mios.length - 1 ? 'disabled' : ''}>↓</button><button class="btn sm" data-slx="${e.id}">Quitar</button></div></div>`).join('')
    : `<div class="mu">La tienda de ${esc(nomSuc(o))} todavía no tiene botones a otras sucursales.</div>`;
}
$('sl-origen').onchange = () => { llenarSelectoresSuc(); renderEnlacesSuc(); };
$('sl-add').onclick = async () => {
  const o = Number($('sl-origen').value), d = Number($('sl-dest').value), etq = $('sl-etq').value.trim();
  if (!o || !d) { say('sl-msg', 'Elige la sucursal donde aparece el botón y a cuál lleva.', true); return; }
  if (enlacesAd.some(e => e.sucursal_id === o && e.destino_id === d)) { say('sl-msg', 'Ese botón ya existe.', true); return; }
  const filas = [{ sucursal_id: o, destino_id: d, etiqueta: etq || null, orden: enlacesAd.filter(e => e.sucursal_id === o).length + 1 }];
  if ($('sl-rec').checked && !enlacesAd.some(e => e.sucursal_id === d && e.destino_id === o)) filas.push({ sucursal_id: d, destino_id: o, etiqueta: null, orden: enlacesAd.filter(e => e.sucursal_id === d).length + 1 });
  const { error } = await sb.from('sucursal_enlaces').insert(filas);
  if (error) { say('sl-msg', /sucursal_enlaces/.test(error.message) ? 'Falta ejecutar supabase_v22.sql en Supabase.' : error.message, true); return; }
  $('sl-etq').value = ''; say('sl-msg', 'Botón agregado. Aparece en la tienda de ' + nomSuc(o) + (filas.length > 1 ? ' y también el de regreso.' : '.')); await loadEnlacesSuc();
};
$('sl-list').onclick = async e => {
  const u = e.target.closest('[data-slu]'), d = e.target.closest('[data-sld]'), x = e.target.closest('[data-slx]');
  const mover = async (id, dir) => {
    const o = Number($('sl-origen').value), mios = enlacesAd.filter(z => z.sucursal_id === o), i = mios.findIndex(z => z.id == id), k = i + dir; if (k < 0 || k >= mios.length) return;
    [mios[i], mios[k]] = [mios[k], mios[i]];
    await Promise.all(mios.map((z, n) => sb.from('sucursal_enlaces').update({ orden: n + 1 }).eq('id', z.id))); await loadEnlacesSuc();
  };
  if (u) await mover(u.dataset.slu, -1); else if (d) await mover(d.dataset.sld, 1);
  else if (x && confirm('¿Quitar este botón?')) { await sb.from('sucursal_enlaces').delete().eq('id', Number(x.dataset.slx)); await loadEnlacesSuc(); }
};

/* ================= HISTORIAL Y EVALUACIÓN DE CLIENTES ================= */
// Evaluación de 0 a 100: 50 puntualidad al pagar + 25 sin deudas vencidas + 15 frecuencia (últimos 90 días) + 10 constancia (meses activos de los últimos 6)
function metricasCliente(cs) {
  const hoy = hoyPA(), ahora = Date.now(), reales = cs.filter(c => !c.historico);
  const debe = c => Math.max(0, Number(c.monto) - Number(c.pagado || 0)), pend = cs.filter(c => !c.pagada);
  const venc = pend.filter(c => c.vence && c.vence < hoy), maxVenc = venc.reduce((m, c) => Math.max(m, difDias(hoy, c.vence)), 0);
  const pagadas = reales.filter(c => c.pagada && c.pagada_en && c.vence), aTiempo = pagadas.filter(c => fechaPA(c.pagada_en) <= c.vence), tardes = pagadas.filter(c => fechaPA(c.pagada_en) > c.vence);
  const atrasoProm = tardes.length ? sumaAd(tardes, c => difDias(fechaPA(c.pagada_en), c.vence)) / tardes.length : 0;
  const punt = pagadas.length ? aTiempo.length / pagadas.length : null;
  const ult90 = reales.filter(c => ahora - new Date(c.fecha) <= 90 * 86400000).length;
  const mesesRec = new Set(reales.filter(c => ahora - new Date(c.fecha) <= 183 * 86400000).map(c => String(c.fecha).slice(0, 7))).size;
  const f = { punt: punt === null ? 35 : Math.round(50 * punt), deuda: Math.max(0, Math.round(25 - Math.min(25, venc.length * 5 + maxVenc * 0.5))), frec: Math.min(15, ult90 * 3), const: Math.round(Math.min(6, mesesRec) / 6 * 10) };
  const score = Math.max(0, Math.min(100, f.punt + f.deuda + f.frec + f.const)), nuevo = cs.length < 3;
  const fechas = cs.map(c => c.fecha).sort();
  return {
    pedidos: cs.length, unidades: sumaAd(cs, c => c.cantidad), total: sumaAd(cs, c => c.monto), pagado: sumaAd(cs, c => c.pagado), pendiente: sumaAd(pend, debe),
    ticket: cs.length ? sumaAd(cs, c => c.monto) / cs.length : 0, primera: fechas[0] || null, ultima: fechas[fechas.length - 1] || null,
    punt, atrasoProm, vencidos: venc.length, vencidoMonto: sumaAd(venc, debe), maxVenc, ult90, mesesRec, f, score: cs.length ? score : null, nuevo, anteriores: cs.length - reales.length,
    nivel: !cs.length ? ['Sin pedidos', ''] : nuevo ? ['Cliente nuevo', 'gold'] : score >= 85 ? ['Excelente', 'ok'] : score >= 70 ? ['Bueno', 'ok'] : score >= 50 ? ['Regular', 'gold'] : ['En riesgo', 'low']
  };
}
const estadoPed = (c, hoy) => c.pagada ? ['Pagado', 'ok'] : (c.vence && c.vence < hoy) ? ['Vencido', 'low'] : Number(c.pagado) > 0 ? ['Abono', 'gold'] : ['Pendiente', ''];
const atrasoPed = (c, hoy) => c.pagada ? (c.pagada_en && c.vence && fechaPA(c.pagada_en) > c.vence ? difDias(fechaPA(c.pagada_en), c.vence) : 0) : (c.vence && c.vence < hoy ? difDias(hoy, c.vence) : 0);
function descargarCSV(nombre, filas) {
  const csv = '\ufeff' + filas.map(r => r.map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function hsEstilos() {
  if (document.getElementById('hs-css')) return;
  const st = document.createElement('style'); st.id = 'hs-css';
  st.textContent = `.hs-score{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;font:800 28px var(--hd,sans-serif);border:6px solid #dde3ea;flex:none}
  .hs-score.ok{border-color:#2f9e44;color:#2b8a3e}.hs-score.gold{border-color:#f59f00;color:#b36b00}.hs-score.low{border-color:#e03131;color:#c92a2a}
  .hs-tab{width:100%;border-collapse:collapse;font-size:13px}.hs-tab th{text-align:left;padding:6px 6px;background:#f4f6f9;position:sticky;top:0;white-space:nowrap}.hs-tab td{padding:6px;border-bottom:1px solid #e9edf2;white-space:nowrap}
  .hs-tab tr.ant td{color:#7a8794}.hs-filtros{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.hs-filtros select,.hs-filtros input{flex:1;min-width:120px}
  @media print{body>*:not(#hs-ov){display:none!important}#hs-ov{position:static!important;background:#fff!important;display:block!important}#hs-ov>div{max-height:none!important;box-shadow:none!important;max-width:none!important}.hs-no{display:none!important}}`;
  document.head.appendChild(st);
}
const hsOverlay = html => {
  hsEstilos(); const prev = document.getElementById('hs-ov'); if (prev) prev.remove();
  const ov = document.createElement('div'); ov.id = 'hs-ov'; ov.className = 'sheet'; ov.style.zIndex = 60;
  ov.innerHTML = `<div style="max-width:760px;max-height:92vh;overflow:auto">${html}</div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-hs-cerrar]')) ov.remove(); });
  document.body.appendChild(ov); return ov;
};

async function abrirHistorial(cid) {
  const ov = hsOverlay('<div class="mu" style="padding:20px">Cargando el historial…</div>');
  let cs, pagos;
  try {
    cs = await traerPaginas((a, b) => sb.from('compras').select('*').eq('cliente_id', cid).order('fecha', { ascending: false }).range(a, b));
    pagos = await traerPaginas((a, b) => sb.from('pagos').select('*').eq('cliente_id', cid).order('fecha', { ascending: false }).range(a, b));
  } catch (e) { ov.firstChild.innerHTML = `<div class="mu" style="padding:20px">No se pudo cargar: ${esc(e.message || e)}</div><button class="btn" data-hs-cerrar style="width:100%">Cerrar</button>`; return; }
  const hoy = hoyPA(), m = metricasCliente(cs), nombre = nombreDe(cid), est = { periodo: 'todo', estado: 'todos', q: '' };
  // productos que más pide
  const prods = {}; cs.forEach(c => { const r = prods[c.producto_nombre] || (prods[c.producto_nombre] = { n: c.producto_nombre, u: 0, veces: 0, total: 0 }); r.u += c.cantidad; r.veces++; r.total += Number(c.monto); });
  const top = Object.values(prods).sort((a, b) => b.u - a.u || b.total - a.total).slice(0, 8);
  // por mes (últimos 12)
  const meses = []; for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
  const porMes = meses.map(k => sumaAd(cs.filter(c => String(c.fecha).slice(0, 7) === k), c => c.monto)), maxMes = Math.max(...porMes, 1);
  const NOMBRE_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const stat = (v, k) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`;
  const filtradas = () => cs.filter(c => {
    if (est.periodo !== 'todo' && Date.now() - new Date(c.fecha) > Number(est.periodo) * 86400000) return false;
    const e = estadoPed(c, hoy)[0];
    if (est.estado === 'pend' && c.pagada) return false; if (est.estado === 'pag' && !c.pagada) return false; if (est.estado === 'venc' && e !== 'Vencido') return false;
    return !est.q || (c.producto_nombre + ' ' + (c.factura || '')).toLowerCase().includes(est.q.toLowerCase());
  });
  const tabla = () => {
    const fs = filtradas();
    return `<div class="mu">${fs.length} pedido(s) · ${money(sumaAd(fs, c => c.monto))}</div><div style="overflow-x:auto;max-height:46vh"><table class="hs-tab"><tr><th>Fecha</th><th>Factura</th><th>Producto</th><th>Cant.</th><th>Monto</th><th>Estado</th><th>Vence</th><th>Pagó el</th><th>Atraso</th></tr>
    ${fs.map(c => { const [t, cl] = estadoPed(c, hoy), at = atrasoPed(c, hoy);
      return `<tr class="${c.historico ? 'ant' : ''}"><td>${fdate(c.fecha)}</td><td>${esc(c.factura || '')}${c.historico ? ' <span class="mu">(anterior)</span>' : ''}</td><td>${esc(c.producto_nombre)}</td><td>${c.cantidad}</td><td>${money(c.monto)}</td><td><span class="badge ${cl}">${t}</span></td><td>${c.vence ? fvence(c.vence) : '—'}</td><td>${c.pagada_en ? fdate(c.pagada_en) : '—'}</td><td>${at > 0 ? `<b class="${c.pagada ? '' : 'low'}">${at} d</b>` : '—'}</td></tr>`; }).join('') || '<tr><td colspan="9" class="mu" style="padding:14px">No hay pedidos con ese filtro.</td></tr>'}</table></div>`;
  };
  ov.firstChild.innerHTML = `
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${avatarHtml(cid, true)}
      <div style="flex:1;min-width:150px"><h2 style="margin:0">${esc(nombre)}</h2><div class="mu">${cid} · cliente desde ${m.primera ? fdate(m.primera) : '—'}</div><span class="badge ${m.nivel[1]}" style="margin-top:4px">${m.nivel[0]}</span>${m.nuevo ? '<div class="mu">Pocos pedidos: la evaluación todavía no es confiable.</div>' : ''}</div>
      <div class="hs-score ${m.nivel[1]}" title="Evaluación de 0 a 100">${m.score === null ? '—' : m.score}</div></div>
    <details style="margin-top:8px"><summary>¿Cómo se calcula la evaluación?</summary>
      <div class="mu" style="margin-top:6px">Suma 100 puntos: <b>${m.f.punt}/50</b> puntualidad al pagar (${m.punt === null ? 'sin pagos aún: se asigna 35' : Math.round(m.punt * 100) + '% de sus pedidos pagados a tiempo'}) · <b>${m.f.deuda}/25</b> sin deudas vencidas (${m.vencidos} vencida(s)${m.maxVenc ? ', hasta ' + m.maxVenc + ' días' : ''}) · <b>${m.f.frec}/15</b> frecuencia (${m.ult90} pedido(s) en 90 días) · <b>${m.f.const}/10</b> constancia (${m.mesesRec} de los últimos 6 meses con compras). 85 o más: Excelente · 70 a 84: Bueno · 50 a 69: Regular · menos de 50: En riesgo. Los pedidos anteriores al sistema no cuentan para puntualidad ni frecuencia.</div></details>
    <div class="stats" style="margin-top:10px">${stat(m.pedidos, 'Pedidos')}${stat(m.unidades, 'Unidades')}${stat(money(m.total), 'Comprado')}
      ${stat(money(m.pagado), 'Pagado')}${stat(money(m.pendiente), 'Por pagar')}${stat(money(m.ticket), 'Ticket promedio')}
      ${stat(m.punt === null ? '—' : Math.round(m.punt * 100) + '%', 'Paga a tiempo')}${stat(m.atrasoProm ? m.atrasoProm.toFixed(1) + ' d' : '0 d', 'Atraso promedio')}${stat(m.ultima ? fdate(m.ultima) : '—', 'Último pedido')}</div>
    ${m.anteriores ? `<div class="mu">Incluye ${m.anteriores} pedido(s) cargado(s) como “anteriores al sistema”.</div>` : ''}
    <div class="sec"><h3>Compras por mes (últimos 12)</h3><div class="wd" style="height:110px">${porMes.map((v, i) => `<div class="${v === Math.max(...porMes) && v > 0 ? 'mejor' : ''}"><i style="height:${Math.max(2, Math.round(v / maxMes * 70))}px" title="${money(v)}"></i>${NOMBRE_MES[Number(meses[i].slice(5)) - 1]}</div>`).join('')}</div></div>
    <div class="sec"><h3>Lo que más pide</h3>${top.length ? top.map((r, i) => `<div class="line"><div>${i === 0 ? '⭐ ' : ''}<b>${esc(r.n)}</b><div class="mu">${r.veces} pedido(s)</div></div><div style="text-align:right"><b>${r.u} u.</b><div class="mu">${money(r.total)}</div></div></div>`).join('') : '<div class="mu">Todavía no ha pedido.</div>'}</div>
    <div class="sec"><h3>Historial completo de pedidos</h3>
      <div class="hs-filtros hs-no"><select data-f="periodo"><option value="todo">Todo el tiempo</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option></select>
        <select data-f="estado"><option value="todos">Todos</option><option value="pend">Por pagar</option><option value="venc">Vencidos</option><option value="pag">Pagados</option></select>
        <input data-f="q" placeholder="Buscar producto o factura"></div>
      <div id="hs-tabla">${tabla()}</div></div>
    <div class="sec"><h3>Pagos recibidos (${pagos.length})</h3>${pagos.length ? pagos.slice(0, 25).map(p => `<div class="line"><div>${fdate(p.fecha)} · ${esc(p.metodo || '')}${p.nota ? `<div class="mu">${esc(p.nota)}</div>` : ''}</div><b>${money(p.monto)}</b></div>`).join('') + (pagos.length > 25 ? `<div class="mu">… y ${pagos.length - 25} más (están en el CSV del perfil)</div>` : '') : '<div class="mu">Sin pagos registrados.</div>'}</div>
    <div class="hs-no" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn go" data-hs-csv>⬇️ Descargar CSV</button><button class="btn" data-hs-print>🖨️ Imprimir / PDF</button><button class="btn" data-hs-wa>💬 Resumen por WhatsApp</button><button class="btn" data-hs-cerrar>Cerrar</button></div>`;
  const cambiar = e => { const f = e.target.closest('[data-f]'); if (!f) return; est[f.dataset.f] = f.value; ov.querySelector('#hs-tabla').innerHTML = tabla(); };
  ov.addEventListener('change', cambiar); ov.addEventListener('input', e => { if (e.target.dataset.f === 'q') cambiar(e); });
  ov.addEventListener('click', e => {
    if (e.target.closest('[data-hs-print]')) window.print();
    if (e.target.closest('[data-hs-csv]')) {
      descargarCSV(`historial-${nombre.replace(/[^\wáéíóúñ]+/gi, '_')}.csv`, [['Fecha', 'Factura', 'Producto', 'Cantidad', 'Monto', 'Pagado', 'Por pagar', 'Estado', 'Vence', 'Pagó el', 'Días de atraso', 'Tipo']]
        .concat(filtradas().map(c => [fechaPA(c.fecha), c.factura, c.producto_nombre, c.cantidad, Number(c.monto).toFixed(2), Number(c.pagado || 0).toFixed(2), c.pagada ? '0.00' : Math.max(0, Number(c.monto) - Number(c.pagado || 0)).toFixed(2), estadoPed(c, hoy)[0], c.vence || '', c.pagada_en ? fechaPA(c.pagada_en) : '', atrasoPed(c, hoy), c.historico ? 'Anterior al sistema' : 'Pedido'])));
    }
    if (e.target.closest('[data-hs-wa]')) {
      const t = `Resumen de ${nombre}: ${m.pedidos} pedidos, comprado ${money(m.total)}, por pagar ${money(m.pendiente)}, paga a tiempo ${m.punt === null ? 'sin datos' : Math.round(m.punt * 100) + '%'}. Evaluación: ${m.score === null ? 'sin pedidos todavía' : m.score + '/100 (' + m.nivel[0] + ')'}.`;
      window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
    }
  });
}

/* ================= REPORTE DE TODOS LOS CLIENTES ================= */
async function abrirReporteClientes() {
  const ov = hsOverlay('<div class="mu" style="padding:20px">Calculando el reporte de todos los clientes…</div>');
  let cs;
  try { cs = await traerPaginas((a, b) => sb.from('compras').select('cliente_id,monto,pagado,pagada,pagada_en,vence,fecha,historico,cantidad').order('id').range(a, b)); }
  catch (e) { ov.firstChild.innerHTML = `<div class="mu" style="padding:20px">No se pudo cargar: ${esc(e.message || e)}</div><button class="btn" data-hs-cerrar style="width:100%">Cerrar</button>`; return; }
  const por = {}; cs.forEach(c => (por[c.cliente_id] = por[c.cliente_id] || []).push(c));
  const filas = clientes.map(c => ({ id: c.id, nombre: c.nombre, m: metricasCliente(por[c.id] || []), ult: (por[c.id] || []).reduce((u, x) => x.fecha > u ? x.fecha : u, '') }));
  const est = { orden: 'score', q: '' };
  const ordenar = {
    score: (a, b) => (b.m.score ?? -1) - (a.m.score ?? -1), riesgo: (a, b) => (a.m.score ?? 999) - (b.m.score ?? 999), comprado: (a, b) => b.m.total - a.m.total,
    pendiente: (a, b) => b.m.pendiente - a.m.pendiente, reciente: (a, b) => (b.ult || '').localeCompare(a.ult || ''), nombre: (a, b) => a.nombre.localeCompare(b.nombre)
  };
  const lista = () => filas.filter(r => !est.q || r.nombre.toLowerCase().includes(est.q.toLowerCase()) || r.id.toLowerCase().includes(est.q.toLowerCase())).sort(ordenar[est.orden]);
  const tabla = () => `<div style="overflow-x:auto;max-height:56vh"><table class="hs-tab"><tr><th>Cliente</th><th>Pedidos</th><th>Comprado</th><th>Por pagar</th><th>A tiempo</th><th>Último pedido</th><th>Evaluación</th></tr>
    ${lista().map(r => `<tr data-hs-ver="${r.id}" style="cursor:pointer"><td><b>${esc(r.nombre)}</b></td><td>${r.m.pedidos}</td><td>${money(r.m.total)}</td><td class="${r.m.vencidos ? 'low' : ''}">${money(r.m.pendiente)}</td><td>${r.m.punt === null ? '—' : Math.round(r.m.punt * 100) + '%'}</td><td>${r.ult ? fdate(r.ult) : '—'}</td><td><span class="badge ${r.m.nivel[1]}">${r.m.score === null ? 'Sin pedidos' : r.m.score + ' · ' + r.m.nivel[0]}</span></td></tr>`).join('') || '<tr><td colspan="7" class="mu" style="padding:14px">Sin resultados.</td></tr>'}</table></div>`;
  const tot = { total: sumaAd(filas, r => r.m.total), pend: sumaAd(filas, r => r.m.pendiente), riesgo: filas.filter(r => r.m.score !== null && !r.m.nuevo && r.m.score < 50).length };
  ov.firstChild.innerHTML = `<h2 style="margin:0 0 4px">📊 Reporte de clientes</h2>
    <div class="mu">${filas.length} cliente(s) · comprado ${money(tot.total)} · por cobrar ${money(tot.pend)} · <b class="${tot.riesgo ? 'low' : ''}">${tot.riesgo} en riesgo</b>. Toca un cliente para ver todo su historial.</div>
    <div class="hs-filtros hs-no"><input data-q placeholder="Buscar cliente"><select data-o><option value="score">Mejor evaluados primero</option><option value="riesgo">En riesgo primero</option><option value="comprado">Los que más compran</option><option value="pendiente">Los que más deben</option><option value="reciente">Pedido más reciente</option><option value="nombre">Por nombre</option></select></div>
    <div id="hs-tabla">${tabla()}</div>
    <div class="hs-no" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn go" data-hs-csv>⬇️ Descargar CSV</button><button class="btn" data-hs-print>🖨️ Imprimir / PDF</button><button class="btn" data-hs-cerrar>Cerrar</button></div>`;
  const refrescar = () => { ov.querySelector('#hs-tabla').innerHTML = tabla(); };
  ov.querySelector('[data-q]').oninput = e => { est.q = e.target.value; refrescar(); };
  ov.querySelector('[data-o]').onchange = e => { est.orden = e.target.value; refrescar(); };
  ov.addEventListener('click', e => {
    const v = e.target.closest('[data-hs-ver]'); if (v) { abrirHistorial(v.dataset.hsVer); return; }
    if (e.target.closest('[data-hs-print]')) window.print();
    if (e.target.closest('[data-hs-csv]')) descargarCSV('reporte-clientes.csv', [['Cliente', 'Número', 'Pedidos', 'Unidades', 'Comprado', 'Pagado', 'Por pagar', 'Vencidos', 'Paga a tiempo %', 'Último pedido', 'Evaluación', 'Nivel']]
      .concat(lista().map(r => [r.nombre, r.id, r.m.pedidos, r.m.unidades, r.m.total.toFixed(2), r.m.pagado.toFixed(2), r.m.pendiente.toFixed(2), r.m.vencidos, r.m.punt === null ? '' : Math.round(r.m.punt * 100), r.ult ? fechaPA(r.ult) : '', r.m.score ?? '', r.m.nivel[0]])));
  });
}
$('rp-abrir').onclick = abrirReporteClientes;
document.addEventListener('click', async e => {
  const h = e.target.closest('[data-hist]'); if (h) { abrirHistorial(h.dataset.hist); return; }
  const q = e.target.closest('[data-qfc]');
  if (q && confirm('¿Quitar la foto que subió este cliente?')) { await sb.from('perfiles').update({ foto_cliente: null }).eq('cliente_id', q.dataset.qfc); if (typeof loadClientes === 'function') loadClientes(); }
});
