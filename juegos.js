/* CRISS’ STORE · Juegos, encuestas y premios (lado del cliente)
   Este archivo solo define funciones: la tienda llama a jgMontar() al arrancar y a jgCargar() cuando cambia el cliente. */
const JG = { datos: { encuestas: [], juegos: [] }, premios: [], vivo: 0, timers: [], enCurso: null };
const jgq = id => document.getElementById(id);
const jgDormir = ms => new Promise(r => setTimeout(r, ms));
const jgAzar = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const jgBarajar = arr => { for (let i = arr.length - 1; i > 0; i--) { const k = jgAzar(i + 1); [arr[i], arr[k]] = [arr[k], arr[i]]; } return arr; };
const JG_TIPOS = {
  vasos: ['🥤', 'Sigue los vasos y adivina bajo cuál quedó la mascota.'],
  memoria: ['🃏', 'Encuentra todas las parejas con pocos movimientos.'],
  atrapa: ['🐾', 'Toca a la mascota cada vez que asome. Tienes 15 segundos.']
};
const JG_DIF = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

function jgEstilos() {
  if (jgq('jg-css')) return;
  const st = document.createElement('style'); st.id = 'jg-css';
  st.textContent = `
  .jg-sheet{position:fixed;inset:0;background:rgba(18,38,58,.55);display:flex;align-items:flex-end;justify-content:center;z-index:7}
  .jg-sheet>div{background:#fff;width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:18px;max-height:90vh;overflow:auto}
  .jg-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
  .jg-h h2{margin:0;font-size:20px}
  .jg-xx{width:36px;height:36px;border-radius:50%;border:2px solid var(--ink,#12263a);background:#fff;font-size:20px;cursor:pointer;flex:none}
  .jg-card{display:flex;gap:12px;align-items:flex-start;border:2px solid var(--ln,#dde3ea);border-radius:14px;padding:12px;margin:10px 0}
  .jg-card.win{background:#fff8db;border-color:#ffd23f;display:block}
  .jg-ic{font-size:34px;line-height:1;flex:none}
  .jg-ok{margin:8px 0;font-weight:700;color:#0b7a75}
  .jq{margin:12px 0}
  .jq-o{display:flex;gap:8px;align-items:center;padding:8px 10px;margin:6px 0;border:2px solid var(--ln,#dde3ea);border-radius:10px;cursor:pointer}
  .jq-o input{width:auto;margin:0}
  .jq-st{display:flex;gap:6px;margin-top:6px}
  .jq-st button{font-size:30px;background:none;border:0;cursor:pointer;color:#f08c00;padding:0 2px}
  .jq textarea{width:100%;margin-top:6px}
  #jgbanner{display:block;width:100%;text-align:left;border:2px solid var(--ink,#12263a);border-radius:14px;background:linear-gradient(90deg,#ffd23f,#ffe98a);padding:12px 14px;margin:12px 0;font-size:16px;cursor:pointer}
  .jg-ov{position:fixed;inset:0;z-index:8;background:linear-gradient(180deg,#1b3a57,#12263a);color:#fff;display:flex;flex-direction:column;align-items:center;padding:14px 12px;overflow:auto}
  .jg-top{display:flex;width:100%;max-width:420px;align-items:center;justify-content:space-between;gap:10px}
  .jg-top b{font-size:19px}
  .jg-top button{width:38px;height:38px;border-radius:50%;border:2px solid #fff;background:rgba(255,255,255,.12);color:#fff;font-size:20px;cursor:pointer}
  #jji{margin:10px 0 6px;font-size:17px;text-align:center;min-height:46px}
  #jjb{width:100%;max-width:420px;display:flex;justify-content:center}
  #jjr{width:100%;max-width:420px;background:#fff;color:#12263a;border-radius:18px;padding:20px;text-align:center;margin-top:14px}
  #jjr .big{font-size:56px;line-height:1}
  #jjr h2{margin:8px 0}
  #jjr .btn{width:100%;margin-top:8px}
  /* vasos */
  .vs{position:relative;height:230px;width:min(340px,94vw)}
  .vc{position:absolute;bottom:18px;width:86px;height:106px;margin-left:-43px;transition:left .38s ease;cursor:pointer;z-index:3}
  .vcup{width:100%;height:100%;transition:transform .25s ease;background:linear-gradient(#ffe3e3 0 13%,transparent 13%),linear-gradient(90deg,#c92a2a,#fa5252 45%,#c92a2a);clip-path:polygon(7% 0,93% 0,100% 100%,0 100%);border-radius:8px}
  .vc.up .vcup{transform:translateY(-84px)}
  .vm{position:absolute;bottom:18px;width:66px;height:66px;margin-left:-33px;z-index:1;opacity:0;transition:opacity .2s}
  .vm img{width:100%;height:100%;border-radius:50%;border:3px solid #fff;object-fit:cover;background:#f9d55b}
  .vm.on{opacity:1}
  .vs.espera .vc:hover .vcup{transform:translateY(-10px)}
  /* memoria */
  .mg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:min(360px,94vw)}
  .mc{aspect-ratio:1;border:0;border-radius:14px;background:#ffd23f;font-size:34px;position:relative;cursor:pointer;color:#12263a;padding:0}
  .mc span{position:absolute;inset:0;display:grid;place-items:center;border-radius:14px;transition:opacity .2s}
  .mc .mb{background:#fff;opacity:0}
  .mc.on .mb,.mc.ok .mb{opacity:1}
  .mc.ok{outline:3px solid #2f9e44}
  .mc img{width:78%;height:78%;border-radius:50%;object-fit:cover}
  /* atrapa */
  .ag{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:min(330px,92vw)}
  .ah{aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 35%,#5b3a1e,#2a1a0b);border:4px solid #8a5a2b;position:relative;overflow:hidden;padding:0;cursor:pointer}
  .ah img{position:absolute;left:12%;bottom:-100%;width:76%;height:76%;border-radius:50%;object-fit:cover;border:3px solid #fff;background:#f9d55b;transition:bottom .12s ease}
  .ah.on img{bottom:12%}`;
  document.head.appendChild(st);
}

