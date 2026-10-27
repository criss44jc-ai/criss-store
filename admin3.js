/* CRISS’ STORE · Administrador (parte 3): perfiles de clientes, premios y tómbola */
let resumenCli = [], perfiles = {}, reglas = [], premiosAll = [], pfCliente = null, pfDatos = null, tombola = null;
const FALTA11 = '<div class="mu">Falta ejecutar supabase_v11.sql en Supabase.</div>';
const AVATARES = ['😀', '😎', '🤠', '🥳', '😋', '🤩', '😏', '🧐', '😇', '🤓', '🦊', '🐯', '🐼', '🦁', '🐸', '🐵', '🦄', '🐶', '🐱', '🐰', '🍌', '🥤', '🍿', '⭐'];
const COLORES = ['#e8590c', '#2f9e44', '#1971c2', '#9c36b5', '#c2255c', '#0c8599', '#f08c00', '#5f3dc4'];
const colorDe = id => COLORES[(parseInt(String(id).slice(2), 10) || 0) % COLORES.length];
const inicioMes = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); };
const TIPOS = { cumpleanos: 'Cumpleaños', producto: 'Comprar un producto', mas_compra: 'Cliente que más compra', mas_producto: 'Cliente que más compra un producto', personalizado: 'Premio libre', tombola: 'Tómbola' };
const fh = h => h == null ? '—' : (h < 48 ? Math.max(1, Math.round(h)) + ' h' : (h / 24).toFixed(1) + ' días');

function avatarHtml(id, grande) {
  const p = perfiles[id] || {}, cls = 'av' + (grande ? ' g' : '');
  if (p.avatar_url) return `<img class="${cls}" src="${esc(p.avatar_url)}" alt="">`;
  if (p.avatar) return `<div class="${cls}" style="background:${colorDe(id)}33">${esc(p.avatar)}</div>`;
  return `<div class="${cls}" style="background:${colorDe(id)}">${esc((nombreDe(id) || '?').charAt(0).toUpperCase())}</div>`;
}
function diasParaCumple(c) {
  if (!c) return null;
  const [, m, d] = String(c).split('-').map(Number);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  let prox = new Date(hoy.getFullYear(), m - 1, d);
  if (prox < hoy) prox = new Date(hoy.getFullYear() + 1, m - 1, d);
  return Math.round((prox - hoy) / 86400000);
}

/* ================= LISTA DE CLIENTES ================= */
async function loadClientes() {
  const [r, p, rg, pr] = await Promise.all([
    sb.rpc('resumen_clientes'),
    sb.from('perfiles').select('cliente_id,avatar,avatar_url,cumple,telefono,correo'),
    sb.from('reglas_premio').select('*').eq('activa', true).order('id'),
    sb.from('premios').select('*').order('id', { ascending: false }).limit(300)
  ]);
  if (r.error) { $('clist').innerHTML = FALTA11; return; }
  resumenCli = r.data || [];
  perfiles = {}; (p.data || []).forEach(x => perfiles[x.cliente_id] = x);
  reglas = rg.data || []; premiosAll = pr.data || [];
  renderClientes(); renderReglas(); renderPremiosLista(); renderTombolaHist(); llenarSelectoresPremios();
}
function renderClientes() {
  const q = $('cbq').value.trim().toLowerCase();
  const prox = resumenCli.map(c => ({ c, d: diasParaCumple((perfiles[c.cliente_id] || {}).cumple) }))
    .filter(x => x.d !== null && x.d <= 30).sort((a, b) => a.d - b.d);
  $('cbd').innerHTML = prox.length ? `<div class="tip">🎂 <b>Cumpleaños próximos:</b> ${prox.map(x => `${esc(x.c.nombre)} (${x.d === 0 ? '¡hoy!' : 'en ' + x.d + ' d'})`).join(' · ')}</div>` : '';
  const lista = resumenCli.filter(c => !q || (c.nombre + ' ' + c.cliente_id).toLowerCase().includes(q));
  $('clist').innerHTML = lista.map(c => `
    <div class="rowc" data-pf="${c.cliente_id}">${avatarHtml(c.cliente_id)}
      <div style="flex:1;min-width:0"><strong>${esc(c.nombre)}</strong> <span class="mu">${c.cliente_id}</span>
        <div class="mu">${Number(c.n_pedidos) > 0 ? `Compró ${money(c.total)} · ${c.unidades} u.${c.fav ? ' · Favorito: ' + esc(c.fav) : ''}` : 'Sin compras'}</div></div>
      <div style="text-align:right">${Number(c.vencido) > 0 ? `<span class="badge mal">Vencido ${money(c.vencido)}</span>` : (Number(c.pendiente) > 0 ? `<span class="badge">Debe ${money(c.pendiente)}</span>` : '')}</div>
    </div>`).join('') || '<div class="mu">Sin resultados.</div>';
}
$('cbq').oninput = renderClientes;
$('clist').onclick = e => { const r = e.target.closest('[data-pf]'); if (r) abrirPerfil(r.dataset.pf); };

