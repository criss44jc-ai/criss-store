/* CRISS’ STORE · Administrador (parte 1): datos, inventario, compras a proveedor, cobros y abonos */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '$' + Number(n || 0).toFixed(2);
const say = (id, t, err) => { const e = $(id); e.textContent = t; e.classList.toggle('err', !!err); };
const fdate = d => new Date(d).toLocaleDateString('es');
const fvence = v => new Date(v + 'T00:00:00').toLocaleDateString('es');
const hoyISO = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); };
const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

let clientes = [], prods = [], pend = [], ajustes = {}, isAdmin = false;
const nombreDe = id => (clientes.find(c => c.id === id) || {}).nombre || id;
const resta = f => Number(f.monto) - Number(f.pagado);
const modTxt = f => f.modalidad === 'inmediato' ? 'Pago inmediato'
  : (f.modalidad === 'anterior' ? 'Pedido anterior · ' : '') + 'Vence ' + fvence(f.vence);

/* ---------- Pestañas y sesión ---------- */
function tab(t) {
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('hide', p.id !== 't-' + t));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'cli' && typeof loadClientes === 'function') loadClientes();
}
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => tab(b.dataset.t));
$('lg').onclick = async () => {
  const { error } = await sb.auth.signInWithPassword({ email: $('em').value.trim(), password: $('pw').value });
  say('lm', error ? 'Correo o contraseña incorrectos.' : '', true);
};
$('out').onclick = () => sb.auth.signOut();

/* ---------- Carga general ---------- */
async function loadAll() {
  const [cl, p, c] = await Promise.all([
    sb.from('clientes').select('*').order('id'),
    sb.from('productos').select('*').eq('activo', true).order('id'),
    sb.from('compras').select('*').eq('pagada', false).order('vence').order('id')
  ]);
  clientes = cl.data || []; prods = p.data || []; pend = c.data || [];
  fillClients(); renderAlerts(); renderProds(); renderProdSelect(); renderCob(); loadEntradas(); loadComps();
  if (typeof loadExtras === 'function') loadExtras();
  if (typeof loadReports === 'function') loadReports();
}
function fillClients() {
  const v = $('cs').value;
  const opts = clientes.map(c => `<option value="${c.id}">${c.id} · ${esc(c.nombre)}</option>`).join('');
  $('cs').innerHTML = '<option value="">Resumen de todos</option>' + opts;
  if (v) $('cs').value = v;
  const w = $('npc').value;
  $('npc').innerHTML = '<option value="">Elige el cliente</option>' + opts;
  if (w) $('npc').value = w;
  const h = $('hcl').value;
  $('hcl').innerHTML = '<option value="">Elige el cliente</option>' + opts;
  if (h) $('hcl').value = h;
}

