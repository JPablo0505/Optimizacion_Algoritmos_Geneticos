/* =========================================================
   plano.js — plano ILUSTRATIVO de una ciudad para el ejemplo
   del repartidor (no es un mapa real: las posiciones no
   corresponden a la geografía de Medellín).
   · Plano.dibujar(ctx, w, h, semilla): manzanas en cuadrícula,
     dos avenidas, un río en diagonal y parques. Se dibuja UNA
     vez por semilla en un canvas de fondo, nunca en cada cuadro.
   · Plano.NOMBRES: barrios de Medellín y el Valle de Aburrá.
   · Plano.azar(semilla): generador de números pseudoaleatorios
     con semilla (mismo plano para la misma semilla).
   · Plano.pines / Plano.etiquetas: dibujo de barrios y nombres,
     compartido por la demo (slide 11) y la galería (slide 12).
   ========================================================= */
(function () {
  "use strict";

  var NOMBRES = [
    "Laureles", "Belén", "El Poblado", "Robledo", "Castilla", "Aranjuez", "Manrique",
    "Buenos Aires", "La América", "San Javier", "Guayabal", "La Candelaria", "Boston",
    "Prado", "Estadio", "Calasanz", "Floresta", "Simón Bolívar", "Conquistadores",
    "Carlos E. Restrepo", "Manila", "Provenza", "Villa Hermosa", "Santa Cruz", "Popular",
    "Doce de Octubre", "Envigado", "Sabaneta", "Itagüí", "Bello", "La Estrella",
    "Copacabana", "Caldas", "Girardota", "Los Colores", "San Antonio de Prado",
    "Altavista", "Santa Elena", "Belén Rosales", "El Salvador"
  ];

  /* mulberry32: pequeño generador con semilla */
  function azar(semilla) {
    var a = semilla >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- el plano (fondo) ---------- */
  function dibujar(g, w, h, semilla, conNota) {
    var r = azar(semilla);
    g.save();
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#fbfaf6";                        // color de las calles
    g.fillRect(0, 0, w, h);

    // manzanas en cuadrícula, con calles de ancho fijo
    var cel = 42, calle = 7, ang = (r() - 0.5) * 0.12;   // la cuadrícula va un poco girada
    g.translate(w / 2, h / 2);
    g.rotate(ang);
    var ext = Math.max(w, h);
    for (var gx = -ext; gx < ext; gx += cel) {
      for (var gy = -ext; gy < ext; gy += cel) {
        var parque = r() < 0.06;
        g.fillStyle = parque ? "#d9ecd2" : "#eceae2";
        g.fillRect(gx + calle / 2, gy + calle / 2, cel - calle, cel - calle);
        if (parque) {                               // unos árboles
          g.fillStyle = "#bcdcb2";
          for (var k = 0; k < 3; k++) {
            g.beginPath();
            g.arc(gx + 10 + r() * (cel - 20), gy + 10 + r() * (cel - 20), 3.4, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    var dpr = g.canvas.width / w;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // río: una franja curva que cruza en diagonal
    var y0 = h * (0.15 + r() * 0.25), y1 = h * (0.6 + r() * 0.3);
    var cx1 = w * 0.35, cy1 = y0 + (r() - 0.3) * h * 0.6, cx2 = w * 0.65, cy2 = y1 - (r() - 0.3) * h * 0.6;
    function rio() { g.beginPath(); g.moveTo(-20, y0); g.bezierCurveTo(cx1, cy1, cx2, cy2, w + 20, y1); }
    g.lineCap = "round";
    rio(); g.strokeStyle = "#e3eef4"; g.lineWidth = 30; g.stroke();
    rio(); g.strokeStyle = "#cfe2ee"; g.lineWidth = 20; g.stroke();

    // dos avenidas principales (cruzan el río: son los puentes)
    var ax = w * (0.3 + r() * 0.4), ay = h * (0.3 + r() * 0.4);
    function avenida(x1, y1, x2, y2) {
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.strokeStyle = "#f3e3b3"; g.lineWidth = 10; g.stroke();
      g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 1.2; g.setLineDash([8, 7]); g.stroke();
      g.setLineDash([]);
    }
    avenida(ax - 50, -10, ax + 50, h + 10);
    avenida(-10, ay + 30, w + 10, ay - 30);

    // nota discreta: es un plano ilustrativo (los mini-mapas van sin nota)
    if (conNota !== false) {
      var nota = "Plano ilustrativo · distancias en línea recta";
      g.font = '600 17px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      var tw = g.measureText(nota).width;
      g.fillStyle = "rgba(255,255,255,.88)";
      redondeado(g, w - tw - 26, h - 34, tw + 16, 26, 7);
      g.fill();
      g.fillStyle = "#4b5f54";
      g.textBaseline = "middle";
      g.fillText(nota, w - tw - 18, h - 21);
    }
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
     opciones: { visitados: {indice: true}, resaltar: indice } */
  function pines(g, ciudades, op) {
    op = op || {};
    for (var c = 0; c < ciudades.length; c++) {
      var q = ciudades[c];
      if (q.bodega) {                               // la Bodega: una casita
        g.fillStyle = "#08281a";
        g.beginPath();
        g.moveTo(q.x, q.y - 13);
        g.lineTo(q.x + 11, q.y - 3);
        g.lineTo(q.x + 8, q.y - 3);
        g.lineTo(q.x + 8, q.y + 9);
        g.lineTo(q.x - 8, q.y + 9);
        g.lineTo(q.x - 8, q.y - 3);
        g.lineTo(q.x - 11, q.y - 3);
        g.closePath();
        g.fill();
        g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
        g.fillStyle = "#f9a12c";
        g.fillRect(q.x - 3, q.y + 1, 6, 8);
        continue;
      }
      var visto = op.visitados && op.visitados[c];
      g.beginPath();
      g.arc(q.x, q.y, 6, 0, Math.PI * 2);
      g.fillStyle = visto ? "#026937" : "#0e8c7f";
      g.fill();
      g.lineWidth = 2.2;
      g.strokeStyle = "#ffffff";
      g.stroke();
      if (visto) {                                  // ✓ de visitado
        g.strokeStyle = "#fff"; g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(q.x - 3, q.y); g.lineTo(q.x - 0.8, q.y + 2.4); g.lineTo(q.x + 3.2, q.y - 2.4); g.stroke();
      }
      if (op.resaltar === c) {
        g.strokeStyle = "#f9a12c"; g.lineWidth = 2;
        g.beginPath(); g.arc(q.x, q.y, 11, 0, Math.PI * 2); g.stroke();
      }
    }
  }

  /* ---------- etiquetas sin solaparse ----------
     Se ubican una vez (cuando cambian los barrios): cada nombre prueba
     4 posiciones y, si choca con otro, se omite (se ve al pasar el cursor). */
  /* tam = tamaño de letra en unidades del mapa; se elige para que en pantalla
     mida al menos ~14 px (ver tamEtiqueta) */
  function fuente(tam) { return "700 " + (tam || 16) + 'px "Plus Jakarta Sans", "Segoe UI", sans-serif'; }

  /* tamaño de letra (en unidades del mapa) para que en pantalla se vea de ≥ 14 px */
  function tamEtiqueta(canvas, w) {
    var ancho = canvas.getBoundingClientRect().width;
    return ancho ? Math.max(16, Math.ceil(14 * w / ancho)) : 16;
  }

  function ubicarEtiquetas(g, ciudades, w, h, reservado, tam) {
    tam = tam || 16;
    g.save();
    g.font = fuente(tam);
    var puestas = (reservado || []).slice(), out = [];   // "reservado": zonas tapadas (p. ej. una leyenda)
    // la Bodega primero: siempre tiene etiqueta
    var orden = ciudades.map(function (_, i) { return i; })
      .sort(function (a, b) { return (ciudades[b].bodega ? 1 : 0) - (ciudades[a].bodega ? 1 : 0); });
    // los pines también ocupan lugar
    var pinesR = ciudades.map(function (q) { return { x: q.x - 9, y: q.y - 13, w: 18, h: 24 }; });
    orden.forEach(function (i) {
      var q = ciudades[i], txt = q.bodega ? "Bodega" : q.nombre;
      var tw = g.measureText(txt).width + 10, th = Math.round(tam * 1.32);
      var cand = [
        { x: q.x + 11, y: q.y - th / 2 }, { x: q.x - 11 - tw, y: q.y - th / 2 },
        { x: q.x - tw / 2, y: q.y - 16 - th }, { x: q.x - tw / 2, y: q.y + 13 }
      ];
      for (var k = 0; k < cand.length; k++) {
        var rr = { x: cand[k].x, y: cand[k].y, w: tw, h: th };
        if (rr.x < 2 || rr.y < 2 || rr.x + rr.w > w - 2 || rr.y + rr.h > h - 36) continue;
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
    if (extra != null && ciudades[extra]) {           // la del cursor, siempre visible y encima
      var q = ciudades[extra], txt = q.bodega ? "Bodega" : q.nombre;
      var tw = g.measureText(txt).width + 10;
      var x = Math.min(Math.max(q.x - tw / 2, 4), (w || 760) - tw - 4);
      una({ x: x, y: Math.max(4, q.y - 18 - tam * 1.4), w: tw, h: Math.round(tam * 1.38), txt: txt }, q.bodega, true);
    }
    g.restore();
  }

  window.Plano = {
    NOMBRES: NOMBRES,
    azar: azar,
    dibujar: dibujar,
    pines: pines,
    ubicarEtiquetas: ubicarEtiquetas,
    tamEtiqueta: tamEtiqueta,
    etiquetas: etiquetas,
    redondeado: redondeado
  };
})();
