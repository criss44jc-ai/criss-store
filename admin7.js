/* CRISS’ STORE · Administrador (parte 7): curva de ventas diarias y cambio de nombre de productos */
const FALTA17 = '<div class="mu">Falta ejecutar supabase_v17.sql en Supabase.</div>';

/* ================= CURVA DE VENTAS ================= */
const METRICAS = { ventas: { n: 'Ventas', din: true }, ganancia: { n: 'Ganancia', din: true }, unidades: { n: 'Unidades', din: false }, pedidos: { n: 'Pedidos', din: false } };
const DIAS_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
let curva = { act: [], ant: [] };

function llenarLocalesCurva() {
  const v = $('cvl').value;
  $('cvl').innerHTML = '<option value="">Todos los locales</option>' + locales.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join('');
  if (v && locales.some(l => l.id == v)) $('cvl').value = v;
}
function rangoCurva() {
  const v = $('cvp').value, hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  let d1 = new Date(hoy), n;
  if (v === 'mes') { d1 = new Date(hoy.getFullYear(), hoy.getMonth(), 1); n = Math.round((hoy - d1) / 86400000) + 1; }
  else { n = Number(v); d1.setDate(d1.getDate() - (n - 1)); }
  const p2 = new Date(d1); p2.setDate(p2.getDate() - 1);
  const p1 = new Date(p2); p1.setDate(p1.getDate() - (n - 1));
  return { d1, d2: hoy, p1, p2, n };
}
async function loadCurva() {
  const r = rangoCurva(), loc = $('cvl').value ? Number($('cvl').value) : null;
  const q = (a, b) => sb.rpc('ventas_diarias', { p_desde: isoDia(a), p_hasta: isoDia(b), p_sucursal: loc });
  const [a, b] = await Promise.all([q(r.d1, r.d2), $('cvc').checked ? q(r.p1, r.p2) : Promise.resolve({ data: [] })]);
  if (a.error) { $('cvout').innerHTML = FALTA17; return; }
  const num = x => ({ dia: x.dia, pedidos: Number(x.pedidos), unidades: Number(x.unidades), ventas: Number(x.ventas), ganancia: Number(x.ganancia) });
  curva.act = (a.data || []).map(num); curva.ant = (b.data || []).map(num);
  renderCurva();
}
['cvp', 'cvl', 'cvc'].forEach(i => $(i).onchange = loadCurva);
$('cvm').onchange = () => renderCurva();