/* ---------- Imágenes ---------- */
async function reducir(file, max = 800, q = 0.82) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise(res => cv.toBlob(res, 'image/jpeg', q));
}
async function subir(file, pre, max, q) {
  const blob = await reducir(file, max, q);
  const path = pre + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
  const up = await sb.storage.from('productos').upload(path, blob, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  return sb.storage.from('productos').getPublicUrl(path).data.publicUrl;
}
async function subirFactura(file) {   // bucket privado
  const img = file.type.startsWith('image/');
  const blob = img ? await reducir(file, 1600, 0.85) : file;
  const path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + (img ? '.jpg' : '.pdf');
  const up = await sb.storage.from('facturas').upload(path, blob, { contentType: img ? 'image/jpeg' : file.type });
  if (up.error) throw up.error;
  return path;
}

/* ---------- Inventario ---------- */
function renderAlerts() {
  const low = prods.filter(p => p.stock <= p.umbral).sort((a, b) => a.stock - b.stock);
  $('alerts').innerHTML = low.length ? low.map(p => `
    <div class="alert"><strong>${p.stock === 0 ? 'Agotado' : 'Quedan ' + p.stock}</strong> · ${esc(p.nombre)}
      <div class="mu">Repón de la misma marca y especificación: ${esc([p.marca, p.especificacion].filter(Boolean).join(' · ') || 'sin datos')}</div>
      <button class="btn sm" data-rep="${p.id}" style="margin-top:6px">Registrar compra a proveedor</button>
    </div>`).join('') : '<span class="mu">Todo el inventario está al día.</span>';
}
function renderProdSelect() {
  const v = $('ep').value;
  $('ep').innerHTML = prods.map(p => `<option value="${p.id}">${esc(p.nombre)}${p.marca ? ' · ' + esc(p.marca) : ''} (${p.stock}) · ${money(p.precio)}</option>`).join('');
  if (v) $('ep').value = v;
  const w = $('npp').value;
  $('npp').innerHTML = prods.filter(p => p.stock > 0).map(p => `<option value="${p.id}">${esc(p.nombre)}${p.marca ? ' · ' + esc(p.marca) : ''} (${p.stock}) · ${money(p.precio)}</option>`).join('');
  if (w) $('npp').value = w;
  $('hprl').innerHTML = prods.map(p => `<option value="${esc(p.nombre)}">`).join('');
}
function renderProds() {
  const L = $('plist');
  if (!prods.length) { L.innerHTML = '<div class="mu">Aún no hay productos. Carga el primero arriba.</div>'; return; }
  L.innerHTML = prods.map(p => {
    const marg = p.precio > 0 && p.costo > 0 ? Math.round(100 * (p.precio - p.costo) / p.precio) + '%' : 'sin costo';
    return `
    <div class="card pcard">
      ${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="">` : '<div class="ph">🛍️</div>'}
      <div>
        <strong>${esc(p.nombre)}</strong>
        <div class="mu">${esc(p.codigo)} · ${esc([p.marca, p.especificacion].filter(Boolean).join(' · '))}</div>
        <div>Precio ${money(p.precio)} · Costo ${money(p.costo)} · Margen ${marg}</div>
        <div>Existencia: <span class="${p.stock <= p.umbral ? 'low' : ''}">${p.stock}</span></div>
        <select data-cat="${p.id}" aria-label="Categoría" style="margin-top:6px;padding:6px;font-size:14px;width:auto">
          ${['snack', 'bebida', 'comida', 'otro'].map(k => `<option value="${k}" ${p.categoria === k ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button class="btn sm" data-rep="${p.id}">Comprar a proveedor</button>
          <button class="btn sm" data-pr="${p.id}">Cambiar precio</button>
          <label class="btn sm" style="cursor:pointer;margin:0;display:inline-block">Cambiar foto<input type="file" accept="image/*" hidden data-img="${p.id}"></label>
          <button class="btn sm red" data-del="${p.id}">Quitar</button>
        </div>
        <div class="qr" id="qr-${p.id}"></div>
      </div>
    </div>`;
  }).join('');
  prods.forEach(p => {
    try { new QRCode($('qr-' + p.id), { text: location.origin + '/?p=' + p.codigo, width: 110, height: 110 }); } catch (e) {}
  });
}
document.addEventListener('click', async e => {
  const r = e.target.closest('[data-rep]'), d = e.target.closest('[data-del]');
  if (r) { tab('inv'); $('ep').value = r.dataset.rep; $('ec').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (d) {
    const p = prods.find(x => x.id == d.dataset.del);
    if (!confirm(`¿Quitar ${p.nombre} del catálogo? Las compras anteriores se conservan.`)) return;
    await sb.from('productos').update({ activo: false }).eq('id', p.id);
    loadAll();
  }
});

document.addEventListener('change', async e => {
  const s = e.target.closest('[data-cat]');
  if (!s) return;
  const { error } = await sb.from('productos').update({ categoria: s.value }).eq('id', s.dataset.cat);
  if (error) alert('No se pudo cambiar la categoría. ¿Ya ejecutaste supabase_v4.sql?');
  else { const p = prods.find(x => x.id == s.dataset.cat); if (p) p.categoria = s.value; }
});

$('addp').onclick = async () => {
  const nombre = $('pn').value.trim(), precio = parseFloat($('pp').value), stock = parseInt($('ps').value, 10);
  const costo = parseFloat($('pc').value) || 0;
  if (!nombre || isNaN(precio) || isNaN(stock)) { say('pmsg', 'Completa nombre, precio y existencia.', true); return; }
  $('addp').disabled = true; say('pmsg', 'Guardando…');
  try {
    const f = $('pf').files[0];
    const imagen_url = f ? await subir(f, 'prod', 800, 0.82) : null;
    const { data, error } = await sb.from('productos').insert({
      nombre, marca: $('pm').value.trim() || null, especificacion: $('pe').value.trim() || null,
      precio, costo, stock, umbral: parseInt($('pu').value, 10) || 2, imagen_url, categoria: $('pk').value
    }).select().single();
    if (error) throw error;
    const fr = $('pfr').value.trim();
    let frMsg = '';
    if (fr.length >= 3) {
      const r = await sb.from('frases').insert({ texto: fr, momento: 'entrada', codigo: data.codigo });
      frMsg = r.error ? ' La frase de la mascota no se guardó (¿ejecutaste supabase_v8.sql?).' : ' La mascota ya sabe promocionarlo.';
    }
    ['pn', 'pm', 'pe', 'pp', 'pc', 'ps', 'pf', 'pfr'].forEach(i => $(i).value = '');
    say('pmsg', `Producto ${data.codigo} guardado.` + (costo ? '' : ' Recuerda cargar su costo con una compra a proveedor.') + frMsg);
    loadAll();
  } catch (e) { say('pmsg', 'No se pudo guardar: ' + (e.message || e), true); }
  $('addp').disabled = false;
};

/* ---------- Compras a proveedor (facturas) ---------- */
$('eadd').onclick = async () => {
  const id = parseInt($('ep').value, 10), cant = parseInt($('ec').value, 10), tot = parseFloat($('et').value);
  if (!id || !(cant > 0) || isNaN(tot) || tot < 0) { say('emsg', 'Elige producto, unidades y total pagado.', true); return; }
  $('eadd').disabled = true; say('emsg', 'Guardando…');
  try {
    const f = $('ef').files[0];
    const path = f ? await subirFactura(f) : null;
    const { error } = await sb.rpc('registrar_entrada', {
      p_producto: id, p_cantidad: cant, p_costo_total: tot,
      p_proveedor: $('ev').value.trim() || null, p_nota: $('en').value.trim() || null, p_factura_path: path
    });
    if (error) throw error;
    ['ec', 'et', 'ev', 'en', 'ef'].forEach(i => $(i).value = '');
    say('emsg', 'Compra registrada: la existencia y el costo promedio ya se actualizaron.');
    loadAll();
  } catch (e) { say('emsg', 'No se pudo registrar: ' + (e.message || e), true); }
  $('eadd').disabled = false;
};
async function loadEntradas() {
  const { data, error } = await sb.from('entradas').select('*').order('id', { ascending: false }).limit(10);
  if (error) { $('elist').innerHTML = '<div class="mu" style="margin-top:8px">Falta ejecutar supabase_v3.sql en Supabase.</div>'; return; }
  $('elist').innerHTML = (data && data.length ? '<div class="mu" style="margin-top:12px">Últimas compras a proveedor</div>' : '') +
    (data || []).map(r => `<div class="line"><div>${r.cantidad} × ${esc(r.producto_nombre)}
      <div class="mu">${fdate(r.fecha)}${r.proveedor ? ' · ' + esc(r.proveedor) : ''}</div></div>
      <div><strong>${money(r.costo_total)}</strong> ${r.factura_path ? `<button class="btn sm" data-fac="${esc(r.factura_path)}">Ver factura</button>` : ''}</div></div>`).join('');
}
$('elist').onclick = async e => {
  const b = e.target.closest('[data-fac]');
  if (!b) return;
  const { data, error } = await sb.storage.from('facturas').createSignedUrl(b.dataset.fac, 600);
  if (error) { alert('No se pudo abrir la factura.'); return; }
  window.open(data.signedUrl, '_blank') || (location.href = data.signedUrl);
};

/* ---------- Cobros y abonos ---------- */
function renderCob() {
  const c = $('cs').value, box = $('cd'), hoy = hoyISO();
  if (!c) {
    const t = {};
    pend.forEach(f => {
      const r = t[f.cliente_id] || (t[f.cliente_id] = { debe: 0, vence: f.vence, items: {} });
      r.debe += resta(f); if (f.vence < r.vence) r.vence = f.vence;
      r.items[f.producto_nombre] = (r.items[f.producto_nombre] || 0) + f.cantidad;
    });
    const ks = Object.keys(t).sort((a, b) => t[a].vence.localeCompare(t[b].vence));
    const all = ks.reduce((s, k) => s + t[k].debe, 0);
    box.innerHTML = ks.length ? ks.map(k => {
      const v = t[k].vence, est = v < hoy ? '<b class="low">Vencido</b> · ' : v === hoy ? '<b>Vence hoy</b> · ' : '';
      return `<div class="line"><div>${esc(nombreDe(k))} <span class="mu">${k}</span>
        <div><b>${Object.entries(t[k].items).map(([n, q]) => q + ' × ' + esc(n)).join(', ')}</b></div>
        <div class="mu">${est}Próximo pago: ${fvence(v)}</div></div><strong>${money(t[k].debe)}</strong></div>`;
    }).join('') + `<div style="margin-top:10px">Total por cobrar: <span class="total">${money(all)}</span></div>`
      : '<div class="mu" style="margin-top:8px">No hay cuentas pendientes.</div>';
    return;
  }
  const fs = pend.filter(f => f.cliente_id === c), debe = fs.reduce((s, f) => s + resta(f), 0);
  box.innerHTML = `<button class="btn go" data-stmt="${c}" style="width:100%;margin:10px 0 4px">Estado de cuenta: compartir, PDF o JPG</button>` +
    (fs.length ? fs.map(f => `
      <div class="line"><div><strong>${esc(f.factura)}</strong> · ${f.cantidad} × ${esc(f.producto_nombre)}
        <div class="mu">${f.vence < hoy ? '<b class="low">Vencida</b> · ' : ''}${modTxt(f)}${Number(f.pagado) > 0 ? ' · abonado ' + money(f.pagado) : ''}</div></div>
        <div style="text-align:right"><strong>${money(resta(f))}</strong><br>
          ${f.historico ? '' : `<button class="btn sm" style="margin:4px 4px 0 0" data-cm="${f.id}">Cambiar pago</button>`}<button class="btn sm red" style="margin-top:4px" data-anc="${f.id}" data-desc="${esc(f.cantidad + ' × ' + f.producto_nombre + ' de ' + nombreDe(f.cliente_id))}">Anular</button></div></div>`).join('') +
      `<div style="margin-top:10px">Debe: <span class="total">${money(debe)}</span></div>
       <h2 style="margin-top:16px;font-size:16px">Registrar pago</h2>
       <div class="row">
         <div><label>Monto ($)</label><input id="abm" type="number" min="0" step="0.01"></div>
         <div><label>Método</label><select id="abt"><option>efectivo</option><option>transferencia</option><option>Yappy</option><option>otro</option></select></div>
       </div>
       <label>Nota (opcional)</label><input id="abn" placeholder="Ej: abono de la quincena">
       <div style="display:flex;gap:8px;flex-wrap:wrap">
         <button class="btn go" id="abok">Registrar pago</button>
         <button class="btn sm" id="aball" style="margin-top:12px">Pagar todo</button>
       </div>
       <div class="msg" id="abmsg"></div>`
      : '<div class="mu" style="margin-top:8px">Este cliente no tiene cuentas pendientes.</div>') +
    '<div id="abh"></div>';
  loadPagos(c);
}
async function loadPagos(c) {
  const { data } = await sb.from('pagos').select('*').eq('cliente_id', c).order('id', { ascending: false }).limit(6);
  const h = $('abh');
  if (!h) return;
  h.innerHTML = data && data.length ? '<div class="mu" style="margin-top:14px">Pagos recibidos</div>' +
    data.map(p => `<div class="line"><span>${fdate(p.fecha)} · ${esc(p.metodo)}${p.nota ? ' · ' + esc(p.nota) : ''}</span>
      <span><strong>${money(p.monto)}</strong> <button class="btn sm red" data-anp="${p.id}" data-desc="el pago de ${money(p.monto)} del ${fdate(p.fecha)}">Anular</button></span></div>`).join('') : '';
}
$('cs').onchange = renderCob;
$('cd').onclick = async e => {
  const s = e.target.closest('[data-stmt]');
  if (s) { openStmt(s.dataset.stmt); return; }
  const c = $('cs').value;
  if (e.target.closest('#aball')) {
    $('abm').value = pend.filter(f => f.cliente_id === c).reduce((t, f) => t + resta(f), 0).toFixed(2);
    return;
  }
  if (e.target.closest('#abok')) {
    const m = parseFloat($('abm').value);
    if (!(m > 0)) { say('abmsg', 'Escribe el monto del pago.', true); return; }
    $('abok').disabled = true;
    const { data, error } = await sb.rpc('registrar_pago', {
      p_cliente: c, p_monto: m, p_metodo: $('abt').value, p_nota: $('abn').value.trim() || null
    });
    if (error) { $('abok').disabled = false; say('abmsg', error.message, true); return; }
    await loadAll();
    say('abmsg', Number(data) > 0.004 ? `Pago registrado. Todavía debe ${money(data)}.` : 'Pago registrado. Cuenta al día.');
  }
};

/* ---------- Cargar pedido anterior (no toca inventario ni ganancias) ---------- */
$('hfd').max = hoyISO();
$('hvd').value = hoyISO();
$('hadd').onclick = async () => {
  const c = $('hcl').value, prod = $('hpr').value.trim(), q = parseInt($('hq').value, 10);
  const m = parseFloat($('hm').value), f = $('hfd').value, v = $('hvd').value;
  if (!c || !prod || !(q > 0) || !(m > 0) || !f || !v) { say('hmsg', 'Completa cliente, producto, cantidad, monto y las dos fechas.', true); return; }
  $('hadd').disabled = true;
  const { data, error } = await sb.rpc('cargar_pedido_anterior', {
    p_cliente: c, p_producto: prod, p_cantidad: q, p_monto: m, p_fecha: f, p_vence: v
  });
  $('hadd').disabled = false;
  if (error) { say('hmsg', /cargar_pedido_anterior/.test(error.message) ? 'Falta ejecutar supabase_v7.sql en Supabase.' : error.message, true); return; }
  ['hpr', 'hm', 'hfd'].forEach(i => $(i).value = ''); $('hq').value = 1;
  await loadAll();
  say('hmsg', `Pedido anterior cargado para ${nombreDe(c)} (${data}). El inventario no cambió.`);
};

/* ---------- Cambiar el precio de un producto ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-pr]');
  if (!b) return;
  const p = prods.find(x => x.id == b.dataset.pr);
  const txt = prompt(`Nuevo precio de ${p.nombre} ($).\nSolo afecta los pedidos nuevos; los ya hechos conservan su precio.`, Number(p.precio).toFixed(2));
  if (txt === null) return;
  const v = parseFloat(String(txt).replace(',', '.'));
  if (!(v >= 0)) { alert('Escribe un precio válido.'); return; }
  const { error } = await sb.from('productos').update({ precio: v }).eq('id', p.id);
  if (error) { alert('No se pudo cambiar el precio: ' + error.message); return; }
  loadAll();
});

/* ---------- Cambiar cuándo paga un pedido ---------- */
let cmId = null;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cm]');
  if (!b) return;
  const f = pend.find(x => x.id == b.dataset.cm);
  if (!f) return;
  cmId = f.id;
  const d = new Date(f.fecha), y = d.getFullYear(), m = d.getMonth();
  const dd = x => x.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
  const q30 = new Date(y, m, Math.min(30, new Date(y, m + 1, 0).getDate()));
  $('cmtx').textContent = `${f.cantidad} × ${f.producto_nombre} · ${nombreDe(f.cliente_id)} · pedido del ${fdate(f.fecha)}`;
  $('cmsel').innerHTML = [
    ['inmediato', 'Pago inmediato'],
    ['quincena15', `Pagar el 15 (${dd(new Date(y, m, 15))})`],
    ['quincena30', `Pagar el ${q30.getDate() === 30 ? '30' : 'fin de mes'} (${dd(q30)})`]
  ].map(([v, t]) => `<option value="${v}" ${v === f.modalidad ? 'selected' : ''}>${t}</option>`).join('');
  $('cmsheet').classList.remove('hide');
});
$('cmx').onclick = () => $('cmsheet').classList.add('hide');
$('cmok').onclick = async () => {
  const { error } = await sb.rpc('cambiar_modalidad', { p_compra: cmId, p_modalidad: $('cmsel').value });
  if (error) { alert(/cambiar_modalidad/.test(error.message) ? 'Falta ejecutar supabase_v6.sql en Supabase.' : error.message); return; }
  $('cmsheet').classList.add('hide');
  loadAll();
};