/* ---------------- montaje ---------------- */
function jgMontar() {
  jgEstilos();
  const d = document.createElement('div');
  d.innerHTML = `
  <div id="jpanel" class="jg-sheet hide"><div>
    <div class="jg-h"><h2>🎮 Juegos y premios</h2><button class="jg-xx" data-cerrar="jpanel" aria-label="Cerrar">×</button></div>
    <div class="msg err" id="jpmsg"></div><div id="jpbody"></div>
  </div></div>
  <div id="jenc" class="jg-sheet hide"><div>
    <div class="jg-h"><h2 id="jet"></h2><button class="jg-xx" data-cerrar="jenc" aria-label="Cerrar">×</button></div>
    <div id="jebody"></div>
  </div></div>
  <div id="jjuego" class="jg-ov hide">
    <div class="jg-top"><b id="jjt"></b><button id="jjx" aria-label="Salir">×</button></div>
    <div id="jji"></div><div id="jjb"></div><div id="jjr" class="hide"></div>
  </div>
  <div id="jwin" class="jg-sheet hide" style="align-items:center;padding:16px"><div style="border-radius:18px;text-align:center">
    <div style="font-size:60px;line-height:1">🏆</div><h2 style="margin:6px 0">¡Ganaste en la ruleta!</h2>
    <div id="jwinp" style="font-size:18px;margin-bottom:6px"></div>
    <div class="mu">Muéstrale esta pantalla al administrador para reclamar tu premio.</div>
    <button class="btn go" id="jwinx" style="width:100%;margin-top:12px">¡Genial!</button>
  </div></div>`;
  while (d.firstChild) document.body.appendChild(d.firstChild);
  const banner = document.createElement('button'); banner.id = 'jgbanner'; banner.className = 'hide';
  banner.innerHTML = '🎮 <b>¡Hay juegos y premios para ti!</b><div class="mu">Toca para participar</div>';
  const ref = jgq('promos') || jgq('cat'); if (ref && ref.parentNode) ref.parentNode.insertBefore(banner, ref.nextSibling);
  banner.onclick = jgAbrirPanel;
  document.body.addEventListener('click', e => {
    const x = e.target.closest('[data-cerrar]'); if (x) jgq(x.dataset.cerrar).classList.add('hide');
    const j = e.target.closest('[data-jugar]'); if (j) jgJugar(Number(j.dataset.jugar));
    const en = e.target.closest('[data-enc]'); if (en) jgAbrirEncuesta(Number(en.dataset.enc));
  });
  jgq('jjx').onclick = jgSalir;
  jgq('jwinx').onclick = () => { jgq('jwin').classList.add('hide'); jgPremioVisto(); };
}

