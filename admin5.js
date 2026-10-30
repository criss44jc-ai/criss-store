/* CRISS’ STORE · Administrador (parte 5): pérdidas de inventario (robos, desaparecidos, daños, vencidos) */
const MOTIVOS_PER = { robo: 'Robo', desaparecido: 'Desaparecido', danado: 'Dañado', vencido: 'Vencido', otro: 'Otro motivo' };
let perdidasLista = [];

// existencia de un producto en un local (si aún no hay locales, se usa la existencia principal)
function existenciaPerdida(lid, pid) {
  const p = prods.find(x => x.id == pid);
  if (!p) return 0;
  if (typeof locales === 'undefined' || !locales.length) return Number(p.stock);
  return disponibleEn(lid, pid);
}
function valorPerdida() {
  const p = prods.find(x => x.id == $('pe-prod').value), q = parseInt($('pe-qty').value, 10) || 0;
  $('pe-val').textContent = money(p ? Number(p.costo || 0) * q : 0);
}
function llenarProductosPerdida(elegido) {
  const lid = $('pe-loc').value, v = elegido || $('pe-prod').value;
  $('pe-prod').innerHTML = prods.filter(p => existenciaPerdida(lid, p.id) > 0)
    .map(p => `<option value="${p.id}">${esc(p.nombre)}${p.marca ? ' · ' + esc(p.marca) : ''} (hay ${existenciaPerdida(lid, p.id)})</option>`).join('')
    || '<option value="">No hay productos con existencia en este local</option>';
  if (v) $('pe-prod').value = v;
  valorPerdida();
}
function abrirPerdida(pid) {
  const hayLocales = typeof locales !== 'undefined' && locales.length;
  $('pe-loc').innerHTML = hayLocales ? locales.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join('') : '<option value="">Inventario principal</option>';
  if (hayLocales) $('pe-loc').value = madre() ? madre().id : locales[0].id;
  const ocultaLocal = !hayLocales || locales.length < 2;
  $('pe-loc').classList.toggle('hide', ocultaLocal); $('pe-loc').previousElementSibling.classList.toggle('hide', ocultaLocal);
  $('pe-qty').value = 1; $('pe-mot').value = 'robo'; $('pe-com').value = ''; $('pe-foto').value = ''; say('pe-msg', '');
  llenarProductosPerdida(pid ? String(pid) : '');
  $('perdida').classList.remove('hide');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-pe]'); if (b) abrirPerdida(b.dataset.pe); });
$('peabrir').onclick = () => abrirPerdida();
$('pe-x').onclick = () => $('perdida').classList.add('hide');
$('pe-loc').onchange = () => llenarProductosPerdida('');
$('pe-prod').onchange = valorPerdida;
$('pe-qty').oninput = valorPerdida;

$('pe-ok').onclick = async () => {
  const pid = Number($('pe-prod').value), q = parseInt($('pe-qty').value, 10), com = $('pe-com').value.trim();
  const lid = $('pe-loc').value ? Number($('pe-loc').value) : null;
  if (!pid) { say('pe-msg', 'No hay un producto con existencia para dar de baja.', true); return; }
  if (!(q > 0)) { say('pe-msg', 'Escribe la cantidad perdida.', true); return; }
  if (q > existenciaPerdida(lid, pid)) { say('pe-msg', `Solo hay ${existenciaPerdida(lid, pid)} de ${nomProd(pid)} en este local.`, true); return; }
  if (com.length < 5) { say('pe-msg', 'El comentario es obligatorio (mínimo 5 letras).', true); return; }
  $('pe-ok').disabled = true; say('pe-msg', 'Guardando…');
  try {
    let path = null; const f = $('pe-foto').files[0];
    if (f) {
      let blob;
      try { blob = await reducir(f, 1400, 0.85); }
      catch (err) { say('pe-msg', 'No se pudo usar esa foto. Elige otra imagen o quítala para continuar.', true); $('pe-ok').disabled = false; return; }
      path = `perdida-${pid}-${Date.now()}.jpg`;
      const up = await sb.storage.from('evidencias').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
    }
    const { error } = await sb.rpc('registrar_perdida', {
      p_producto: pid, p_sucursal: lid, p_cantidad: q, p_motivo: $('pe-mot').value, p_comentario: com, p_foto_path: path
    });
    if (error) throw error;
    $('perdida').classList.add('hide');
    await loadAll();
  } catch (e) {
    const m = (e && e.message) || String(e);
    say('pe-msg', /registrar_perdida|perdidas|evidencias|bucket/i.test(m) ? 'Falta ejecutar supabase_v14.sql (y supabase_v12.sql) en Supabase.' : m, true);
  }
  $('pe-ok').disabled = false;
};

/* ---------- Historial de pérdidas ---------- */
async function loadPerdidas() {
  const { data, error } = await sb.from('perdidas').select('*').order('id', { ascending: false }).limit(60);
  if (error) { $('pehist').innerHTML = '<div class="mu">Falta ejecutar supabase_v14.sql en Supabase.</div>'; return; }
  perdidasLista = data || [];
  const n = new Date(), mes = new Date(n.getFullYear(), n.getMonth(), 1);
  const delMes = perdidasLista.filter(x => new Date(x.fecha) >= mes);
  const valor = x => Number(x.cantidad) * Number(x.costo_unit);
  const varios = typeof locales !== 'undefined' && locales.length > 1;
  $('pehist').innerHTML = perdidasLista.length
    ? `<div class="tip">Este mes: <b>${money(delMes.reduce((s, x) => s + valor(x), 0))}</b> en pérdidas (${delMes.length} ${delMes.length === 1 ? 'registro' : 'registros'}), valorado al costo.</div>` +
      perdidasLista.slice(0, 15).map(x => `
        <div class="line" style="align-items:flex-start"><div><b>${x.cantidad} × ${esc(x.producto_nombre)}</b> <span class="badge mal">${esc(MOTIVOS_PER[x.motivo] || x.motivo)}</span>
          <div class="mu">${fdate(x.fecha)}${varios && x.sucursal_id ? ' · 📍 ' + esc(nomLocal(x.sucursal_id)) : ''} · ${money(valor(x))}</div>
          <div>${esc(x.comentario)}</div></div>
          ${x.foto_path ? `<button class="btn sm" data-ev="${esc(x.foto_path)}">Ver foto</button>` : ''}</div>`).join('')
    : '<div class="mu">Todavía no has registrado pérdidas.</div>';
}