/* ---------- Anular pedidos y pagos ---------- */
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-anc]'), b = e.target.closest('[data-anp]');
  if (a) {
    if (!confirm(`¿Anular ${a.dataset.desc}?\nLas unidades vuelven al inventario.`)) return;
    const { error } = await sb.rpc('anular_compra', { p_compra: Number(a.dataset.anc) });
    if (error) { alert(error.message); return; }
    loadAll();
  }
  if (b) {
    if (!confirm(`¿Anular ${b.dataset.desc}?\nLo que debe el cliente vuelve a subir.`)) return;
    const { error } = await sb.rpc('anular_pago', { p_pago: Number(b.dataset.anp) });
    if (error) { alert(error.message); return; }
    loadAll();
  }
});

/* ---------- Comprobantes de pago de los clientes ---------- */
let comps = [];
async function loadComps() {
  const { data, error } = await sb.from('comprobantes').select('*').eq('estado', 'pendiente').order('id');
  comps = data || [];
  document.querySelector('#nav [data-t=cob]').textContent = comps.length ? `Cobros (${comps.length})` : 'Cobros';
  $('comp').innerHTML = error ? '<div class="mu">Falta ejecutar supabase_v5.sql en Supabase.</div>'
    : comps.length ? comps.map(c => `
      <div class="line"><div><strong>${esc(nombreDe(c.cliente_id))}</strong> <span class="mu">${fdate(c.fecha)}</span>
        <div class="mu">${Number(c.monto) > 0 ? 'Debía pagar hoy: ' + money(c.monto) : ''}${c.nota ? ' · ' + esc(c.nota) : ''}</div></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn sm" data-vc="${esc(c.archivo_path)}">Ver captura</button>
          <button class="btn sm" data-rc="${c.id}">Registrar pago</button>
          <button class="btn sm red" data-dc="${c.id}">Descartar</button>
        </div></div>`).join('')
    : '<div class="mu">No hay comprobantes pendientes.</div>';
}
$('comp').onclick = async e => {
  const v = e.target.closest('[data-vc]'), r = e.target.closest('[data-rc]'), d = e.target.closest('[data-dc]');
  if (v) {
    const { data, error } = await sb.storage.from('comprobantes').createSignedUrl(v.dataset.vc, 600);
    if (error) { alert('No se pudo abrir la captura.'); return; }
    window.open(data.signedUrl, '_blank') || (location.href = data.signedUrl);
  }
  if (r) {
    const c = comps.find(x => x.id == r.dataset.rc);
    const txt = prompt(`Monto que recibiste de ${nombreDe(c.cliente_id)} ($):`, Number(c.monto).toFixed(2));
    const m = parseFloat(txt);
    if (!(m > 0)) return;
    const { error } = await sb.rpc('registrar_pago', { p_cliente: c.cliente_id, p_monto: m, p_metodo: 'Yappy/transferencia', p_nota: 'Comprobante #' + c.id });
    if (error) { alert(error.message); return; }
    await sb.from('comprobantes').update({ estado: 'verificado' }).eq('id', c.id);
    loadAll();
  }
  if (d) {
    if (!confirm('¿Descartar este comprobante? No se registra ningún pago.')) return;
    await sb.from('comprobantes').update({ estado: 'rechazado' }).eq('id', d.dataset.dc);
    loadAll();
  }
};