/* ================= PERFIL DE UN CLIENTE ================= */
async function abrirPerfil(id) {
  pfCliente = id;
  $('pbody').innerHTML = '<div class="mu">Cargando…</div>';
  $('perfil').classList.remove('hide');
  const [cm, pg, cp, pr, pf] = await Promise.all([
    sb.from('compras').select('*').eq('cliente_id', id).order('fecha', { ascending: false }).limit(1000),
    sb.from('pagos').select('*').eq('cliente_id', id).order('id', { ascending: false }).limit(200),
    sb.from('comprobantes').select('*').eq('cliente_id', id).order('id', { ascending: false }).limit(100),
    sb.from('premios').select('*').eq('cliente_id', id).order('id', { ascending: false }).limit(100),
    sb.from('perfiles').select('*').eq('cliente_id', id).maybeSingle()
  ]);
  pfDatos = { compras: cm.data || [], pagos: pg.data || [], comp: cp.data || [], premios: pr.data || [], perfil: pf.data || { cliente_id: id } };
  perfiles[id] = Object.assign(perfiles[id] || {}, pfDatos.perfil);
  renderPerfil();
}
function analisis(compras) {
  const cs = [...compras].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const dia = f => Math.floor(new Date(f).getTime() / 86400000), ahora = Date.now();
  const prods = {};
  cs.forEach(f => {
    const r = prods[f.producto_nombre] || (prods[f.producto_nombre] = { n: f.producto_nombre, u: 0, veces: 0, total: 0, dias: [], ult: null });
    r.u += f.cantidad; r.veces++; r.total += Number(f.monto); r.dias.push(dia(f.fecha)); r.ult = f.fecha;
  });
  const lista = Object.values(prods).map(r => {
    const ds = [...new Set(r.dias)], gaps = ds.slice(1).map((d, i) => d - ds[i]);
    r.cada = gaps.length ? gaps.reduce((s, x) => s + x, 0) / gaps.length : null;
    r.desde = Math.floor((ahora - new Date(r.ult)) / 86400000);
    return r;
  }).sort((a, b) => b.u - a.u || b.total - a.total);
  const dias = [...new Set(cs.map(f => dia(f.fecha)))], gapsAll = dias.slice(1).map((d, i) => d - dias[i]);
  const total = sumar(cs, f => f.monto);
  const pagadas = cs.filter(f => f.pagada_en && !f.historico);
  return {
    lista, total, pedidos: cs.length, ticket: cs.length ? total / cs.length : 0,
    cada: gapsAll.length ? gapsAll.reduce((s, x) => s + x, 0) / gapsAll.length : null,
    horas: pagadas.length ? sumar(pagadas, f => (new Date(f.pagada_en) - new Date(f.fecha)) / 3600000) / pagadas.length : null,
    puntualidad: pagadas.length ? pagadas.filter(f => new Date(f.pagada_en).toISOString().slice(0, 10) <= f.vence).length / pagadas.length : null,
    ultima: cs.length ? cs[cs.length - 1].fecha : null
  };
}
function accionesCliente(a, pend, p) {
  const t = [], c = a.lista[0];
  if (c) {
    if (c.cada && c.desde >= c.cada * 1.3) t.push(`🛒 Suele llevar <b>${esc(c.n)}</b> cada ${Math.round(c.cada)} días y ya pasaron ${c.desde}. Buen momento para ofrecérselo.`);
    else if (c.cada) t.push(`✅ Va al ritmo con <b>${esc(c.n)}</b>: lo compra cada ${Math.round(c.cada)} días y la última vez fue hace ${c.desde}.`);
    else t.push(`⭐ Su producto más comprado es <b>${esc(c.n)}</b> (${c.u} u.).`);
  }
  if (a.ultima) { const d = Math.floor((Date.now() - new Date(a.ultima)) / 86400000); if (d >= 30) t.push(`💤 No compra hace ${d} días. Un mensaje o una promoción puede reactivarlo.`); }
  const venc = pend.filter(f => f.vence < hoyISO());
  if (venc.length) t.push(`⏰ Tiene ${money(sumar(venc, resta))} vencido. Envíale su estado de cuenta.`);
  if (a.puntualidad !== null) t.push(a.puntualidad >= 0.8 ? `👍 Paga a tiempo (${Math.round(a.puntualidad * 100)}% de sus pagos).` : `⚠️ Solo el ${Math.round(a.puntualidad * 100)}% de sus pagos llegó a tiempo. Considera pedirle pago inmediato.`);
  const d = diasParaCumple(p.cumple);
  if (d !== null && d <= 14) t.push(d === 0 ? '🎂 ¡Hoy cumple años! Es el momento de su premio.' : `🎂 Cumple años en ${d} días.`);
  if (!p.telefono && !p.correo) t.push('📇 No tienes cómo contactarlo: agrega su teléfono o correo.');
  if (!t.length) t.push('Aún no hay suficientes datos para sugerir acciones.');
  return t;
}
function renderPerfil() {
  const id = pfCliente, d = pfDatos, p = d.perfil || {}, a = analisis(d.compras);
  const pend = d.compras.filter(f => !f.pagada), compPorId = {};
  d.comp.forEach(c => compPorId[c.id] = c);
  const cumple = p.cumple ? new Date(p.cumple + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long' }) : '';
  const stat = (v, k) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`;
  $('pbody').innerHTML = `
    <div style="display:flex;gap:14px;align-items:center">${avatarHtml(id, true)}
      <div><h2 style="margin:0">${esc(nombreDe(id))}</h2><div class="mu">${id}${cumple ? ' · 🎂 ' + esc(cumple) : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          <label class="btn sm" style="cursor:pointer;margin:0;display:inline-block">📷 Foto<input type="file" accept="image/*" id="pf-foto" hidden></label>
          ${p.avatar_url ? '<button class="btn sm" id="pf-quitar" style="margin:0">Quitar foto</button>' : ''}
        </div></div></div>
    <details><summary>Elegir un avatar</summary><div class="emoji">${AVATARES.map(e => `<button data-emo="${e}">${e}</button>`).join('')}</div></details>

    <div class="stats">
      ${stat(money(a.total), 'Comprado')}${stat(a.pedidos, 'Pedidos')}${stat(money(a.ticket), 'Ticket promedio')}
      ${stat(a.cada ? 'cada ' + Math.round(a.cada) + ' d' : '—', 'Frecuencia de compra')}${stat(money(sumar(pend, resta)), 'Pendiente')}${stat(fh(a.horas), 'Tarda en pagar')}
    </div>

    <div class="sec"><h3>Para accionar</h3>${accionesCliente(a, pend, p).map(t => `<div class="tip">${t}</div>`).join('')}</div>

    <div class="sec"><h3>Productos que compra</h3>
      ${a.lista.length ? a.lista.map((r, i) => `<div class="line"><div>${i === 0 ? '⭐ ' : ''}<b>${esc(r.n)}</b>${i === 0 ? ' <span class="badge ok">Más comprado</span>' : ''}
        <div class="mu">${r.veces} ${r.veces === 1 ? 'compra' : 'compras'} · ${r.cada ? 'lo compra cada ' + Math.round(r.cada) + ' días' : 'una sola vez'} · última hace ${r.desde} d</div></div>
        <div style="text-align:right"><b>${r.u} u.</b><div class="mu">${money(r.total)}</div></div></div>`).join('') : '<div class="mu">Todavía no ha comprado.</div>'}</div>

    <div class="sec"><h3>Pagos realizados</h3>
      ${d.pagos.length ? d.pagos.map(x => { const m = /Comprobante #(\d+)/.exec(x.nota || ''), sc = m && compPorId[m[1]];
        return `<div class="line"><div>${fdate(x.fecha)} · ${esc(x.metodo)}${x.nota ? '<div class="mu">' + esc(x.nota) + '</div>' : ''}</div>
          <div style="text-align:right"><b>${money(x.monto)}</b>${sc ? `<div><button class="btn sm" data-sp="${esc(sc.archivo_path)}">Ver soporte</button></div>` : ''}</div></div>`; }).join('')
        : '<div class="mu">Sin pagos registrados.</div>'}</div>

    ${d.comp.length ? `<div class="sec"><h3>Soportes enviados por el cliente</h3>${d.comp.map(c => `<div class="line"><div>${fdate(c.fecha)} · ${Number(c.monto) > 0 ? money(c.monto) : ''}
        <span class="badge ${c.estado === 'verificado' ? 'ok' : c.estado === 'rechazado' ? 'mal' : ''}">${esc(c.estado)}</span>${c.nota ? '<div class="mu">' + esc(c.nota) + '</div>' : ''}</div>
        <button class="btn sm" data-sp="${esc(c.archivo_path)}">Ver captura</button></div>`).join('')}</div>` : ''}

    <div class="sec"><h3>Pendiente por pagar</h3>
      ${pend.length ? pend.map(f => `<div class="line"><div>${f.cantidad} × ${esc(f.producto_nombre)}<div class="mu">${f.vence < hoyISO() ? '<b class="low">Vencido</b> · ' : ''}${modTxt(f)}</div></div><b>${money(resta(f))}</b></div>`).join('')
        : '<div class="mu">No debe nada. 🎉</div>'}</div>

    <div class="sec"><h3>Premios</h3>
      ${d.premios.length ? d.premios.map(x => `<div class="line"><div>🎁 ${esc(x.descripcion)}<div class="mu">${TIPOS[x.tipo] || x.tipo} · ${fdate(x.fecha)}${x.nota ? ' · ' + esc(x.nota) : ''}</div></div>
        ${x.entregado ? '<span class="badge ok">Entregado</span>' : `<button class="btn sm" data-ent="${x.id}">Marcar entregado</button>`}</div>`).join('') : '<div class="mu">Aún no tiene premios.</div>'}
      <details><summary>🎁 Premiar a este cliente</summary>
        <label>¿Qué le das?</label><input id="pf-pdesc" placeholder="Ej: Una soda gratis por su cumpleaños">
        <label>Motivo</label><select id="pf-ptipo"><option value="personalizado">Premio libre</option><option value="cumpleanos">Cumpleaños</option></select>
        <button class="btn go" id="pf-premiar">Registrar premio</button><div class="msg" id="pf-pmsg"></div></details></div>

    <div class="sec"><h3>Datos de contacto</h3>
      <div class="row"><div><label>Teléfono</label><input id="pf-telefono" value="${esc(p.telefono || '')}" inputmode="tel"></div>
        <div><label>Correo</label><input id="pf-correo" value="${esc(p.correo || '')}" type="email"></div></div>
      <div class="row"><div><label>Instagram</label><input id="pf-instagram" value="${esc(p.instagram || '')}" placeholder="@usuario"></div>
        <div><label>Facebook</label><input id="pf-facebook" value="${esc(p.facebook || '')}"></div></div>
      <div class="row"><div><label>TikTok</label><input id="pf-tiktok" value="${esc(p.tiktok || '')}"></div>
        <div><label>Cumpleaños</label><input id="pf-cumple" type="date" value="${esc(p.cumple || '')}"></div></div>
      <label>Otras redes</label><input id="pf-otras" value="${esc(p.otras || '')}">
      <label>Notas privadas</label><textarea id="pf-notas" rows="2">${esc(p.notas || '')}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn go" id="pf-guardar">Guardar datos</button>
        ${p.telefono ? `<a href="https://wa.me/${String(p.telefono).replace(/\D/g, '')}" target="_blank" rel="noopener" style="margin-top:12px">WhatsApp</a>` : ''}
        ${p.correo ? `<a href="mailto:${esc(p.correo)}" style="margin-top:12px">Correo</a>` : ''}</div>
      <div class="msg" id="pf-msg"></div></div>`;
}
async function guardarPerfil(campos) {
  const fila = Object.assign({ cliente_id: pfCliente, actualizado: new Date().toISOString() }, campos);
  const { error } = await sb.from('perfiles').upsert(fila);
  if (error) { alert('No se pudo guardar: ' + (/perfiles/.test(error.message) ? 'falta ejecutar supabase_v11.sql en Supabase.' : error.message)); return false; }
  Object.assign(pfDatos.perfil, campos); perfiles[pfCliente] = Object.assign(perfiles[pfCliente] || {}, campos);
  return true;
}
async function fotoAAvatar(file) {
  const bmp = await createImageBitmap(file), lado = Math.min(bmp.width, bmp.height);
  const cv = document.createElement('canvas'); cv.width = cv.height = 192;
  cv.getContext('2d').drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, 192, 192);
  return cv.toDataURL('image/jpeg', 0.82);
}
async function verSoporte(path) {
  const { data, error } = await sb.storage.from('comprobantes').createSignedUrl(path, 600);
  if (error) { alert('No se pudo abrir el soporte.'); return; }
  window.open(data.signedUrl, '_blank') || (location.href = data.signedUrl);
}
const vacio = v => (v && String(v).trim()) || null;
$('pbody').onclick = async e => {
  const t = e.target;
  const sp = t.closest('[data-sp]'), emo = t.closest('[data-emo]'), ent = t.closest('[data-ent]');
  if (sp) { verSoporte(sp.dataset.sp); return; }
  if (emo) { if (await guardarPerfil({ avatar: emo.dataset.emo, avatar_url: null })) { renderPerfil(); renderClientes(); } return; }
  if (t.closest('#pf-quitar')) { if (await guardarPerfil({ avatar_url: null })) { renderPerfil(); renderClientes(); } return; }
  if (ent) {
    await sb.from('premios').update({ entregado: true }).eq('id', ent.dataset.ent);
    [pfDatos.premios, premiosAll].forEach(l => l.forEach(x => { if (x.id == ent.dataset.ent) x.entregado = true; }));
    renderPerfil(); renderPremiosLista(); return;
  }
  if (t.closest('#pf-guardar')) {
    const ok = await guardarPerfil({
      telefono: vacio($('pf-telefono').value), correo: vacio($('pf-correo').value), instagram: vacio($('pf-instagram').value),
      facebook: vacio($('pf-facebook').value), tiktok: vacio($('pf-tiktok').value), otras: vacio($('pf-otras').value),
      cumple: $('pf-cumple').value || null, notas: vacio($('pf-notas').value)
    });
    if (ok) { renderPerfil(); renderClientes(); say('pf-msg', 'Datos guardados.'); }
    return;
  }
  if (t.closest('#pf-premiar')) {
    const desc = $('pf-pdesc').value.trim();
    if (!desc) { say('pf-pmsg', 'Escribe qué premio le das.', true); return; }
    const { data, error } = await sb.from('premios').insert({ cliente_id: pfCliente, tipo: $('pf-ptipo').value, descripcion: desc }).select().single();
    if (error) { say('pf-pmsg', 'No se pudo registrar: ' + error.message, true); return; }
    pfDatos.premios.unshift(data); premiosAll.unshift(data);
    renderPerfil(); renderPremiosLista();
  }
};
$('pbody').onchange = async e => {
  if (e.target.id !== 'pf-foto' || !e.target.files[0]) return;
  try { if (await guardarPerfil({ avatar_url: await fotoAAvatar(e.target.files[0]) })) { renderPerfil(); renderClientes(); } }
  catch (err) { alert('No se pudo usar esa foto.'); }
};
$('pcl').onclick = () => $('perfil').classList.add('hide');

/* ================= REGLAS DE PREMIO ================= */
function llenarSelectoresPremios() {
  const nombres = [...new Set(prods.map(p => p.nombre))].sort();
  const o = nombres.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  $('rprod').innerHTML = o; $('tprod').innerHTML = o;
}
function ajustarFormRegla() {
  const t = $('rt').value;
  $('rprodw').classList.toggle('hide', !(t === 'producto' || t === 'mas_producto'));
  $('rminw').classList.toggle('hide', t !== 'producto');
  $('rperw').classList.toggle('hide', t === 'cumpleanos');
}
$('rt').onchange = ajustarFormRegla; ajustarFormRegla();
$('tpool').onchange = () => $('tprodw').classList.toggle('hide', $('tpool').value !== 'producto');

$('radd').onclick = async () => {
  const tipo = $('rt').value, nombre = $('rn').value.trim(), premio = $('rp').value.trim();
  if (!nombre || !premio) { say('rmsg', 'Escribe el nombre de la regla y el premio.', true); return; }
  const usaProd = tipo === 'producto' || tipo === 'mas_producto';
  if (usaProd && !$('rprod').value) { say('rmsg', 'Primero carga productos para elegir uno.', true); return; }
  const { error } = await sb.from('reglas_premio').insert({
    tipo, nombre, premio, producto: usaProd ? $('rprod').value : null,
    minimo: tipo === 'producto' ? Math.max(1, parseInt($('rmin').value, 10) || 1) : 1, periodo: tipo === 'cumpleanos' ? 'todo' : $('rper').value
  });
  if (error) { say('rmsg', 'No se pudo guardar: ' + (/reglas_premio/.test(error.message) ? 'falta ejecutar supabase_v11.sql.' : error.message), true); return; }
  ['rn', 'rp'].forEach(i => $(i).value = ''); say('rmsg', 'Regla guardada.'); loadClientes();
};
function renderReglas() {
  $('rlist').innerHTML = reglas.length ? reglas.map(r => `
    <div class="line" style="align-items:flex-start"><div><strong>${esc(r.nombre)}</strong> <span class="badge">${TIPOS[r.tipo]}</span>
      <div class="mu">Premio: ${esc(r.premio)}${r.producto ? ' · ' + esc(r.producto) : ''}${r.tipo === 'producto' ? ' · mínimo ' + r.minimo + ' u.' : ''}${r.tipo !== 'cumpleanos' ? ' · ' + (r.periodo === 'mes' ? 'este mes' : 'todo el tiempo') : ''}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn sm" data-rv="${r.id}">Ver quién gana</button><button class="btn sm red" data-rq="${r.id}">Quitar</button></div></div>
    <div id="rc-${r.id}"></div>`).join('') : '<div class="mu">Todavía no tienes reglas. Crea la primera abajo.</div>';
}
async function candidatos(r) {
  const yaPremiado = c => premiosAll.some(p => p.regla_id === r.id && p.cliente_id === c &&
    (r.tipo === 'cumpleanos' ? new Date(p.fecha).getFullYear() === new Date().getFullYear() : (r.periodo === 'mes' ? new Date(p.fecha) >= inicioMes() : true)));
  let lista = [];
  if (r.tipo === 'cumpleanos') {
    lista = resumenCli.map(c => ({ id: c.cliente_id, d: diasParaCumple((perfiles[c.cliente_id] || {}).cumple) }))
      .filter(x => x.d !== null && x.d <= 7).sort((a, b) => a.d - b.d)
      .map(x => ({ id: x.id, texto: x.d === 0 ? '🎂 ¡Cumple hoy!' : `Cumple en ${x.d} días` }));
  } else {
    const { data, error } = await sb.rpc('compras_por_cliente', { p_desde: r.periodo === 'mes' ? inicioMes().toISOString() : null });
    if (error) return null;
    const filas = data || [];
    if (r.tipo === 'producto') lista = filas.filter(x => x.producto === r.producto && Number(x.unidades) >= r.minimo)
      .sort((a, b) => b.unidades - a.unidades).map(x => ({ id: x.cliente_id, texto: `${x.unidades} u. de ${r.producto}` }));
    if (r.tipo === 'mas_producto') {
      const f = filas.filter(x => x.producto === r.producto).sort((a, b) => b.unidades - a.unidades);
      lista = f.length ? f.filter(x => x.unidades === f[0].unidades).map(x => ({ id: x.cliente_id, texto: `${x.unidades} u. de ${r.producto}` })) : [];
    }
    if (r.tipo === 'mas_compra') {
      const t = {}; filas.forEach(x => { t[x.cliente_id] = (t[x.cliente_id] || 0) + Number(x.total); });
      const arr = Object.entries(t).sort((a, b) => b[1] - a[1]);
      lista = arr.length ? arr.filter(([, v]) => v === arr[0][1]).map(([id, v]) => ({ id, texto: `${money(v)} comprados` })) : [];
    }
  }
  return lista.map(x => ({ ...x, ya: yaPremiado(x.id) }));
}
$('rlist').onclick = async e => {
  const v = e.target.closest('[data-rv]'), q = e.target.closest('[data-rq]'), pr = e.target.closest('[data-prem]');
  if (v) {
    const r = reglas.find(x => x.id == v.dataset.rv), box = $('rc-' + r.id);
    box.innerHTML = '<div class="mu">Buscando…</div>';
    const c = await candidatos(r);
    box.innerHTML = c === null ? FALTA11 : (c.length ? c.map(x => `<div class="line" style="padding-left:10px">${avatarHtml(x.id)}<div style="flex:1"><b>${esc(nombreDe(x.id))}</b><div class="mu">${esc(x.texto)}</div></div>
      ${x.ya ? '<span class="badge ok">✔ Ya premiado</span>' : `<button class="btn sm" data-prem="${r.id}|${x.id}">🎁 Premiar</button>`}</div>`).join('')
      : '<div class="mu" style="padding-left:10px">Nadie cumple esta regla por ahora.</div>');
  }
  if (q) {
    if (!confirm('¿Quitar esta regla? Los premios ya dados se conservan.')) return;
    await sb.from('reglas_premio').update({ activa: false }).eq('id', q.dataset.rq); loadClientes();
  }
  if (pr) {
    const [rid, cid] = pr.dataset.prem.split('|'), r = reglas.find(x => x.id == rid);
    const { data, error } = await sb.from('premios').insert({ cliente_id: cid, tipo: r.tipo, descripcion: r.premio, regla_id: r.id }).select().single();
    if (error) { alert('No se pudo registrar: ' + error.message); return; }
    premiosAll.unshift(data); renderPremiosLista();
    pr.outerHTML = '<span class="badge ok">✔ Premiado</span>';
  }
};
function renderPremiosLista() {
  $('plst').innerHTML = premiosAll.length ? premiosAll.slice(0, 15).map(x => `<div class="line">${avatarHtml(x.cliente_id)}
    <div style="flex:1;min-width:0"><b>${esc(nombreDe(x.cliente_id))}</b> · ${esc(x.descripcion)}<div class="mu">${TIPOS[x.tipo] || x.tipo} · ${fdate(x.fecha)}</div></div>
    ${x.entregado ? '<span class="badge ok">Entregado</span>' : `<button class="btn sm" data-ent2="${x.id}">Entregado</button>`}</div>`).join('')
    : '<div class="mu">Aún no has dado premios.</div>';
}
$('plst').onclick = async e => {
  const b = e.target.closest('[data-ent2]'); if (!b) return;
  await sb.from('premios').update({ entregado: true }).eq('id', b.dataset.ent2);
  premiosAll.forEach(x => { if (x.id == b.dataset.ent2) x.entregado = true; }); renderPremiosLista();
};

/* ================= TÓMBOLA ================= */
function numeroAzar(n) {
  const b = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
  do { crypto.getRandomValues(b); } while (b[0] >= lim);   // sin sesgo
  return b[0] % n;
}
function sortear(ids, k) { const a = [...ids], g = []; while (g.length < k && a.length) g.push(a.splice(numeroAzar(a.length), 1)[0]); return g; }
async function participantes() {
  const modo = $('tpool').value; let ids = resumenCli.map(c => c.cliente_id);
  if (modo === 'sindeuda') ids = resumenCli.filter(c => Number(c.vencido) <= 0).map(c => c.cliente_id);
  if (modo === 'mes' || modo === 'producto') {
    const { data, error } = await sb.rpc('compras_por_cliente', { p_desde: modo === 'mes' ? inicioMes().toISOString() : null });
    if (error) return null;
    let filas = data || []; if (modo === 'producto') filas = filas.filter(x => x.producto === $('tprod').value);
    const s = new Set(filas.map(x => x.cliente_id)); ids = ids.filter(i => s.has(i));
  }
  return ids;
}
$('tsort').onclick = async () => {
  const premio = $('tn').value.trim();
  if (!premio) { say('tmsg2', 'Escribe el premio de la tómbola.', true); return; }
  if (!resumenCli.length) { say('tmsg2', 'Primero abre la lista de clientes (falta ejecutar supabase_v11.sql).', true); return; }
  const ids = await participantes();
  if (ids === null) { say('tmsg2', 'Falta ejecutar supabase_v11.sql en Supabase.', true); return; }
  if (!ids.length) { say('tmsg2', 'Nadie cumple ese filtro.', true); return; }
  say('tmsg2', '');
  $('tsort').disabled = true;
  let i = 0; const nombres = ids.map(nombreDe);
  const giro = setInterval(() => { $('tres').innerHTML = `<div class="total" style="text-align:center;margin:12px 0">🎰 ${esc(nombres[i++ % nombres.length])}</div>`; }, 70);
  await new Promise(r => setTimeout(r, 1800)); clearInterval(giro);
  const k = Math.min(Math.max(1, parseInt($('tnum').value, 10) || 1), ids.length);
  tombola = { premio, ganadores: sortear(ids, k), total: ids.length };
  $('tres').innerHTML = `<div class="tip" style="margin-top:10px"><b>🎉 ${tombola.ganadores.length === 1 ? 'Ganador' : 'Ganadores'}</b> (entre ${tombola.total} participantes)
    ${tombola.ganadores.map(g => `<div class="line">${avatarHtml(g)}<b style="flex:1">${esc(nombreDe(g))}</b></div>`).join('')}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn go" id="treg" style="margin:0">Registrar premio</button><button class="btn sm" id="tmas">Sortear de nuevo</button></div></div>`;
  $('tsort').disabled = false;
};
$('tres').onclick = async e => {
  if (e.target.closest('#tmas')) { $('tsort').click(); return; }
  if (!e.target.closest('#treg') || !tombola) return;
  const nota = `Tómbola del ${fdate(new Date())} · ${tombola.total} participantes`;
  const filas = tombola.ganadores.map(g => ({ cliente_id: g, tipo: 'tombola', descripcion: tombola.premio, nota }));
  const { data, error } = await sb.from('premios').insert(filas).select();
  if (error) { say('tmsg2', 'No se pudo registrar: ' + error.message, true); return; }
  premiosAll = (data || []).concat(premiosAll); tombola = null;
  $('tres').innerHTML = '<div class="msg">Premio registrado. Puedes marcarlo como entregado en "Últimos premios".</div>';
  $('tn').value = ''; renderPremiosLista(); renderTombolaHist();
};
function renderTombolaHist() {
  const h = premiosAll.filter(x => x.tipo === 'tombola').slice(0, 10);
  $('thist').innerHTML = h.length ? h.map(x => `<div class="line"><div><b>${esc(nombreDe(x.cliente_id))}</b> ganó ${esc(x.descripcion)}<div class="mu">${esc(x.nota || fdate(x.fecha))}</div></div></div>`).join('') : '<div class="mu">Todavía no has hecho tómbolas.</div>';
}
