/* CRISS’ STORE · Administrador (parte 2): estado de cuenta, ganancias, ranking, promociones y pago */

/* ================= ESTADO DE CUENTA ================= */
let stC = null, stRows = [], stPagos = [];
const stLines = () => stRows.filter(f => $('stall').checked || !f.pagada);
const stTotal = () => stRows.filter(f => !f.pagada).reduce((s, f) => s + resta(f), 0);

async function openStmt(c) {
  stC = c;
  const [a, b] = await Promise.all([
    sb.from('compras').select('*').eq('cliente_id', c).order('id'),
    sb.from('pagos').select('*').eq('cliente_id', c).order('id', { ascending: false }).limit(8)
  ]);
  stRows = a.data || []; stPagos = b.data || [];
  $('stall').checked = false;
  renderStmt();
  $('stmt').classList.remove('hide');
}
function renderStmt() {
  const L = stLines(), tot = stTotal(), hoy = hoyISO();
  $('stbody').innerHTML = `
    <h2 style="font-size:24px">CRISS’ STORE</h2>
    <div class="mu">Estado de cuenta · ${fdate(new Date())}</div>
    <div style="margin:10px 0"><strong>${esc(nombreDe(stC))}</strong> <span class="mu">(${esc(stC)})</span></div>
    ${L.length ? L.map(f => `
      <div class="stl"><div>${f.cantidad} × ${esc(f.producto_nombre)}
        <div class="mu">${fdate(f.fecha)} · ${esc(f.factura)} · ${f.pagada ? '<span class="paid">COBRADA</span>' : (f.vence < hoy ? '<span class="low">VENCIDA</span> ' : '') + modTxt(f)}</div>
        ${!f.pagada && Number(f.pagado) > 0 ? `<div class="mu">Abonado ${money(f.pagado)} · resta ${money(resta(f))}</div>` : ''}</div>
        <strong>${money(f.monto)}</strong></div>`).join('')
      : '<div class="mu" style="padding:10px 0">Sin compras pendientes.</div>'}
    <div style="margin-top:12px">Total por cobrar: <span class="total">${money(tot)}</span></div>
    ${stPagos.length ? `<div style="margin-top:12px"><strong>Pagos recibidos</strong>${stPagos.map(p =>
      `<div class="stl"><span>${fdate(p.fecha)} · ${esc(p.metodo)}</span><span>${money(p.monto)}</span></div>`).join('')}</div>` : ''}
    ${tot > 0 && (ajustes.pago_texto || ajustes.pago_imagen) ? `
      <div style="margin-top:14px;padding-top:12px;border-top:2px dashed var(--ln)">
        <strong>Datos para pagar</strong>
        ${ajustes.pago_texto ? `<div style="white-space:pre-line;margin-top:4px">${esc(ajustes.pago_texto)}</div>` : ''}
        ${ajustes.pago_imagen ? `<img src="${esc(ajustes.pago_imagen)}" crossorigin="anonymous" alt="Datos de pago" style="display:block;max-width:220px;width:100%;margin-top:8px;border-radius:8px">` : ''}
      </div>` : ''}`;
}
function stText() {
  const hoy = hoyISO();
  let t = `*CRISS’ STORE* · Estado de cuenta\nCliente: ${nombreDe(stC)} (${stC})\nFecha: ${fdate(new Date())}\n\n`;
  stLines().forEach(f => {
    t += `${fdate(f.fecha)} · ${f.cantidad} × ${f.producto_nombre} · ${money(f.monto)}`;
    t += f.pagada ? ' (cobrada)' : ` · ${f.vence < hoy ? 'VENCIDA ' : ''}${modTxt(f)}${Number(f.pagado) > 0 ? ` · resta ${money(resta(f))}` : ''}`;
    t += '\n';
  });
  t += `\n*Total por cobrar: ${money(stTotal())}*`;
  if (stTotal() > 0 && ajustes.pago_texto) t += `\n\nDatos para pagar:\n${ajustes.pago_texto}`;
  return t;
}
$('stall').onchange = renderStmt;
$('stwa').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(stText()), '_blank');
$('stcp').onclick = async () => {
  try { await navigator.clipboard.writeText(stText()); $('stcp').textContent = 'Copiado'; }
  catch (e) { $('stcp').textContent = 'No se pudo copiar'; }
  setTimeout(() => $('stcp').textContent = 'Copiar texto', 1800);
};
$('stpr').onclick = () => window.print();
$('stx').onclick = () => $('stmt').classList.add('hide');
$('stjp').onclick = async () => {
  const b = $('stjp'); b.disabled = true; b.textContent = 'Generando…';
  try {
    const cv = await html2canvas($('stbody'), { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
    const name = `estado-cuenta-${stC}.jpg`;
    const file = new File([blob], name, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  } catch (e) { if (e.name !== 'AbortError') alert('No se pudo crear la imagen. Usa PDF o captura de pantalla.'); }
  b.disabled = false; b.textContent = 'Descargar JPG';
};

/* ================= REPORTES: ganancias, ranking, resumen mensual ================= */
const FALTA = '<div class="mu">Falta ejecutar supabase_v3.sql en Supabase.</div>';
const medal = ['🥇', '🥈', '🥉'];
function desde() {
  if ($('rk').value !== 'mes') return null;
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
}
async function loadUltimas() {
  const r = await sb.from('compras').select('*').order('id', { ascending: false }).limit(60);
  const data = (r.data || []).filter(f => !f.historico).slice(0, 15);
  $('ult').innerHTML = data.length ? data.map(f => `
    <div class="line"><div><strong>${f.cantidad} × ${esc(f.producto_nombre)}</strong>
      <div class="mu">${esc(nombreDe(f.cliente_id))} · ${fdate(f.fecha)} · ${f.pagada ? '<span class="paid">COBRADA</span>' : modTxt(f)}</div></div>
      <div style="text-align:right"><strong>${money(f.monto)}</strong><br>
        ${f.pagada ? '' : `<button class="btn sm" style="margin:4px 4px 0 0" data-cm="${f.id}">Cambiar pago</button>`}<button class="btn sm red" style="margin-top:4px" data-anc="${f.id}" data-desc="${esc(f.cantidad + ' × ' + f.producto_nombre + ' de ' + nombreDe(f.cliente_id))}">Anular</button></div></div>`).join('') : '<div class="mu">Aún no hay ventas.</div>';
}
async function loadReports() {
  loadUltimas();
  const d = desde();
  const [rk, gp, rm] = await Promise.all([
    sb.rpc('ranking', { p_desde: d }),
    sb.rpc('ganancias_producto', { p_desde: d }),
    sb.rpc('resumen_mensual')
  ]);
  renderRanking(rk); renderGanancias(gp); renderMensual(rm); renderKpis(rm);
}
$('rk').onchange = loadReports;

function renderRanking({ data, error }) {
  if (error) { $('rkout').innerHTML = FALTA; return; }
  const fh = h => h < 48 ? Math.max(1, Math.round(h)) + ' h' : (h / 24).toFixed(1) + ' días';
  const est = (data || []).filter(r => Number(r.total) > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  const rap = (data || []).filter(r => r.pagadas >= 2).sort((a, b) => a.horas_pago - b.horas_pago).slice(0, 5);
  $('rkout').innerHTML = `
    <strong>⭐ Comprador estrella</strong>
    <div class="rk">${est.length ? est.map((r, i) => `<div class="line"><span>${medal[i] || '•'} ${esc(r.nombre)}</span><span>${money(r.total)} · ${r.unidades} u.</span></div>`).join('') : '<div class="mu">Aún no hay compras en este período.</div>'}</div>
    <strong>⚡ Pago rápido</strong>
    <div class="rk">${rap.length ? rap.map((r, i) => `<div class="line"><span>${medal[i] || '•'} ${esc(r.nombre)}</span><span>${fh(r.horas_pago)} · ${r.pagadas} pagos</span></div>`).join('') : '<div class="mu">Se necesitan al menos 2 compras cobradas por cliente.</div>'}</div>`;
}

function consejos(rows) {
  const out = [];
  if (!rows.length) return ['Aún no hay ventas en este período para analizar.'];
  const sorted = [...rows].sort((a, b) => b.ganancia - a.ganancia);
  const total = rows.reduce((s, r) => s + Number(r.ganancia), 0);
  const star = sorted[0];
  out.push(`⭐ <b>${esc(star.producto)}</b> es tu producto estrella: dejó ${money(star.ganancia)} de ganancia con ${star.unidades} unidades` +
    (total > 0 ? ` (${Math.round(100 * star.ganancia / total)}% de lo ganado).` : '.'));
  const con = rows.filter(r => !r.sin_costo && r.unidades >= 2);
  const best = [...con].sort((a, b) => b.margen - a.margen)[0];
  if (best && best.producto !== star.producto)
    out.push(`💰 <b>${esc(best.producto)}</b> tiene el mejor margen (${best.margen}%). Promociónalo: cada venta te deja más.`);
  con.filter(r => r.margen < 15).slice(0, 3).forEach(r =>
    out.push(`⚠️ <b>${esc(r.producto)}</b> deja poco margen (${r.margen}%). Revisa su precio de venta o su costo de compra.`));
  const sin = rows.filter(r => r.sin_costo);
  if (sin.length)
    out.push(`ℹ️ ${sin.length} producto(s) sin costo cargado (${sin.slice(0, 3).map(r => esc(r.producto)).join(', ')}). Su ganancia aparece inflada hasta que registres la factura de compra.`);
  const p = prods.find(x => x.nombre === star.producto);
  if (p && p.stock <= Math.max(p.umbral, 3))
    out.push(`📦 A tu producto estrella le quedan ${p.stock}. Repónlo pronto para no perder ventas.`);
  out.push('<span class="mu">Consejos automáticos basados en tus ventas y costos registrados; no son una predicción.</span>');
  return out;
}
function renderGanancias({ data, error }) {
  if (error) { $('gout').innerHTML = FALTA; return; }
  const rows = (data || []).map(r => ({ ...r, ganancia: Number(r.ganancia), ventas: Number(r.ventas), margen: Number(r.margen) }));
  const sorted = [...rows].sort((a, b) => b.ganancia - a.ganancia);
  $('gout').innerHTML = consejos(rows).map(t => `<div class="tip">${t}</div>`).join('') +
    (sorted.length ? '<div class="mu" style="margin-top:10px">Ranking por ganancia</div>' + sorted.slice(0, 10).map((r, i) => `
      <div class="line"><div>${medal[i] || '•'} ${esc(r.producto)}<div class="mu">${r.unidades} u. · vendido ${money(r.ventas)} · margen ${r.sin_costo ? 'sin costo' : r.margen + '%'}</div></div>
      <strong>${money(r.ganancia)}</strong></div>`).join('') : '');
}
function renderMensual({ data, error }) {
  if (error) { $('mout').innerHTML = FALTA; return; }
  if (!data || !data.length) { $('mout').innerHTML = '<div class="mu">Aún no hay movimientos.</div>'; return; }
  $('mout').innerHTML = `<table class="mtab"><tr><th>Mes</th><th>Ventas</th><th>Costo vendido</th><th>Ganancia</th><th>Compras prov.</th><th>Cobrado</th></tr>` +
    data.map(r => `<tr><td>${new Date(r.mes + 'T00:00:00').toLocaleDateString('es', { month: 'short', year: '2-digit' })}</td>
      <td>${money(r.ventas)}</td><td>${money(r.costo_vendido)}</td><td><b>${money(r.ganancia)}</b></td><td>${money(r.gastos)}</td><td>${money(r.cobrado)}</td></tr>`).join('') +
    `</table><div class="mu" style="margin-top:8px">Ganancia = ventas − costo de lo vendido. “Compras prov.” es lo que pagaste a proveedores ese mes (incluye inventario que aún no vendes). “Cobrado” es el dinero que recibiste de clientes.</div>`;
}
function renderKpis(rm) {
  const hoy = hoyISO(), mes = hoy.slice(0, 7);
  const porCobrar = pend.reduce((s, f) => s + resta(f), 0);
  const vencido = pend.filter(f => f.vence < hoy).reduce((s, f) => s + resta(f), 0);
  const fila = (rm.data || []).find(r => String(r.mes).startsWith(mes));
  $('kpis').innerHTML = [
    ['Por cobrar', money(porCobrar)], ['Vencido', money(vencido)],
    ['Ganancia del mes', rm.error ? '—' : money(fila ? fila.ganancia : 0)],
    ['Compras a proveedor (mes)', rm.error ? '—' : money(fila ? fila.gastos : 0)]
  ].map(([k, v]) => `<div class="kpi"><b>${v}</b><span>${k}</span></div>`).join('');
}

/* ================= PROMOCIONES Y DATOS DE PAGO ================= */
async function loadExtras() {
  const [pr, aj, fr] = await Promise.all([
    sb.from('promos').select('*').eq('activa', true).order('id', { ascending: false }),
    sb.from('ajustes').select('*'),
    sb.from('frases').select('*').eq('activa', true).order('id', { ascending: false })
  ]);
  $('tp').innerHTML = '<option value="">Sin producto</option>' + prods.map(p => `<option value="${esc(p.codigo)}">${esc(p.nombre)}</option>`).join('');
  $('tlist').innerHTML = pr.error ? '<div class="mu" style="margin-top:8px">Falta ejecutar supabase_v2.sql en Supabase.</div>'
    : (pr.data || []).map(p => `<div class="line"><span>${esc(p.titulo)}</span><button class="btn sm red" data-qp="${p.id}">Quitar</button></div>`).join('');
  ajustes = {};
  (aj.data || []).forEach(r => ajustes[r.clave] = r.valor);
  $('ptx').value = ajustes.pago_texto || '';
  showPago();
  $('fp').innerHTML = '<option value="">Ninguno</option>' + prods.map(p => `<option value="${esc(p.codigo)}">${esc(p.nombre)}</option>`).join('');
  const MOM = { entrada: 'Al entrar', compra: 'Tras una compra', azar: 'Al tocarla' };
  $('flist').innerHTML = fr.error ? '<div class="mu" style="margin-top:8px">Falta ejecutar supabase_v8.sql en Supabase.</div>'
    : (fr.data || []).map(f => `<div class="line"><div>${esc(f.texto)}
        <div class="mu">${MOM[f.momento]}${f.codigo ? ' · ' + esc((prods.find(p => p.codigo === f.codigo) || {}).nombre || f.codigo) : ''}</div></div>
        <button class="btn sm red" data-qf="${f.id}">Quitar</button></div>`).join('');
}
function showPago() {
  const u = ajustes.pago_imagen;
  $('ppv').classList.toggle('hide', !u);
  if (u) $('ppv').src = u;
}
$('tlist').onclick = async e => {
  const b = e.target.closest('[data-qp]');
  if (!b) return;
  await sb.from('promos').update({ activa: false }).eq('id', b.dataset.qp);
  loadExtras();
};
$('tadd').onclick = async () => {
  const titulo = $('tt').value.trim();
  if (!titulo) { say('tmsg', 'Escribe un título.', true); return; }
  $('tadd').disabled = true; say('tmsg', 'Publicando…');
  try {
    const f = $('tf').files[0];
    const imagen_url = f ? await subir(f, 'promo', 1000, 0.85) : null;
    const { error } = await sb.from('promos').insert({ titulo, texto: $('tx2').value.trim() || null, imagen_url, codigo: $('tp').value || null });
    if (error) throw error;
    ['tt', 'tx2', 'tf'].forEach(i => $(i).value = '');
    say('tmsg', 'Promoción publicada.');
    loadExtras();
  } catch (e) { say('tmsg', 'No se pudo publicar: ' + (e.message || e), true); }
  $('tadd').disabled = false;
};
$('fadd').onclick = async () => {
  const texto = $('fx').value.trim();
  if (texto.length < 3) { say('fmsg', 'Escribe la frase (mínimo 3 letras).', true); return; }
  const { error } = await sb.from('frases').insert({ texto, momento: $('fm').value, codigo: $('fp').value || null });
  if (error) { say('fmsg', 'No se pudo guardar: ' + (/frases/.test(error.message) ? 'falta ejecutar supabase_v8.sql en Supabase.' : error.message), true); return; }
  $('fx').value = '';
  say('fmsg', 'Frase agregada. La mascota ya puede decirla.');
  loadExtras();
};
$('flist').onclick = async e => {
  const b = e.target.closest('[data-qf]');
  if (!b) return;
  await sb.from('frases').update({ activa: false }).eq('id', b.dataset.qf);
  loadExtras();
};
async function guardarPago(quitarImg) {
  try {
    let url = quitarImg ? '' : (ajustes.pago_imagen || '');
    const f = $('pim').files[0];
    if (f && !quitarImg) url = await subir(f, 'pago', 1000, 0.92);
    const { error } = await sb.from('ajustes').upsert([
      { clave: 'pago_texto', valor: $('ptx').value.trim() },
      { clave: 'pago_imagen', valor: url }
    ]);
    if (error) throw error;
    ajustes.pago_texto = $('ptx').value.trim(); ajustes.pago_imagen = url;
    $('pim').value = ''; showPago();
    say('pgmsg', quitarImg ? 'Imagen quitada.' : 'Datos de pago guardados.');
  } catch (e) { say('pgmsg', 'No se pudo guardar: ' + (e.message || e), true); }
}
$('psv').onclick = () => guardarPago(false);
$('prm').onclick = () => guardarPago(true);

/* ================= INFORME DEL DÍA ================= */
let rTxt = '';
const FMOD = { inmediato: 'Pago inmediato', quincena15: 'Pago el 15', quincena30: 'Pago el 30' };
const sumar = (arr, fn) => arr.reduce((s, x) => s + Number(fn(x)), 0);

async function openInforme() {
  const dia = $('rfd').value || hoyISO();
  const [y, m, d] = dia.split('-').map(Number);
  const ini = new Date(y, m - 1, d).toISOString(), fin = new Date(y, m - 1, d + 1).toISOString();
  const rng = q => q.gte('fecha', ini).lt('fecha', fin).order('id');
  const [a, b, c] = await Promise.all([
    rng(sb.from('compras').select('*')), rng(sb.from('pagos').select('*')), rng(sb.from('entradas').select('*'))
  ]);
  const ventas = (a.data || []).filter(f => !f.historico), pagos = b.data || [], ent = c.data || [];

  const vendido = sumar(ventas, f => f.monto), costo = sumar(ventas, f => f.cantidad * f.costo_unit);
  const unidades = sumar(ventas, f => f.cantidad), cobrado = sumar(pagos, p => p.monto), gastos = sumar(ent, e => e.costo_total);
  const porProd = {}, porCli = {}, porMod = {}, porMet = {};
  ventas.forEach(f => {
    const p = porProd[f.producto_nombre] || (porProd[f.producto_nombre] = { q: 0, m: 0 }); p.q += f.cantidad; p.m += Number(f.monto);
    const c2 = porCli[f.cliente_id] || (porCli[f.cliente_id] = { it: [], m: 0 }); c2.it.push(f.cantidad + ' × ' + f.producto_nombre); c2.m += Number(f.monto);
    porMod[f.modalidad] = (porMod[f.modalidad] || 0) + Number(f.monto);
  });
  pagos.forEach(p => { porMet[p.metodo] = (porMet[p.metodo] || 0) + Number(p.monto); });
  const hoy = hoyISO();
  const porCobrar = sumar(pend, resta), vencido = sumar(pend.filter(f => f.vence < hoy), resta);
  const bajos = prods.filter(p => p.stock <= p.umbral);

  const secs = [];
  const res = [['Pedidos', ventas.length], ['Unidades vendidas', unidades], ['Vendido', money(vendido)],
    ['Costo de lo vendido', money(costo)], ['Ganancia del día', money(vendido - costo)]];
  secs.push({ t: 'Ventas del día', l: res, nota: ventas.some(f => Number(f.costo_unit) === 0) && ventas.length ? 'Hay ventas sin costo cargado: la ganancia puede salir inflada.' : '' });
  if (ventas.length) {
    secs.push({ t: 'Productos vendidos', l: Object.entries(porProd).sort((x, y2) => y2[1].m - x[1].m).map(([n, v]) => [`${v.q} × ${n}`, money(v.m)]) });
    secs.push({ t: 'Clientes que compraron', l: Object.entries(porCli).map(([k, v]) => [`${nombreDe(k)}: ${v.it.join(', ')}`, money(v.m)]) });
    secs.push({ t: 'Cuándo pagarán lo vendido', l: Object.entries(porMod).map(([k, v]) => [FMOD[k] || k, money(v)]) });
  }
  secs.push({ t: 'Cobros del día', l: pagos.length ? [['Total cobrado', money(cobrado)], ...Object.entries(porMet).map(([k, v]) => ['· ' + k, money(v)]),
    ...pagos.map(p => [`${nombreDe(p.cliente_id)} (${p.metodo})`, money(p.monto)])] : [['Sin cobros este día', '']] });
  if (ent.length) secs.push({ t: 'Compras a proveedor', l: [['Total pagado', money(gastos)], ...ent.map(e => [`${e.cantidad} × ${e.producto_nombre}${e.proveedor ? ' · ' + e.proveedor : ''}`, money(e.costo_total)])] });
  secs.push({ t: 'Situación actual', l: [['Por cobrar (todos)', money(porCobrar)], ['Vencido', money(vencido)],
    ['Por agotarse', bajos.length ? bajos.map(p => `${p.nombre} (${p.stock})`).join(', ') : 'Nada']] });

  const fechaTxt = new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('rbody').innerHTML = `
    <h2 style="font-size:24px">CRISS’ STORE</h2>
    <div class="mu">Informe del día · ${esc(fechaTxt)}</div>
    ${secs.map(s => `<div style="margin-top:16px"><strong>${esc(s.t)}</strong>
      ${s.l.map(([k, v]) => `<div class="stl"><span>${esc(k)}</span><span><b>${esc(v)}</b></span></div>`).join('')}
      ${s.nota ? `<div class="mu" style="margin-top:4px">${esc(s.nota)}</div>` : ''}</div>`).join('')}`;
  rTxt = `*CRISS’ STORE* · Informe del día\n${fechaTxt}\n` +
    secs.map(s => `\n*${s.t.toUpperCase()}*\n` + s.l.map(([k, v]) => v === '' ? k : `${k}: ${v}`).join('\n') + (s.nota ? `\n(${s.nota})` : '')).join('\n');
  $('rep').classList.remove('hide');
}
async function jpgDe(el, nombre, btn, rotulo) {
  btn.disabled = true; btn.textContent = 'Generando…';
  try {
    const cv = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
    const file = new File([blob], nombre, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); }
  } catch (e) { if (e.name !== 'AbortError') alert('No se pudo crear la imagen. Usa PDF o captura de pantalla.'); }
  btn.disabled = false; btn.textContent = rotulo;
}
$('rfd').value = hoyISO();
$('rfb').onclick = openInforme;
$('rwa').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(rTxt), '_blank');
$('rpr').onclick = () => window.print();
$('rx').onclick = () => $('rep').classList.add('hide');
$('rjp').onclick = () => jpgDe($('rbody'), `informe-${$('rfd').value || hoyISO()}.jpg`, $('rjp'), 'Descargar JPG');
$('rcp').onclick = async () => {
  try { await navigator.clipboard.writeText(rTxt); $('rcp').textContent = 'Copiado'; }
  catch (e) { $('rcp').textContent = 'No se pudo copiar'; }
  setTimeout(() => $('rcp').textContent = 'Copiar texto', 1800);
};

/* ================= SESIÓN (va al final para que todo esté cargado) ================= */
sb.auth.onAuthStateChange((ev, session) => {
  isAdmin = !!session;
  $('login').classList.toggle('hide', isAdmin);
  $('panel').classList.toggle('hide', !isAdmin);
  $('nav').classList.toggle('hide', !isAdmin);
  if (isAdmin && ev !== 'TOKEN_REFRESHED') loadAll();
});