/* ---------- Crear pedido para un cliente ---------- */
function renderModsAdmin() {
  const h = new Date(), y = h.getFullYear(), m = h.getMonth();
  const hoy = new Date(y, m, h.getDate()), q15 = new Date(y, m, 15);
  const q30 = new Date(y, m, Math.min(30, new Date(y, m + 1, 0).getDate()));
  const dd = d => d.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
  const o = [
    ['inmediato', 'Pago inmediato', true],
    ['quincena15', `Pagar el 15 (${dd(q15)})`, q15 > hoy],
    ['quincena30', `Pagar el ${q30.getDate() === 30 ? '30' : 'fin de mes'} (${dd(q30)})`, q30 > hoy]
  ];
  $('npmod').innerHTML = o.map(([v, t, ok]) => `<option value="${v}" ${ok ? '' : 'disabled'}>${t}</option>`).join('');
}
renderModsAdmin();
$('npadd').onclick = async () => {
  const c = $('npc').value, p = prods.find(x => x.id == $('npp').value), q = parseInt($('npq').value, 10);
  if (!c || !p || !(q > 0)) { say('npmsg', 'Elige el cliente, el producto y la cantidad.', true); return; }
  $('npadd').disabled = true;
  const { data, error } = await sb.rpc('registrar_compra', { p_cliente: c, p_codigo: p.codigo, p_cantidad: q, p_modalidad: $('npmod').value });
  $('npadd').disabled = false;
  if (error) { say('npmsg', error.message, true); return; }
  $('npq').value = 1;
  await loadAll();
  say('npmsg', `Pedido creado: ${q} × ${p.nombre} para ${nombreDe(c)} (${data.factura}).`);
};

