/* CRISS’ STORE · Administrador (parte 6): inventario por día, marca de cada local, grupos y buzón */
const FALTA15 = '<div class="mu">Falta ejecutar supabase_v15.sql en Supabase.</div>';
const FALTA16 = '<div class="mu">Falta ejecutar supabase_v16.sql en Supabase.</div>';

/* ================= INVENTARIO POR DÍA ================= */
const isoDia = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function rangoRapido(k) {
  const h = new Date(); let a = new Date(h), b = new Date(h);
  if (k === 'ayer') { a.setDate(a.getDate() - 1); b = new Date(a); }
  else if (k === '7') a.setDate(a.getDate() - 6);
  else if (k === 'mes') a = new Date(h.getFullYear(), h.getMonth(), 1);
  $('idd').value = isoDia(a); $('idh').value = isoDia(b); cargarInvDia();
}
const signo = n => n > 0 ? '+' + n : String(n);
async function cargarInvDia() {
  const d1 = $('idd').value, d2 = $('idh').value;
  if (!d1 || !d2 || d1 > d2) { $('idout').innerHTML = '<div class="mu">Elige un rango de fechas válido (la primera fecha no puede ser mayor que la segunda).</div>'; return; }
  $('idout').innerHTML = '<div class="mu">Calculando…</div>';
  const { data, error } = await sb.rpc('inventario_periodo', { p_desde: d1, p_hasta: d2 });
  if (error) { $('idout').innerHTML = FALTA15; return; }
  const loc = $('idl').value, filas = (data || []).filter(r => !loc || r.sucursal_id == loc), mapa = {};
  filas.forEach(r => {
    const x = mapa[r.producto_id] || (mapa[r.producto_id] = { n: r.producto, ini: 0, ent: 0, ven: 0, per: 0, tra: 0, otr: 0, fin: 0 });
    x.ini += Number(r.inicio); x.ent += Number(r.entradas); x.ven += Number(r.ventas); x.per += Number(r.perdidas);
    x.tra += Number(r.traslados); x.otr += Number(r.otros); x.fin += Number(r.fin);
  });
  const lista = Object.values(mapa).sort((a, b) => a.n.localeCompare(b.n));
  const t = k => lista.reduce((s, x) => s + x[k], 0);
  const fd = s => new Date(s + 'T00:00:00').toLocaleDateString('es');
  const nom = loc ? nomLocal(loc) : 'Todos los locales';
  $('idout').innerHTML = `<div class="mu" style="margin-bottom:6px">Empezó el ${fd(d1)} · terminó el ${fd(d2)} · ${esc(nom)}</div>` +
    (filas.some(r => !r.completo) ? '<div class="tip">⚠️ El registro diario empezó cuando instalaste esta mejora. Para fechas anteriores, las cifras de "Empezó" pueden no ser exactas.</div>' : '') +
    (lista.length ? `<table class="mtab"><tr><th>Producto</th><th>Empezó</th><th>Entró</th><th>Vendió</th><th>Perdió</th><th>Traslados</th><th>Otros</th><th>Terminó</th></tr>` +
      lista.map(x => `<tr><td>${esc(x.n)}</td><td>${x.ini}</td><td>${x.ent ? signo(x.ent) : '–'}</td><td>${x.ven ? signo(x.ven) : '–'}</td><td>${x.per ? '<span class="low">' + signo(x.per) + '</span>' : '–'}</td><td>${x.tra ? signo(x.tra) : '–'}</td><td>${x.otr ? signo(x.otr) : '–'}</td><td><b>${x.fin}</b></td></tr>`).join('') +
      `<tr><td><b>Total</b></td><td><b>${t('ini')}</b></td><td>${signo(t('ent'))}</td><td>${signo(t('ven'))}</td><td>${signo(t('per'))}</td><td>${signo(t('tra'))}</td><td>${signo(t('otr'))}</td><td><b>${t('fin')}</b></td></tr></table>` +
      '<div class="mu" style="margin-top:8px">Entró = compras a proveedor y existencia inicial. Vendió = ventas (menos pedidos anulados). Traslados = lo que entró o salió entre locales.</div>'
      : '<div class="mu">No hay productos para mostrar.</div>');
}
$('idver').onclick = cargarInvDia;
document.addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) rangoRapido(b.dataset.ir); });
$('idd').value = $('idh').value = isoDia(new Date());

