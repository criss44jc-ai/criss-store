/* CRISS’ STORE · Mascota animada (estilo cómic)
   Estados: "alegre" (pícara, parpadea y guiña), "canta", "asoma" (se acerca al vidrio) y "reposo" (descansando).
   Uso:  Mascota.montar(elemento, 'alegre');   Mascota.estado(elemento, 'canta');  */
(function () {
  const CSS = `
.mc{display:block;width:100%;height:100%;overflow:visible}
.mc .cabeza{transform-box:view-box;transform-origin:100px 176px}
.mc .ceja,.mc .nota,.mc .z,.mc .mano,.mc .rayas,.mc .pupila{transform-box:view-box}

/* ---------- movimiento de la cabeza ---------- */
.mc[data-estado="alegre"] .cabeza{animation:mc-idle 4s ease-in-out infinite}
.mc[data-estado="reposo"] .cabeza{animation:mc-respira 5s ease-in-out infinite}
.mc[data-estado="canta"] .cabeza{animation:mc-balanceo 1.1s ease-in-out infinite}
.mc[data-estado="asoma"] .cabeza{animation:mc-acerca 2.6s cubic-bezier(.2,.8,.2,1) forwards, mc-vidrio 2.6s ease-in-out 2.6s infinite}
@keyframes mc-idle{0%,100%{transform:translateY(0) rotate(-1.8deg)}50%{transform:translateY(-3px) rotate(1.8deg)}}
@keyframes mc-respira{0%,100%{transform:translateY(3px) rotate(5deg) scale(1)}50%{transform:translateY(5px) rotate(5deg) scale(1.02)}}
@keyframes mc-balanceo{0%,100%{transform:translateY(0) rotate(-6deg)}25%{transform:translateY(-5px) rotate(0)}50%{transform:translateY(0) rotate(6deg)}75%{transform:translateY(-5px) rotate(0)}}
@keyframes mc-acerca{0%{transform:translateY(40px) scale(.5)}75%{transform:translateY(3px) scale(1.3)}100%{transform:translateY(6px) scale(1.26)}}
@keyframes mc-vidrio{0%,100%{transform:translateY(6px) scale(1.26) rotate(0)}50%{transform:translateY(4px) scale(1.29) rotate(-2.2deg)}}

/* ---------- ojos ---------- */
.mc .ojos-abiertos,.mc .ojos-feliz,.mc .ojos-dormido{opacity:0}
.mc[data-estado="alegre"] .ojos-abiertos,.mc[data-estado="asoma"] .ojos-abiertos{opacity:1}
.mc[data-estado="canta"] .ojos-feliz{opacity:1}
.mc[data-estado="reposo"] .ojos-dormido{opacity:1}
.mc .parpado{transform-box:fill-box;transform-origin:50% 0;transform:scaleY(0)}
.mc .linea-parpado{opacity:0}
.mc[data-estado="alegre"] .linea-parpado{opacity:1}
.mc[data-estado="alegre"] .parpado.p{transform:scaleY(.34);animation:mc-parpadeo 4.6s infinite}
.mc[data-estado="alegre"] .parpado.g{animation:mc-guino 7s infinite}
@keyframes mc-parpadeo{0%,92%,100%{transform:scaleY(.34)}95.5%{transform:scaleY(1)}}
@keyframes mc-guino{0%,58%,100%{transform:scaleY(0)}62%,74%{transform:scaleY(1)}78%{transform:scaleY(0)}}
.mc .esclera{transform-box:fill-box;transform-origin:center}
.mc[data-estado="asoma"] .esclera{transform:scale(1.22)}
.mc[data-estado="alegre"] .pupila{animation:mc-mira-suave 5.5s ease-in-out infinite}
.mc[data-estado="asoma"] .pupila{animation:mc-mira 2.2s ease-in-out .9s infinite}
@keyframes mc-mira-suave{0%,100%{transform:translate(0,0)}30%{transform:translate(-2.5px,0)}60%{transform:translate(3px,-1px)}}
@keyframes mc-mira{0%,100%{transform:translate(0,0)}20%{transform:translate(-3.5px,1.5px)}45%{transform:translate(3.5px,-1px)}70%{transform:translate(-2px,-2.5px)}}

/* ---------- cejas pícaras ---------- */
.mc[data-estado="alegre"] .ceja-i{animation:mc-ceja 3.4s ease-in-out infinite}
.mc[data-estado="canta"] .ceja-i{animation:mc-ceja-baila .55s ease-in-out infinite alternate}
.mc[data-estado="canta"] .ceja-d{animation:mc-ceja-baila .55s ease-in-out .27s infinite alternate}
.mc[data-estado="asoma"] .ceja{transform:translateY(-3px)}
.mc[data-estado="reposo"] .ceja{transform:translateY(3px)}
@keyframes mc-ceja{0%,55%,100%{transform:translateY(0)}65%,85%{transform:translateY(-5px)}}
@keyframes mc-ceja-baila{from{transform:translateY(0)}to{transform:translateY(-4px)}}

/* ---------- boca ---------- */
.mc .boca-abierta{opacity:0;transform-box:fill-box;transform-origin:50% 0}
.mc[data-estado="canta"] .boca-abierta{opacity:1;animation:mc-canta .5s ease-in-out infinite alternate}
.mc[data-estado="canta"] .boca-cerrada{opacity:0}
@keyframes mc-canta{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
.mc[data-estado="asoma"] .boca-cerrada{transform-box:fill-box;transform-origin:center;transform:scaleX(1.12)}

/* ---------- notas musicales y Zzz ---------- */
.mc .nota,.mc .z{opacity:0}
.mc[data-estado="canta"] .nota{animation:mc-nota 2.4s ease-out infinite}
.mc[data-estado="canta"] .nota.n2{animation-delay:.8s}
.mc[data-estado="canta"] .nota.n3{animation-delay:1.6s}
@keyframes mc-nota{0%{opacity:0;transform:translate(0,12px) scale(.6) rotate(0)}15%{opacity:1}100%{opacity:0;transform:translate(10px,-44px) scale(1.15) rotate(14deg)}}
.mc[data-estado="reposo"] .z{animation:mc-zzz 3.2s ease-out infinite}
.mc[data-estado="reposo"] .z.z2{animation-delay:1s}
.mc[data-estado="reposo"] .z.z3{animation-delay:2s}
@keyframes mc-zzz{0%{opacity:0;transform:translate(0,10px) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(8px,-26px) scale(1.2)}}

/* ---------- el vidrio ---------- */
.mc .niebla{opacity:0;transform-box:fill-box;transform-origin:center}
.mc[data-estado="asoma"] .niebla{animation:mc-niebla 2.8s ease-in-out 1.6s infinite}
@keyframes mc-niebla{0%,100%{opacity:0;transform:scale(.7)}50%{opacity:.8;transform:scale(1.2)}}
.mc .mano{opacity:0}
.mc[data-estado="asoma"] .mano{animation:mc-mano .45s ease-out 1.5s forwards}
.mc[data-estado="asoma"] .mano.m2{animation-delay:1.7s}
@keyframes mc-mano{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.mc .rayas{opacity:0;transform-origin:100px 100px}
.mc[data-estado="asoma"] .rayas{animation:mc-rayas 1.8s ease-out forwards}
@keyframes mc-rayas{0%{opacity:0;transform:scale(.55)}30%{opacity:.85}100%{opacity:0;transform:scale(1.3)}}
.mc .brillo{opacity:.16}
.mc[data-estado="asoma"] .brillo{opacity:.24}

@media (prefers-reduced-motion:reduce){.mc *{animation:none!important}}
`;

  const rayas = Array.from({ length: 14 }, (_, i) =>
    `<line x1="100" y1="4" x2="100" y2="26" transform="rotate(${i * (360 / 14)} 100 100)"/>`).join('');

  const SVG = `
<svg class="mc" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mascota de CRISS’ STORE" data-estado="alegre">
<defs>
  <clipPath id="mc-clip"><circle cx="100" cy="100" r="95"/></clipPath>
  <filter id="mc-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2"/></filter>
  <pattern id="mc-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.5" fill="#e0a91c" opacity=".5"/></pattern>
  <g id="mc-nota">
    <ellipse cx="0" cy="0" rx="6.4" ry="4.6" transform="rotate(-22)" fill="#12263a"/>
    <path d="M5.2 -2 V-24 C10 -22 15 -18 14 -11" fill="none" stroke="#12263a" stroke-width="3.2" stroke-linecap="round"/>
  </g>
</defs>

<g clip-path="url(#mc-clip)">
  <rect width="200" height="200" fill="#f9d85c"/>
  <rect width="200" height="200" fill="url(#mc-dots)"/>
  <g class="rayas" stroke="#fff" stroke-width="3.4" stroke-linecap="round">${rayas}</g>

  <g class="cabeza" stroke="#1a1210" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round">
    <ellipse cx="57" cy="104" rx="8" ry="12" fill="#efbd3a"/>
    <ellipse cx="144" cy="104" rx="8" ry="12" fill="#efbd3a"/>
    <path d="M60 88 C60 64 80 54 102 54 C124 54 142 64 142 88 L142 118 C142 148 124 164 101 164 C78 164 60 148 60 118 Z" fill="#efbd3a"/>
    <path d="M55 98 C50 144 72 182 101 184 C130 184 152 144 147 98 L141 100 C140 116 134 126 126 130 C114 124 88 124 76 130 C68 126 62 116 61 100 Z" fill="#1a1210"/>
    <path d="M74 132 C86 120 97 124 101 131 C105 124 116 120 128 132 C120 144 108 139 101 139 C94 139 82 144 74 132 Z" fill="#1a1210"/>
    <path d="M54 106 C46 58 74 28 104 28 C136 28 154 58 148 106 L142 98 C141 74 128 56 104 56 C80 56 64 74 62 98 Z" fill="#1a1210"/>
    <path d="M80 38 C92 32 106 32 118 36" fill="none" stroke="#fff" stroke-width="4" opacity=".35"/>
    <path d="M64 132 C66 150 76 162 88 168" fill="none" stroke="#fff" stroke-width="4" opacity=".22"/>

    <g class="boca-cerrada" stroke="none">
      <path d="M82 146 C92 163 116 163 128 136 C117 152 96 153 82 146 Z" fill="#efbd3a"/>
      <path d="M100 155 L109 155 L107 148 Z" fill="#fff"/>
    </g>
    <g class="boca-abierta">
      <ellipse cx="104" cy="150" rx="13" ry="11" fill="#4a0f14" stroke="#efbd3a" stroke-width="2.6"/>
      <ellipse cx="104" cy="157" rx="7.5" ry="4" fill="#e8576b" stroke="none"/>
    </g>

    <path d="M102 88 C97 100 95 108 101 111 C107 114 113 108 109 103" fill="#efbd3a"/>

    <ellipse cx="72" cy="113" rx="8" ry="5" fill="#ff7a6b" opacity=".4" stroke="none"/>
    <ellipse cx="134" cy="111" rx="8" ry="5" fill="#ff7a6b" opacity=".4" stroke="none"/>

    <g class="ojos-abiertos">
      <ellipse class="esclera" cx="83" cy="88" rx="9.5" ry="7.5" fill="#fff" stroke-width="2.8"/>
      <circle class="pupila" cx="85" cy="89" r="3.8" fill="#1a1210" stroke="none"/>
      <ellipse class="esclera" cx="121" cy="86" rx="9.5" ry="7.5" fill="#fff" stroke-width="2.8"/>
      <circle class="pupila" cx="123" cy="87" r="3.8" fill="#1a1210" stroke="none"/>
      <ellipse class="parpado p" cx="83" cy="88" rx="11" ry="9" fill="#efbd3a" stroke="none"/>
      <ellipse class="parpado p" cx="121" cy="86" rx="11" ry="9" fill="#efbd3a" stroke="none"/>
      <ellipse class="parpado g" cx="121" cy="86" rx="11" ry="9" fill="#efbd3a" stroke="none"/>
      <path class="linea-parpado" d="M73 85 Q83 82 93 86" fill="none" stroke-width="3.6"/>
      <path class="linea-parpado" d="M111 83 Q121 80 131 84" fill="none" stroke-width="3.6"/>
    </g>
    <g class="ojos-feliz" fill="none" stroke-width="4.4">
      <path d="M74 91 Q83 78 92 91"/><path d="M112 89 Q121 76 130 89"/>
    </g>
    <g class="ojos-dormido" fill="none" stroke-width="4.4">
      <path d="M74 86 Q83 96 92 86"/><path d="M112 84 Q121 94 130 84"/>
    </g>

    <path class="ceja ceja-i" d="M71 72 Q83 58 97 68" fill="none" stroke-width="6.4"/>
    <path class="ceja ceja-d" d="M110 70 Q124 64 139 75" fill="none" stroke-width="6.4"/>
  </g>

  <ellipse class="niebla" cx="100" cy="132" rx="40" ry="26" fill="#eaf6ff" filter="url(#mc-blur)"/>
  <g transform="translate(34 152) rotate(-14)"><g class="mano m1" stroke="#1a1210" stroke-width="3" stroke-linejoin="round">
    <ellipse cx="-9" cy="-14" rx="3.8" ry="8.5" fill="#efbd3a"/><ellipse cx="-3" cy="-17" rx="3.8" ry="9" fill="#efbd3a"/>
    <ellipse cx="3" cy="-17" rx="3.8" ry="9" fill="#efbd3a"/><ellipse cx="9" cy="-14" rx="3.8" ry="8.5" fill="#efbd3a"/>
    <ellipse cx="0" cy="0" rx="13.5" ry="12" fill="#efbd3a"/></g></g>
  <g transform="translate(166 152) rotate(14)"><g class="mano m2" stroke="#1a1210" stroke-width="3" stroke-linejoin="round">
    <ellipse cx="-9" cy="-14" rx="3.8" ry="8.5" fill="#efbd3a"/><ellipse cx="-3" cy="-17" rx="3.8" ry="9" fill="#efbd3a"/>
    <ellipse cx="3" cy="-17" rx="3.8" ry="9" fill="#efbd3a"/><ellipse cx="9" cy="-14" rx="3.8" ry="8.5" fill="#efbd3a"/>
    <ellipse cx="0" cy="0" rx="13.5" ry="12" fill="#efbd3a"/></g></g>

  <path class="brillo" d="M18 62 L66 8 L92 8 L18 92 Z" fill="#fff"/>
  <path class="brillo" d="M150 192 L192 148 L192 172 L172 192 Z" fill="#fff"/>
</g>
<circle cx="100" cy="100" r="95" fill="none" stroke="#12263a" stroke-width="5"/>

<g transform="translate(152 66)"><g class="nota n1"><use href="#mc-nota"/></g></g>
<g transform="translate(168 98)"><g class="nota n2"><use href="#mc-nota"/></g></g>
<g transform="translate(34 84)"><g class="nota n3"><use href="#mc-nota"/></g></g>

<g fill="none" stroke="#12263a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
  <path class="z z1" d="M140 66 h9 l-9 11 h9"/>
  <path class="z z2" d="M152 48 h11 l-11 13 h11"/>
  <path class="z z3" d="M167 28 h13 l-13 15 h13"/>
</g>
</svg>`;

  function inyectarCss() {
    if (document.getElementById('mc-css')) return;
    const s = document.createElement('style');
    s.id = 'mc-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  window.Mascota = {
    svg: SVG,
    css: CSS,
    montar(el, estado) {
      inyectarCss();
      el.innerHTML = SVG;
      this.estado(el, estado || 'alegre');
    },
    estado(el, estado) {
      const s = el.querySelector('svg.mc');
      if (!s) return;
      if (s.dataset.estado === estado && estado !== 'asoma') return;
      s.dataset.estado = '';          // reinicia la animación
      void s.getBoundingClientRect();
      s.dataset.estado = estado;
    },
    actual(el) {
      const s = el.querySelector('svg.mc');
      return s ? s.dataset.estado : null;
    }
  };
})();
