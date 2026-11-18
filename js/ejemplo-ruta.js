/* =========================================================
   ejemplo-ruta.js — slide 12 "Así evolucionó la ruta".
   Muestra el resultado de la corrida del repartidor (slide 11),
   leyendo sus datos de window.Repartidor (ejemplo-viajero.js):
   · resumen: "De X km a Y km: Z % más corta en N generaciones"
   · galería: de 2 a 5 mini-mapas (gen 0, intermedios bien
     repartidos según la mejora, y la ganadora resaltada)
   · mapa grande con una moto de reparto (dibujada con formas)
     que recorre la ruta ganadora desde la Bodega, barrio por
     barrio, y vuelve; los barrios se marcan como visitados
   · línea de tiempo: un slider sobre las instantáneas guardadas
     para "rebobinar" la evolución
   Si no hubo corrida, muestra un aviso con un botón para volver.
   Se registra con Presentacion.registrar: start() lee los datos
   y dibuja; stop() detiene la animación de la moto.
   ========================================================= */
(function () {
  "use strict";

  var R = window.Repartidor;
  if (!R) return;
  var W = R.W, H = R.H;
  var DURACION = 9000;            // ms que tarda la moto en hacer toda la ruta

  var elResumen = document.getElementById("ruta-resumen");
  var elAviso = document.getElementById("ruta-aviso");
  var elAvisoTxt = document.getElementById("ruta-aviso-txt");
  var elContenido = document.getElementById("ruta-contenido");
  var elNota = document.getElementById("ruta-nota");
  var elGaleria = document.getElementById("ruta-galeria");
  var elFondo = document.getElementById("ruta-fondo");
  var elMoto = document.getElementById("ruta-moto");
  var elPlay = document.getElementById("ruta-play");
  var elRepetir = document.getElementById("ruta-repetir");
  var elTiempo = document.getElementById("ruta-tiempo");
  var elTiempoTxt = document.getElementById("ruta-tiempo-txt");
  var elRecorrido = document.getElementById("ruta-recorrido");

  function prepararCanvas(c, w, h) {
    var dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return g;
  }
  var fctx = prepararCanvas(elFondo, W, H);
  var mctx = prepararCanvas(elMoto, W, H);

  var datos = null;               // copia de lo que expone el repartidor al entrar
  var etiquetas = [];
  var actual = 0;                 // índice de la instantánea que se ve en el mapa grande
  var anim = null;                // requestAnimationFrame de la moto
  var t0 = 0;
  var recorrido = null;           // { puntos, acum, total } de la ruta que recorre la moto

  function pct(d0, d) { return Math.round((d0 - d) / d0 * 100); }

  /* la ganadora: la PRIMERA instantánea con la distancia mínima
     (los hitos posteriores pueden repetir la misma ruta) */
  function indiceGanadora(fotos) {
    var g = 0;
    for (var i = 1; i < fotos.length; i++) if (fotos[i].d < fotos[g].d) g = i;
    return g;
  }

  /* ---------- elegir las instantáneas de la galería ----------
     siempre la primera y la ganadora; en medio, las más cercanas
     al 45 %, 80 % y 95 % de la mejora total */
  function elegirGaleria(fotos) {
    var n = indiceGanadora(fotos) + 1;                 // lo que viene después repite la ganadora
    if (n <= 5) { var todas = []; for (var t = 0; t < n; t++) todas.push(t); return todas; }
    var d0 = fotos[0].d, dN = fotos[n - 1].d, elegidas = [0, n - 1];
    [0.45, 0.8, 0.95].forEach(function (t) {
      var meta = d0 - t * (d0 - dN), mejor = -1, dif = Infinity;
      for (var i = 1; i < n - 1; i++) {
        if (elegidas.indexOf(i) >= 0) continue;
        var e = Math.abs(fotos[i].d - meta);
        if (e < dif) { dif = e; mejor = i; }
      }
      if (mejor >= 0) elegidas.push(mejor);
    });
    return elegidas.sort(function (a, b) { return a - b; });
  }

  /* ---------- dibujo compartido ---------- */
  function dibujarRuta(g, ciudades, ruta, ancho) {
    if (!ruta || !ruta.length) return;
    g.beginPath();
    for (var i = 0; i < ruta.length; i++) {
      var p = ciudades[ruta[i]];
      if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
    }
    g.closePath();
    g.lineJoin = "round";
    g.strokeStyle = "rgba(255,255,255,.9)";
    g.lineWidth = ancho + 3;
    g.stroke();
    g.strokeStyle = "#026937";
    g.lineWidth = ancho;
    g.stroke();
  }

  function genRel(f) { return f.gen - datos.genBase; }

  /* ---------- galería ---------- */
  function pintarGaleria() {
    var fotos = datos.fotos, idx = elegirGaleria(fotos), d0 = fotos[0].d;
    var gana = datos.gana;
    elGaleria.innerHTML = "";
    idx.forEach(function (i) {
      var f = fotos[i], esGana = i === gana;
      var card = document.createElement("button");
      card.className = "foto" + (esGana ? " ganadora" : "") + (i === actual ? " sel" : "");
      card.dataset.i = i;
      var c = document.createElement("canvas");
      var esc = esGana ? 0.42 : 0.32;                // la ganadora se ve más grande
      var g = prepararCanvas(c, W * esc, H * esc);
      g.drawImage(R.planoLimpio, 0, 0, W * esc, H * esc);
      g.scale(esc, esc);
      dibujarRuta(g, datos.ciudades, f.ruta, esGana ? 5 : 6);
      window.Plano.pines(g, datos.ciudades, {});
      card.appendChild(c);
      var pie = document.createElement("span");
      pie.className = "foto-pie";
      pie.innerHTML = (esGana ? '<em class="foto-tag">Ruta más eficiente</em>' : "") +
        "<b>Gen " + genRel(f) + "</b> · " + R.km(f.d) +
        (i === 0 ? " · al azar" : " · −" + pct(d0, f.d) + " %");
      card.appendChild(pie);
      elGaleria.appendChild(card);
    });
  }

  elGaleria.addEventListener("click", function (e) {
    var b = e.target.closest(".foto");
    if (!b) return;
    b.blur();
    mostrar(+b.dataset.i);
  });

  /* ---------- mapa grande ---------- */
  function mostrar(i) {
    pararMoto();
    actual = i;
    elTiempo.value = i;
    var f = datos.fotos[i], d0 = datos.fotos[0].d;
    fctx.clearRect(0, 0, W, H);
    fctx.drawImage(R.plano, 0, 0, W, H);
    dibujarRuta(fctx, datos.ciudades, f.ruta, 3.6);
    recorrido = prepararRecorrido(f.ruta);
    dibujarMoto(0);
    elTiempoTxt.innerHTML = "<b>Gen " + genRel(f) + "</b> · " + R.km(f.d) +
      (i === 0 ? " · la mejor de la población al azar" : " · " + pct(d0, f.d) + " % más corta que en la generación 0") +
      (i === datos.gana ? " · <b>la ganadora</b>" : "");
    Array.prototype.forEach.call(elGaleria.children, function (c) {
      c.classList.toggle("sel", +c.dataset.i === i);
    });
    elRecorrido.textContent = "";
  }

  elTiempo.addEventListener("input", function () { mostrar(+this.value); });

  /* ---------- la moto ---------- */
  function prepararRecorrido(ruta) {
    var pts = ruta.map(function (k) { return { x: datos.ciudades[k].x, y: datos.ciudades[k].y, k: k }; });
    pts.push(pts[0]);                                  // vuelve a la Bodega
    var acum = [0];
    for (var i = 1; i < pts.length; i++) {
      acum.push(acum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    return { puntos: pts, acum: acum, total: acum[acum.length - 1] };
  }

  /* dibuja barrios (visitados en verde con ✓), nombres y la moto en la fracción t del camino */
  function dibujarMoto(t) {
    var rc = recorrido;
    mctx.clearRect(0, 0, W, H);
    if (!rc) return;
    var dist = t * rc.total, seg = 1;
    while (seg < rc.acum.length - 1 && rc.acum[seg] < dist) seg++;
    var visitados = {}, n = 0;
    for (var i = 1; i < rc.puntos.length - 1; i++) {
      if (rc.acum[i] <= dist && t > 0) { visitados[rc.puntos[i].k] = true; n++; }
    }
    window.Plano.pines(mctx, datos.ciudades, { visitados: visitados });
    window.Plano.etiquetas(mctx, datos.ciudades, etiquetas, null, W);

    var a = rc.puntos[seg - 1], b = rc.puntos[seg];
    var largo = (rc.acum[seg] - rc.acum[seg - 1]) || 1;
    var u = Math.min(1, Math.max(0, (dist - rc.acum[seg - 1]) / largo));
    var x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
    moto(mctx, x, y, Math.atan2(b.y - a.y, b.x - a.x));
    return n;
  }

  /* una moto de reparto simple: ruedas, cuerpo, conductor y caja naranja */
  function moto(g, x, y, ang) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.scale(1.5, 1.5);                                // que se vea bien proyectada
    if (Math.cos(ang) < 0) g.scale(1, -1);            // que no quede de cabeza al ir a la izquierda
    g.fillStyle = "rgba(0,0,0,.18)";                  // sombra
    g.beginPath(); g.ellipse(0, 9, 17, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1c2b23";                          // ruedas
    g.beginPath(); g.arc(-11, 5, 5.2, 0, Math.PI * 2); g.arc(12, 5, 5.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(-11, 5, 1.8, 0, Math.PI * 2); g.arc(12, 5, 1.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#026937";                          // cuerpo
    window.Plano.redondeado(g, -12, -4, 26, 8, 3); g.fill();
    g.fillStyle = "#f9a12c";                          // caja del pedido
    window.Plano.redondeado(g, -21, -15, 13, 12, 2); g.fill();
    g.strokeStyle = "#a55f00"; g.lineWidth = 1; g.stroke();
    g.fillStyle = "#08281a";                          // conductor
    g.beginPath(); g.arc(1, -11, 4.6, 0, Math.PI * 2); g.fill();
    g.fillRect(-2, -8, 6, 6);
    g.restore();
  }

  function pararMoto() {
    if (anim) { cancelAnimationFrame(anim); anim = null; }
    elPlay.textContent = "▶ Recorrer la ruta ganadora";
  }

  function cuadro(ahora) {
    var t = Math.min(1, (ahora - t0) / DURACION);
    var n = dibujarMoto(t);
    var total = datos.ciudades.length - 1;
    elRecorrido.textContent = t < 1 ? "Visitados: " + n + " de " + total + " barrios"
      : "¡Ruta completa! Visitó los " + total + " barrios y volvió a la Bodega.";
    if (t < 1) anim = requestAnimationFrame(cuadro);
    else { anim = null; elPlay.textContent = "▶ Recorrer la ruta ganadora"; }
  }

  function recorrer() {
    var gana = datos.gana;
    if (actual !== gana) mostrar(gana);               // la moto siempre hace la ruta ganadora
    pararMoto();
    t0 = performance.now();
    elPlay.textContent = "⏸ Recorriendo…";
    anim = requestAnimationFrame(cuadro);
  }

  elPlay.addEventListener("click", function () {
    this.blur();
    if (!datos) return;
    if (anim) { pararMoto(); return; }
    recorrer();
  });
  elRepetir.addEventListener("click", function () { this.blur(); if (datos) recorrer(); });

  document.getElementById("ruta-volver").addEventListener("click", function () {
    this.blur();
    var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    window.Presentacion.irA(slides.indexOf(document.getElementById("slide-demo-viajero")));
  });

  /* ---------- entrar a la slide ---------- */
  function preparar() {
    var e = R.estado();
    var hay = e.arrancado && e.fotos.length >= 2;
    elAviso.hidden = hay;
    elContenido.hidden = !hay;
    if (!hay) {
      datos = null;
      elAvisoTxt.textContent = e.arrancado
        ? "La corrida acaba de empezar: deje que el repartidor mejore su ruta unas generaciones y vuelva."
        : "Primero corra el ejemplo en la slide anterior.";
      elResumen.innerHTML = "Aquí verá cómo la ruta del repartidor se fue acortando, generación tras generación.";
      return;
    }
    datos = {
      ciudades: e.ciudades.map(function (c) { return { x: c.x, y: c.y, nombre: c.nombre, bodega: c.bodega }; }),
      fotos: e.fotos.slice(),
      genBase: e.genBase
    };
    datos.gana = indiceGanadora(datos.fotos);
    var f0 = datos.fotos[0], fN = datos.fotos[datos.gana];
    elResumen.innerHTML = "De <strong>" + R.km(f0.d) + "</strong> a <strong>" + R.km(fN.d) + "</strong>: " +
      "<strong>" + pct(f0.d, fN.d) + " % más corta</strong> en " + genRel(fN) + " generaciones " +
      "<small>(km a escala ilustrativa)</small>.";
    if (e.cambioMapa) {
      elNota.hidden = false;
      elNota.textContent = "El mapa cambió en la generación " + e.cambioMapa.gen +
        "; se muestra la evolución desde ahí (esa es la nueva generación 0).";
    } else {
      elNota.hidden = true;
    }
    elTiempo.max = datos.fotos.length - 1;
    actual = datos.gana;
    pintarGaleria();
    mostrar(actual);
    // las etiquetas se ubican cuando el mapa ya tiene tamaño en pantalla
    etiquetas = window.Plano.ubicarEtiquetas(mctx, datos.ciudades, W, H, null, window.Plano.tamEtiqueta(elMoto, W));
    dibujarMoto(0);
  }

  window.Presentacion.registrar("slide-demo-ruta", {
    start: function () { preparar(); },
    stop: function () { pararMoto(); }
  });
})();
