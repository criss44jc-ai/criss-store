/* CRISS’ STORE · Administrador (parte 8): corregir precios de venta y compras a proveedor mal digitadas */
const FALTA18 = '<div class="mu">Falta ejecutar supabase_v18.sql en Supabase.</div>';
const MOTIVOS_COR = { cambio_precio: 'Cambio de precio', error_carga: 'Estaba mal cargado', error_digitacion: 'Error de digitación', factura_distinta: 'La factura decía otra cosa', otro: 'Otro motivo' };
const conSigno = n => (n >= 0 ? '+' : '−') + money(Math.abs(n));

/* ================= PRECIO DE VENTA ================= */
let prId = null, prTimer = null;
const corrigiendo = () => (document.querySelector('input[name=pr2m]:checked') || {}).value === 'corregir';
document.addEventListener('click', e => { const b = e.target.closest('[data-pr]'); if (b) abrirPrecio(b.dataset.pr); });
function abrirPrecio(id) {
  const p = prods.find(x => x.id == id); if (!p) return;
  prId = p.id;
  $('pr2-act').textContent = `${p.nombre} · precio actual: ${money(p.precio)} · costo: ${money(p.costo)}`;
  $('pr2-nuevo').value = Number(p.precio).toFixed(2);
  document.querySelector('input[name=pr2m][value=ahora]').checked = true;
  $('pr2-corr').classList.add('hide'); $('pr2-com').value = ''; $('pr2-mot').value = 'error_carga';
  const ped = pend.filter(f => f.producto_id === p.id).map(f => f.fecha).sort()[0];      // pedido pendiente más antiguo
  $('pr2-desde').value = isoDia(ped ? new Date(ped) : new Date());
  say('pr2-msg', ''); $('precio').classList.remove('hide');
}
async function vistaPrecio() {
  if (!corrigiendo()) return;
  const pr = parseFloat($('pr2-nuevo').value), d = $('pr2-desde').value;
  if (!(pr >= 0) || !d) { $('pr2-vista').textContent = 'Escribe el precio y la fecha.'; return; }
  const { data, error } = await sb.rpc('vista_correccion_precio', { p_producto: prId, p_precio: pr, p_desde: d });
  if (error) { $('pr2-vista').innerHTML = /vista_correccion_precio/.test(error.message) ? FALTA18 : esc(error.message); return; }
  const r = (data && data[0]) || { pendientes: 0, diferencia: 0, con_pagos: 0 };
  $('pr2-vista').innerHTML = `Se corregirán <b>${r.pendientes}</b> pedido(s) pendiente(s) (<b>${conSigno(Number(r.diferencia))}</b> en lo que deben los clientes). <b>${r.con_pagos}</b> pedido(s) con pagos no se tocan.`;
}
const programarVista = () => { clearTimeout(prTimer); prTimer = setTimeout(vistaPrecio, 350); };
document.querySelectorAll('input[name=pr2m]').forEach(r => r.onchange = () => { $('pr2-corr').classList.toggle('hide', !corrigiendo()); vistaPrecio(); });
$('pr2-nuevo').oninput = programarVista; $('pr2-desde').onchange = vistaPrecio;
$('pr2-x').onclick = () => $('precio').classList.add('hide');
$('pr2-ok').onclick = async () => {
  const pr = parseFloat($('pr2-nuevo').value), p = prods.find(x => x.id == prId), corr = corrigiendo(), com = $('pr2-com').value.trim();
  if (!(pr >= 0)) { say('pr2-msg', 'Escribe el precio nuevo.', true); return; }
  if (!corr && p && pr === Number(p.precio)) { say('pr2-msg', 'El precio nuevo es igual al actual.', true); return; }
  if (corr && !$('pr2-desde').value) { say('pr2-msg', 'Elige desde qué fecha corregir.', true); return; }
  if (corr && com.length < 5) { say('pr2-msg', 'La justificación es obligatoria (mínimo 5 letras).', true); return; }
  $('pr2-ok').disabled = true; say('pr2-msg', 'Guardando…');
  let { data, error } = await sb.rpc('corregir_precio', {
    p_producto: prId, p_precio: pr, p_corregir: corr, p_desde: corr ? $('pr2-desde').value : null,
    p_motivo: corr ? $('pr2-mot').value : null, p_comentario: corr ? com : null
  });
  if (error && !corr && /corregir_precio/.test(error.message)) {       // respaldo mientras no se ejecute supabase_v18.sql
    error = (await sb.from('productos').update({ precio: pr }).eq('id', prId)).error;
  }
  $('pr2-ok').disabled = false;
  if (error) { say('pr2-msg', /corregir_precio|correcciones/.test(error.message) ? 'Falta ejecutar supabase_v18.sql en Supabase.' : error.message, true); return; }
  $('precio').classList.add('hide');
  if (corr && data) alert(`Listo. Se corrigieron ${data.corregidos} pedido(s) pendiente(s). ${data.con_pagos} con pagos quedaron igual.`);
  await loadAll();
};

