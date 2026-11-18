/* =========================================================
   mapa.js — mapa REAL del Valle de Aburrá para el ejemplo del
   repartidor (slides 11 y 12). Lee window.DATOS_MAPA, que genera
   herramientas/preparar_mapa.py con datos de OpenStreetMap:
   · barrios reales (punto de OSM de cada barrio o centro urbano)
   · vías principales y el río Medellín (fondo del mapa)
   · distancia POR CALLE entre cada par de barrios (Dijkstra sobre
     las vías principales, sin sentidos viales) y el camino de cada
     par como polilínea simplificada.
   Proyección: los datos vienen en metros (x al este, y al norte);
   aquí se escalan al canvas con el norte arriba.

   API (window.Mapa):
   · W, H              tamaño lógico del canvas del mapa
   · pool              barrios disponibles [{ nombre, x, y }] en px del canvas
   · distancia(a, b)   metros por calle entre los barrios a y b del pool
   · trazarCamino(g, a, b, primero)  agrega al trazo el camino a→b
   · camino(a, b)      puntos [x0, y0, x1, y1, …] del camino a→b
   · dibujarFondo(g)   vías y río (se dibuja una vez en un canvas de fondo)
   · pines / ubicarEtiquetas / etiquetas / tamEtiqueta / redondeado
   ========================================================= */