const fmtM = (v, din) => din ? money(v) : String(Math.round(v));
const fmtCorto = (v, din) => din ? '$' + (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : (v % 1 ? v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') : v)) : String(Math.round(v));
function maxBonito(m) {
  if (m <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(m))), f = m / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
}
// curva suave que pasa por los puntos
function trazoSuave(pts, ymin, ymax) {
  if (pts.length < 2) return '';
  const cl = y => Math.min(ymax, Math.max(ymin, y));
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, cl(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, cl(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
const fechaLarga = s => new Date(s + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
const fechaCorta = s => new Date(s + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: '2-digit' });

function renderCurva() {
  const key = $('cvm').value, M = METRICAS[key], act = curva.act, ant = curva.ant;
  if (!act.length) { $('cvout').innerHTML = '<div class="mu">Sin datos para este período.</div>'; return; }
  const W = 640, H = 250, pl = 48, pr = 12, pt = 14, pb = 28, base = H - pb, alto = H - pt - pb, n = act.length;
  const vals = act.map(x => x[key]), valsA = ant.length === n ? ant.map(x => x[key]) : [];
  const max = maxBonito(Math.max(...vals, ...valsA, 0));
  const X = i => n === 1 ? (pl + (W - pl - pr) / 2) : pl + i * (W - pl - pr) / (n - 1);
  const Y = v => base - (v / max) * alto;
  const pts = vals.map((v, i) => [X(i), Y(v)]), ptsA = valsA.map((v, i) => [X(i), Y(v)]);
  const linea = trazoSuave(pts, pt, base);
  const area = linea ? `${linea} L${X(n - 1).toFixed(1)},${base} L${X(0).toFixed(1)},${base} Z` : '';
  const cada = Math.max(1, Math.ceil(n / 6));
  const grid = [0, 1, 2, 3, 4].map(k => { const v = max * k / 4, y = Y(v); return `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="#dde3ea" stroke-width="1"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#5d6b7a">${fmtCorto(v, M.din)}</text>`; }).join('');
  const etiq = act.map((x, i) => (i % cada === 0 || i === n - 1) && (n - 1 - i >= cada * 0.6 || i === n - 1) ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#5d6b7a">${fechaCorta(x.dia)}</text>` : '').join('');
  const puntos = n <= 31 ? pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#fff" stroke="#1971c2" stroke-width="2"/>`).join('') : '';

  // resumen
  const total = vals.reduce((s, v) => s + v, 0), totA = valsA.reduce((s, v) => s + v, 0);
  const iMax = vals.indexOf(Math.max(...vals)), iMin = vals.indexOf(Math.min(...vals));
  const cambio = valsA.length && totA > 0 ? ((total - totA) / totA) * 100 : null;
  const stat = (v, k, cls) => `<div class="stat"><b class="${cls || ''}">${v}</b><span>${k}</span></div>`;

  // promedio por día de la semana
  const suma = Array(7).fill(0), cuenta = Array(7).fill(0);
  act.forEach(x => { const d = new Date(x.dia + 'T00:00:00').getDay(); suma[d] += x[key]; cuenta[d]++; });
  const prom = suma.map((s, d) => cuenta[d] ? s / cuenta[d] : 0), pmax = Math.max(...prom), orden = [1, 2, 3, 4, 5, 6, 0];
  const mejorDia = pmax > 0 ? prom.indexOf(pmax) : -1;

  $('cvout').innerHTML = `
    <div class="cv">
      <svg id="cvsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva de ${M.n.toLowerCase()} por día">
        <defs><linearGradient id="cvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1971c2" stop-opacity=".30"/><stop offset="100%" stop-color="#1971c2" stop-opacity="0"/></linearGradient></defs>
        ${grid}
        ${valsA.length ? `<path d="${trazoSuave(ptsA, pt, base)}" fill="none" stroke="#9aa5b1" stroke-width="2" stroke-dasharray="5 4"/>` : ''}
        ${area ? `<path d="${area}" fill="url(#cvg)"/><path d="${linea}" fill="none" stroke="#1971c2" stroke-width="3" stroke-linecap="round"/>` : ''}
        ${puntos}${etiq}
        <line id="cvlin" x1="0" x2="0" y1="${pt}" y2="${base}" stroke="#12263a" stroke-width="1" stroke-dasharray="3 3" style="display:none"/>
        <circle id="cvdot" r="5" fill="#1971c2" stroke="#fff" stroke-width="2" style="display:none"/>
        <rect id="cvhit" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
      </svg>
      <div class="cvtip hide" id="cvtip"></div>
    </div>
    <div class="mu" style="display:flex;gap:14px;flex-wrap:wrap;margin:2px 0 8px"><span><b style="color:#1971c2">━</b> Este período</span>${valsA.length ? '<span><b style="color:#9aa5b1">┅</b> Período anterior</span>' : ''}</div>
    <div class="stats">
      ${stat(fmtM(total, M.din), 'Total')}
      ${stat(fmtM(total / n, M.din), 'Promedio por día')}
      ${cambio === null ? stat('—', 'Vs. anterior') : stat((cambio >= 0 ? '▲ ' : '▼ ') + Math.abs(cambio).toFixed(0) + '%', 'Vs. anterior', cambio >= 0 ? 'ok' : 'low')}
      ${stat(fmtM(vals[iMax], M.din), 'Mejor día: ' + fechaCorta(act[iMax].dia))}
      ${stat(fmtM(vals[iMin], M.din), 'Más flojo: ' + fechaCorta(act[iMin].dia))}
      ${stat(act.filter(x => x[key] > 0).length + ' / ' + n, 'Días con ventas')}
    </div>
    ${mejorDia >= 0 ? `<div class="tip">📅 Tu mejor día de la semana suele ser el <b>${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][mejorDia]}</b> (${fmtM(pmax, M.din)} en promedio).</div>` : ''}
    <div class="mu" style="margin-top:8px">Promedio por día de la semana</div>
    <div class="wd">${orden.map(d => `<div class="${d === mejorDia ? 'mejor' : ''}"><i style="height:${pmax > 0 ? Math.max(2, Math.round(prom[d] / pmax * 70)) : 2}px" title="${fmtM(prom[d], M.din)}"></i>${DIAS_SEM[d]}</div>`).join('')}</div>`;

  // al pasar el dedo o el mouse por la curva se ve el detalle de ese día
  const svg = $('cvsvg'), tip = $('cvtip');
  const mover = ev => {
    const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * W / r.width;
    const i = Math.max(0, Math.min(n - 1, Math.round((x - pl) / ((W - pl - pr) / Math.max(1, n - 1)))));
    $('cvlin').setAttribute('x1', X(i)); $('cvlin').setAttribute('x2', X(i)); $('cvlin').style.display = '';
    $('cvdot').setAttribute('cx', X(i)); $('cvdot').setAttribute('cy', Y(vals[i])); $('cvdot').style.display = '';
    const d = act[i];
    tip.innerHTML = `<b>${esc(fechaLarga(d.dia))}</b><br>${M.n}: <b>${fmtM(d[key], M.din)}</b>` +
      (valsA.length ? `<br><span style="color:#cbd5e0">Antes: ${fmtM(valsA[i], M.din)}</span>` : '') +
      `<br>${d.pedidos} ${d.pedidos === 1 ? 'pedido' : 'pedidos'} · ${d.unidades} u.`;
    tip.classList.remove('hide');
    const caja = svg.parentElement.getBoundingClientRect().width, px = X(i) / W * caja;
    tip.style.left = Math.min(caja - 70, Math.max(70, px)) + 'px';
  };
  const ocultar = () => { tip.classList.add('hide'); $('cvlin').style.display = 'none'; $('cvdot').style.display = 'none'; };
  const hit = $('cvhit');
  hit.addEventListener('pointermove', mover); hit.addEventListener('pointerdown', mover);
  hit.addEventListener('pointerleave', ocultar);
}

/* ================= CAMBIAR EL NOMBRE DE UN PRODUCTO ================= */
const MOTIVOS_NOM = { error_escritura: 'Estaba mal escrito', presentacion: 'Cambió la presentación o la marca', nuevo_nombre: 'Nuevo nombre comercial', otro: 'Otro motivo' };
let rnId = null;
document.addEventListener('click', e => { const b = e.target.closest('[data-rnp]'); if (b) abrirRenombre(b.dataset.rnp); });
function abrirRenombre(id) {
  const p = prods.find(x => x.id == id); if (!p) return;
  rnId = p.id;
  $('rn2-act').textContent = `Nombre actual: ${p.nombre}`;
  $('rn2-nom').value = p.nombre; $('rn2-mot').value = 'error_escritura'; $('rn2-com').value = ''; say('rn2-msg', '');
  $('renombre').classList.remove('hide');
  setTimeout(() => $('rn2-nom').select(), 50);
}
$('rn2-x').onclick = () => $('renombre').classList.add('hide');
$('rn2-ok').onclick = async () => {
  const nom = $('rn2-nom').value.trim(), com = $('rn2-com').value.trim(), p = prods.find(x => x.id == rnId);
  if (nom.length < 2) { say('rn2-msg', 'Escribe el nombre nuevo.', true); return; }
  if (p && nom === p.nombre) { say('rn2-msg', 'El nombre nuevo es igual al actual.', true); return; }
  if (com.length < 5) { say('rn2-msg', 'La justificación es obligatoria (mínimo 5 letras).', true); return; }
  $('rn2-ok').disabled = true; say('rn2-msg', 'Guardando…');
  const { error } = await sb.rpc('renombrar_producto', { p_producto: rnId, p_nombre: nom, p_motivo: $('rn2-mot').value, p_comentario: com });
  $('rn2-ok').disabled = false;
  if (error) { say('rn2-msg', /renombrar_producto/.test(error.message) ? 'Falta ejecutar supabase_v17.sql en Supabase.' : error.message, true); return; }
  $('renombre').classList.add('hide');
  await loadAll();
};
async function loadCambiosNombre() {
  const { data, error } = await sb.from('cambios_nombre').select('*').order('id', { ascending: false }).limit(15);
  if (error) { $('cnlist').innerHTML = FALTA17; return; }
  $('cnlist').innerHTML = data && data.length ? data.map(c => `
    <div class="line" style="align-items:flex-start"><div><b>${esc(c.nombre_anterior)}</b> → <b>${esc(c.nombre_nuevo)}</b>
      <div class="mu">${fdate(c.fecha)} · ${esc(MOTIVOS_NOM[c.motivo] || c.motivo)}</div><div>${esc(c.comentario)}</div></div></div>`).join('')
    : '<div class="mu">Todavía no has cambiado nombres de productos.</div>';
}