/* ================= COMPRA A PROVEEDOR MAL DIGITADA ================= */
let ceId = null, ceE = null;
document.addEventListener('click', e => { const b = e.target.closest('[data-ce]'); if (b) abrirCorreccionCompra(b.dataset.ce); });
function actualizaUnidadCE() {
  const t = parseFloat($('ce-total').value);
  if (ceE && t >= 0) {
    const cu = t / ceE.cantidad;
    $('ce-unit').innerHTML = `Costo por unidad con este total: <b>${money(cu)}</b> (antes: ${money(Number(ceE.costo_total) / ceE.cantidad)})`;
    $('ce-cu').value = cu.toFixed(4);
  }
  $('ce-ap').classList.toggle('hide', !$('ce-aplicar').checked);
}
function abrirCorreccionCompra(id) {
  const r = entradasLista.find(x => x.id == id); if (!r) return;
  ceId = r.id; ceE = r;
  $('ce-act').textContent = `${r.cantidad} × ${r.producto_nombre} · ${fdate(r.fecha)}${r.proveedor ? ' · ' + r.proveedor : ''} · total registrado: ${money(r.costo_total)}`;
  $('ce-total').value = Number(r.costo_total).toFixed(2);
  $('ce-aplicar').checked = true; $('ce-mot').value = 'error_digitacion'; $('ce-com').value = ''; $('ce-foto').value = '';
  $('ce-desde').value = isoDia(new Date(r.fecha));
  actualizaUnidadCE(); say('ce-msg', ''); $('corrcompra').classList.remove('hide');
}
$('ce-total').oninput = actualizaUnidadCE; $('ce-aplicar').onchange = actualizaUnidadCE;
$('ce-x').onclick = () => $('corrcompra').classList.add('hide');
$('ce-ok').onclick = async () => {
  const t = parseFloat($('ce-total').value), apl = $('ce-aplicar').checked, cu = parseFloat($('ce-cu').value), com = $('ce-com').value.trim();
  if (!(t >= 0)) { say('ce-msg', 'Escribe el total correcto de la factura.', true); return; }
  if (apl && !(cu >= 0)) { say('ce-msg', 'Escribe el costo correcto por unidad.', true); return; }
  if (apl && !$('ce-desde').value) { say('ce-msg', 'Elige desde qué fecha corregir el costo de las ventas.', true); return; }
  if (!apl && ceE && t === Number(ceE.costo_total)) { say('ce-msg', 'El total es igual al registrado.', true); return; }
  if (com.length < 5) { say('ce-msg', 'La justificación es obligatoria (mínimo 5 letras).', true); return; }
  $('ce-ok').disabled = true; say('ce-msg', 'Guardando…');
  try {
    let path = null; const f = $('ce-foto').files[0];
    if (f) {
      let blob;
      try { blob = await reducir(f, 1400, 0.85); }
      catch (err) { say('ce-msg', 'No se pudo usar esa foto. Elige otra imagen o quítala para continuar.', true); $('ce-ok').disabled = false; return; }
      path = `correccion-${ceId}-${Date.now()}.jpg`;
      const up = await sb.storage.from('evidencias').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
    }
    const { data, error } = await sb.rpc('corregir_entrada', {
      p_entrada: ceId, p_costo_total: t, p_aplicar_costo: apl, p_costo_unit: apl ? cu : null, p_desde: apl ? $('ce-desde').value : null,
      p_motivo: $('ce-mot').value, p_comentario: com, p_foto_path: path
    });
    if (error) throw error;
    $('corrcompra').classList.add('hide');
    if (apl && data) alert(`Listo. Se corrigió la factura y el costo de ${data.ventas_ajustadas} venta(s).`);
    await loadAll();
  } catch (e) {
    const m = (e && e.message) || String(e);
    say('ce-msg', /corregir_entrada|correcciones|evidencias|bucket/i.test(m) ? 'Falta ejecutar supabase_v18.sql (y supabase_v12.sql) en Supabase.' : m, true);
  }
  $('ce-ok').disabled = false;
};

/* ================= HISTORIAL ================= */
async function loadCorrecciones() {
  const { data, error } = await sb.from('correcciones').select('*').order('id', { ascending: false }).limit(20);
  if (error) { $('colist').innerHTML = FALTA18; return; }
  $('colist').innerHTML = data && data.length ? data.map(c => {
    const compra = c.tipo === 'compra_proveedor';
    return `<div class="line" style="align-items:flex-start"><div>
      <b>${esc(c.producto_nombre || '')}</b> <span class="badge ${compra ? '' : 'gold'}">${compra ? 'Compra a proveedor' : 'Precio de venta'}</span>
      <div>${compra ? `Total de la factura: ${money(c.valor_anterior)} → <b>${money(c.valor_nuevo)}</b>${c.costo_nuevo != null ? ` · costo por unidad: ${money(c.costo_anterior)} → <b>${money(c.costo_nuevo)}</b>` : ''}` : `Precio: ${money(c.valor_anterior)} → <b>${money(c.valor_nuevo)}</b>`}</div>
      <div class="mu">${fdate(c.fecha)} · ${esc(MOTIVOS_COR[c.motivo] || c.motivo)}${c.detalle ? ' · ' + esc(c.detalle) : ''}</div>
      ${c.comentario ? `<div>${esc(c.comentario)}</div>` : ''}</div>
      ${c.foto_path ? `<button class="btn sm" data-ev="${esc(c.foto_path)}">Ver foto</button>` : ''}</div>`;
  }).join('') : '<div class="mu">Todavía no hay cambios de precio ni correcciones.</div>';
}