(function () {
  "use strict";

  var D = window.DATOS_MAPA;
  if (!D) { console.error("Falta js/datos-mapa.js (genérelo con herramientas/preparar_mapa.py)"); return; }

  var W = 600;                                       // ancho lógico; el alto sale de la forma real del valle
  var H = Math.round(W * D.alto / D.ancho);
  var S = W / D.ancho;                               // px del canvas por unidad de los datos
  var N = D.barrios.length;

  function px(x) { return x * S; }
  function py(y) { return H - y * S; }               // el norte queda arriba

  var pool = D.barrios.map(function (b) { return { nombre: b.nombre, x: px(b.x), y: py(b.y) }; });

  /* índice del par (i, j), i < j, en los arreglos del triángulo superior */
  function indicePar(i, j) {
    if (i > j) { var t = i; i = j; j = t; }
    return i * N - i * (i + 1) / 2 + (j - i - 1);
  }

  // los caminos se convierten a px una sola vez (Float32Array por par)
  var caminos = D.caminos.map(function (c) {
    var a = new Float32Array(c.length);
    for (var k = 0; k < c.length; k += 2) { a[k] = px(c[k]); a[k + 1] = py(c[k + 1]); }
    return a;
  });

  function distancia(a, b) { return a === b ? 0 : D.dist[indicePar(a, b)]; }

  /* puntos del camino a→b (el guardado va de menor a mayor índice) */
  function camino(a, b) {
    var c = caminos[indicePar(a, b)];
    if (a < b) return c;
    var r = new Float32Array(c.length);
    for (var k = 0; k < c.length; k += 2) { r[k] = c[c.length - 2 - k]; r[k + 1] = c[c.length - 1 - k]; }
    return r;
  }

  /* agrega el camino a→b al trazo actual, sin cerrarlo */
  function trazarCamino(g, a, b, primero) {
    if (a === b) return;
    var c = caminos[indicePar(a, b)], n = c.length, k;
    if (a < b) {
      if (primero) g.moveTo(c[0], c[1]);
      for (k = 2; k < n; k += 2) g.lineTo(c[k], c[k + 1]);
    } else {
      if (primero) g.moveTo(c[n - 2], c[n - 1]);
      for (k = n - 4; k >= 0; k -= 2) g.lineTo(c[k], c[k + 1]);
    }
  }

  /* ---------- fondo: vías reales y río ---------- */
  function lineas(g, lista) {
    g.beginPath();
    for (var i = 0; i < lista.length; i++) {
      var l = lista[i];
      g.moveTo(px(l[0]), py(l[1]));
      for (var k = 2; k < l.length; k += 2) g.lineTo(px(l[k]), py(l[k + 1]));
    }
  }

  function dibujarFondo(g) {
    g.save();
    g.fillStyle = "#f6f5f0";
    g.fillRect(0, 0, W, H);
    g.lineCap = "round";
    g.lineJoin = "round";
    lineas(g, D.rio);                                // el río Medellín
    g.strokeStyle = "#b9d6ea"; g.lineWidth = 4.5; g.stroke();
    lineas(g, D.vias.secundarias);                   // secundarias y terciarias
    g.strokeStyle = "#dcd6c8"; g.lineWidth = 1.3; g.stroke();
    lineas(g, D.vias.principales);                   // autopistas, troncales y primarias
    g.strokeStyle = "#e9d398"; g.lineWidth = 2.6; g.stroke();
    g.restore();
  }

  function redondeado(g, x, y, w, h, rad) {
    g.beginPath();
    g.moveTo(x + rad, y);
    g.arcTo(x + w, y, x + w, y + h, rad);
    g.arcTo(x + w, y + h, x, y + h, rad);
    g.arcTo(x, y + h, x, y, rad);
    g.arcTo(x, y, x + w, y, rad);
    g.closePath();
  }

  /* ---------- pines de los barrios ----------
     opciones: { visitados: {indice: true}, escala: n } */
  function pines(g, ciudades, op) {
    op = op || {};
    var e = op.escala || 1;
    for (var c = 0; c < ciudades.length; c++) {
      var q = ciudades[c];
      if (q.bodega) {                                // la Bodega: una casita
        g.save();
        g.translate(q.x, q.y);
        g.scale(e, e);
        g.fillStyle = "#08281a";
        g.beginPath();
        g.moveTo(0, -13); g.lineTo(11, -3); g.lineTo(8, -3); g.lineTo(8, 9);
        g.lineTo(-8, 9); g.lineTo(-8, -3); g.lineTo(-11, -3);
        g.closePath();
        g.fill();
        g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
        g.fillStyle = "#f9a12c";
        g.fillRect(-3, 1, 6, 8);
        g.restore();
        continue;
      }
      var visto = op.visitados && op.visitados[c];
      g.beginPath();
      g.arc(q.x, q.y, 6 * e, 0, Math.PI * 2);
      g.fillStyle = visto ? "#026937" : "#0e8c7f";
      g.fill();
      g.lineWidth = 2.2 * e;
      g.strokeStyle = "#ffffff";
      g.stroke();
      if (visto) {                                   // ✓ de visitado
        g.strokeStyle = "#fff"; g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(q.x - 3, q.y); g.lineTo(q.x - 0.8, q.y + 2.4); g.lineTo(q.x + 3.2, q.y - 2.4); g.stroke();
      }
    }
  }

  /* ---------- etiquetas sin solaparse ----------
     Se ubican una vez (cuando cambian los barrios): cada nombre prueba
     4 posiciones y, si choca con otro, se omite (se ve al pasar el cursor). */
  function fuente(tam) { return "700 " + (tam || 16) + 'px "Plus Jakarta Sans", "Segoe UI", sans-serif'; }

  /* tamaño de letra (en unidades del canvas) para que en pantalla mida ≥ 14 px */
  function tamEtiqueta(canvas, w) {
    var ancho = canvas.getBoundingClientRect().width;
    return ancho ? Math.max(16, Math.ceil(14 * w / ancho)) : 16;
  }

  function texto(q) { return q.bodega ? "Bodega: " + q.nombre : q.nombre; }

  function ubicarEtiquetas(g, ciudades, w, h, reservado, tam) {
    tam = tam || 16;
    g.save();
    g.font = fuente(tam);
    var puestas = (reservado || []).slice(), out = [];
    var orden = ciudades.map(function (_, i) { return i; })
      .sort(function (a, b) { return (ciudades[b].bodega ? 1 : 0) - (ciudades[a].bodega ? 1 : 0); });
    var pinesR = ciudades.map(function (q) { return { x: q.x - 9, y: q.y - 13, w: 18, h: 24 }; });
    orden.forEach(function (i) {
      var q = ciudades[i], txt = texto(q);
      var tw = g.measureText(txt).width + 10, th = Math.round(tam * 1.32);
      var cand = [
        { x: q.x + 11, y: q.y - th / 2 }, { x: q.x - 11 - tw, y: q.y - th / 2 },
        { x: q.x - tw / 2, y: q.y - 16 - th }, { x: q.x - tw / 2, y: q.y + 13 }
      ];
      for (var k = 0; k < cand.length; k++) {
        var rr = { x: cand[k].x, y: cand[k].y, w: tw, h: th };
        if (rr.x < 2 || rr.y < 2 || rr.x + rr.w > w - 2 || rr.y + rr.h > h - 2) continue;
        if (choca(rr, puestas) || choca(rr, pinesR, i)) continue;
        puestas.push(rr);
        out[i] = { x: rr.x, y: rr.y, w: tw, h: th, txt: txt, tam: tam };
        break;
      }
      if (q.bodega && !out[i]) {                     // la Bodega siempre lleva su nombre
        var bx = Math.min(Math.max(q.x - tw / 2, 2), w - tw - 2), by = Math.max(2, q.y - 18 - th);
        puestas.push({ x: bx, y: by, w: tw, h: th });
        out[i] = { x: bx, y: by, w: tw, h: th, txt: txt, tam: tam };
      }
    });
    g.restore();
    return out;
  }

  function choca(r, lista, salvo) {
    for (var i = 0; i < lista.length; i++) {
      if (i === salvo) continue;
      var o = lista[i];
      if (r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y) return true;
    }
    return false;
  }

  /* dibuja las etiquetas ubicadas; "extra" = índice que se muestra aunque no quepa (cursor);
     w = ancho lógico del mapa */
  function etiquetas(g, ciudades, ubic, extra, w) {
    g.save();
    var tam = 16;
    for (var j = 0; j < ubic.length; j++) if (ubic[j]) { tam = ubic[j].tam; break; }
    g.font = fuente(tam);
    g.textBaseline = "middle";
    function una(e, bodega, fuerte) {
      g.fillStyle = fuerte ? "#08281a" : bodega ? "rgba(8,40,26,.92)" : "rgba(255,255,255,.88)";
      redondeado(g, e.x, e.y, e.w, e.h, 6);
      g.fill();
      g.fillStyle = fuerte || bodega ? "#fff" : "#20352a";
      g.fillText(e.txt, e.x + 5, e.y + e.h / 2 + 1);
    }
    for (var i = 0; i < ciudades.length; i++) {
      if (ubic[i] && i !== extra) una(ubic[i], ciudades[i].bodega, false);
    }
    if (extra != null && ciudades[extra]) {          // la del cursor, siempre visible y encima
      var q = ciudades[extra], txt = texto(q);
      var tw = g.measureText(txt).width + 10;
      var x = Math.min(Math.max(q.x - tw / 2, 4), (w || W) - tw - 4);
      una({ x: x, y: Math.max(4, q.y - 18 - tam * 1.4), w: tw, h: Math.round(tam * 1.38), txt: txt }, q.bodega, true);
    }
    g.restore();
  }

  window.Mapa = {
    W: W, H: H,
    pool: pool,
    fuente: D.fuente,
    distancia: distancia,
    camino: camino,
    trazarCamino: trazarCamino,
    dibujarFondo: dibujarFondo,
    pines: pines,
    ubicarEtiquetas: ubicarEtiquetas,
    etiquetas: etiquetas,
    tamEtiqueta: tamEtiqueta,
    redondeado: redondeado
  };
})();
