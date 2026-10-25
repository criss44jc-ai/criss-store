/* CRISS’ STORE · Mascota pixelada animada
   Misma forma de uso que mascota.js:  MascotaPixel.montar(elemento, 'alegre');  MascotaPixel.estado(elemento, 'canta');
   Estados: "alegre", "canta", "asoma" y "reposo". Necesita los 4 archivos mascota-pixel-*.gif en la misma carpeta. */
(function () {
  const ARCHIVOS = {
    alegre: 'mascota-pixel-alegre.gif',
    canta: 'mascota-pixel-canta.gif',
    asoma: 'mascota-pixel-asoma.gif',
    reposo: 'mascota-pixel-reposo.gif'
  };

  function inyectarCss() {
    if (document.getElementById('mp-css')) return;
    const s = document.createElement('style');
    s.id = 'mp-css';
    s.textContent = '.mp{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;-webkit-user-drag:none;user-select:none}';
    document.head.appendChild(s);
  }
  function precargar() {
    Object.values(ARCHIVOS).forEach(u => { const i = new Image(); i.src = u; });
  }
  // Se crea una imagen nueva en cada cambio de estado: así el GIF siempre arranca desde su primer cuadro
  function poner(el, estado) {
    const img = document.createElement('img');
    img.className = 'mp';
    img.alt = 'Mascota de CRISS’ STORE';
    img.draggable = false;
    img.dataset.estado = estado;
    img.onerror = () => {
      img.onerror = null;
      img.src = 'mascota.png';
      img.style.cssText = 'border-radius:50%;border:3px solid #12263a;background:#f9d55b;object-fit:cover;image-rendering:auto';
    };
    img.src = ARCHIVOS[estado] || ARCHIVOS.alegre;
    el.replaceChildren(img);
  }

  window.MascotaPixel = {
    montar(el, estado) {
      inyectarCss();
      precargar();
      poner(el, ARCHIVOS[estado] ? estado : 'alegre');
    },
    estado(el, estado) {
      const img = el.querySelector('img.mp');
      if (!img || !ARCHIVOS[estado]) return;
      if (img.dataset.estado === estado && estado !== 'asoma') return;
      poner(el, estado);
    },
    actual(el) {
      const img = el.querySelector('img.mp');
      return img ? img.dataset.estado : null;
    }
  };
})();
