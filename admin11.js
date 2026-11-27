/* CRISS’ STORE · Administrador (parte 11): encuestas, juegos y ruleta */
const FALTA21 = '<div class="mu">Falta ejecutar supabase_v21.sql en Supabase.</div>';
const TIPOS_J = { vasos: ['🥤', '¿Dónde está la mascota?'], memoria: ['🃏', 'Memoria'], atrapa: ['🐾', 'Atrapa a la mascota'] };
const DIF_J = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };
const nomCli = id => (typeof nombreDe === 'function' ? nombreDe(id) : id);
const dormirAd = ms => new Promise(r => setTimeout(r, ms));
let encuestasAd = [], juegosAd = [], intentosAd = [], respuestasAd = [], sorteosAd = [], ganadoresAd = [], preguntasNuevas = [], ruPool = [];

function estadoCamp(c) {
  const hoy = isoDia(new Date());
  if (!c.activo) return ['Pausado', ''];
  if (c.termina && c.termina < hoy) return ['Vencido', 'low'];
  if (c.inicia && c.inicia > hoy) return ['Programado', 'gold'];
  return ['Activo', 'ok'];
}
const nomLocalAd = id => id ? ((typeof locales !== 'undefined' ? locales : []).find(l => l.id === id) || {}).nombre || 'un local' : 'Todos los locales';

async function loadJuegos(op) {
  const [en, ju, it, re, so, ga] = await Promise.all([
    sb.from('encuestas').select('*').order('id', { ascending: false }),
    sb.from('juegos').select('*').order('id', { ascending: false }),
    sb.from('juego_intentos').select('juego_id,cliente_id,gano,terminado'),
    sb.from('encuesta_respuestas').select('encuesta_id,cliente_id'),
    sb.from('sorteos').select('*').order('id', { ascending: false }).limit(15),
    sb.from('sorteo_ganadores').select('*').limit(200)
  ]);
  if (en.error || ju.error) { ['en-list', 'jg-list', 'ru-hist'].forEach(i => $(i).innerHTML = FALTA21); return; }
  encuestasAd = en.data || []; juegosAd = ju.data || []; intentosAd = it.data || []; respuestasAd = re.data || [];
  sorteosAd = so.data || []; ganadoresAd = ga.data || [];
  llenarSelectoresJuegos(); renderPreguntasNuevas(); renderEncuestasAd(); renderJuegosAd(); renderHistorialRuleta(); ayudaJuego();
  if (!(op && op.sinRuleta)) ruPreview();
}
function llenarSelectoresJuegos() {
  const locs = typeof locales !== 'undefined' ? locales : [];
  const opLoc = '<option value="">Todos los locales</option>' + locs.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join('');
  ['en-loc', 'jg-loc'].forEach(id => { const v = $(id).value; $(id).innerHTML = opLoc; if (v) $(id).value = v; });
  const ve = $('jg-enc').value;
  $('jg-enc').innerHTML = '<option value="">Ninguna</option>' + encuestasAd.map(e => `<option value="${e.id}">${esc(e.titulo)}</option>`).join(''); if (ve) $('jg-enc').value = ve;
  const vr = $('ru-sel').value;
  $('ru-sel').innerHTML = juegosAd.map(j => `<option value="juego:${j.id}">${TIPOS_J[j.tipo][0]} ${esc(j.titulo)}</option>`).join('') +
    encuestasAd.map(e => `<option value="encuesta:${e.id}">📝 ${esc(e.titulo)}</option>`).join('');
  if (vr) $('ru-sel').value = vr;
}