/* ---------------- datos ---------------- */
function jgPendientes() {
  const c = (jgq('cl') || {}).value;
  return JG.datos.juegos.filter(j => !c || j.usados < j.intentos).length + JG.datos.encuestas.filter(e => !c || !e.respondida).length;
}
async function jgCargar() {
  const c = jgq('cl').value || null;
  const { data, error } = await sb.rpc('campanas_tienda', { p_cliente: c, p_sucursal: LOCINFO ? LOCINFO.id : LOCAL });
  JG.datos = (!error && data) ? { encuestas: data.encuestas || [], juegos: data.juegos || [] } : { encuestas: [], juegos: [] };
  const ban = jgq('jgbanner'); if (ban) ban.classList.toggle('hide', jgPendientes() === 0);
  if (typeof cat !== 'undefined' && cat.length) renderMenu(secciones());
  if (!jgq('jpanel').classList.contains('hide')) jgPintarPanel();
  if (c) jgRevisarPremios(c); else JG.premios = [];
}
async function jgRevisarPremios(c) {
  const { data } = await sb.rpc('mis_sorteos', { p_cliente: c });
  JG.premios = data || [];
  const nuevo = JG.premios.find(p => { try { return !localStorage.getItem('sorteo_' + p.sorteo_id + '_' + c); } catch (e) { return false; } });
  if (nuevo && jgq('jwin').classList.contains('hide') && jgq('jjuego').classList.contains('hide')) {
    JG.mostrando = { id: nuevo.sorteo_id, c };
    jgq('jwinp').textContent = nuevo.premio || nuevo.titulo || 'Un premio de la tienda';
    jgq('jwin').classList.remove('hide');
    if (typeof habla === 'function') habla('🏆 ¡Ganaste en la ruleta, {cliente}! Revisa tu premio.');
  }
}
function jgPremioVisto() { const m = JG.mostrando; if (m) { try { localStorage.setItem('sorteo_' + m.id + '_' + m.c, '1'); } catch (e) {} } JG.mostrando = null; }