// se llama cada vez que se cargan los locales
function extrasLocales() {
  const o = locales.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join('');
  const vl = $('idl').value; $('idl').innerHTML = '<option value="">Todos los locales</option>' + o; if (vl && locales.some(l => l.id == vl)) $('idl').value = vl;
  const vt = $('tloc').value; $('tloc').innerHTML = '<option value="">En todos los locales</option>' + o; if (vt && locales.some(l => l.id == vt)) $('tloc').value = vt;
  if (!$('t-loc').classList.contains('hide')) cargarInvDia();
}

/* ================= MARCA DE CADA LOCAL ================= */
let mkId = null;
const luzColor = c => { const n = parseInt(String(c).slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
function abrirMarca(id) {
  const l = locales.find(x => x.id == id); if (!l) return;
  mkId = l.id;
  $('mk-loc').textContent = 'Local: ' + l.nombre;
  $('mk-tit').value = l.titulo || ''; $('mk-esl').value = l.eslogan || '';
  $('mk-def').checked = !l.color_encabezado && !l.color_acento;
  $('mk-col1').value = l.color_encabezado || '#ffd23f'; $('mk-col2').value = l.color_acento || '#0b7a75';
  ['mk-logo', 'mk-port'].forEach(i => $(i).value = ''); $('mk-qlogo').checked = false; $('mk-qport').checked = false;
  say('mk-msg', ''); pintarMarca(); $('marca').classList.remove('hide');
}
function pintarMarca() {
  const l = locales.find(x => x.id == mkId) || {}, def = $('mk-def').checked;
  $('mk-col1').disabled = def; $('mk-col2').disabled = def;
  const c1 = def ? '#ffd23f' : $('mk-col1').value, c2 = def ? '#0b7a75' : $('mk-col2').value, tx = luzColor(c1) > 0.6 ? '#12263a' : '#ffffff';
  const fl = $('mk-logo').files[0], fp = $('mk-port').files[0];
  const logo = $('mk-qlogo').checked ? 'mascota.png' : (fl ? URL.createObjectURL(fl) : (l.logo_url || 'mascota.png'));
  const port = $('mk-qport').checked ? '' : (fp ? URL.createObjectURL(fp) : (l.portada_url || ''));
  $('mk-prev').innerHTML = `<div style="background:${c1};color:${tx};padding:12px;display:flex;gap:10px;align-items:center">
      <img src="${esc(logo)}" alt="" style="width:52px;height:52px;border-radius:12px;background:#fff;object-fit:contain">
      <div><div style="font:800 20px var(--hd)">${esc($('mk-tit').value || 'CRISS’ STORE')}</div><div style="font-size:13px">${esc($('mk-esl').value || '¡Come sin remordimientos! 😋')}</div></div></div>
    ${port ? `<img src="${esc(port)}" alt="" style="width:100%;max-height:110px;object-fit:cover;display:block">` : ''}
    <div style="padding:10px"><span style="background:${c2};color:#fff;padding:8px 14px;border-radius:10px;font-weight:700;display:inline-block">Confirmar retiro</span></div>`;
}
['mk-tit', 'mk-esl', 'mk-logo', 'mk-port', 'mk-qlogo', 'mk-qport', 'mk-def', 'mk-col1', 'mk-col2'].forEach(i => { $(i).oninput = pintarMarca; $(i).onchange = pintarMarca; });
document.addEventListener('click', e => { const b = e.target.closest('[data-mk]'); if (b) abrirMarca(b.dataset.mk); });
$('mk-x').onclick = () => $('marca').classList.add('hide');

async function subirMarca(file, pre, max, png) {
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  const g = cv.getContext('2d');
  if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); }
  g.drawImage(bmp, 0, 0, cv.width, cv.height);
  const blob = await new Promise(r => cv.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.88));
  const path = `${pre}-${mkId}-${Date.now()}.${png ? 'png' : 'jpg'}`;
  const up = await sb.storage.from('multimedia').upload(path, blob, { contentType: png ? 'image/png' : 'image/jpeg' });
  if (up.error) throw up.error;
  return sb.storage.from('multimedia').getPublicUrl(path).data.publicUrl;
}
$('mk-ok').onclick = async () => {
  $('mk-ok').disabled = true; say('mk-msg', 'Guardando…');
  try {
    const def = $('mk-def').checked, fl = $('mk-logo').files[0], fp = $('mk-port').files[0];
    const campos = { titulo: vacio($('mk-tit').value), eslogan: vacio($('mk-esl').value),
      color_encabezado: def ? null : $('mk-col1').value, color_acento: def ? null : $('mk-col2').value };
    if ($('mk-qlogo').checked) campos.logo_url = null; else if (fl) campos.logo_url = await subirMarca(fl, 'logo', 512, true);
    if ($('mk-qport').checked) campos.portada_url = null; else if (fp) campos.portada_url = await subirMarca(fp, 'portada', 1400, false);
    const { error } = await sb.from('sucursales').update(campos).eq('id', mkId);
    if (error) throw error;
    $('marca').classList.add('hide'); await loadLocales();
  } catch (e) {
    const m = (e && e.message) || String(e);
    say('mk-msg', /titulo|eslogan|color_|logo_url|portada_url|multimedia|bucket/i.test(m) ? 'Falta ejecutar supabase_v16.sql en Supabase.' : m, true);
  }
  $('mk-ok').disabled = false;
};

