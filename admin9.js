/* CRISS’ STORE · Administrador (parte 9): qué productos ve cada local */
const FALTA19 = '<div class="mu">Falta ejecutar supabase_v19.sql en Supabase.</div>';
let ocultos = [];
const estaOculto = (lid, pid) => ocultos.some(o => o.sucursal_id == lid && o.producto_id == pid);

// aviso en cada producto del inventario: en qué locales no se ve
function etiquetaOculto(p) {
  const l = (typeof locales !== 'undefined' ? locales : []).filter(x => estaOculto(x.id, p.id));
  return l.length ? `<div class="mu">🙈 No se ve en: <b>${l.map(x => esc(x.nombre)).join(', ')}</b></div>` : '';
}
async function loadOcultos() {
  const { data, error } = await sb.from('producto_oculto').select('*');
  if (error) { ocultos = []; $('qvout').innerHTML = FALTA19; return; }
  ocultos = data || [];
  renderQueVe();
  if (typeof renderProds === 'function') renderProds();
  if (typeof llenarProductosPedido === 'function') llenarProductosPedido();
}
function renderQueVe() {
  const locs = typeof locales !== 'undefined' ? locales : [];
  if (!locs.length || !prods.length) { $('qvout').innerHTML = '<div class="mu">Aún no hay locales o productos.</div>'; return; }
  $('qvout').innerHTML = `<table class="mtab"><tr><th>Producto</th>${locs.map(l => `<th>${esc(l.nombre)}
      <div style="display:flex;gap:4px;justify-content:flex-end;margin-top:4px"><button class="btn sm" data-qvt="${l.id}|1" title="Mostrar todos">✔</button><button class="btn sm" data-qvt="${l.id}|0" title="Ocultar todos">✖</button></div></th>`).join('')}</tr>` +
    prods.map(p => `<tr><td>${esc(p.nombre)}</td>${locs.map(l =>
      `<td><input type="checkbox" data-qv="${l.id}|${p.id}" ${estaOculto(l.id, p.id) ? '' : 'checked'} style="width:22px;height:22px" aria-label="${esc(p.nombre)} en ${esc(l.nombre)}"></td>`).join('')}</tr>`).join('') + '</table>';
}
$('qvout').onchange = async e => {
  const c = e.target.closest('[data-qv]'); if (!c) return;
  const [lid, pid] = c.dataset.qv.split('|').map(Number), mostrar = c.checked;
  c.disabled = true;
  const r = mostrar ? await sb.from('producto_oculto').delete().eq('sucursal_id', lid).eq('producto_id', pid)
                    : await sb.from('producto_oculto').upsert({ sucursal_id: lid, producto_id: pid });
  c.disabled = false;
  if (r.error) { c.checked = !mostrar; say('qvmsg', /producto_oculto/.test(r.error.message) ? 'Falta ejecutar supabase_v19.sql en Supabase.' : 'No se pudo guardar: ' + r.error.message, true); return; }
  ocultos = ocultos.filter(o => !(o.sucursal_id == lid && o.producto_id == pid));
  if (!mostrar) ocultos.push({ sucursal_id: lid, producto_id: pid });
  say('qvmsg', `${nomProd(pid)} ${mostrar ? 'ahora se ve' : 'ya no se ve'} en ${nomLocal(lid)}.`);
  if (typeof renderProds === 'function') renderProds();
  if (typeof llenarProductosPedido === 'function') llenarProductosPedido();
};
$('qvout').onclick = async e => {
  const b = e.target.closest('[data-qvt]'); if (!b) return;
  const [lid, mostrar] = b.dataset.qvt.split('|');
  if (mostrar === '0' && !confirm(`¿Ocultar TODOS los productos en ${nomLocal(lid)}? Esa tienda quedará vacía hasta que vuelvas a marcarlos.`)) return;
  const r = mostrar === '1' ? await sb.from('producto_oculto').delete().eq('sucursal_id', Number(lid))
                            : await sb.from('producto_oculto').upsert(prods.map(p => ({ sucursal_id: Number(lid), producto_id: p.id })));
  if (r.error) { say('qvmsg', 'No se pudo guardar: ' + r.error.message, true); return; }
  say('qvmsg', mostrar === '1' ? `Todos los productos se ven en ${nomLocal(lid)}.` : `Se ocultaron todos los productos en ${nomLocal(lid)}.`);
  await loadOcultos();
};