/* ================= ENCUESTAS ================= */
function renderPreguntasNuevas() {
  $('en-qs').innerHTML = preguntasNuevas.length ? preguntasNuevas.map((q, i) =>
    `<div class="line"><div><b>${i + 1}. ${esc(q.p)}</b> <span class="mu">· ${q.t === 'opcion' ? 'opciones: ' + esc(q.o.join(', ')) : q.t === 'estrellas' ? 'estrellas de 1 a 5' : 'texto libre'}</span></div><button class="btn sm" data-qd="${i}">Quitar</button></div>`).join('')
    : '<div class="mu">Todavía no agregaste preguntas.</div>';
}
$('en-qt').onchange = () => $('en-qow').classList.toggle('hide', $('en-qt').value !== 'opcion');
$('en-qadd').onclick = () => {
  const p = $('en-qp').value.trim(), t = $('en-qt').value;
  if (p.length < 3) { say('en-msg', 'Escribe la pregunta.', true); return; }
  if (preguntasNuevas.length >= 6) { say('en-msg', 'Máximo 6 preguntas por encuesta.', true); return; }
  const q = { t, p };
  if (t === 'opcion') {
    const o = $('en-qo').value.split('\n').map(x => x.trim()).filter(Boolean);
    if (o.length < 2 || o.length > 6) { say('en-msg', 'Escribe de 2 a 6 opciones, una por línea.', true); return; }
    if (o.some(x => x.length > 40)) { say('en-msg', 'Cada opción puede tener hasta 40 letras.', true); return; }
    q.o = o;
  }
  preguntasNuevas.push(q); $('en-qp').value = ''; $('en-qo').value = ''; say('en-msg', ''); renderPreguntasNuevas();
};
$('en-qs').onclick = e => { const d = e.target.closest('[data-qd]'); if (d) { preguntasNuevas.splice(Number(d.dataset.qd), 1); renderPreguntasNuevas(); } };
$('en-pub').onclick = async () => {
  const titulo = $('en-tit').value.trim();
  if (!titulo) { say('en-msg', 'Escribe el título de la encuesta.', true); return; }
  if (!preguntasNuevas.length) { say('en-msg', 'Agrega al menos una pregunta.', true); return; }
  if ($('en-ini').value && $('en-fin').value && $('en-ini').value > $('en-fin').value) { say('en-msg', 'La fecha final es anterior a la inicial.', true); return; }
  $('en-pub').disabled = true; say('en-msg', 'Publicando…');
  const { error } = await sb.from('encuestas').insert({
    titulo, descripcion: $('en-des').value.trim() || null, premio: $('en-pre').value.trim() || null, preguntas: preguntasNuevas,
    min_pedidos: Math.max(0, Math.min(50, Number($('en-min').value) || 0)), sucursal_id: $('en-loc').value ? Number($('en-loc').value) : null,
    inicia: $('en-ini').value || null, termina: $('en-fin').value || null
  });
  $('en-pub').disabled = false;
  if (error) { say('en-msg', /encuestas/.test(error.message) ? 'Falta ejecutar supabase_v21.sql en Supabase.' : error.message, true); return; }
  ['en-tit', 'en-des', 'en-pre', 'en-ini', 'en-fin'].forEach(i => $(i).value = ''); $('en-min').value = 0; preguntasNuevas = [];
  say('en-msg', 'Encuesta publicada. Los clientes la verán en la tienda.'); await loadJuegos();
};
function renderEncuestasAd() {
  $('en-list').innerHTML = encuestasAd.length ? encuestasAd.map(e => {
    const [txt, cls] = estadoCamp(e), n = respuestasAd.filter(r => r.encuesta_id === e.id).length;
    return `<div class="line" style="align-items:flex-start"><div style="flex:1;min-width:0"><b>📝 ${esc(e.titulo)}</b> <span class="badge ${cls}">${txt}</span>
      <div class="mu">${(e.preguntas || []).length} pregunta(s) · ${n} respuesta(s) · ${esc(nomLocalAd(e.sucursal_id))}${e.min_pedidos ? ` · pide ${e.min_pedidos} pedido(s)` : ''}</div>
      ${e.premio ? `<div class="mu">🏆 ${esc(e.premio)}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <button class="btn sm" data-enr="${e.id}">Resultados</button><button class="btn sm" data-enrul="encuesta:${e.id}">Ruleta</button>
        <button class="btn sm" data-ena="${e.id}">${e.activo ? 'Pausar' : 'Activar'}</button><button class="btn sm" data-end="${e.id}">Quitar</button></div></div></div>`;
  }).join('') : '<div class="mu">Todavía no hay encuestas.</div>';
}
$('en-list').onclick = async e => {
  const r = e.target.closest('[data-enr]'), ru = e.target.closest('[data-enrul]'), a = e.target.closest('[data-ena]'), d = e.target.closest('[data-end]');
  if (r) { verResultadosEncuesta(Number(r.dataset.enr)); return; }
  if (ru) { irARuleta(ru.dataset.enrul); return; }
  if (a) { const x = encuestasAd.find(z => z.id == a.dataset.ena); await sb.from('encuestas').update({ activo: !x.activo }).eq('id', x.id); await loadJuegos({ sinRuleta: true }); return; }
  if (d && confirm('¿Quitar esta encuesta? También se borran sus respuestas.')) { await sb.from('encuestas').delete().eq('id', Number(d.dataset.end)); await loadJuegos(); }
};
async function verResultadosEncuesta(id) {
  const e = encuestasAd.find(x => x.id === id); if (!e) return;
  const { data } = await sb.from('encuesta_respuestas').select('*').eq('encuesta_id', id);
  const rs = data || [], total = rs.length;
  const bloques = (e.preguntas || []).map((q, i) => {
    const vals = rs.map(r => ({ v: (r.respuestas || [])[i], c: r.cliente_id }));
    let cuerpo = '';
    if (q.t === 'opcion') cuerpo = q.o.map((o, k) => { const n = vals.filter(x => x.v === k).length, pc = total ? Math.round(n * 100 / total) : 0; return `<div style="margin:4px 0"><div>${esc(o)} <b>${n}</b> <span class="mu">(${pc}%)</span></div><div style="height:10px;background:#e9edf2;border-radius:6px"><div style="height:10px;width:${pc}%;background:#0b7a75;border-radius:6px"></div></div></div>`; }).join('');
    else if (q.t === 'estrellas') { const nums = vals.map(x => Number(x.v)).filter(Boolean); cuerpo = `<div>Promedio: <b>${nums.length ? (nums.reduce((s, x) => s + x, 0) / nums.length).toFixed(1) : '—'}</b> ★ <span class="mu">(${nums.length} voto(s))</span></div>` + [5, 4, 3, 2, 1].map(s => `<div class="mu">${'★'.repeat(s)}${'☆'.repeat(5 - s)} ${nums.filter(x => x === s).length}</div>`).join(''); }
    else { const t = vals.filter(x => x.v); cuerpo = t.length ? t.map(x => `<div class="line"><div>“${esc(x.v)}” <span class="mu">— ${esc(nomCli(x.c))}</span></div></div>`).join('') : '<div class="mu">Sin comentarios.</div>'; }
    return `<div style="margin:14px 0"><b>${i + 1}. ${esc(q.p)}</b>${cuerpo}</div>`;
  }).join('');
  const ov = document.createElement('div'); ov.className = 'sheet'; ov.style.zIndex = 60;
  ov.innerHTML = `<div style="max-height:88vh;overflow:auto"><h2>${esc(e.titulo)}</h2><div class="mu">${total} respuesta(s)</div>${bloques || ''}<button class="btn go" data-x style="width:100%;margin-top:8px">Cerrar</button></div>`;
  ov.onclick = ev => { if (ev.target === ov || ev.target.closest('[data-x]')) ov.remove(); };
  document.body.appendChild(ov);
}

/* ================= JUEGOS ================= */
function ayudaJuego() {
  const t = $('jg-tipo').value, d = $('jg-dif').value;
  $('jg-ayuda').textContent = t === 'vasos' ? `${{ facil: 6, normal: 9, dificil: 13 }[d]} mezclas de vasos. Gana quien adivina dónde quedó la mascota.`
    : t === 'memoria' ? (() => { const p = Number($('jg-pares').value) || 6; return `${p} parejas (${p * 2} cartas). Gana quien las encuentra en ${d === 'facil' ? p * 3 : d === 'normal' ? Math.round(p * 2.2) : Math.round(p * 1.7)} movimientos o menos.`; })()
    : `Gana quien atrapa a la mascota ${{ facil: 6, normal: 9, dificil: 12 }[d]} veces o más en 15 segundos.`;
}
$('jg-tipo').onchange = () => { $('jg-paresw').classList.toggle('hide', $('jg-tipo').value !== 'memoria'); ayudaJuego(); };
$('jg-dif').onchange = ayudaJuego; $('jg-pares').onchange = ayudaJuego;
$('jg-pub').onclick = async () => {
  const titulo = $('jg-tit').value.trim();
  if (!titulo) { say('jg-msg', 'Escribe el título del juego.', true); return; }
  if ($('jg-ini').value && $('jg-fin').value && $('jg-ini').value > $('jg-fin').value) { say('jg-msg', 'La fecha final es anterior a la inicial.', true); return; }
  $('jg-pub').disabled = true; say('jg-msg', 'Publicando…');
  const { error } = await sb.from('juegos').insert({
    titulo, tipo: $('jg-tipo').value, dificultad: $('jg-dif').value, premio: $('jg-pre').value.trim() || null,
    ganadores: Number($('jg-gan').value), intentos: Number($('jg-int').value), pares: $('jg-tipo').value === 'memoria' ? Number($('jg-pares').value) : 6, min_pedidos: Math.max(0, Math.min(50, Number($('jg-min').value) || 0)),
    encuesta_id: $('jg-enc').value ? Number($('jg-enc').value) : null, sucursal_id: $('jg-loc').value ? Number($('jg-loc').value) : null,
    inicia: $('jg-ini').value || null, termina: $('jg-fin').value || null
  });
  $('jg-pub').disabled = false;
  if (error) { say('jg-msg', /juegos/.test(error.message) ? 'Falta ejecutar supabase_v21.sql en Supabase.' : error.message, true); return; }
  ['jg-tit', 'jg-pre', 'jg-ini', 'jg-fin'].forEach(i => $(i).value = ''); $('jg-min').value = 0;
  say('jg-msg', 'Juego publicado. Los clientes lo verán en la tienda.'); await loadJuegos();
};
const unicos = (arr, f) => new Set(arr.filter(f).map(x => x.cliente_id)).size;
function renderJuegosAd() {
  $('jg-list').innerHTML = juegosAd.length ? juegosAd.map(j => {
    const [txt, cls] = estadoCamp(j), its = intentosAd.filter(i => i.juego_id === j.id && i.terminado);
    const resp = j.encuesta_id ? respuestasAd.filter(r => r.encuesta_id === j.encuesta_id).length : null;
    return `<div class="line" style="align-items:flex-start"><div style="flex:1;min-width:0"><b>${TIPOS_J[j.tipo][0]} ${esc(j.titulo)}</b> <span class="badge ${cls}">${txt}</span>
      <div class="mu">${esc(TIPOS_J[j.tipo][1])}${j.tipo === 'memoria' ? ' (' + (j.pares || 6) + ' parejas)' : ''} · ${DIF_J[j.dificultad]} · ${j.ganadores} ganador(es) · ${j.intentos} intento(s) · ${esc(nomLocalAd(j.sucursal_id))}${j.min_pedidos ? ` · pide ${j.min_pedidos} pedido(s)` : ''}</div>
      <div>👥 <b>${unicos(its, () => true)}</b> jugaron · 🏆 <b>${unicos(its, i => i.gano)}</b> ganaron${resp !== null ? ` · 📝 <b>${resp}</b> respondieron la encuesta` : ''}</div>
      ${j.premio ? `<div class="mu">Premio: ${esc(j.premio)}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <button class="btn sm" data-jur="juego:${j.id}">Ruleta</button>
        <button class="btn sm" data-jua="${j.id}">${j.activo ? 'Pausar' : 'Activar'}</button><button class="btn sm" data-jud="${j.id}">Quitar</button></div></div></div>`;
  }).join('') : '<div class="mu">Todavía no hay juegos.</div>';
}
$('jg-list').onclick = async e => {
  const r = e.target.closest('[data-jur]'), a = e.target.closest('[data-jua]'), d = e.target.closest('[data-jud]');
  if (r) { irARuleta(r.dataset.jur); return; }
  if (a) { const x = juegosAd.find(z => z.id == a.dataset.jua); await sb.from('juegos').update({ activo: !x.activo }).eq('id', x.id); await loadJuegos({ sinRuleta: true }); return; }
  if (d && confirm('¿Quitar este juego? También se borran los intentos de los clientes.')) { await sb.from('juegos').delete().eq('id', Number(d.dataset.jud)); await loadJuegos(); }
};

/* ================= RULETA ================= */
function irARuleta(valor) { $('ru-sel').value = valor; ruPreview(); $('ru-sel').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
const ruSel = () => { const [origen, id] = ($('ru-sel').value || '').split(':'); return origen ? { origen, id: Number(id) } : null; };
async function ruPreview() {
  const s = ruSel(); ruPool = []; $('ru-rueda').innerHTML = ''; $('ru-out').innerHTML = '';
  if (!s) { $('ru-part').textContent = 'Crea un juego o una encuesta para usar la ruleta.'; return; }
  const esJuego = s.origen === 'juego'; $('ru-gan').disabled = !esJuego; $('ru-res').disabled = !esJuego;
  const { data, error } = await sb.rpc('participantes_sorteo', { p_origen: s.origen, p_id: s.id, p_solo_ganadores: $('ru-gan').checked, p_solo_respondieron: $('ru-res').checked });
  if (error) { $('ru-part').innerHTML = /participantes_sorteo/.test(error.message) ? FALTA21 : esc(error.message); return; }
  ruPool = data || [];
  const j = esJuego ? juegosAd.find(x => x.id === s.id) : null, gan = Number($('ru-n').value) || (j ? j.ganadores : 1), sale = Math.min(gan, ruPool.length);
  $('ru-part').innerHTML = ruPool.length ? `<b>${ruPool.length}</b> participante${ruPool.length === 1 ? '' : 's'} en la ruleta: ${ruPool.slice(0, 20).map(p => esc(p.nombre)).join(', ')}${ruPool.length > 20 ? '…' : ''}. Saldrá${sale === 1 ? '' : 'n'} <b>${sale}</b> ganador${sale === 1 ? '' : 'es'}.`
    : 'Todavía no hay participantes con esas condiciones.';
  if (ruPool.length) ruRueda(ruPool.slice(0, 24).map(p => p.nombre));
}
['ru-sel', 'ru-gan', 'ru-res', 'ru-n'].forEach(i => $(i).onchange = ruPreview);
function ruRueda(nombres) {
  const n = nombres.length, C = 150, R = 138, col = ['#ff6b6b', '#ffd23f', '#4dabf7', '#69db7c', '#da77f2', '#ffa94d', '#38d9a9', '#f783ac'];
  const rad = d => d * Math.PI / 180, pt = (a, r) => [C + r * Math.cos(rad(a)), C + r * Math.sin(rad(a))], paso = 360 / n; let sl = '';
  nombres.forEach((nm, i) => {
    const a0 = -90 + i * paso, a1 = a0 + paso, fill = col[i % col.length], [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
    const corto = nm.length > 12 ? nm.slice(0, 11) + '…' : nm, fs = n > 16 ? 9 : n > 10 ? 11 : 13;
    sl += n === 1 ? `<circle cx="${C}" cy="${C}" r="${R}" fill="${fill}"/>`
      : `<path d="M${C},${C} L${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 ${paso > 180 ? 1 : 0} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${fill}" stroke="#fff" stroke-width="2"/>`;
    sl += `<text transform="translate(${C},${C}) rotate(${(a0 + paso / 2).toFixed(1)}) translate(${R * 0.6},0)" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="700" fill="#12263a">${esc(corto)}</text>`;
  });
  $('ru-rueda').innerHTML = `<svg viewBox="0 0 300 300" style="width:100%;display:block"><g id="ru-g" style="transform-origin:150px 150px">${sl}</g>
    <circle cx="150" cy="150" r="16" fill="#12263a" stroke="#fff" stroke-width="3"/><polygon points="150,28 137,2 163,2" fill="#12263a" stroke="#fff" stroke-width="2"/></svg>`;
}
const barajarAd = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [r[i], r[k]] = [r[k], r[i]]; } return r; };
$('ru-girar').onclick = async () => {
  const s = ruSel(); if (!s || !ruPool.length) { say('ru-msg', 'No hay participantes para la ruleta.', true); return; }
  if (!confirm('¿Girar la ruleta ahora? El resultado queda guardado y no se puede repetir.')) return;
  $('ru-girar').disabled = true; say('ru-msg', '');
  const { data, error } = await sb.rpc('sortear_campana', { p_origen: s.origen, p_id: s.id, p_ganadores: $('ru-n').value ? Number($('ru-n').value) : null, p_solo_ganadores: $('ru-gan').checked, p_solo_respondieron: $('ru-res').checked });
  if (error) { $('ru-girar').disabled = false; say('ru-msg', /sortear_campana/.test(error.message) ? 'Falta ejecutar supabase_v21.sql en Supabase.' : error.message, true); return; }
  const gan = data.ganadores || []; let restantes = ruPool.slice(); $('ru-out').innerHTML = '';
  for (let k = 0; k < gan.length; k++) {                           // el servidor ya eligió; la rueda solo lo muestra, un ganador a la vez
    const w = gan[k], otros = restantes.filter(p => p.cliente_id !== w.cliente_id), lista = barajarAd([w, ...barajarAd(otros).slice(0, 23)]);
    ruRueda(lista.map(p => p.nombre));
    const idx = lista.findIndex(p => p.cliente_id === w.cliente_id), paso = 360 / lista.length, g = $('ru-g');
    g.style.transition = 'none'; g.style.transform = 'rotate(0deg)'; void g.getBoundingClientRect();
    g.style.transition = 'transform 4.6s cubic-bezier(.12,.7,.1,1)'; g.style.transform = `rotate(${360 * 5 - (idx + 0.5) * paso + (Math.random() - 0.5) * paso * 0.6}deg)`;
    await dormirAd(4900);
    $('ru-out').innerHTML += `<div class="line"><b>🏆 Ganador ${k + 1}:</b> ${esc(w.nombre)}</div>`;
    restantes = otros;
  }
  say('ru-msg', 'Listo. Quedó anotado y cada ganador verá su premio al entrar a la tienda.');
  $('ru-girar').disabled = false; await loadJuegos({ sinRuleta: true });
};
function renderHistorialRuleta() {
  $('ru-hist').innerHTML = sorteosAd.length ? sorteosAd.map(s => {
    const gs = ganadoresAd.filter(g => g.sorteo_id === s.id);
    return `<div class="line" style="flex-direction:column;align-items:flex-start;gap:4px"><div><b>${esc(s.titulo || '')}</b> <span class="mu">· ${fdate(s.creado)} · ${s.participantes} participante(s) · ${s.origen === 'juego' ? 'juego' : 'encuesta'}</span></div>
      ${s.premio ? `<div class="mu">Premio: ${esc(s.premio)}</div>` : ''}
      ${gs.map(g => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-ent="${g.id}" ${g.entregado ? 'checked' : ''} style="width:auto"> 🏆 ${esc(g.nombre || nomCli(g.cliente_id))} <span class="mu">${g.entregado ? '· entregado' : '· por entregar'}</span></label>`).join('')}</div>`;
  }).join('') : '<div class="mu">Todavía no giraste la ruleta.</div>';
}
$('ru-hist').onchange = async e => {
  const c = e.target.closest('[data-ent]'); if (!c) return;
  await sb.from('sorteo_ganadores').update({ entregado: c.checked }).eq('id', Number(c.dataset.ent));
  const g = ganadoresAd.find(x => x.id == c.dataset.ent); if (g) g.entregado = c.checked; renderHistorialRuleta();
};