/* ================= GRUPOS DE PRODUCTOS ================= */
let grupos = [];
function selectorGrupo(p) {
  if (!grupos.length) return '';
  return `<select data-grp="${p.id}" aria-label="Grupo en la tienda" style="margin:6px 0 0 6px;padding:6px;font-size:14px;width:auto">
    <option value="">Sin grupo</option>${grupos.map(g => `<option value="${g.id}" ${p.grupo_id == g.id ? 'selected' : ''}>${esc(g.nombre)}</option>`).join('')}</select>`;
}
async function loadGrupos() {
  const { data, error } = await sb.from('grupos').select('*').eq('activo', true).order('orden').order('id');
  if (error) { grupos = []; $('gplist').innerHTML = FALTA16; return; }
  grupos = data || []; renderGrupos();
  if (typeof renderProds === 'function') renderProds();
}
function renderGrupos() {
  $('gplist').innerHTML = grupos.length ? grupos.map((g, i) => `
    <div class="line"><b>${esc(g.nombre)}</b>
      <div style="display:flex;gap:6px"><button class="btn sm" data-gup="${g.id}" ${i === 0 ? 'disabled' : ''}>▲</button><button class="btn sm" data-gdn="${g.id}" ${i === grupos.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="btn sm" data-gren="${g.id}">Renombrar</button><button class="btn sm red" data-gqui="${g.id}">Quitar</button></div></div>`).join('')
    : '<div class="mu">Aún no tienes grupos. Crea el primero abajo.</div>';
}
$('gpadd').onclick = async () => {
  const n = $('gpn').value.trim();
  if (!n) { say('gpmsg', 'Escribe el nombre del grupo.', true); return; }
  const { error } = await sb.from('grupos').insert({ nombre: n, orden: grupos.length });
  if (error) { say('gpmsg', /grupos/.test(error.message) ? 'Falta ejecutar supabase_v16.sql en Supabase.' : error.message, true); return; }
  $('gpn').value = ''; say('gpmsg', `Grupo "${n}" creado. Asígnalo a tus productos en la lista de abajo.`); loadGrupos();
};
$('gplist').onclick = async e => {
  const up = e.target.closest('[data-gup]'), dn = e.target.closest('[data-gdn]'), rn = e.target.closest('[data-gren]'), qu = e.target.closest('[data-gqui]');
  if (up || dn) {
    const id = (up || dn).dataset.gup || (up || dn).dataset.gdn, i = grupos.findIndex(g => g.id == id), j = i + (up ? -1 : 1);
    if (j < 0 || j >= grupos.length) return;
    const a = grupos.splice(i, 1)[0]; grupos.splice(j, 0, a);
    await Promise.all(grupos.map((g, k) => sb.from('grupos').update({ orden: k }).eq('id', g.id)));
    loadGrupos();
  }
  if (rn) {
    const g = grupos.find(x => x.id == rn.dataset.gren), n = prompt('Nuevo nombre del grupo:', g.nombre);
    if (n === null || !n.trim()) return;
    await sb.from('grupos').update({ nombre: n.trim() }).eq('id', g.id); loadGrupos();
  }
  if (qu) {
    const g = grupos.find(x => x.id == qu.dataset.gqui);
    if (!confirm(`¿Quitar el grupo "${g.nombre}"? Sus productos quedarán sin grupo.`)) return;
    await sb.from('productos').update({ grupo_id: null }).eq('grupo_id', g.id);
    await sb.from('grupos').update({ activo: false }).eq('id', g.id);
    await loadAll();
  }
};
document.addEventListener('change', async e => {
  const s = e.target.closest('[data-grp]'); if (!s) return;
  const gid = s.value ? Number(s.value) : null;
  const { error } = await sb.from('productos').update({ grupo_id: gid }).eq('id', s.dataset.grp);
  if (error) { alert('No se pudo cambiar el grupo. ¿Ya ejecutaste supabase_v16.sql?'); return; }
  const p = prods.find(x => x.id == s.dataset.grp); if (p) p.grupo_id = gid;
});

