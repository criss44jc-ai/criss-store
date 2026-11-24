/* CRISS’ STORE · Administrador (parte 10): posición de la mascota y ventana emergente de propaganda */
const FALTA20 = '<div class="mu">Falta ejecutar supabase_v20.sql en Supabase.</div>';

/* ================= DÓNDE APARECE LA MASCOTA ================= */
// posición = centro de la mascota como fracción de la pantalla (igual que en la tienda)
let posMasc = { x: 0.13, y: 0.93 };
function colocarMascotaEjemplo() {
  const box = $('mpos'), av = $('mposav'), w = box.clientWidth, h = box.clientHeight, a = av.offsetWidth || 40;
  const left = Math.max(2, Math.min(w - a - 2, posMasc.x * w - a / 2)), top = Math.max(2, Math.min(h - a - 2, posMasc.y * h - a / 2));
  av.style.left = left + 'px'; av.style.top = top + 'px';
}
function cargarPosMascota() {
  const p = typeof ajustes.mascota_pos === 'string' ? ajustes.mascota_pos.split(',').map(Number) : null;
  posMasc = p && p.length === 2 && p.every(isFinite) ? { x: Math.max(0, Math.min(1, p[0])), y: Math.max(0, Math.min(1, p[1])) } : { x: 0.13, y: 0.93 };
  $('mpm').checked = ajustes.mascota_mover !== 'no';
  colocarMascotaEjemplo();
}
(function () {
  const av = $('mposav'), box = $('mpos');
  let d = null;
  av.addEventListener('pointerdown', e => {
    d = { sx: e.clientX, sy: e.clientY, l: av.offsetLeft, t: av.offsetTop };
    try { av.setPointerCapture(e.pointerId); } catch (err) {}
  });
  av.addEventListener('pointermove', e => {
    if (!d) return;
    const a = av.offsetWidth, w = box.clientWidth, h = box.clientHeight;
    const left = Math.max(2, Math.min(w - a - 2, d.l + e.clientX - d.sx)), top = Math.max(2, Math.min(h - a - 2, d.t + e.clientY - d.sy));
    av.style.left = left + 'px'; av.style.top = top + 'px';
    posMasc = { x: (left + a / 2) / w, y: (top + a / 2) / h };
  });
  const fin = () => { d = null; };
  av.addEventListener('pointerup', fin); av.addEventListener('pointercancel', fin);
})();
$('mpsv').onclick = async () => {
  $('mpsv').disabled = true; say('mpmsg', 'Guardando…');
  const { error } = await sb.from('ajustes').upsert([
    { clave: 'mascota_pos', valor: posMasc.x.toFixed(3) + ',' + posMasc.y.toFixed(3) },
    { clave: 'mascota_mover', valor: $('mpm').checked ? 'si' : 'no' }
  ]);
  $('mpsv').disabled = false;
  if (error) { say('mpmsg', error.message, true); return; }
  ajustes.mascota_pos = posMasc.x.toFixed(3) + ',' + posMasc.y.toFixed(3); ajustes.mascota_mover = $('mpm').checked ? 'si' : 'no';
  say('mpmsg', 'Listo. Así aparecerá la mascota al abrir la tienda' + ($('mpm').checked ? ', y cada cliente podrá moverla.' : ' (los clientes no podrán moverla).'));
};
$('mprs').onclick = async () => {
  posMasc = { x: 0.13, y: 0.93 }; colocarMascotaEjemplo();
  const { error } = await sb.from('ajustes').upsert({ clave: 'mascota_pos', valor: '' });
  if (error) { say('mpmsg', error.message, true); return; }
  ajustes.mascota_pos = ''; say('mpmsg', 'La mascota vuelve a aparecer abajo a la izquierda.');
};
window.addEventListener('resize', colocarMascotaEjemplo);
document.addEventListener('click', e => { if (e.target.closest('#nav [data-t]')) setTimeout(colocarMascotaEjemplo, 50); });

/* ================= VENTANA EMERGENTE DE PROPAGANDA ================= */
let popups = [];
const FREC = { dia: 'Una vez al día por cliente', siempre: 'Cada vez que entra', una_vez: 'Solo una vez por cliente' };
const ytIdP = u => { const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/); return m ? m[1] : ''; };