/* ---------------- panel ---------------- */
function jgAbrirPanel() { say('jpmsg', ''); jgPintarPanel(); jgq('jpanel').classList.remove('hide'); jgCargar(); }
function jgTarjetaJuego(j, c) {
  const t = JG_TIPOS[j.tipo] || JG_TIPOS.vasos, falta = Math.max(0, j.min_pedidos - j.pedidos), quedan = j.intentos - j.usados;
  const btnEnc = j.encuesta_id && j.encuesta_respondida === false ? `<button class="btn go" data-enc="${j.encuesta_id}" style="width:100%;margin-top:6px">Responder la encuesta${j.gano ? ' para entrar a la ruleta' : ''}</button>` : '';
  let estado;
  if (!c) estado = '<div class="mu">Elige tu nombre arriba para jugar.</div>';
  else if (falta > 0) estado = `<div class="tip">Haz <b>${falta}</b> pedido${falta === 1 ? '' : 's'} más para poder jugar.</div>`;
  else if (quedan <= 0) estado = (j.gano ? '<div class="jg-ok">✅ ¡Ganaste! Estás dentro de la ruleta.</div>' : '<div class="mu">Ya usaste tu intento.</div>') + btnEnc;
  else estado = `<button class="btn go" data-jugar="${j.id}" style="width:100%;margin-top:6px">Jugar${j.intentos > 1 ? ` (${quedan} intento${quedan === 1 ? '' : 's'})` : ''}</button>`;
  return `<div class="jg-card"><div class="jg-ic">${t[0]}</div><div style="flex:1;min-width:0"><b>${esc(j.titulo)}</b>
    <div class="mu">${esc(t[1])}</div>${j.premio ? `<div>🏆 ${esc(j.premio)}</div>` : ''}
    <div class="mu">${j.ganadores} ganador${j.ganadores === 1 ? '' : 'es'} en la ruleta · ${JG_DIF[j.dificultad] || ''}</div>${estado}</div></div>`;
}
function jgTarjetaEncuesta(e, c) {
  const falta = Math.max(0, e.min_pedidos - e.pedidos);
  let estado;
  if (!c) estado = '<div class="mu">Elige tu nombre arriba para responder.</div>';
  else if (e.respondida) estado = '<div class="jg-ok">✅ Ya respondiste. ¡Gracias!</div>';
  else if (falta > 0) estado = `<div class="tip">Haz <b>${falta}</b> pedido${falta === 1 ? '' : 's'} más para poder responder.</div>`;
  else estado = `<button class="btn go" data-enc="${e.id}" style="width:100%;margin-top:6px">Responder (${(e.preguntas || []).length} pregunta${(e.preguntas || []).length === 1 ? '' : 's'})</button>`;
  return `<div class="jg-card"><div class="jg-ic">📝</div><div style="flex:1;min-width:0"><b>${esc(e.titulo)}</b>
    ${e.descripcion ? `<div class="mu">${esc(e.descripcion)}</div>` : ''}${e.premio ? `<div>🏆 ${esc(e.premio)}</div>` : ''}${estado}</div></div>`;
}
function jgPintarPanel() {
  const c = jgq('cl').value, D = JG.datos; let h = '';
  if (JG.premios.length) h += `<div class="jg-card win"><b>🏆 Tus premios</b>${JG.premios.map(p => `<div>${esc(p.premio || p.titulo || 'Premio')} <span class="mu">· ${p.entregado ? 'entregado' : 'por entregar'}</span></div>`).join('')}</div>`;
  h += D.juegos.map(j => jgTarjetaJuego(j, c)).join('') + D.encuestas.map(e => jgTarjetaEncuesta(e, c)).join('');
  if (!D.juegos.length && !D.encuestas.length) h += '<div class="mu" style="margin:14px 0">Por ahora no hay juegos ni encuestas. ¡Vuelve pronto!</div>';
  jgq('jpbody').innerHTML = h;
}