/* ================= BUZÓN: SUGERENCIAS Y RECLAMOS ================= */
let buzonLista = [];
async function loadBuzon() {
  const { data, error } = await sb.from('buzon').select('*').order('id', { ascending: false }).limit(150);
  const btn = document.querySelector('#nav [data-t=buz]');
  if (error) { if (btn) btn.textContent = 'Buzón'; $('buzout').innerHTML = FALTA16; return; }
  buzonLista = data || [];
  const nuevos = buzonLista.filter(x => x.estado === 'nuevo').length;
  if (btn) btn.textContent = nuevos ? `Buzón (${nuevos})` : 'Buzón';
  renderBuzon();
}
function renderBuzon() {
  const f = $('buzf').value, lista = buzonLista.filter(x => f === 'todos' || x.estado === f);
  const varios = typeof locales !== 'undefined' && locales.length > 1;
  const EST = { nuevo: 'Nuevo', en_revision: 'En revisión', resuelto: 'Resuelto' };
  $('buzout').innerHTML = lista.length ? lista.map(x => `
    <div class="line" style="align-items:flex-start"><div style="min-width:0">
      <span class="badge ${x.tipo === 'reclamo' ? 'mal' : ''}">${x.tipo === 'reclamo' ? '⚠️ Reclamo' : '💡 Sugerencia'}</span>
      <span class="badge ${x.estado === 'resuelto' ? 'ok' : ''}">${EST[x.estado]}</span>
      <div class="mu">${fdate(x.fecha)} · ${x.cliente_id ? esc(nombreDe(x.cliente_id)) : 'Anónimo'}${varios && x.sucursal_id ? ' · 📍 ' + esc(nomLocal(x.sucursal_id)) : ''}</div>
      <div style="margin:4px 0;white-space:pre-line">${esc(x.mensaje)}</div>
      ${x.contacto ? `<div class="mu">Contacto: ${esc(x.contacto)}</div>` : ''}
      ${x.respuesta ? `<div class="tip" style="margin-top:6px"><b>Tu nota:</b> ${esc(x.respuesta)}</div>` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${x.estado === 'nuevo' ? `<button class="btn sm" data-bz="${x.id}|en_revision">En revisión</button>` : ''}
        ${x.estado !== 'resuelto' ? `<button class="btn sm" style="background:#0b7a75;color:#fff;border-color:#0b7a75" data-bz="${x.id}|resuelto">Resolver</button>` : `<button class="btn sm" data-bz="${x.id}|nuevo">Reabrir</button>`}
        <button class="btn sm" data-bz="${x.id}|nota">Agregar nota</button></div></div>`).join('')
    : '<div class="mu">No hay mensajes en esta lista.</div>';
}
$('buzf').onchange = renderBuzon;
$('buzout').onclick = async e => {
  const b = e.target.closest('[data-bz]'); if (!b) return;
  const [id, acc] = b.dataset.bz.split('|'), x = buzonLista.find(m => m.id == id); if (!x) return;
  let cambios;
  if (acc === 'nota' || acc === 'resuelto') {
    const n = prompt(acc === 'resuelto' ? 'Nota de cómo se resolvió (opcional):' : 'Nota interna:', x.respuesta || '');
    if (n === null) return;
    cambios = acc === 'resuelto' ? { estado: 'resuelto', resuelto_en: new Date().toISOString(), respuesta: n.trim() || x.respuesta || null } : { respuesta: n.trim() || null };
  } else cambios = { estado: acc, resuelto_en: acc === 'nuevo' ? null : x.resuelto_en };
  const { error } = await sb.from('buzon').update(cambios).eq('id', id);
  if (error) { alert('No se pudo guardar: ' + error.message); return; }
  loadBuzon();
};