function llenarSelectoresPopup() {
  const v = $('pu-loc').value, p = $('pu-prod').value;
  $('pu-loc').innerHTML = '<option value="">Todos los locales</option>' + locales.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join('');
  if (v && locales.some(l => l.id == v)) $('pu-loc').value = v;
  $('pu-prod').innerHTML = prods.map(x => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join('');
  if (p) $('pu-prod').value = p;
}
$('pu-dest').onchange = () => {
  $('pu-prodw').classList.toggle('hide', $('pu-dest').value !== 'prod');
  $('pu-urlw').classList.toggle('hide', $('pu-dest').value !== 'url');
  if ($('pu-dest').value === 'prod') llenarSelectoresPopup();
};

// ventana de vista previa (igual a la que ve el cliente)
function vistaPopup(p) {
  const yt = ytIdP(p.video_externo), ov = document.createElement('div');
  ov.className = 'sheet'; ov.style.cssText = 'z-index:60;align-items:center;padding:16px';
  const media = p.video_url ? `<video src="${esc(p.video_url)}" muted loop playsinline controls autoplay style="width:100%;display:block;max-height:60vh;background:#000"></video>`
    : yt ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?playsinline=1&rel=0" allowfullscreen style="width:100%;aspect-ratio:16/9;display:block;border:0"></iframe>`
    : p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="" style="width:100%;display:block">` : '';
  const txtBtn = p.boton_texto || (p.codigo || p.enlace ? 'Ver más' : '');
  ov.innerHTML = `<div style="position:relative;max-width:420px;border-radius:18px;padding:0;overflow:auto;max-height:92vh">
    <button data-x style="position:absolute;top:8px;right:8px;z-index:2;width:38px;height:38px;border-radius:50%;border:0;background:rgba(18,38,58,.78);color:#fff;font-size:22px;cursor:pointer">×</button>
    ${media}<div style="padding:16px"><h2 style="margin:0 0 6px">${esc(p.titulo)}</h2>
    <div class="mu" style="font-size:15px;white-space:pre-line">${esc(p.texto || '')}</div>
    ${txtBtn ? `<button class="btn go" data-x style="width:100%">${esc(txtBtn)}</button>` : ''}
    <div class="mu" style="margin-top:8px;text-align:center">Vista previa: así la verá el cliente</div></div></div>`;
  ov.onclick = e => { if (e.target === ov || e.target.closest('[data-x]')) ov.remove(); };
  document.body.appendChild(ov);
}
function lecturaFormularioPopup() {
  const f = $('pu-img').files[0], dest = $('pu-dest').value;
  return {
    titulo: $('pu-tit').value.trim() || 'Título de tu propaganda', texto: $('pu-txt').value.trim() || null,
    imagen_url: f ? URL.createObjectURL(f) : null, video_url: $('pu-vid').files[0] ? URL.createObjectURL($('pu-vid').files[0]) : null,
    video_externo: $('pu-yt').value.trim() || null, boton_texto: $('pu-bt').value.trim() || null,
    codigo: dest === 'prod' ? $('pu-prod').value : null, enlace: dest === 'url' ? $('pu-url').value.trim() : null
  };
}
$('pu-prev').onclick = () => vistaPopup(lecturaFormularioPopup());

$('pu-add').onclick = async () => {
  const titulo = $('pu-tit').value.trim(), dest = $('pu-dest').value, url = $('pu-url').value.trim();
  if (!titulo) { say('pu-msg', 'Escribe un título.', true); return; }
  if (dest === 'url' && !/^https?:\/\//i.test(url)) { say('pu-msg', 'El enlace debe empezar con http:// o https://', true); return; }
  if (dest === 'prod' && !$('pu-prod').value) { say('pu-msg', 'Elige el producto.', true); return; }
  if ($('pu-ini').value && $('pu-fin').value && $('pu-ini').value > $('pu-fin').value) { say('pu-msg', 'La fecha final es anterior a la inicial.', true); return; }
  const yt = $('pu-yt').value.trim();
  if (yt && !ytIdP(yt)) { say('pu-msg', 'El enlace de YouTube no parece válido.', true); return; }
  $('pu-add').disabled = true; say('pu-msg', 'Publicando…');
  try {
    const f = $('pu-img').files[0], vf = $('pu-vid').files[0];
    const imagen_url = f ? await subir(f, 'popup', 1000, 0.85) : null;
    let video_url = null;
    if (vf) {
      if (vf.size > 50 * 1024 * 1024) throw new Error('El video pesa más de 50 MB. Usa uno más corto o enlaza uno de YouTube.');
      const ext = ((vf.name.split('.').pop() || 'mp4').toLowerCase()).replace(/[^a-z0-9]/g, '') || 'mp4';
      say('pu-msg', 'Subiendo el video…');
      const path = `popup-${Date.now()}.${ext}`;
      const up = await sb.storage.from('multimedia').upload(path, vf, { contentType: vf.type || 'video/mp4' });
      if (up.error) throw up.error;
      video_url = sb.storage.from('multimedia').getPublicUrl(path).data.publicUrl;
    }
    const { error } = await sb.from('popups').insert({
      titulo, texto: $('pu-txt').value.trim() || null, imagen_url, video_url, video_externo: yt || null,
      boton_texto: $('pu-bt').value.trim() || null, codigo: dest === 'prod' ? $('pu-prod').value : null, enlace: dest === 'url' ? url : null,
      sucursal_id: $('pu-loc').value ? Number($('pu-loc').value) : null, frecuencia: $('pu-frec').value,
      inicia: $('pu-ini').value || null, termina: $('pu-fin').value || null
    });
    if (error) throw error;
    ['pu-tit', 'pu-txt', 'pu-img', 'pu-vid', 'pu-yt', 'pu-bt', 'pu-url', 'pu-ini', 'pu-fin'].forEach(i => $(i).value = '');
    $('pu-dest').value = ''; $('pu-dest').onchange();
    say('pu-msg', 'Ventana publicada. Los clientes la verán al entrar a la tienda.');
    await loadPopups();
  } catch (e) {
    const m = (e && e.message) || String(e);
    say('pu-msg', /popups|multimedia|bucket/i.test(m) ? 'Falta ejecutar supabase_v20.sql (y supabase_v16.sql) en Supabase.' : 'No se pudo publicar: ' + m, true);
  }
  $('pu-add').disabled = false;
};

function estadoPopup(p) {
  const hoy = isoDia(new Date());
  if (!p.activo) return ['Pausada', ''];
  if (p.termina && p.termina < hoy) return ['Vencida', 'low'];
  if (p.inicia && p.inicia > hoy) return ['Programada', 'gold'];
  return ['Activa', 'ok'];
}
async function loadPopups() {
  const { data, error } = await sb.from('popups').select('*').order('id', { ascending: false });
  if (error) { $('pu-list').innerHTML = FALTA20; return; }
  popups = data || [];
  $('pu-list').innerHTML = popups.length ? popups.map(p => {
    const [txt, cls] = estadoPopup(p), loc = p.sucursal_id ? ((locales.find(l => l.id === p.sucursal_id) || {}).nombre || 'un local') : 'Todos los locales';
    return `<div class="line" style="align-items:flex-start;gap:10px">
      ${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex:none">` : '<div style="width:56px;height:56px;border-radius:10px;background:#dde3ea;display:grid;place-items:center;flex:none">📣</div>'}
      <div style="flex:1;min-width:0"><b>${esc(p.titulo)}</b> <span class="badge ${cls}">${txt}</span>
        <div class="mu">${esc(loc)} · ${esc(FREC[p.frecuencia] || p.frecuencia)}${p.inicia || p.termina ? ` · ${p.inicia ? 'desde ' + fdate(p.inicia + 'T00:00:00') : ''} ${p.termina ? 'hasta ' + fdate(p.termina + 'T00:00:00') : ''}` : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          <button class="btn sm" data-puv="${p.id}">Vista previa</button>
          <button class="btn sm" data-pua="${p.id}">${p.activo ? 'Pausar' : 'Activar'}</button>
          <button class="btn sm" data-pud="${p.id}">Quitar</button></div></div></div>`;
  }).join('') : '<div class="mu">Todavía no hay ventanas de propaganda.</div>';
}
$('pu-list').onclick = async e => {
  const v = e.target.closest('[data-puv]'), a = e.target.closest('[data-pua]'), d = e.target.closest('[data-pud]');
  if (v) { vistaPopup(popups.find(x => x.id == v.dataset.puv)); return; }
  if (a) { const p = popups.find(x => x.id == a.dataset.pua); await sb.from('popups').update({ activo: !p.activo }).eq('id', p.id); await loadPopups(); return; }
  if (d && confirm('¿Quitar esta ventana de propaganda?')) { await sb.from('popups').delete().eq('id', d.dataset.pud); await loadPopups(); }
};