/* ---------------- encuestas ---------------- */
function jgAbrirEncuesta(id) {
  const c = jgq('cl').value, e = JG.datos.encuestas.find(x => x.id === id);
  if (!c) { say('jpmsg', 'Elige tu nombre para responder.', true); return; }
  if (!e) { say('jpmsg', 'Esta encuesta ya no está disponible.', true); return; }
  jgq('jjuego').classList.add('hide'); jgq('jpanel').classList.add('hide');
  jgq('jet').textContent = e.titulo;
  jgq('jebody').innerHTML = `${e.descripcion ? `<div class="mu">${esc(e.descripcion)}</div>` : ''}${e.premio ? `<div class="tip">🏆 ${esc(e.premio)}</div>` : ''}` +
    (e.preguntas || []).map((q, i) => {
      const tit = `<b>${i + 1}. ${esc(q.p)}</b>`;
      if (q.t === 'opcion') return `<div class="jq">${tit}${(q.o || []).map((o, k) => `<label class="jq-o"><input type="radio" name="jq${i}" value="${k}"> ${esc(o)}</label>`).join('')}</div>`;
      if (q.t === 'estrellas') return `<div class="jq">${tit}<div class="jq-st" data-q="${i}" data-v="0">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-st="${n}" aria-label="${n} estrellas">☆</button>`).join('')}</div></div>`;
      return `<div class="jq">${tit} <span class="mu">(opcional)</span><textarea data-tx="${i}" rows="2" maxlength="300"></textarea></div>`;
    }).join('') + `<button class="btn go" id="jesend" style="width:100%">Enviar respuestas</button><div class="msg" id="jemsg"></div>`;
  jgq('jebody').onclick = ev => {
    const s = ev.target.closest('[data-st]'); if (!s) return;
    const box = s.parentNode, v = Number(s.dataset.st); box.dataset.v = v;
    box.querySelectorAll('button').forEach((b, k) => { b.textContent = k < v ? '★' : '☆'; }); say('jemsg', '');
  };
  jgq('jebody').onchange = () => say('jemsg', '');
  jgq('jesend').onclick = async () => {
    const resp = [];
    for (let i = 0; i < (e.preguntas || []).length; i++) {
      const q = e.preguntas[i];
      if (q.t === 'opcion') { const r = jgq('jebody').querySelector(`input[name="jq${i}"]:checked`); if (!r) { say('jemsg', `Responde la pregunta ${i + 1}.`, true); return; } resp.push(Number(r.value)); }
      else if (q.t === 'estrellas') { const v = Number(jgq('jebody').querySelector(`[data-q="${i}"]`).dataset.v); if (!v) { say('jemsg', `Pon tus estrellas en la pregunta ${i + 1}.`, true); return; } resp.push(v); }
      else resp.push((jgq('jebody').querySelector(`[data-tx="${i}"]`).value || '').trim());
    }
    jgq('jesend').disabled = true; say('jemsg', 'Enviando…');
    const { error } = await sb.rpc('responder_encuesta', { p_encuesta: e.id, p_cliente: c, p_respuestas: resp });
    jgq('jesend').disabled = false;
    if (error) { say('jemsg', error.message, true); return; }
    jgq('jebody').innerHTML = '<div style="text-align:center;padding:14px"><div style="font-size:54px">🎉</div><h2>¡Gracias por responder!</h2><div class="mu">Quedaste participando por el premio.</div><button class="btn go" data-cerrar="jenc" style="width:100%;margin-top:12px">Listo</button></div>';
    if (typeof habla === 'function') habla('¡Gracias por responder, {cliente}! 🎉');
    jgCargar();
  };
  say('jemsg', ''); jgq('jenc').classList.remove('hide');
}

/* ---------------- juegos ---------------- */
function jgLimpiarTimers() { JG.timers.forEach(t => { clearTimeout(t); clearInterval(t); }); JG.timers = []; }
const jgInfo = t => { jgq('jji').innerHTML = t; };
function jgCerrarJuego() { JG.vivo++; jgLimpiarTimers(); JG.enCurso = null; jgq('jjuego').classList.add('hide'); jgq('jjb').innerHTML = ''; }
function jgSalir() {
  const e = JG.enCurso;
  if (e && !e.fin) { if (!confirm('Si sales ahora pierdes este intento. ¿Salir?')) return; jgFin({}, true); }
  else jgCerrarJuego();
}
async function jgJugar(id) {
  const c = jgq('cl').value, j = JG.datos.juegos.find(x => x.id === id);
  if (!c || !j) return;
  say('jpmsg', 'Preparando el juego…');
  const { data, error } = await sb.rpc('juego_iniciar', { p_juego: id, p_cliente: c });
  if (error) { say('jpmsg', error.message, true); jgCargar(); return; }
  say('jpmsg', ''); jgq('jpanel').classList.add('hide');
  JG.vivo++; jgLimpiarTimers(); JG.enCurso = { j, intento: data.intento, fin: false };
  jgq('jjt').textContent = j.titulo; jgq('jjr').classList.add('hide'); jgq('jjb').innerHTML = ''; jgq('jjuego').classList.remove('hide');
  if (j.tipo === 'vasos') jgVasos(j, data); else if (j.tipo === 'memoria') jgMemoria(j); else jgAtrapa(j);
}
async function jgFin(resultado, silencioso) {
  const e = JG.enCurso; if (!e || e.fin) return;
  e.fin = true; JG.vivo++; jgLimpiarTimers();
  const { data, error } = await sb.rpc('juego_terminar', { p_intento: e.intento, p_cliente: jgq('cl').value, p_resultado: resultado });
  if (silencioso) { jgCerrarJuego(); jgCargar(); return; }
  jgResultado(error ? { error: error.message } : data, e.j);
  jgCargar();
}
function jgResultado(r, j) {
  const box = jgq('jjr'), gano = !!r.gano, quedan = j.intentos - (j.usados + 1);
  const btnEnc = r.encuesta_id && r.encuesta_respondida === false ? `<button class="btn go" data-enc="${r.encuesta_id}">Responder la encuesta${gano ? ' para entrar a la ruleta' : ''}</button>` : '';
  if (r.error) box.innerHTML = `<div class="big">⚠️</div><h2>No se pudo guardar</h2><div class="mu">${esc(r.error)}</div><button class="btn go" id="jjcerrar">Cerrar</button>`;
  else if (gano) box.innerHTML = `<div class="big">🎉</div><h2>¡Ganaste!</h2><div>${j.premio ? `Premio: <b>${esc(j.premio)}</b><br>` : ''}Quedas dentro de la ruleta${j.ganadores > 1 ? ` (salen ${j.ganadores} ganadores)` : ''}.</div>${btnEnc}<button class="btn" id="jjcerrar">Cerrar</button>`;
  else box.innerHTML = `<div class="big">😅</div><h2>¡Casi!</h2><div>Gracias por jugar.${quedan > 0 ? ` Te quedan ${quedan} intento${quedan === 1 ? '' : 's'}.` : ''}</div>${btnEnc}${quedan > 0 ? `<button class="btn go" data-jugar="${j.id}" id="jjotra">Intentar otra vez</button>` : ''}<button class="btn" id="jjcerrar">Cerrar</button>`;
  jgq('jjb').innerHTML = ''; jgInfo(''); box.classList.remove('hide');
  const cerrar = jgq('jjcerrar'); if (cerrar) cerrar.onclick = jgCerrarJuego;
  if (gano && typeof habla === 'function') habla('🎉 ¡Ganaste, {cliente}!');
}

/* ----- 1 · ¿Dónde está la mascota? (vasos) ----- */
async function jgVasos(j, cfg) {
  const vivo = JG.vivo, X = [17, 50, 83], vel = { facil: 740, normal: 540, dificil: 400 }[j.dificultad] || 540;
  jgq('jjb').innerHTML = `<div class="vs" id="vs">${[0, 1, 2].map(i => `<div class="vc" data-id="${i}" style="left:${X[i]}%"><div class="vcup"></div></div>`).join('')}
    <div class="vm" id="vm" style="left:${X[cfg.inicio]}%"><img src="mascota.png" alt=""></div></div>`;
  const vs = jgq('vs'), copas = [...vs.querySelectorAll('.vc')], vm = jgq('vm');
  const cupEn = [0, 1, 2], slotDe = [0, 1, 2];                      // qué vaso hay en cada lugar y en qué lugar está cada vaso
  const sigue = () => JG.vivo === vivo;
  jgInfo('👀 ¡Mira dónde está la mascota!');
  vm.classList.add('on'); copas[cfg.inicio].classList.add('up'); await jgDormir(1500); if (!sigue()) return;
  copas[cfg.inicio].classList.remove('up'); await jgDormir(420); vm.classList.remove('on');
  jgInfo('🌀 ¡Atento! Se están mezclando…'); await jgDormir(300);
  for (const [a, b] of cfg.swaps) {
    if (!sigue()) return;
    const ca = cupEn[a], cb = cupEn[b], ea = copas[ca], eb = copas[cb];
    ea.style.left = X[b] + '%'; eb.style.left = X[a] + '%';
    ea.firstChild.style.transform = 'translateY(-28px)'; eb.firstChild.style.transform = 'translateY(12px)';
    await jgDormir(vel * 0.5); ea.firstChild.style.transform = ''; eb.firstChild.style.transform = ''; await jgDormir(vel * 0.5);
    cupEn[a] = cb; cupEn[b] = ca; slotDe[ca] = b; slotDe[cb] = a;
  }
  if (!sigue()) return;
  jgInfo('🤔 ¿Dónde está la mascota? ¡Toca un vaso!'); vs.classList.add('espera');
  vs.onclick = async ev => {
    const c = ev.target.closest('.vc'); if (!c || !vs.classList.contains('espera')) return;
    vs.classList.remove('espera');
    const elegido = Number(c.dataset.id), correcto = cfg.inicio;
    vm.style.left = X[slotDe[correcto]] + '%'; vm.classList.add('on'); copas[correcto].classList.add('up');
    if (elegido !== correcto) c.classList.add('up');
    jgInfo(elegido === correcto ? '🎯 ¡Ahí estaba!' : '😬 ¡Ahí no estaba!');
    await jgDormir(1300); if (!sigue()) return;
    jgFin({ copa: slotDe[elegido] });
  };
}

/* ----- 2 · Memoria ----- */
function jgMemoria(j) {
  const vivo = JG.vivo, lim = { facil: 18, normal: 13, dificil: 10 }[j.dificultad] || 13;
  const caras = ['🥤', '🍿', '🍌', '🍕', '🍩', 'M'], mazo = jgBarajar(caras.concat(caras));
  jgq('jjb').innerHTML = `<div class="mg" id="mg">${mazo.map((f, i) => `<button class="mc" data-i="${i}" data-f="${f}"><span class="mf">❓</span><span class="mb">${f === 'M' ? '<img src="mascota.png" alt="">' : f}</span></button>`).join('')}</div>`;
  let abiertas = [], movs = 0, pares = 0, bloqueo = false; const t0 = Date.now();
  const info = () => jgInfo(`Movimientos: <b>${movs}</b> de ${lim} · Parejas: <b>${pares}</b>/6`); info();
  jgq('mg').onclick = async ev => {
    const b = ev.target.closest('.mc'); if (!b || bloqueo || b.classList.contains('on') || b.classList.contains('ok')) return;
    b.classList.add('on'); abiertas.push(b);
    if (abiertas.length < 2) return;
    movs++; bloqueo = true; const [x, y] = abiertas; abiertas = [];
    if (x.dataset.f === y.dataset.f) { x.classList.add('ok'); y.classList.add('ok'); pares++; }
    else { await jgDormir(700); x.classList.remove('on'); y.classList.remove('on'); }
    if (JG.vivo !== vivo) return;
    info(); bloqueo = false;
    if (pares === 6) { await jgDormir(500); if (JG.vivo === vivo) jgFin({ movs, ms: Date.now() - t0 }); }
    else if (movs >= lim) { jgInfo('😬 Se acabaron los movimientos'); await jgDormir(900); if (JG.vivo === vivo) jgFin({ movs, ms: Date.now() - t0 }); }
  };
}

/* ----- 3 · Atrapa a la mascota ----- */
function jgAtrapa(j) {
  const vivo = JG.vivo, c = { facil: { int: 900, meta: 6 }, normal: { int: 700, meta: 9 }, dificil: { int: 520, meta: 12 } }[j.dificultad] || { int: 700, meta: 9 };
  const DUR = 15000;
  jgq('jjb').innerHTML = `<div class="ag" id="ag">${Array.from({ length: 9 }, (_, i) => `<button class="ah" data-i="${i}" aria-label="Hoyo ${i + 1}"><img src="mascota.png" alt=""></button>`).join('')}</div>`;
  const hoyos = [...jgq('ag').querySelectorAll('.ah')]; let score = 0, ultimo = -1, t0 = 0;
  const info = () => { const seg = Math.max(0, Math.ceil((DUR - (Date.now() - t0)) / 1000)); jgInfo(`⏱ <b>${seg}</b> s · 🐾 <b>${score}</b> / meta ${c.meta}`); };
  jgInfo('Prepárate… la mascota va a asomar. ¡Tócala!');
  jgq('ag').onclick = ev => { const h = ev.target.closest('.ah'); if (!h || !h.classList.contains('on') || !t0) return; h.classList.remove('on'); score++; info(); };
  const asomar = () => {
    let k; do { k = jgAzar(9); } while (k === ultimo); ultimo = k; hoyos[k].classList.add('on');
    JG.timers.push(setTimeout(() => hoyos[k].classList.remove('on'), c.int * 0.85));
  };
  JG.timers.push(setTimeout(() => {
    if (JG.vivo !== vivo) return;
    t0 = Date.now(); info(); asomar();
    JG.timers.push(setInterval(() => { if (JG.vivo === vivo) { asomar(); info(); } }, c.int));
    JG.timers.push(setInterval(() => { if (JG.vivo === vivo) info(); }, 250));
    JG.timers.push(setTimeout(() => { if (JG.vivo === vivo) jgFin({ score, ms: Date.now() - t0 }); }, DUR));
  }, 1500));
}