/* ---------- Cambiar la foto de un producto ---------- */
document.addEventListener('change', async e => {
  const s = e.target.closest('[data-img]');
  if (!s || !s.files[0]) return;
  const p = prods.find(x => x.id == s.dataset.img);
  s.disabled = true;
  try {
    const url = await subir(s.files[0], 'prod', 800, 0.82);
    const { error } = await sb.from('productos').update({ imagen_url: url }).eq('id', p.id);
    if (error) throw error;
    const viejo = p.imagen_url && /\/productos\/([^/?]+)$/.exec(p.imagen_url);
    if (viejo) sb.storage.from('productos').remove([viejo[1]]);   // borra la foto anterior para ahorrar espacio
    await loadAll();
  } catch (err) { alert('No se pudo cambiar la foto: ' + (err.message || err)); }
  s.disabled = false;
});

/* ---------- Agregar cliente ---------- */
$('addc').onclick = async () => {
  const n = $('cn').value.trim();
  if (!n) { say('cmsg', 'Escribe el nombre del cliente.', true); return; }
  const next = clientes.reduce((m, c) => Math.max(m, parseInt(c.id.slice(2), 10) || 0), 0) + 1;
  const id = 'C-' + String(next).padStart(3, '0');
  const { error } = await sb.from('clientes').insert({ id, nombre: n });
  if (error) { say('cmsg', 'No se pudo agregar: ' + error.message, true); return; }
  $('cn').value = '';
  say('cmsg', `${n} agregado con el número ${id}.`);
  loadAll();
};
